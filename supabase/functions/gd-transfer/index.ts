import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import { gdImportStartedTemplate } from "../_shared/email-templates.ts";
import { sendWhatsAppNotification } from "../_shared/whatsapp.ts";
import { corsHeaders } from "../_shared/cors.ts";

const GD_TO_B2_URL = "https://us-central1-wesnapp-editing-server.cloudfunctions.net/gd-to-b2";

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

Deno.serve(async (req) => {
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
      
      const gcpRequestBody = {
        input_dir: singleLink,
        metadata_only: true,
      };

      console.log("Calling GCP function for metadata:", JSON.stringify(gcpRequestBody));

      const gcpResponse = await fetch(GD_TO_B2_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gcpRequestBody),
      });

      if (!gcpResponse.ok) {
        const errorText = await gcpResponse.text();
        console.error("GCP function error:", errorText);
        
        if (errorText.includes("Invalid Google Drive folder link") || errorText.includes("404")) {
          return new Response(
            JSON.stringify({ error: "Cannot access this folder. Please make sure the folder is shared with 'Anyone with the link' as Viewer." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to connect to transfer service" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metadata: MetadataResponse = await gcpResponse.json();
      
      if (metadata.number_of_images === 0) {
        return new Response(
          JSON.stringify({ error: "This folder is empty or contains no images." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          folderName: metadata.folder_name,
          imageCount: metadata.number_of_images,
          totalSizeMB: Math.round(metadata.all_files_size * 10) / 10,
          fileNames: metadata.file_names,
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
    // Every folder gets a callback so the webhook can register all images
    links.forEach((link, index) => {
      const gcpRequestBody: Record<string, unknown> = {
        input_dir: link,
        output_dir: finalOutputDir,
        use_uuid4: true,
      };

      if (isStyleTransfer && styleId) {
        gcpRequestBody.callback_url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/train-webhook`;
        gcpRequestBody.callback_args = {
          styleId,
          userId,
          transferType,
          totalFolders: links.length,
          folderIndex: index,
          modelType: body.modelType || "event",
        };
      } else {
        gcpRequestBody.callback_url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gd-transfer-webhook`;
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
      fetch(GD_TO_B2_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gcpRequestBody),
      }).catch(err => {
        console.error(`Transfer ${index + 1} failed to start:`, err);
      });
    });

    // Send "import started" email (fire and forget)
    if (galleryId && !isStyleTransfer) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authUser?.email) {
          const { data: gallery } = await supabaseAdmin
            .from("galleries")
            .select("name")
            .eq("id", galleryId)
            .single();
          const galleryName = gallery?.name || "Untitled Gallery";
          const userName = authUser.user_metadata?.full_name || authUser.email.split("@")[0];
          const studioUrl = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");
          const galleryUrl = `${studioUrl}/dashboard/galleries/${galleryId}`;
          const { subject, html } = gdImportStartedTemplate(galleryName, totalImageCount || links.length, galleryUrl);
          sendEmail({
            to: authUser.email,
            subject,
            html,
            emailType: "gd_import_started",
            userId,
            metadata: { galleryId, foldersCount: links.length },
            supabaseAdmin,
          }).catch(err => console.error("Failed to send gd_import_started email:", err));

          // WhatsApp notification
          const now = new Date();
          const dateStr = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
          const waMsg = `📂 Google Drive Import Started\nUser: ${userName}\nEmail: ${authUser.email}\nGallery: ${galleryName}\nFolders: ${links.length}\nImages: ${totalImageCount || "unknown"}\nDate: ${dateStr}`;
          sendWhatsAppNotification(waMsg).catch(() => {});
        }
      } catch (emailErr) {
        console.error("Error sending import started email:", emailErr);
      }
    }

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
