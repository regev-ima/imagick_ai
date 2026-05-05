// Webhook endpoint to receive processing results from Imagick API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import { galleryImagesReadyTemplate } from "../_shared/email-templates.ts";
import { sendWhatsAppNotification } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SHOWCASE_GALLERY_NAME = "__showcase__";

interface WebhookPayload {
  imageId?: string;
  galleryId?: string;
  userId?: string;
  styleId?: string;
  styleName?: string;
  styleMap?: Record<string, { id: string; name: string }>;
  im?: string;
  editedImagePath?: string;
  URL?: string;
  PhotoID?: string;
  Status?: string;
  Model?: string;
  error?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json() as WebhookPayload;
    console.log("Webhook received:", JSON.stringify(body, null, 2));

    const { imageId, galleryId, userId, styleId: rawStyleId, styleName: rawStyleName, styleMap, error: webhookError } = body;

    // Resolve styleId/styleName: prefer styleMap lookup via Model field, fallback to URL path extraction
    let styleId = rawStyleId;
    let styleName = rawStyleName;
    if (styleMap && body.Model && styleMap[body.Model]) {
      styleId = styleMap[body.Model].id;
      styleName = styleMap[body.Model].name;
      console.log(`Resolved style from styleMap: Model=${body.Model} -> styleId=${styleId}, styleName=${styleName}`);
    }

    // Fallback: extract style external ID from the edited image URL path
    // URL pattern: .../galleries/{userId}/{galleryId}/{styleExternalId}/{imageFile}.jpeg
    const editedUrl = body.im || body.editedImagePath || body.URL;
    if (!styleId && styleMap && editedUrl) {
      for (const key of Object.keys(styleMap)) {
        if (editedUrl.includes(`/${key}/`)) {
          styleId = styleMap[key].id;
          styleName = styleMap[key].name;
          console.log(`Resolved style from URL path: key=${key} -> styleId=${styleId}, styleName=${styleName}`);
          break;
        }
      }
    }

