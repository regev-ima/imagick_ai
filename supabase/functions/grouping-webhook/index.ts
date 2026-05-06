// Webhook endpoint to receive grouping/culling results from Imagick API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import { cullingReadyTemplate } from "../_shared/email-templates.ts";
import { captureException } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CullingInfo {
  overall_score: number;
  label: string;
  background_sharpness?: number;
  subject_sharpness?: number;
  thirds_rule?: number;
  intended_facial_expression?: number;
}

interface GroupingWebhookPayload {
  status: "COMPLETED" | "FAILED";
  output?: Record<string, [[number, number, number], CullingInfo]>;
  error?: string;
  // Callback args we sent
  galleryId?: string;
  userId?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role for webhook - no user auth
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json() as GroupingWebhookPayload;
    console.log("Grouping webhook received:", JSON.stringify(body, null, 2));

    const { galleryId, userId, status, output, error: webhookError } = body;

    if (!galleryId) {
      console.error("Missing galleryId in webhook payload");
      return new Response(
        JSON.stringify({ error: "Missing galleryId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle error case
    if (status === "FAILED" || webhookError) {
      console.error("Grouping failed for gallery", galleryId, ":", webhookError);
      await supabase
        .from("galleries")
        .update({ culling_status: "idle", culling_completed_at: new Date().toISOString() })
        .eq("id", galleryId);

      return new Response(
        JSON.stringify({ success: false, error: webhookError || "Processing failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle success case
    if (status === "COMPLETED" && output) {
      console.log("Processing grouping results for gallery:", galleryId);

      // Get all images for this gallery (only original images, not deleted)
      const { data: images, error: fetchError } = await supabase
        .from("gallery_images")
        .select("id, filename, original_url")
        .eq("gallery_id", galleryId)
        .neq("status", "deleted");

      if (fetchError) {
        console.error("Error fetching images:", fetchError);
        return new Response(
          JSON.stringify({ success: false, error: fetchError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!images || images.length === 0) {
        console.log("No images found for gallery:", galleryId);
        await supabase
          .from("galleries")
          .update({ culling_status: "ready" })
          .eq("id", galleryId);

        return new Response(
          JSON.stringify({ success: true, updated: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Helper function to extract filename from URL
      const extractFilename = (url: string): string => {
        const parts = url.split("/");
        return parts[parts.length - 1];
      };

      // Map output to images
      let updatedCount = 0;
      for (const image of images) {
        // Try to match by filename from original_url
        const urlFilename = extractFilename(image.original_url);
        
        // Look for matching key in output (could be filename or original_name)
        const matchingKey = Object.keys(output).find(key => {
          const keyFilename = extractFilename(key);
          return key === image.filename || 
                 key === urlFilename || 
                 keyFilename === image.filename ||
                 keyFilename === urlFilename;
        });

        if (matchingKey && output[matchingKey]) {
          const scores = output[matchingKey];
          const [groupings, cullingInfo] = scores;
          
          const updateData: Record<string, unknown> = {
            similarity_group_1: groupings[0] ?? null,
            similarity_group_2: groupings[1] ?? null,
            similarity_group_3: groupings[2] ?? null,
          };

          // Extract all culling metrics if available
          if (cullingInfo && typeof cullingInfo === "object") {
            updateData.culling_score = cullingInfo.overall_score ?? null;
            updateData.culling_label = cullingInfo.label ?? null;
            updateData.background_sharpness = cullingInfo.background_sharpness ?? null;
            updateData.subject_sharpness = cullingInfo.subject_sharpness ?? null;
            updateData.thirds_rule = cullingInfo.thirds_rule ?? null;
            updateData.intended_facial_expression = cullingInfo.intended_facial_expression ?? null;
          }

          const { error: updateError } = await supabase
            .from("gallery_images")
            .update(updateData)
            .eq("id", image.id);

          if (updateError) {
            console.error("Error updating image", image.id, ":", updateError);
          } else {
            updatedCount++;
          }
        } else {
          console.log("No matching output for image:", image.filename);
        }
      }

      console.log(`Updated ${updatedCount} of ${images.length} images for gallery ${galleryId}`);

      // Update gallery culling status to ready and record completion time
      await supabase
        .from("galleries")
        .update({ culling_status: "ready", culling_completed_at: new Date().toISOString() })
        .eq("id", galleryId);

      // Send culling complete email (fire-and-forget)
      if (userId) {
        sendCullingReadyEmail(supabase, galleryId, userId, images.length, updatedCount).catch(err =>
          console.error("sendCullingReadyEmail error:", err)
        );
      }

      return new Response(
        JSON.stringify({ success: true, updated: updatedCount }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown status
    console.log("Unknown status in webhook:", status);
    return new Response(
      JSON.stringify({ success: false, error: "Unknown status" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in grouping-webhook:", error);
    await captureException(error, { tags: { fn: "grouping-webhook" } });
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendCullingReadyEmail(
  supabase: any,
  galleryId: string,
  userId: string,
  totalImages: number,
  updatedCount: number,
) {
  // Fetch gallery name
  const { data: gallery } = await supabase
    .from("galleries")
    .select("name")
    .eq("id", galleryId)
    .single();
  if (!gallery) return;

  // Count images scored as "best" (culling_label = 'best')
  const { count: topPicksCount } = await supabase
    .from("gallery_images")
    .select("id", { count: "exact", head: true })
    .eq("gallery_id", galleryId)
    .eq("culling_label", "best")
    .neq("status", "deleted");

  // Fetch user email via admin client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const { createClient: mkClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const adminClient = mkClient(supabaseUrl, serviceKey);

  const { data: userRecord } = await adminClient.auth.admin.getUserById(userId);
  if (!userRecord?.user?.email) return;

  const appUrl     = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");
  const galleryUrl = `${appUrl}/dashboard/galleries/${galleryId}`;
  const template   = cullingReadyTemplate(gallery.name, totalImages, topPicksCount ?? 0, galleryUrl);

  await sendEmail({
    to:           userRecord.user.email,
    subject:      template.subject,
    html:         template.html,
    emailType:    "culling_ready",
    userId,
    metadata:     { galleryId, totalImages, updatedCount, topPicksCount: topPicksCount ?? 0 },
    supabaseAdmin: adminClient,
  });
}
