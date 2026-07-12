// Edge function to call Imagick API for AI image processing
// Hardened orchestration: count-based chaining, per-image error handling, retry logic
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const IMAGICK_API_URL = "https://imagick-api-endpoint.rx8rq49b5c.workers.dev";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

// Max images per invocation — keeps runtime well under 150s limit
const CHUNK_LIMIT = 300;
// Time budget: stop sending new batches after this many ms
const TIME_BUDGET_MS = 110_000;
// Max processing attempts per image before marking as permanent error
const MAX_ATTEMPTS = 3;

interface ProcessImagesRequest {
  galleryId: string;
  imageIds?: string[];
  styleIds: string[];
  collectionId?: string;
  requestBatchSize?: number;
  userId?: string; // for internal calls
}

interface ProcessImageResult {
  imageId: string;
  styleId: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    let supabase;

    if (token === supabaseServiceKey) {
      if (!body.userId) {
        return new Response(
          JSON.stringify({ error: "userId required for internal calls" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = body.userId;
      supabase = createClient(supabaseUrl, supabaseServiceKey);
      console.log("Internal call for user:", userId);
    } else {
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = userData.user.id;
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Is the (non-internal) caller an admin? Admins operate galleries they
    // don't own — chiefly the shared __showcase__ gallery, which belongs to
    // one account but every admin manages it. Without this the owner filter
    // below 404s ("Gallery not found or access denied") and the Showcase
    // Manager's "Process" buttons all fail.
    let isAdminCaller = false;
    if (token !== supabaseServiceKey) {
      const { data: adm } = await supabaseAdmin.rpc("is_admin", { _user_id: userId });
      isAdminCaller = !!adm;
    }

    // Get Imagick API credentials
    const username = Deno.env.get("IMAGICK_API_USERNAME");
    const password = Deno.env.get("IMAGICK_API_PASSWORD");
    if (!username || !password) {
      console.error("Missing IMAGICK_API_USERNAME or IMAGICK_API_PASSWORD");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { galleryId, imageIds, styleIds, collectionId, requestBatchSize } =
      body as ProcessImagesRequest;

    const DEFAULT_REQUEST_BATCH_SIZE = 25;
    const parsedRequestBatchSize = requestBatchSize === undefined
      ? DEFAULT_REQUEST_BATCH_SIZE
      : Number(requestBatchSize);

    if (!galleryId || !styleIds || !Array.isArray(styleIds)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: galleryId, styleIds" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!Number.isInteger(parsedRequestBatchSize) || parsedRequestBatchSize < 1) {
      return new Response(
        JSON.stringify({ error: "requestBatchSize must be a positive integer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify access to the gallery. Owner (or internal service call) always;
    // admins may operate any gallery (e.g. the shared showcase). Use the admin
    // client so RLS never hides a foreign gallery from a legitimate admin.
    let galleryQuery = supabaseAdmin
      .from("galleries")
      .select("id, name, user_id")
      .eq("id", galleryId);
    if (token !== supabaseServiceKey && !isAdminCaller) {
      galleryQuery = galleryQuery.eq("user_id", userId);
    }
    const { data: gallery, error: galleryError } = await galleryQuery.single();

    if (galleryError || !gallery) {
      return new Response(
        JSON.stringify({ error: "Gallery not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // When an admin drives a gallery they don't own (the showcase), attribute
    // the edits + any credit reservation to the gallery's OWNER — never to the
    // admin. The showcase owner is a system/unlimited account, so this also
    // means showcase processing is never charged to a person.
    if (isAdminCaller && gallery.user_id && gallery.user_id !== userId) {
      userId = gallery.user_id;
    }

    // ── Fetch styles & resolve each to its ENGINE key — uniqueness is mandatory ──
    // This must happen BEFORE fetching images: the "images missing edits"
    // query, the reservation, the chain and the remaining-count must all speak
    // in terms of styles that can actually be dispatched.
    //
    // The editing engine identifies a look by style_id_external; the webhook
    // maps results back through that key and the edited file's storage path is
    // keyed by it too. A style with NO trained model used to fall back to the
    // shared legacy key "1" — selecting several model-less looks collapsed
    // them onto ONE key: the engine edited once, the result was attributed to
    // whichever style won the map, the other looks silently never happened,
    // and worse — the missing-edits counter kept seeing them as "todo" and
    // chained invocations forever. Now: first claim per key wins (keeps the
    // legacy single-"1" fallback working), the rest are REJECTED loudly and
    // excluded from dispatch, billing, gallery merge and chaining.
    const { data: styles, error: stylesError } = await supabase
      .from("styles")
      .select("id, name, style_id_external")
      .in("id", styleIds);

    if (stylesError || !styles || styles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No styles found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const usableStyles: typeof styles = [];
    const rejectedStyles: { id: string; name: string; reason: string }[] = [];
    {
      const claimedKeys = new Set<string>();
      for (const s of styles) {
        const key = s.style_id_external || "1";
        if (claimedKeys.has(key)) {
          rejectedStyles.push({
            id: s.id,
            name: s.name,
            reason: s.style_id_external
              ? `duplicate engine key ${key}`
              : "no trained model attached (style_id_external is empty) — the look cannot be applied",
          });
          continue;
        }
        claimedKeys.add(key);
        usableStyles.push(s);
      }
    }
    if (rejectedStyles.length > 0) {
      console.error(
        `process-images: ${rejectedStyles.length} style(s) rejected for gallery ${galleryId}:`,
        rejectedStyles.map((r) => `${r.name} (${r.reason})`).join("; "),
      );
    }
    if (usableStyles.length === 0) {
      return new Response(
        JSON.stringify({
          error: "no_deployable_styles",
          message: "None of the selected styles has a trained model attached — nothing can be edited.",
          rejectedStyles,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const usableStyleIds = usableStyles.map((s) => s.id);

    // ── Fetch images to process ──
    let images: { id: string; original_url: string; filename: string; processing_attempts: number }[] | null = null;
    let imagesError: unknown = null;

    if (imageIds && Array.isArray(imageIds) && imageIds.length > 0) {
      // Explicit image IDs provided (e.g. re-edit)
      console.log(`Fetching ${imageIds.length} images by ID`);
      const IN_BATCH = 100;
      const allFetched: { id: string; original_url: string; filename: string; processing_attempts: number }[] = [];
      for (let i = 0; i < imageIds.length; i += IN_BATCH) {
        const batch = imageIds.slice(i, i + IN_BATCH);
        const { data, error } = await supabaseAdmin
          .from("gallery_images")
          .select("id, original_url, filename, processing_attempts")
          .eq("gallery_id", galleryId)
          .in("id", batch);
        if (error) { imagesError = error; break; }
        if (data) allFetched.push(...data);
      }
      images = allFetched.length > 0 ? allFetched : null;
    } else {
      // Step 1: Query images still in "processing" status (highest priority)
      console.log(`Fetching processing images for gallery ${galleryId} (limit: ${CHUNK_LIMIT})`);
      const { data: processingData, error: processingError } = await supabaseAdmin
        .from("gallery_images")
        .select("id, original_url, filename, processing_attempts")
        .eq("gallery_id", galleryId)
        .in("status", ["processing", "uploading"])
        .lt("processing_attempts", MAX_ATTEMPTS)
        .order("processing_attempts", { ascending: true })
        .order("id", { ascending: true })
        .limit(CHUNK_LIMIT);

      if (processingError) {
        imagesError = processingError;
      } else {
        const processingImages = processingData || [];
        console.log(`Found ${processingImages.length} processing images`);

        // Step 2: If we have room, also fetch "ready" images missing edits for
        // the DISPATCHABLE styles only — counting rejected styles here would
        // re-fetch forever (their edits can never arrive).
        const remaining = CHUNK_LIMIT - processingImages.length;
        if (remaining > 0 && usableStyleIds.length > 0) {
          console.log(`Fetching up to ${remaining} ready images missing edits for ${usableStyleIds.length} styles`);
          const { data: readyData, error: readyError } = await supabaseAdmin
            .rpc("get_images_missing_edits", {
              p_gallery_id: galleryId,
              p_style_ids: usableStyleIds,
              p_limit: remaining,
            });

          if (readyError) {
            console.error("Error fetching ready images missing edits:", readyError);
          } else {
            const readyImages = readyData || [];
            console.log(`Found ${readyImages.length} ready images missing edits`);
            // Merge: processing first, then ready missing edits
            const allImages = [...processingImages, ...readyImages];
            images = allImages.length > 0 ? allImages : null;
          }
        }

        if (!images) {
          images = processingImages.length > 0 ? processingImages : null;
        }
      }
    }

    if (imagesError || !images || images.length === 0) {
      console.log("No images to process:", imagesError, "count:", images?.length);
      return new Response(
        JSON.stringify({ error: "No images found to process" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Fetched ${images.length} images to process`);

    const { appendWebhookSecret } = await import("../_shared/imagick-webhook-auth.ts");
    const webhookUrl = appendWebhookSecret(`${supabaseUrl}/functions/v1/image-webhook`);

    // Check existing edits to skip duplicates
    const fetchedImageIds = images.map((img) => img.id);
    const { data: existingEdits } = await supabaseAdmin
      .from("image_edits")
      .select("image_id, style_id")
      .in("image_id", fetchedImageIds)
      .in("style_id", usableStyleIds);

    const existingCombos = new Set<string>();
    for (const edit of existingEdits || []) {
      if (edit.image_id && edit.style_id) {
        existingCombos.add(`${edit.image_id}:${edit.style_id}`);
      }
    }
    console.log("Existing combos to skip:", existingCombos.size);

    // ── EDIT RESERVATION ──
    // Reserve edits atomically on user-initiated calls (has imageIds + user token).
    // Chain calls (service role, no imageIds) skip reservation entirely.
    const isFirstCall = imageIds && Array.isArray(imageIds) && imageIds.length > 0 && token !== supabaseServiceKey;

    if (isFirstCall) {
      // Check if user has a limited plan (edits_remaining != -1)
      const { data: userSub } = await supabaseAdmin
        .from("user_subscriptions")
        .select("edits_remaining, edits_reserved")
        .eq("user_id", userId)
        .single();

      if (userSub && userSub.edits_remaining !== -1) {
        // Reserve only for combos that will actually be dispatched — rejected
        // (model-less/colliding) styles must not hold the user's credits.
        const needed = (images.length * usableStyles.length) - existingCombos.size;

        if (needed > 0) {
          // Atomic reserve — fails if insufficient available edits
          const { data: reserved, error: reserveError } = await supabaseAdmin
            .rpc("reserve_edits_atomic", {
              p_user_id: userId,
              p_gallery_id: galleryId,
              p_needed: needed,
            });

          if (reserveError || !reserved) {
            const available = Math.max(0, (userSub.edits_remaining || 0) - (userSub.edits_reserved || 0));
            console.error("Insufficient edits for reservation:", { needed, available, reserveError });
            return new Response(
              JSON.stringify({
                error: "insufficient_edits",
                needed,
                available,
                message: `Not enough edits. Need ${needed} but only ${available} available.`,
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          console.log(`Reserved ${needed} edits for gallery ${galleryId}`);
        }
      }
    }

    // Mark all fetched images as "processing" and bump attempt counter
    const imageIdsToMark = images.map((img) => img.id);
    const BATCH = 500;
    for (let i = 0; i < imageIdsToMark.length; i += BATCH) {
      const batch = imageIdsToMark.slice(i, i + BATCH);
      await supabaseAdmin
        .from("gallery_images")
        .update({
          status: "processing",
          processing_attempts: images[0]?.processing_attempts !== undefined
            ? undefined // we'll increment per-image below
            : undefined,
          last_processing_attempt_at: new Date().toISOString(),
        })
        .in("id", batch);
    }

    // Build processing tasks
    const processTasks: Array<{ imageId: string; exec: () => Promise<ProcessImageResult[]> }> = [];
    const results: ProcessImageResult[] = [];

    // Surface each rejected style once in the results, so callers can tell
    // the photographer exactly which looks were not applied and why.
    for (const r of rejectedStyles) {
      results.push({ imageId: "", styleId: r.id, success: false, error: r.reason });
    }

    for (const image of images) {
      const stylesToProcess = usableStyles.filter(
        (style) => !existingCombos.has(`${image.id}:${style.id}`),
      );

      // Record skipped combos
      for (const style of usableStyles.filter(s => existingCombos.has(`${image.id}:${s.id}`))) {
        results.push({ imageId: image.id, styleId: style.id, success: true, skipped: true });
      }

      if (stylesToProcess.length === 0) {
        // All styles already done — mark image as ready
        await supabaseAdmin
          .from("gallery_images")
          .update({ status: "ready" })
          .eq("id", image.id);
        continue;
      }

      const editingStyles = stylesToProcess.map(s => s.style_id_external || "1");
      const styleMap: Record<string, { id: string; name: string }> = {};
      for (const s of stylesToProcess) {
        styleMap[s.style_id_external || "1"] = { id: s.id, name: s.name };
      }

      processTasks.push({
        imageId: image.id,
        exec: async () => {
          try {
            const requestBody = {
              imagePath: image.original_url,
              editingStyles,
              callbackURL: webhookUrl,
              callbackArgs: {
                imageId: image.id,
                galleryId,
                userId,
                styleMap,
              },
              originalName: image.filename,
              collectionId: collectionId || galleryId,
              collectionName: gallery.name,
              userId,
              imageUUID: image.id,
            };

            const response = await fetch(`${IMAGICK_API_URL}/at/imagick/`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Username": username,
                "Password": password,
              },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error("Imagick API error for image", image.id, ":", response.status, errorText);

              // Mark image with error info
              const newAttempts = (image.processing_attempts || 0) + 1;
              if (newAttempts >= MAX_ATTEMPTS) {
                await supabaseAdmin
                  .from("gallery_images")
                  .update({
                    status: "error",
                    processing_attempts: newAttempts,
                    last_processing_error: `HTTP ${response.status}: ${errorText.substring(0, 500)}`,
                    last_processing_attempt_at: new Date().toISOString(),
                  })
                  .eq("id", image.id);
              } else {
                await supabaseAdmin
                  .from("gallery_images")
                  .update({
                    status: "processing", // keep processing for retry in next chain
                    processing_attempts: newAttempts,
                    last_processing_error: `HTTP ${response.status}: ${errorText.substring(0, 500)}`,
                    last_processing_attempt_at: new Date().toISOString(),
                  })
                  .eq("id", image.id);
              }

              return stylesToProcess.map(s => ({
                imageId: image.id, styleId: s.id, success: false, error: errorText,
              }));
            }

            // Success — increment attempts but leave status as processing (webhook will set to ready)
            await supabaseAdmin
              .from("gallery_images")
              .update({
                processing_attempts: (image.processing_attempts || 0) + 1,
                last_processing_attempt_at: new Date().toISOString(),
              })
              .eq("id", image.id);

            return stylesToProcess.map(s => ({
              imageId: image.id, styleId: s.id, success: true,
            }));
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Error processing image", image.id, ":", errorMessage);

            const newAttempts = (image.processing_attempts || 0) + 1;
            await supabaseAdmin
              .from("gallery_images")
              .update({
                status: newAttempts >= MAX_ATTEMPTS ? "error" : "processing",
                processing_attempts: newAttempts,
                last_processing_error: errorMessage.substring(0, 500),
                last_processing_attempt_at: new Date().toISOString(),
              })
              .eq("id", image.id);

            return stylesToProcess.map(s => ({
              imageId: image.id, styleId: s.id, success: false, error: errorMessage,
            }));
          }
        },
      });
    }

    console.log("Processing tasks:", processTasks.length, "batchSize:", parsedRequestBatchSize);

    // Execute in batches with time budget
    const startTime = Date.now();
    let stoppedEarly = false;

    const totalBatches = Math.ceil(processTasks.length / parsedRequestBatchSize);
    for (let i = 0; i < processTasks.length; i += parsedRequestBatchSize) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.log(`Time budget exceeded after ${Math.round((Date.now() - startTime) / 1000)}s. Stopping early.`);
        stoppedEarly = true;
        break;
      }

      const batch = processTasks.slice(i, i + parsedRequestBatchSize);
      const batchNumber = Math.floor(i / parsedRequestBatchSize) + 1;
      console.log(`Batch ${batchNumber}/${totalBatches} (${batch.length} requests)`);

      const batchResults = await Promise.all(batch.map(t => t.exec()));
      for (const r of batchResults) results.push(...r);
    }

    // Merge style IDs
    const { data: currentGallery } = await supabaseAdmin
      .from("galleries")
      .select("selected_style_ids")
      .eq("id", galleryId)
      .maybeSingle();

    // Merge only styles that actually got dispatched — a rejected (model-less)
    // style on the gallery would render an empty look tab and re-enter the
    // todo-count forever.
    const existingStyleIds: string[] = currentGallery?.selected_style_ids || [];
    const mergedStyleIds = [...new Set([...existingStyleIds, ...usableStyleIds])];

    await supabaseAdmin
      .from("galleries")
      .update({ selected_style_ids: mergedStyleIds, status: "processing" })
      .eq("id", galleryId);

    // ── COUNT-BASED CHAINING ──
    // Check both processing images AND ready images missing edits
    const { count: remainingProcessing } = await supabaseAdmin
      .from("gallery_images")
      .select("*", { count: "exact", head: true })
      .eq("gallery_id", galleryId)
      .in("status", ["processing", "uploading"])
      .lt("processing_attempts", MAX_ATTEMPTS);

    // Also count ready images that still need edits — for DISPATCHABLE styles
    // only. Counting a rejected style here would keep this >0 forever and
    // chain invocations in an infinite loop (its edits can never arrive).
    let remainingReady = 0;
    if (usableStyleIds.length > 0 && !imageIds) {
      const { data: readyCount } = await supabaseAdmin
        .rpc("count_images_missing_edits", {
          p_gallery_id: galleryId,
          p_style_ids: usableStyleIds,
        });
      remainingReady = Number(readyCount) || 0;
    }

    const remaining = (remainingProcessing ?? 0) + remainingReady;
    console.log(`Remaining: ${remainingProcessing ?? 0} processing + ${remainingReady} ready missing edits = ${remaining}`);

    let chained = false;
    if (remaining > 0 && !imageIds) {
      console.log(`Chaining next invocation for ${remaining} remaining images`);
      const selfUrl = `${supabaseUrl}/functions/v1/process-images`;
      const chainPromise = fetch(selfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ galleryId, styleIds: usableStyleIds, userId }),
      }).catch((err) => console.error("Self-chain failed:", err));
      EdgeRuntime.waitUntil(chainPromise);
      chained = true;
    }

    const successCount = results.filter(r => r.success && !r.skipped).length;
    const failCount = results.filter(r => !r.success).length;
    const skipCount = results.filter(r => r.skipped).length;
    console.log(`Done: ${successCount} sent, ${failCount} failed, ${skipCount} skipped, ${remaining} remaining, chained=${chained}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processing ${images.length} images with ${usableStyles.length} styles`,
        ...(rejectedStyles.length > 0 ? { rejectedStyles } : {}),
        requestBatchSize: parsedRequestBatchSize,
        chained,
        remainingProcessing: remaining,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in process-images:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