    if (!imageId || !galleryId) {
      console.error("Missing imageId or galleryId in webhook payload");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle error case
    if (webhookError) {
      console.error("Webhook reported error for image", imageId, ":", webhookError);
      await supabase
        .from("gallery_images")
        .update({
          status: "error",
          last_processing_error: String(webhookError).substring(0, 500),
          last_processing_attempt_at: new Date().toISOString(),
        })
        .eq("id", imageId);

      return new Response(
        JSON.stringify({ success: false, error: webhookError }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the edited image URL from various possible fields
    // editedUrl already resolved above (line ~60), re-use it
    // const editedUrl was moved up for style resolution

    if (!editedUrl) {
      console.error("No edited image URL in webhook payload for image", imageId);
      await supabase
        .from("gallery_images")
        .update({
          status: "error",
          last_processing_error: "No edited image URL in webhook response",
          last_processing_attempt_at: new Date().toISOString(),
        })
        .eq("id", imageId);

      return new Response(
        JSON.stringify({ success: false, error: "No edited image URL" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the image with the edited URL (backwards compat - latest edit wins)
    const { data: imageRow, error: updateError } = await supabase
      .from("gallery_images")
      .update({ 
        edited_url: editedUrl,
        status: "ready"
      })
      .eq("id", imageId)
      .select("original_url")
      .single();

    if (updateError) {
      console.error("Error updating image", imageId, ":", updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert into image_edits table for multi-style tracking (idempotent)
    if (styleId) {
      const { error: editInsertError } = await supabase
        .from("image_edits")
        .upsert({
          image_id: imageId,
          gallery_id: galleryId,
          user_id: userId || "",
          style_id: styleId,
          style_name: styleName || null,
          edited_url: editedUrl,
        }, { onConflict: "image_id,style_id" });
      if (editInsertError) {
        console.error("Error upserting image_edit:", editInsertError);
      } else {
        console.log("Upserted image_edit for image", imageId, "style", styleName);
      }
    }

    console.log("Successfully updated image", imageId, "with edited URL:", editedUrl);

    // Log credit usage — 1 credit per image×style callback (deduplicated)
    if (userId) {
      const logDescription = `AI edit for image ${imageId}${styleName ? ` (${styleName})` : ''}`;

      // Check if credit already logged for this image+style to prevent duplicate charges
      const { data: existingLog } = await supabase
        .from("edit_usage_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("description", logDescription)
        .maybeSingle();

      if (!existingLog) {
        const { error: creditLogError } = await supabase
          .from("edit_usage_logs")
          .insert({
            user_id: userId,
            action_type: "ai_edit",
            edits_spent: 1,
            gallery_id: galleryId,
            description: logDescription,
          });
        if (creditLogError) {
          console.error("Failed to log credit usage:", creditLogError);
        } else {
          console.log(`Credit usage logged for user ${userId}: 1 credit`);
        }
      } else {
        console.log(`Skipping duplicate credit log for image ${imageId} style ${styleName || 'default'}`);
      }

      // Decrement gallery-level reservation counter
      // (user_subscriptions.edits_reserved is handled by the DB trigger)
      const { data: galleryForReserve } = await supabase
        .from("galleries")
        .select("edits_reserved")
        .eq("id", galleryId)
        .single();

      if (galleryForReserve && (galleryForReserve.edits_reserved || 0) > 0) {
        await supabase
          .from("galleries")
          .update({ edits_reserved: Math.max(0, (galleryForReserve.edits_reserved || 0) - 1) })
          .eq("id", galleryId);
      }

      // Check edit thresholds for free users (warning emails)
      try {
        const { data: sub } = await supabase
          .from("user_subscriptions")
          .select("edits_remaining, plan_id, subscription_plans!inner(slug)")
          .eq("user_id", userId)
          .single();

        const planSlug = (sub as any)?.subscription_plans?.slug;
        const remaining = sub?.edits_remaining;

        if (planSlug === "free" && remaining !== null && remaining !== undefined) {
          if (remaining === 500 || remaining === 100 || remaining === 0) {
            const emailType = remaining === 0 ? "edits_exhausted" : `edits_warning_${remaining}`;
            // Fire-and-forget: send warning email
            const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;
            fetch(sendEmailUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ type: emailType, userId, remaining }),
            }).catch(err => console.error("Failed to trigger edit warning email:", err));

            // WhatsApp notification for edits exhausted
            if (remaining === 0) {
              const { data: userRecord } = await supabase.auth.admin.getUserById(userId);
              const userName = userRecord?.user?.user_metadata?.full_name || userRecord?.user?.email?.split("@")[0] || "Unknown";
              const msg = `⚠️ Free Edits Exhausted\nUser: ${userName} (${userRecord?.user?.email})\nAll 3,000 free edits used up.`;
              sendWhatsAppNotification(msg).catch((err: any) => console.error("WhatsApp notification failed:", err));
            }
          }
        }
      } catch (err) {
        console.error("Failed to check edit thresholds:", err);
      }
    }

    // Trigger EXIF extraction asynchronously (fire and forget)
    if (imageRow?.original_url) {
      const extractExifUrl = `${supabaseUrl}/functions/v1/extract-exif`;
      fetch(extractExifUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ imageId, imageUrl: imageRow.original_url }),
      }).catch(err => console.error("Failed to trigger EXIF extraction:", err));
    }

    // Check if all images in the gallery are processed — use COUNT queries to avoid 1000-row cap
    const [totalRes, readyRes, processingRes, errorRes] = await Promise.all([
      supabase.from("gallery_images").select("*", { count: "exact", head: true }).eq("gallery_id", galleryId).neq("status", "deleted"),
      supabase.from("gallery_images").select("*", { count: "exact", head: true }).eq("gallery_id", galleryId).eq("status", "ready"),
      supabase.from("gallery_images").select("*", { count: "exact", head: true }).eq("gallery_id", galleryId).eq("status", "processing"),
      supabase.from("gallery_images").select("*", { count: "exact", head: true }).eq("gallery_id", galleryId).eq("status", "error"),
    ]);

    const totalCount = totalRes.count ?? 0;
    const readyCount = readyRes.count ?? 0;
    const processingCount = processingRes.count ?? 0;
    const errorCount = errorRes.count ?? 0;
    const fetchError = totalRes.error || readyRes.error;

    if (!fetchError && totalCount > 0) {
      const allReady = readyCount === totalCount;
      const someError = errorCount > 0;

      console.log(`Gallery ${galleryId} status: ${readyCount}/${totalCount} ready, ${processingCount} processing, ${errorCount} errors`);

      // Update gallery status based on images
      if (allReady || (someError && processingCount === 0)) {
        // Read current state for reservation release info
        const { data: galleryBefore } = await supabase
          .from("galleries")
          .select("status, edits_reserved")
          .eq("id", galleryId)
          .single();

        // Atomic update: .neq("status", "ready") ensures only the FIRST webhook to
        // transition the status gets a row back — all concurrent ones get null.
        const { data: galleryAfter } = await supabase
          .from("galleries")
          .update({
            status: "ready",
            processed_images: readyCount,
            processing_completed_at: new Date().toISOString(),
          })
          .eq("id", galleryId)
          .neq("status", "ready")
          .select("status")
          .maybeSingle();

        // Only the webhook that actually transitioned the status runs post-transition logic
        if (galleryAfter) {
          // Release any remaining gallery reservation (from errors/skipped images)
          if (galleryBefore && (galleryBefore.edits_reserved || 0) > 0 && userId) {
            await supabase.rpc("release_gallery_reservation", {
              p_gallery_id: galleryId,
              p_user_id: userId,
            });
            console.log(`Released remaining reservation (${galleryBefore.edits_reserved}) for gallery ${galleryId}`);
          }

          // Send "gallery ready" email + WhatsApp exactly once
          if (userId) {
            sendGalleryReadyEmail(supabase, galleryId, userId, readyCount, supabaseUrl).catch(err =>
              console.error("sendGalleryReadyEmail error:", err)
            );
          }
        }

        // === Auto-apply showcase results to style ===
        // Check if this is the showcase gallery and auto-update style before/after
        if (styleId) {
          try {
            await autoApplyShowcaseToStyle(supabase, galleryId, styleId);
          } catch (err) {
            console.error("Error in auto-apply showcase:", err);
          }
        }

        // Check if gallery is still importing folders before triggering culling
        const { data: importStatus } = await supabase
          .from("galleries")
          .select("import_folders_total, import_folders_completed, status")
          .eq("id", galleryId)
          .single();

        const stillImporting = importStatus && 
          importStatus.import_folders_total > 0 && 
          importStatus.import_folders_completed < importStatus.import_folders_total;

        if (stillImporting || importStatus?.status === "transferring") {
          console.log("Skipping culling - gallery still importing folders");
        } else {
          // Fetch culling settings now that we know import is complete
          const { data: galleryData } = await supabase
            .from("galleries")
            .select("ai_culling_enabled, culling_status, culling_labels")
            .eq("id", galleryId)
            .single();

          if (galleryData?.ai_culling_enabled && galleryData?.culling_status !== "processing") {
          console.log("AI culling enabled, triggering grouping for gallery:", galleryId);
          
          await supabase
            .from("galleries")
            .update({ culling_status: "processing" })
            .eq("id", galleryId);

          const apiUsername = Deno.env.get("IMAGICK_API_USERNAME")!;
          const apiPassword = Deno.env.get("IMAGICK_API_PASSWORD")!;
          const apiEndpoint = "https://imagick-api-endpoint.rx8rq49b5c.workers.dev/make-grouping/";
          const webhookUrl = `${supabaseUrl}/functions/v1/grouping-webhook`;

          const groupingRequest = {
            collectionId: galleryId,
            thresholds: [0.5, 0.7, 0.9],
            timeThreshold: 60,
            labels: galleryData.culling_labels || [],
            callbackURL: webhookUrl,
            callbackArgs: { 
              galleryId, 
              userId 
            },
            callbackHeaders: {}
          };

          try {
            const groupingResponse = await fetch(apiEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Username": apiUsername,
                "Password": apiPassword,
              },
              body: JSON.stringify(groupingRequest),
            });

            if (!groupingResponse.ok) {
              console.error("Failed to start grouping:", await groupingResponse.text());
              await supabase
                .from("galleries")
                .update({ culling_status: "idle" })
                .eq("id", galleryId);
            } else {
              console.log("Grouping started successfully for gallery:", galleryId);
            }
          } catch (groupingError) {
            console.error("Error calling grouping API:", groupingError);
            await supabase
              .from("galleries")
              .update({ culling_status: "idle" })
              .eq("id", galleryId);
          }
          }
        }
      } else {
        await supabase
          .from("galleries")
          .update({ processed_images: readyCount })
          .eq("id", galleryId);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in image-webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * When a showcase gallery finishes processing for a style,
 * auto-update that style's before_image_urls and after_image_urls.
 */
async function autoApplyShowcaseToStyle(supabase: any, galleryId: string, styleId: string) {
  // Check if this gallery is the showcase gallery
  const { data: gallery } = await supabase
    .from("galleries")
    .select("name")
    .eq("id", galleryId)
    .single();

  if (!gallery || gallery.name !== SHOWCASE_GALLERY_NAME) return;

  console.log(`Showcase gallery processing complete for style ${styleId}, auto-applying results...`);

  // Get all showcase images
  const { data: images } = await supabase
    .from("gallery_images")
    .select("id, original_url")
    .eq("gallery_id", galleryId)
    .neq("status", "deleted")
    .order("sort_order");

  if (!images || images.length === 0) return;

  // Get all edits for this style in this gallery
  const { data: edits } = await supabase
    .from("image_edits")
    .select("image_id, edited_url")
    .eq("gallery_id", galleryId)
    .eq("style_id", styleId);

  if (!edits || edits.length === 0) return;

  const editMap = new Map(edits.map((e: any) => [e.image_id, e.edited_url]));

  // Build aligned before/after arrays
  // Use thumbnail URL for "before" so RAW files display as WebP
  const beforeUrls: string[] = [];
  const afterUrls: string[] = [];

  for (const img of images) {
    const editedUrl = editMap.get(img.id);
    if (editedUrl) {
      // Build thumbnail URL inline (same logic as getThumbnailUrl)
      const originalUrl = img.original_url as string;
      beforeUrls.push(buildThumbnailUrl(originalUrl));
      afterUrls.push(editedUrl as string);
    }
  }

  if (beforeUrls.length === 0) return;

  const updateData: Record<string, unknown> = {
    before_image_urls: beforeUrls,
    after_image_urls: afterUrls,
  };

  // Set thumbnail if style doesn't have one
  const { data: styleData } = await supabase
    .from("styles")
    .select("thumbnail_url")
    .eq("id", styleId)
    .single();

  if (!styleData?.thumbnail_url && afterUrls.length > 0) {
    updateData.thumbnail_url = afterUrls[0];
  }

  const { error } = await supabase
    .from("styles")
    .update(updateData)
    .eq("id", styleId);

  if (error) {
    console.error(`Failed to auto-apply showcase to style ${styleId}:`, error);
  } else {
    console.log(`Auto-applied ${beforeUrls.length} before/after pairs to style ${styleId}`);
  }
}

/**
 * Send a "gallery is ready" email to the gallery owner.
 * Skips showcase galleries and handles missing user data gracefully.
 */
async function sendGalleryReadyEmail(supabase: any, galleryId: string, userId: string, readyCount: number, supabaseUrl: string) {
  // Fetch gallery name + check it's not the showcase gallery
  const { data: gallery } = await supabase
    .from("galleries")
    .select("name, user_id")
    .eq("id", galleryId)
    .single();

  if (!gallery || gallery.name === SHOWCASE_GALLERY_NAME) return;

  // Fetch user email via auth.admin (service role)
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const { createClient: createAdminClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const adminClient = createAdminClient(supabaseUrl, serviceKey);

  const { data: userRecord } = await adminClient.auth.admin.getUserById(userId);
  if (!userRecord?.user?.email) return;

  const appUrl    = (Deno.env.get("STUDIO_URL") || "https://studio.imagick.ai").replace(/\/+$/, "");
  const galleryUrl = `${appUrl}/dashboard/galleries/${galleryId}`;
  const template   = galleryImagesReadyTemplate(gallery.name, readyCount, galleryUrl);

  await sendEmail({
    to:           userRecord.user.email,
    subject:      template.subject,
    html:         template.html,
    emailType:    "gallery_images_ready",
    userId,
    metadata:     { galleryId, readyCount },
    supabaseAdmin: adminClient,
  });

  // WhatsApp notification for new collection ready
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const userName = userRecord.user.user_metadata?.full_name || userRecord.user.email?.split("@")[0] || "Unknown";
  const msg = `📸 New Collection\nName: ${gallery.name}\nPhotos: ${readyCount}\nPhotographer: ${userName} (${userRecord.user.email})\nDate: ${dateStr}`;
  sendWhatsAppNotification(msg).catch((err: any) => console.error("WhatsApp notification failed:", err));
}

/**
 * Build a thumbnail URL from an original B2 URL.
 * Mirrors the logic from src/lib/imageUrls.ts getThumbnailUrl.
 */
function buildThumbnailUrl(originalUrl: string): string {
  const B2_BASE = "https://s3.us-east-005.backblazeb2.com/imagick";
  
  let path = originalUrl;
  if (originalUrl.startsWith(B2_BASE)) {
    path = originalUrl.replace(B2_BASE + "/", "");
  } else if (originalUrl.startsWith("https://")) {
    try {
      const urlObj = new URL(originalUrl);
      path = urlObj.pathname.replace(/^\/file\/imagick\//, "");
    } catch {
      return originalUrl;
    }
  }

  const lastSlash = path.lastIndexOf("/");
  const basePath = lastSlash > 0 ? path.substring(0, lastSlash) : "";
  const fullFilename = lastSlash > 0 ? path.substring(lastSlash + 1) : path;
  const lastDot = fullFilename.lastIndexOf(".");
  const filename = lastDot > 0 ? fullFilename.substring(0, lastDot) : fullFilename;

  return `${B2_BASE}/${basePath}/thumbnail/${filename}_reduced_thumbnail.webp`;
}
