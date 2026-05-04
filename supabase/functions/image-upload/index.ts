// Edge function to get signed URLs from Imagick API for B2 uploads
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
 
 const IMAGICK_API_URL = "https://imagick-api-endpoint.rx8rq49b5c.workers.dev";
const B2_PROXY_URL = "https://cloudflare-b2-proxy.rx8rq49b5c.workers.dev";
 
 interface SignUrlRequest {
   bucket: string;
   prefix: string;
   names: string[];
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
     
     const supabase = createClient(supabaseUrl, supabaseAnonKey, {
       global: { headers: { Authorization: authHeader } },
     });
 
     // Verify the user
     const token = authHeader.replace("Bearer ", "");
     const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
     if (claimsError || !claimsData.user) {
       return new Response(
         JSON.stringify({ error: "Unauthorized" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const userId = claimsData.user.id;
 
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
 
    // === Storage limit check ===
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: storageLimitGb } = await adminClient.rpc(
      "get_effective_storage_limit",
      { p_user_id: userId }
    );

    if (storageLimitGb && storageLimitGb > 0) {
      const { data: subData } = await adminClient
        .from("user_subscriptions")
        .select("storage_used_mb")
        .eq("user_id", userId)
        .single();

      const storageUsedGb = (subData?.storage_used_mb || 0) / 1024;
      if (storageUsedGb >= storageLimitGb) {
        return new Response(
          JSON.stringify({
            error: "storage_limit_exceeded",
            message: `Storage limit exceeded. You're using ${storageUsedGb.toFixed(1)} GB of ${storageLimitGb} GB. Please upgrade your plan or purchase additional storage.`,
            storageUsedGb: Math.round(storageUsedGb * 10) / 10,
            storageLimitGb,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body = await req.json();
    const { bucket, prefix, names } = body as SignUrlRequest;

    if (!bucket || !prefix || !names || !Array.isArray(names)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: bucket, prefix, names" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure prefix ends with / for proper path joining
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
 
    console.log(`Getting signed URLs for ${names.length} files, bucket: ${bucket}, prefix: ${normalizedPrefix}`);

    // Call Imagick API to get signed URLs for direct B2 upload
    const signUrlResponse = await fetch(`${IMAGICK_API_URL}/sign-urls/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Username": username,
        "Password": password,
      },
      body: JSON.stringify({ bucket, prefix: normalizedPrefix, names }),
    });
 
     if (!signUrlResponse.ok) {
       const errorText = await signUrlResponse.text();
       console.error("Sign URL API error:", signUrlResponse.status, errorText);
       return new Response(
         JSON.stringify({ error: "Failed to get signed URLs", details: errorText }),
         { status: signUrlResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const signedUrls = await signUrlResponse.json();
    console.log("Got signed URLs:", JSON.stringify(signedUrls));
 
     return new Response(
       JSON.stringify({ 
         success: true, 
         urls: signedUrls,
        b2ProxyUrl: B2_PROXY_URL,
        userId: userId
       }),
       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
 
   } catch (error: unknown) {
     console.error("Error in image-upload:", error);
     const errorMessage = error instanceof Error ? error.message : "Internal server error";
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });