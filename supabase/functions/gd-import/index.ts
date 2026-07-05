import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
// The email-template / Resend / WhatsApp helpers are imported *dynamically*
// inside the transfer branch (see below) so they never evaluate at module
// load. This keeps the worker's cold-start/boot path minimal and identical to
// the core functions — a heavy module here was crashing the worker at boot
// (503 on the OPTIONS preflight, no execution), which broke Drive imports.

// File-transfer service (Google Drive ↔ B2). Lives on Fly alongside the
// /download service used by DownloadGalleryModal. B2 credentials are stored
// as Fly secrets, so we never send them in the request body.
const FILE_TRANSFER_URL = "https://downloadfiles.fly.dev/file-transfer";

// Photo + RAW extensions we process; everything else (and any hidden dotfile
// like .DS_Store) is junk that rides along from Drive folders. Kept in sync
// with gd-transfer-webhook's filter so the pre-import count matches the import.
const IMAGE_EXTS = new Set([
  "jpg", "jpeg", "jpe", "jfif", "png", "webp", "gif", "bmp", "tif", "tiff",
  "heic", "heif", "avif",
  "dng", "cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "raf", "orf",
  "rw2", "rwl", "pef", "srw", "x3f", "3fr", "fff", "iiq", "kdc", "dcr", "mos",
  "mef", "mrw", "raw",
]);
function isRealImage(name: string | undefined | null): boolean {
  if (!name) return false;
  const base = (name.split("/").pop() || name).trim();
  if (!base || base.startsWith(".")) return false;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return false;
  return IMAGE_EXTS.has(base.slice(dot + 1).toLowerCase());
}

interface TransferRequest {
  driveLink?: string;
  driveLinks?: string[];
  galleryId?: string;
  styleId?: string;
  styleIds?: string[];
  transferType?: "gallery" | "style-before" | "style-after";
  metadataOnly?: boolean;
  outputDir?: string;
  totalImageCount?: number;
  totalSizeMB?: number;
  modelType?: string;
}

interface MetadataResponse {
  all_files_size: number;
  folder_name: string;
  number_of_images: number;
  original_url: string;
  file_names: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id as string;

    // Parse request body
  const body: TransferRequest = await req.json();
    const { driveLink, driveLinks, galleryId, styleId, styleIds = [], transferType = "gallery", metadataOnly = false, outputDir, totalImageCount } = body;

    // Support both single link and multiple links
    const links = driveLinks || (driveLink ? [driveLink] : []);

