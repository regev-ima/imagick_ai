import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import { styleReadyTemplate } from "../_shared/email-templates.ts";
import { sendWhatsAppNotification } from "../_shared/whatsapp.ts";
import { captureException } from "../_shared/sentry.ts";
import { verifyWebhookSecret } from "../_shared/imagick-webhook-auth.ts";
import { autoProcessStyleSource } from "../_shared/style-source.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!(await verifyWebhookSecret(req))) {
      console.warn("Rejecting train-webhook: bad or missing token");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    console.log("Train webhook received:", JSON.stringify(body));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Detect callback type: GD transfer completion vs training API completion
    const isGDTransfer = !!body.file_mappings;

    if (isGDTransfer) {
      // === GD Transfer completed — one of potentially multiple transfers ===
      const { styleId, userId, modelType, transferType } = body.callback_args || {};

      if (!styleId || !userId) {
        console.error("Missing styleId or userId in callback_args");
        return new Response(JSON.stringify({ error: "Missing styleId or userId in callback_args" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // === Harvest this batch's file_mappings into before/after_image_urls ===
      // Drive-imported styles historically left before_image_urls/after_image_urls
      // completely empty (only local uploads populate them in CreateStylePage).
      // body.file_mappings carries { original_name, new_name }[] for the files
      // that just landed in THIS folder's B2 output dir (see gd-transfer-webhook's
      // identical FileMapping shape). Parse it defensively — a malformed shape
      // must never break the transfer-counter/training-kickoff logic below.
      try {
        const fileMappings = Array.isArray(body.file_mappings) ? body.file_mappings : [];
        console.log(
          `file_mappings shape for style ${styleId} (${transferType}): count=${fileMappings.length} sample=${JSON.stringify(fileMappings.slice(0, 3))}`
        );

        if (
          fileMappings.length > 0 &&
          (transferType === "style-before" || transferType === "style-after")
        ) {
          const subDir = transferType === "style-before" ? "before" : "after";
          const outputDir = `styles/${userId}/${styleId}/${subDir}/`;
          const newUrls = fileMappings
            .map((m: any) => (m && typeof m.new_name === "string" ? m.new_name : null))
            .filter((n: string | null): n is string => !!n)
            .map((newName: string) => `https://s3.us-east-005.backblazeb2.com/imagick/${outputDir}${newName}`);

          if (newUrls.length > 0) {
            const column = transferType === "style-before" ? "before_image_urls" : "after_image_urls";
            const otherColumn = column === "before_image_urls" ? "after_image_urls" : "before_image_urls";

            const { data: currentStyle, error: fetchStyleErr } = await supabase
              .from("styles")
              .select("before_image_urls, after_image_urls")
              .eq("id", styleId)
              .single();

            if (fetchStyleErr || !currentStyle) {
              console.error("Failed to fetch style before harvesting file_mappings:", fetchStyleErr);
            } else {
              const existingUrls: string[] = (currentStyle as any)[column] || [];
              const merged = Array.from(new Set([...existingUrls, ...newUrls]));
              const otherUrls: string[] = (currentStyle as any)[otherColumn] || [];

              const { error: harvestUpdateErr } = await supabase
                .from("styles")
                .update({
                  [column]: merged,
                  total_images_imported: merged.length + otherUrls.length,
                })
                .eq("id", styleId);

              if (harvestUpdateErr) {
                console.error("Failed to persist harvested file_mappings URLs:", harvestUpdateErr);
              } else {
                console.log(
                  `Harvested ${newUrls.length} ${transferType} URL(s) for style ${styleId}; ${column} now has ${merged.length} total.`
                );
              }
            }
          }
        }
      } catch (harvestErr) {
        console.error("Non-fatal: failed to harvest file_mappings into image URL arrays:", harvestErr);
      }

      console.log(`GD transfer (${transferType}) complete for style ${styleId}. Incrementing counter...`);

      // Atomically increment the completed counter
      const { error: rpcError } = await supabase.rpc("increment_style_transfer_completed", {
        p_style_id: styleId,
      });

      if (rpcError) {
        console.error("Failed to increment transfer counter:", rpcError);
        // Fallback: try direct update
        await supabase
          .from("styles")
          .update({
            import_completion_date: new Date().toISOString(),
          })
          .eq("id", styleId);
      }

      // Read back the updated style to check if all transfers are done
      const { data: style, error: fetchError } = await supabase
        .from("styles")
        .select("import_transfers_total, import_transfers_completed")
        .eq("id", styleId)
        .single();

      if (fetchError || !style) {
        console.error("Failed to fetch style after increment:", fetchError);
        return new Response(JSON.stringify({ error: "Failed to read style" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { import_transfers_total, import_transfers_completed } = style;
      console.log(`Style ${styleId}: transfers ${import_transfers_completed}/${import_transfers_total}`);

      if (import_transfers_completed >= import_transfers_total && import_transfers_total > 0) {
        // All transfers done — attempt atomic status transition to prevent duplicate triggers
        console.log(`All transfers complete for style ${styleId}. Attempting atomic training trigger...`);

        const { data: transitioned, error: transitionError } = await supabase
          .from("styles")
          .update({
            status: "training",
            import_completion_date: new Date().toISOString(),
          })
          .eq("id", styleId)
          .eq("status", "importing")
          .select("id");

        if (transitionError || !transitioned || transitioned.length === 0) {
          console.log(`Style ${styleId}: status already transitioned, skipping duplicate training trigger`);
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const beforeDir = `styles/${userId}/${styleId}/before/`;
        const afterDir = `styles/${userId}/${styleId}/after/`;

        const trainResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/train-style`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              styleId,
              userId,
              modelType: modelType || "event",
              beforeDirs: [beforeDir],
              afterDirs: [afterDir],
            }),
          }
        );

        if (!trainResponse.ok) {
          const errorText = await trainResponse.text();
          console.error("Failed to trigger train-style:", errorText);

          await supabase
            .from("styles")
            .update({
              status: "error",
              error_details: [`Failed to start training: ${errorText}`],
            })
            .eq("id", styleId);
        } else {
          console.log(`Training triggered for style ${styleId}`);
        }
      } else {
        console.log(`Style ${styleId}: waiting for more transfers (${import_transfers_completed}/${import_transfers_total})`);
      }
    } else {
      // === Training API completion callback ===
      const { styleId, userId, status, error: errorMsg } = body;
      const callbackStyleId = styleId || body.callbackArgs?.styleId;
      const callbackUserId = userId || body.callbackArgs?.userId;

      if (!callbackStyleId) {
        console.error("Missing styleId in training completion callback");
        return new Response(JSON.stringify({ error: "Missing styleId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (status === "error" || errorMsg) {
        await supabase
          .from("styles")
          .update({
            status: "error",
            error_details: [errorMsg || "Training failed"],
          })
          .eq("id", callbackStyleId);

        console.log(`Style ${callbackStyleId} marked as error`);
      } else {
        const styleIdExternal = body.style_id_external || body.output?.style_id || null;
        const completionDate = new Date().toISOString();

        const updateData: Record<string, unknown> = {
          status: "ready",
          training_completion_date: completionDate,
        };

        if (styleIdExternal) {
          updateData.style_id_external = styleIdExternal;
        }

        await supabase
          .from("styles")
          .update(updateData)
          .eq("id", callbackStyleId);

        console.log(`Style ${callbackStyleId} marked as ready, external ID: ${styleIdExternal}`);

        // Send "style ready" email + WhatsApp (fire-and-forget)
        if (callbackUserId) {
          sendStyleReadyEmail(supabase, callbackStyleId, callbackUserId).catch(err =>
            console.error("sendStyleReadyEmail error:", err)
          );

          // WhatsApp notification with training duration
          (async () => {
            try {
              const { data: styleData } = await supabase
                .from("styles")
                .select("name, training_start_date")
                .eq("id", callbackStyleId)
                .single();
              
              const { data: userRecord } = await supabase.auth.admin.getUserById(callbackUserId);
              const email = userRecord?.user?.email || "unknown";
              const name = userRecord?.user?.user_metadata?.full_name || email;

              let durationStr = "";
              if (styleData?.training_start_date) {
                const startMs = new Date(styleData.training_start_date).getTime();
                const endMs = new Date(completionDate).getTime();
                const totalSec = Math.round((endMs - startMs) / 1000);
                const mins = Math.floor(totalSec / 60);
                const secs = totalSec % 60;
                durationStr = `\nDuration: ${mins}m ${secs}s`;
              }

              await sendWhatsAppNotification(
                `✅ Style Training Complete\nStyle: ${styleData?.name || callbackStyleId}\nUser: ${name} (${email})${durationStr}`
              );
            } catch (e) { console.error("WhatsApp notify error:", e); }
          })();
        }

        // === Auto-process showcase images for this newly ready style ===
        try {
          await autoProcessShowcase(supabase, callbackStyleId);
        } catch (showcaseErr) {
          console.error("Error in auto-process showcase:", showcaseErr);
          // Non-fatal — don't fail the webhook
        }

        // === Auto-edit the style's own SOURCE collection (req 2) ===
        // Materializes the style's BEFORE set as a hidden gallery and runs
        // the freshly trained model over it, so the three-way compare
        // (source · photographer's edit · model's edit) has data to show.
        try {
          await autoProcessStyleSource(
            supabase,
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            callbackStyleId,
          );
        } catch (sourceErr) {
          console.error("Error in auto-process style source:", sourceErr);
          // Non-fatal — don't fail the webhook
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in train-webhook:", error);
    await captureException(error, { tags: { fn: "train-webhook" } });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Find the __showcase__ gallery, get its images, check which ones
 * don't already have edits for this style, and trigger process-images.
 */
async function autoProcessShowcase(supabase: any, styleId: string) {
  // Find the showcase gallery
  const { data: gallery } = await supabase
    .from("galleries")
    .select("id, user_id")
    .eq("name", "__showcase__")
    .maybeSingle();

  if (!gallery) {
    console.log("No __showcase__ gallery found, skipping auto-process");
    return;
  }

  // Get all non-deleted images in showcase
  const { data: images } = await supabase
    .from("gallery_images")
    .select("id")
    .eq("gallery_id", gallery.id)
    .neq("status", "deleted");

  if (!images || images.length === 0) {
    console.log("No images in __showcase__ gallery, skipping auto-process");
    return;
  }

  const imageIds = images.map((img: any) => img.id);

  // Check which images already have edits for this style
  const { data: existingEdits } = await supabase
    .from("image_edits")
    .select("image_id")
    .eq("style_id", styleId)
    .in("image_id", imageIds);

  const processedSet = new Set((existingEdits || []).map((e: any) => e.image_id));
  const unprocessedIds = imageIds.filter((id: string) => !processedSet.has(id));

  if (unprocessedIds.length === 0) {
    console.log(`All showcase images already processed for style ${styleId}`);
    return;
  }

  console.log(`Auto-processing ${unprocessedIds.length} showcase images for style ${styleId}`);

  // Call process-images edge function
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-images`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        galleryId: gallery.id,
        imageIds: unprocessedIds,
        styleIds: [styleId],
        userId: gallery.user_id,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to trigger showcase processing:", errorText);
  } else {
    console.log(`Showcase processing triggered for style ${styleId}`);
  }
}

async function sendStyleReadyEmail(supabase: any, styleId: string, userId: string) {
  // Fetch style name
  const { data: style } = await supabase
    .from("styles")
    .select("name")
    .eq("id", styleId)
    .single();
  if (!style) return;

  // Fetch user email
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const { createClient: mkClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const adminClient = mkClient(supabaseUrl, serviceKey);

  const { data: userRecord } = await adminClient.auth.admin.getUserById(userId);
  if (!userRecord?.user?.email) return;

  const appUrl   = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");
  const styleUrl = `${appUrl}/dashboard/styles/${styleId}`;
  const template = styleReadyTemplate(style.name, styleUrl);

  await sendEmail({
    to:           userRecord.user.email,
    subject:      template.subject,
    html:         template.html,
    emailType:    "style_ready",
    userId,
    metadata:     { styleId, styleName: style.name },
    supabaseAdmin: adminClient,
  });
}
