// Edge function to trigger AI grouping/culling via external API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface StartGroupingRequest {
  galleryId: string;
  labels?: string[];
  thresholds?: number[];
  timeThreshold?: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;

    const body = await req.json() as StartGroupingRequest;
    const { galleryId, labels = [], thresholds = [0.5, 0.7, 0.9], timeThreshold = 60 } = body;

    if (!galleryId) {
      return new Response(
        JSON.stringify({ error: "galleryId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify gallery ownership
    const { data: gallery, error: galleryError } = await supabaseAdmin
      .from("galleries")
      .select("id, user_id, status")
      .eq("id", galleryId)
      .eq("user_id", userId)
      .single();

    if (galleryError || !gallery) {
      console.error("Gallery not found or unauthorized:", galleryError);
      return new Response(
        JSON.stringify({ error: "Gallery not found or unauthorized" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update gallery culling status to processing, store labels, and record start time
    const { error: updateError } = await supabaseAdmin
      .from("galleries")
      .update({ 
        culling_status: "processing",
        culling_labels: labels,
        culling_started_at: new Date().toISOString(),
        culling_completed_at: null
      })
      .eq("id", galleryId);

    if (updateError) {
      console.error("Error updating gallery status:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update gallery status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API credentials
    const apiUsername = Deno.env.get("IMAGICK_API_USERNAME")!;
    const apiPassword = Deno.env.get("IMAGICK_API_PASSWORD")!;
    const apiEndpoint = "https://imagick-api-endpoint.rx8rq49b5c.workers.dev/make-grouping/";

    // Build webhook URL for callback
    const webhookUrl = `${supabaseUrl}/functions/v1/grouping-webhook`;

    // Prepare request body for external API
    const requestBody = {
      collectionId: galleryId,
      thresholds: thresholds,
      timeThreshold: timeThreshold,
      labels: labels,
      callbackURL: webhookUrl,
      callbackArgs: { 
        galleryId, 
        userId 
      },
      callbackHeaders: {}
    };

    console.log("Calling external API with:", JSON.stringify(requestBody, null, 2));

    // Call external API
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Username": apiUsername,
        "Password": apiPassword,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("External API error:", errorText);
      
      // Reset culling status on failure
      await supabaseAdmin
        .from("galleries")
        .update({ culling_status: "idle" })
        .eq("id", galleryId);

      return new Response(
        JSON.stringify({ error: "Failed to start grouping process", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Grouping started successfully for gallery:", galleryId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Grouping/culling process started",
        galleryId 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in start-grouping:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
