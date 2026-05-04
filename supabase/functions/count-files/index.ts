import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const IMAGICK_API_URL = "https://imagick-api-endpoint.rx8rq49b5c.workers.dev/count-files/";

interface CountFilesRequest {
  folder: string;
  bucket?: string;
}

interface CountFilesResponse {
  Status: string;
  Folder: string;
  FileCount: number;
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

    // Parse request body
    const body: CountFilesRequest = await req.json();
    const { folder, bucket } = body;

    if (!folder) {
      return new Response(
        JSON.stringify({ error: "folder is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Imagick API credentials from environment
    const apiUsername = Deno.env.get("IMAGICK_API_USERNAME");
    const apiPassword = Deno.env.get("IMAGICK_API_PASSWORD");

    if (!apiUsername || !apiPassword) {
      console.error("Missing Imagick API credentials");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling Imagick API count-files:", { folder, bucket });

    // Call the Imagick API
    const apiResponse = await fetch(IMAGICK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Username": apiUsername,
        "Password": apiPassword,
      },
      body: JSON.stringify({
        folder,
        bucket: bucket || undefined,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("Imagick API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to count files" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data: CountFilesResponse = await apiResponse.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        folder: data.Folder,
        fileCount: data.FileCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in count-files:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