    if (links.length === 0) {
      return new Response(
        JSON.stringify({ error: "driveLink or driveLinks is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate all links
    for (const link of links) {
      if (!link.includes("drive.google.com") || !link.includes("folders")) {
        return new Response(
          JSON.stringify({ error: `Invalid Google Drive folder link: ${link}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // If galleryId is provided, verify ownership
    if (galleryId) {
      const { data: gallery, error: galleryError } = await supabase
        .from("galleries")
        .select("id, user_id")
        .eq("id", galleryId)
        .single();

      if (galleryError || !gallery) {
        return new Response(
          JSON.stringify({ error: "Gallery not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (gallery.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "You don't have permission to modify this gallery" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // For metadata requests, return info for a single link (first one)
    if (metadataOnly) {
      const singleLink = links[0];
      
      const transferRequestBody = {
        input_dir: singleLink,
        direction: "gd2b2",
        metadata_only: true,
      };

      console.log("Calling file-transfer service for metadata:", JSON.stringify(transferRequestBody));

      const gcpResponse = await fetch(FILE_TRANSFER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferRequestBody),
      });

      if (!gcpResponse.ok) {
        const errorText = await gcpResponse.text();
        console.error("Transfer service error:", gcpResponse.status, errorText);

        if (errorText.includes("Invalid Google Drive folder link") || errorText.includes("404")) {
          return new Response(
            JSON.stringify({ error: "Cannot access this folder. Please make sure the folder is shared with 'Anyone with the link' as Viewer." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Pass the upstream status + body through so the client (and logs)
        // show WHAT the transfer service said, not just that it failed.
        return new Response(
          JSON.stringify({
            error: `Transfer service error (HTTP ${gcpResponse.status}): ${errorText.slice(0, 300) || "no response body"}`,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metadata: MetadataResponse = await gcpResponse.json();

      // Drop non-image junk (.DS_Store, Thumbs.db, hidden dotfiles, anything
      // without an image/RAW extension) so the count shown before import matches
      // what actually gets imported — the transfer webhook filters the same way.
      const realNames = (metadata.file_names ?? []).filter(isRealImage);
      const realCount = realNames.length > 0 ? realNames.length : metadata.number_of_images;

      if (realCount === 0) {
        return new Response(
          JSON.stringify({ error: "This folder is empty or contains no images." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          folderName: metadata.folder_name,
          imageCount: realCount,
          totalSizeMB: Math.round(metadata.all_files_size * 10) / 10,
          fileNames: realNames.length > 0 ? realNames : metadata.file_names,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Storage limit check (gallery transfers only) ===
    if (transferType === "gallery") {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: storageLimitGb } = await supabaseAdmin.rpc(
        "get_effective_storage_limit",
        { p_user_id: userId }
      );

      if (storageLimitGb && storageLimitGb > 0) {
        const { data: subData } = await supabaseAdmin
          .from("user_subscriptions")
          .select("storage_used_mb")
          .eq("user_id", userId)
          .single();

        const storageUsedGb = (subData?.storage_used_mb || 0) / 1024;
        const incomingSizeGb = (body.totalSizeMB || 0) / 1024;

        if (storageUsedGb + incomingSizeGb > storageLimitGb) {
          return new Response(
            JSON.stringify({
              error: "storage_limit_exceeded",
              message: `This import would exceed your storage limit. You're using ${storageUsedGb.toFixed(1)} GB of ${storageLimitGb} GB.${incomingSizeGb > 0 ? ` The import requires approximately ${incomingSizeGb.toFixed(1)} GB.` : ""}`,
              storageUsedGb: Math.round(storageUsedGb * 10) / 10,
              storageLimitGb,
              incomingSizeGb: Math.round(incomingSizeGb * 10) / 10,
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // For full transfer, determine context (gallery or style)
    const isStyleTransfer = transferType === "style-before" || transferType === "style-after";

    if (!galleryId && !styleId) {
      return new Response(
        JSON.stringify({ error: "galleryId or styleId is required for full transfer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify style ownership if style transfer
    if (isStyleTransfer && styleId) {
      const { data: style, error: styleError } = await supabase
        .from("styles")
        .select("id, user_id")
        .eq("id", styleId)
        .single();

      if (styleError || !style) {
        return new Response(
          JSON.stringify({ error: "Style not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (style.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "You don't have permission to modify this style" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Determine output directory
    let finalOutputDir: string;
    if (outputDir) {
      finalOutputDir = outputDir;
    } else if (isStyleTransfer && styleId) {
      const subDir = transferType === "style-before" ? "before" : "after";
      finalOutputDir = `styles/${userId}/${styleId}/${subDir}/`;
    } else {
      finalOutputDir = `galleries/${userId}/${galleryId}/`;
    }

    // Update status based on context
    if (isStyleTransfer && styleId) {
      await supabase
        .from("styles")
        .update({ status: "importing", import_start_date: new Date().toISOString() })
        .eq("id", styleId);
    } else if (galleryId) {
      await supabase
        .from("galleries")
        .update({ 
          status: "transferring",
          import_folders_total: links.length,
          import_folders_completed: 0,
        })
        .eq("id", galleryId);
    }

    // Fire and forget - start transfers without waiting for completion
    // Every folder gets a callback so the webhook can register all images.
    // Resolve the webhook-signing helper once (await is only valid here, in the
    // async handler — not inside the non-async forEach callback below).
    const { appendWebhookSecret } = await import("../_shared/imagick-webhook-auth.ts");
    links.forEach((link, index) => {
      const gcpRequestBody: Record<string, unknown> = {
        input_dir: link,
        output_dir: finalOutputDir,
        direction: "gd2b2",
        // Style training matches before/after pairs by original filename, so
        // it must keep the Drive names. Galleries dedupe/store by the
        // UUID-renamed key, so they keep UUID renaming.
        use_uuid4: !isStyleTransfer,
      };

      if (isStyleTransfer && styleId) {
        gcpRequestBody.callback_url = appendWebhookSecret(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/train-webhook`
        );
        gcpRequestBody.callback_args = {
          styleId,
          userId,
          transferType,
          totalFolders: links.length,
          folderIndex: index,
          modelType: body.modelType || "event",
        };
      } else {
        gcpRequestBody.callback_url = appendWebhookSecret(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/gd-transfer-webhook`
        );
        gcpRequestBody.callback_args = {
          galleryId,
          userId,
          styleIds,
          totalFolders: links.length,
          folderIndex: index,
        };
      }

      console.log(`Starting transfer ${index + 1}/${links.length}:`, JSON.stringify(gcpRequestBody));

      // Fire and forget - don't await!
      fetch(FILE_TRANSFER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gcpRequestBody),
      }).catch(err => {
        console.error(`Transfer ${index + 1} failed to start:`, err);
      });
    });

    // NOTE: the "import started" email + WhatsApp notification were removed
    // from here. Importing the email-template / Resend / WhatsApp chain (even
    // dynamically) was implicated in a worker boot crash that 503'd the OPTIONS
    // preflight and blocked ALL Drive imports. The gallery status still updates
    // in-app; we can re-add notifications later via a dedicated lightweight path.

    // Return immediately without waiting for transfers to complete
    return new Response(
      JSON.stringify({
        success: true,
        message: `Transfer started for ${links.length} folder(s). You will be notified when complete.`,
        foldersCount: links.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in gd-transfer:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
