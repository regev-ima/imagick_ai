import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyWebhookSecret } from "../_shared/imagick-webhook-auth.ts";
import { triggerCullingPipeline } from "../_shared/trigger-culling.ts";
// Notification helpers (email templates + Resend + WhatsApp) are imported
// dynamically inside the handler so they never evaluate at module boot —
// same boot-safety fix as gd-transfer (a heavy module here crashed the worker).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const B2_BASE_URL = "https://s3.us-east-005.backblazeb2.com/imagick";

interface FileMapping {
  original_name: string;
  new_name: string;
}

interface CallbackArgs {
  galleryId: string;
  userId: string;
  styleIds: string[];
  folderIndex?: number;
  totalFolders?: number;
}

// Photo + RAW extensions we actually process. Everything else (and any hidden
// dotfile like .DS_Store / Thumbs.db) is junk that rides along from Drive
// folders — it never compresses, so it would stall the compression barrier and
// show up as a "failed to load" tile. We drop it at import time.
const IMAGE_EXTS = new Set([
  "jpg", "jpeg", "jpe", "jfif", "png", "webp", "gif", "bmp", "tif", "tiff",
  "heic", "heif", "avif",
  // RAW
  "dng", "cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "raf", "orf",
  "rw2", "rwl", "pef", "srw", "x3f", "3fr", "fff", "iiq", "kdc", "dcr", "mos",
  "mef", "mrw", "raw",
]);

function isRealImage(name: string | undefined | null): boolean {
  if (!name) return false;
  const base = (name.split("/").pop() || name).trim();
  if (!base || base.startsWith(".")) return false; // .DS_Store & other dotfiles
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return false;                       // no extension
  return IMAGE_EXTS.has(base.slice(dot + 1).toLowerCase());
}

