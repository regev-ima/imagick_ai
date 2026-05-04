// Edge function to fetch AI Culling and Grouping data from external API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const IMAGICK_API_URL = "https://imagick-api-endpoint.rx8rq49b5c.workers.dev";

interface CullingDataItem {
  PhotoID: string;
  external_id?: string;
  original_name: string;
  culling: number;
  grouping_1: number;
  grouping_2: number;
  grouping_3: number;
  label?: string;
  status?: string;
}

interface FetchCullingRequest {
  galleryId: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // For database updates with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Get Imagick API credentials
    const username = Deno.env.get("IMAGICK_API_USERNAME");
    const password = Deno.env.get("IMAGICK_API_PASSWORD");

    if (!username || !password) {
      console.error("Missing IMAGICK_API_USERNAME or IMAGICK_API_PASSWORD");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { galleryId } = body as FetchCullingRequest;

    if (!galleryId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: galleryId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns the gallery
    const { data: gallery, error: galleryError } = await supabase
      .from("galleries")
      .select("id, name, user_id")
      .eq("id", galleryId)
      .eq("user_id", userId)
      .single();

    if (galleryError || !gallery) {
      return new Response(
        JSON.stringify({ error: "Gallery not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update gallery to show culling is in progress
    await supabaseAdmin
      .from("galleries")
      .update({ culling_status: "processing" })
      .eq("id", galleryId);

    // Call the external API to get culling data
    console.log("Fetching culling data for collection:", galleryId);

    const response = await fetch(`${IMAGICK_API_URL}/collection/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Username": username,
        "Password": password,
      },
      body: JSON.stringify({ collectionID: galleryId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Imagick API error:", response.status, errorText);
      
      // Reset status on error
      await supabaseAdmin
        .from("galleries")
        .update({ culling_status: "idle" })
        .eq("id", galleryId);
      
      return new Response(
        JSON.stringify({ error: `API error: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cullingData: CullingDataItem[] = await response.json();
    console.log("Received culling data for", cullingData.length, "images");

    // Fetch all images from this gallery
    const { data: galleryImages, error: imagesError } = await supabaseAdmin
      .from("gallery_images")
      .select("id, filename")
      .eq("gallery_id", galleryId);

    if (imagesError) {
      console.error("Error fetching gallery images:", imagesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch gallery images" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create lookup maps for matching
    const imagesByUuid = new Map<string, string>(); // PhotoID -> image.id
    const imagesByFilename = new Map<string, string>(); // original_name -> image.id

    galleryImages?.forEach(img => {
      // The image.id is the UUID we sent as imageUUID
      imagesByUuid.set(img.id, img.id);
      // Also map by filename (without extension for more flexible matching)
      const filenameBase = img.filename.replace(/\.[^/.]+$/, "").toLowerCase();
      imagesByFilename.set(filenameBase, img.id);
      imagesByFilename.set(img.filename.toLowerCase(), img.id);
    });

    // Update each image with culling data
    let updatedCount = 0;
    let notFoundCount = 0;

    for (const item of cullingData) {
      // Try to find the image by PhotoID first (should match imageUUID)
      let imageId = imagesByUuid.get(item.PhotoID) || imagesByUuid.get(item.external_id || "");
      
      // Fallback to filename matching
      if (!imageId && item.original_name) {
        const filenameBase = item.original_name.replace(/\.[^/.]+$/, "").toLowerCase();
        imageId = imagesByFilename.get(filenameBase) || imagesByFilename.get(item.original_name.toLowerCase());
      }

      if (imageId) {
        const { error: updateError } = await supabaseAdmin
          .from("gallery_images")
          .update({
            culling_score: item.culling,
            similarity_group_1: item.grouping_1,
            similarity_group_2: item.grouping_2,
            similarity_group_3: item.grouping_3,
            culling_label: item.label || null,
          })
          .eq("id", imageId);

        if (updateError) {
          console.error("Error updating image", imageId, ":", updateError);
        } else {
          updatedCount++;
        }
      } else {
        console.warn("Could not match image:", item.PhotoID, item.original_name);
        notFoundCount++;
      }
    }

    // Update gallery culling status to ready
    await supabaseAdmin
      .from("galleries")
      .update({ culling_status: "ready" })
      .eq("id", galleryId);

    console.log(`Culling data updated: ${updatedCount} images updated, ${notFoundCount} not found`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${updatedCount} images with culling data`,
        updated: updatedCount,
        notFound: notFoundCount,
        total: cullingData.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in fetch-culling-data:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
