import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface UpdatePasswordRequest {
  galleryId: string;
  password: string | null;
}

// Hash password using Web Crypto API (PBKDF2)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  
  // Combine salt and hash, then base64 encode
  const combined = new Uint8Array(salt.length + new Uint8Array(hash).length);
  combined.set(salt);
  combined.set(new Uint8Array(hash), salt.length);
  
  return btoa(String.fromCharCode(...combined));
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user token
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    const { galleryId, password }: UpdatePasswordRequest = await req.json();

    // Validate required fields
    if (!galleryId) {
      return new Response(
        JSON.stringify({ error: "Missing galleryId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns the gallery
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
        JSON.stringify({ error: "Forbidden - you do not own this gallery" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the password if provided, otherwise set to null
    let hashedPassword: string | null = null;
    if (password && password.trim()) {
      hashedPassword = await hashPassword(password);
    }

    // Update the gallery password using service role to bypass RLS restrictions on password column
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await serviceSupabase
      .from("galleries")
      .update({ client_password: hashedPassword })
      .eq("id", galleryId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in update-gallery-password function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