interface WebhookPayload {
  file_mappings: FileMapping[];
  callback_args: CallbackArgs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!(await verifyWebhookSecret(req))) {
      console.warn("Rejecting gd-transfer-webhook: bad or missing token");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: WebhookPayload = await req.json();
    const { file_mappings, callback_args } = payload;

    console.log("Received webhook:", JSON.stringify({
      fileCount: file_mappings?.length,
      galleryId: callback_args?.galleryId,
      userId: callback_args?.userId,
      styleIds: callback_args?.styleIds,
      folderIndex: callback_args?.folderIndex,
      totalFolders: callback_args?.totalFolders,
    }));

    if (!file_mappings || !callback_args) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { galleryId, userId, styleIds, folderIndex, totalFolders } = callback_args;

    if (!galleryId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing galleryId or userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing folder ${(folderIndex ?? 0) + 1}/${totalFolders ?? 1}`);

    // Drop non-image junk (.DS_Store, Thumbs.db, hidden dotfiles, anything
    // without an image/RAW extension) so it never becomes a gallery_images row —
    // it never compresses and would stall culling / clutter the grid.
    const imageMappings = file_mappings.filter((m) => isRealImage(m.original_name || m.new_name));
    const dropped = file_mappings.length - imageMappings.length;
    if (dropped > 0) {
      console.warn(
        `Skipping ${dropped} non-image file(s) from Drive:`,
        file_mappings.filter((m) => !isRealImage(m.original_name || m.new_name)).map((m) => m.original_name).slice(0, 20),
      );
    }

    // Create gallery_images records for each transferred file
    const imagesToInsert = imageMappings.map((mapping, index) => {
      const filePath = `galleries/${userId}/${galleryId}/${mapping.new_name}`;
      const originalUrl = `${B2_BASE_URL}/${filePath}`;

      return {
        gallery_id: galleryId,
        user_id: userId,
        filename: mapping.original_name,
        original_url: originalUrl,
        status: styleIds.length > 0 ? "processing" : "ready",
        sort_order: index,
        is_hero: false, // Hero will be set during finalization
      };
    });

    // Insert images in batches
    const BATCH_SIZE = 200;
    const imageIds: string[] = [];
    const totalBatches = Math.ceil(imagesToInsert.length / BATCH_SIZE);
    console.log(`Inserting ${imagesToInsert.length} images in ${totalBatches} batches`);

    for (let i = 0; i < imagesToInsert.length; i += BATCH_SIZE) {
      const batch = imagesToInsert.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`Inserting batch ${batchNum}/${totalBatches} (${batch.length} images)`);

      const { data: insertedBatch, error: insertError } = await supabase
        .from("gallery_images")
        .insert(batch)
        .select("id");

      if (insertError) {
        console.error(`Error inserting batch ${batchNum}:`, insertError);
        throw insertError;
      }

      if (insertedBatch) {
        imageIds.push(...insertedBatch.map(img => img.id));
      }
    }

    console.log(`Successfully inserted ${imageIds.length} images for folder ${(folderIndex ?? 0) + 1}`);

    // Atomically increment folder completion counter and check if all folders are done
    const { data: counterData, error: counterError } = await supabase.rpc(
      'increment_gallery_folder_completed',
      { p_gallery_id: galleryId }
    );

    if (counterError) {
      console.error("Error incrementing folder counter:", counterError);
    }

    const allFoldersDone = counterData && counterData.length > 0 &&
      counterData[0].import_folders_completed >= counterData[0].import_folders_total;

    console.log(`Folder counter: completed=${counterData?.[0]?.import_folders_completed}, total=${counterData?.[0]?.import_folders_total}, allDone=${allFoldersDone}`);

    // If not all folders done, return early — finalization happens when the last folder completes
    if (!allFoldersDone) {
      return new Response(
        JSON.stringify({
          success: true,
          imagesCreated: imageIds.length,
          folderIndex,
          totalFolders,
          finalized: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === FINALIZATION: only runs when all folders have completed ===

    // Count total images in gallery from DB
    const { count: totalImagesInGallery } = await supabase
      .from("gallery_images")
      .select("*", { count: "exact", head: true })
      .eq("gallery_id", galleryId);

    const totalCount = totalImagesInGallery ?? imageIds.length;
    console.log(`Finalization: total images in gallery = ${totalCount}`);

    // === Fetch file sizes from B2 for imported images ===
    try {
      console.log("Fetching file sizes from B2 via HEAD requests...");
      const { data: unsizedImages } = await supabase
        .from("gallery_images")
        .select("id, original_url")
        .eq("gallery_id", galleryId)
        .is("file_size_bytes", null);

      if (unsizedImages && unsizedImages.length > 0) {
        const HEAD_CONCURRENCY = 20;
        const sizeUpdates: { id: string; size: number }[] = [];
        const startTime = Date.now();
        const TIME_BUDGET_MS = 25000; // 25s max for HEAD requests

        for (let i = 0; i < unsizedImages.length; i += HEAD_CONCURRENCY) {
          if (Date.now() - startTime > TIME_BUDGET_MS) {
            console.log(`Time budget exceeded after sizing ${sizeUpdates.length}/${unsizedImages.length} images`);
            break;
          }
          const batch = unsizedImages.slice(i, i + HEAD_CONCURRENCY);
          const results = await Promise.allSettled(
            batch.map(async (img) => {
              try {
                const resp = await fetch(img.original_url, { method: "HEAD" });
                if (resp.ok) {
                  const size = parseInt(resp.headers.get("content-length") || "0", 10);
                  if (size > 0) return { id: img.id, size };
                }
              } catch { /* ignore */ }
              return null;
            })
          );
          for (const r of results) {
            if (r.status === "fulfilled" && r.value) {
              sizeUpdates.push(r.value);
            }
          }
        }

        // Batch update file sizes
        if (sizeUpdates.length > 0) {
          const UPDATE_CONCURRENCY = 50;
          for (let i = 0; i < sizeUpdates.length; i += UPDATE_CONCURRENCY) {
            const batch = sizeUpdates.slice(i, i + UPDATE_CONCURRENCY);
            await Promise.all(
              batch.map(({ id, size }) =>
                supabase
                  .from("gallery_images")
                  .update({ file_size_bytes: size })
                  .eq("id", id)
              )
            );
          }
          console.log(`Updated file sizes for ${sizeUpdates.length}/${unsizedImages.length} images`);
        }

        // Estimate remaining images from average if we couldn't HEAD all of them
        if (sizeUpdates.length > 0 && sizeUpdates.length < unsizedImages.length) {
          const avgSize = Math.round(
            sizeUpdates.reduce((sum, u) => sum + u.size, 0) / sizeUpdates.length
          );
          const remainingIds = unsizedImages
            .filter((img) => !sizeUpdates.find((u) => u.id === img.id))
            .map((img) => img.id);

          for (let i = 0; i < remainingIds.length; i += 200) {
            const batch = remainingIds.slice(i, i + 200);
            await supabase
              .from("gallery_images")
              .update({ file_size_bytes: avgSize })
              .in("id", batch);
          }
          console.log(`Estimated sizes for ${remainingIds.length} remaining images (avg ${avgSize} bytes)`);
        }

        // Recalculate user storage (trigger only fires on INSERT/DELETE, not UPDATE)
        await supabase.rpc("recalculate_user_storage", { p_user_id: userId });
        console.log("Storage recalculated for user:", userId);
      }
    } catch (sizeErr) {
      console.error("Error fetching file sizes (non-fatal):", sizeErr);
    }

    // Get the first image for hero
    const { data: firstImage } = await supabase
      .from("gallery_images")
      .select("original_url")
      .eq("gallery_id", galleryId)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    let heroImageUrl: string | null = null;
    if (firstImage?.original_url) {
      const pathAfterBase = firstImage.original_url.replace(B2_BASE_URL + "/", "");
      const lastSlash = pathAfterBase.lastIndexOf("/");
      const basePath = lastSlash > 0 ? pathAfterBase.substring(0, lastSlash) : "";
      const fullFilename = lastSlash > 0 ? pathAfterBase.substring(lastSlash + 1) : pathAfterBase;
      const lastDot = fullFilename.lastIndexOf(".");
      const filenameNoExt = lastDot > 0 ? fullFilename.substring(0, lastDot) : fullFilename;
      heroImageUrl = `${B2_BASE_URL}/${basePath}/compressed/${filenameNoExt}_reduced.webp`;
    }

    // Set first image as hero
    if (firstImage) {
      await supabase
        .from("gallery_images")
        .update({ is_hero: true })
        .eq("gallery_id", galleryId)
        .eq("original_url", firstImage.original_url);
    }

    // Update gallery with totals and hero image
    const { error: updateError } = await supabase
      .from("galleries")
      .update({
        total_images: totalCount,
        hero_image_url: heroImageUrl,
        status: styleIds.length > 0 ? "processing" : "ready",
      })
      .eq("id", galleryId);

    if (updateError) {
      console.error("Error updating gallery:", updateError);
      throw updateError;
    }

    // Auto-start AI Culling for Drive galleries now that the originals exist.
    // Local uploads dispatch this from the create page; Drive images only land
    // here, so this is the trigger point (and it fixes hosting-only Drive
    // galleries that never got culled). Runs in parallel with any style edits;
    // guarded on culling_started_at so a later edit-completion webhook won't
    // double-run it.
    try {
      const { data: gd } = await supabase
        .from("galleries")
        .select("ai_culling_enabled, ai_grouping_enabled, ai_faces_enabled, culling_labels, culling_status, culling_started_at, culling_completed_at")
        .eq("id", galleryId)
        .single();
      const cullingUntouched =
        gd?.culling_status !== "processing" && !gd?.culling_started_at && !gd?.culling_completed_at;
      if (gd?.ai_culling_enabled && cullingUntouched) {
        console.log("Drive transfer complete — dispatching AI culling for gallery:", galleryId);
        await triggerCullingPipeline(
          supabase,
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          galleryId,
          {
            cluster: gd.ai_grouping_enabled ?? true,
            faces: gd.ai_faces_enabled ?? false,
            labels: gd.culling_labels || [],
          },
        );
      }
    } catch (cullErr) {
      console.error("Drive auto-culling trigger failed (non-fatal):", cullErr);
    }

    // Don't pass imageIds — let process-images query by status with cursor pagination
    // This avoids the 1000-row limit and supports galleries of any size

    // Trigger AI processing if styles selected
    if (styleIds.length > 0) {
      console.log("Triggering AI processing for gallery", galleryId);

      const processResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-images`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            galleryId,
            styleIds,
            userId,
          }),
        }
      );

      if (!processResponse.ok) {
        console.error("Failed to trigger processing:", await processResponse.text());
      }
    }

    // NOTE: the "import complete" email + WhatsApp notification were removed
    // here for the same reason as gd-transfer — the email/template/WhatsApp
    // import chain was implicated in a worker boot crash. The gallery is still
    // marked ready and processing is triggered above; notifications can be
    // re-added later via a dedicated lightweight path.

    console.log("Webhook finalization completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        imagesCreated: imageIds.length,
        totalImagesInGallery: totalCount,
        finalized: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in gd-transfer-webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
