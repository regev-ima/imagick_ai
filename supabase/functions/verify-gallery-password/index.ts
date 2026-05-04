import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyRequest {
  galleryId: string;
  password: string;
}

// In-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5; // Max attempts
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Verify password using Web Crypto API (PBKDF2)
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    
    // Decode the stored hash (base64 encoded salt + hash)
    const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));
    
    // Extract salt (first 16 bytes) and stored hash (remaining 32 bytes)
    const salt = combined.slice(0, 16);
    const storedHashBytes = combined.slice(16);
    
    // Derive key from provided password
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
    
    // Compare hashes
    const hashBytes = new Uint8Array(hash);
    if (hashBytes.length !== storedHashBytes.length) {
      return false;
    }
    
    // Constant-time comparison
    let result = 0;
    for (let i = 0; i < hashBytes.length; i++) {
      result |= hashBytes[i] ^ storedHashBytes[i];
    }
    
    return result === 0;
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    
    const { galleryId, password }: VerifyRequest = await req.json();

    // Validate required fields
    if (!galleryId || !password) {
      return new Response(
        JSON.stringify({ error: "Missing galleryId or password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit by IP + galleryId combination
    const rateLimitKey = `${clientIp}:${galleryId}`;
    if (!checkRateLimit(rateLimitKey)) {
      return new Response(
        JSON.stringify({ error: "Too many attempts. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role key to access password column
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the gallery's password using service role (bypasses RLS)
    const { data: gallery, error } = await supabase
      .from("galleries")
      .select("id, client_password")
      .eq("client_link", galleryId)
      .single();

    if (error || !gallery) {
      return new Response(
        JSON.stringify({ error: "Gallery not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storedPassword = gallery.client_password || "";
    let isValid = false;
    
    if (storedPassword.startsWith("$2")) {
      // Legacy bcrypt hash - these cannot be verified in edge runtime
      // User needs to reset password via dashboard
      return new Response(
        JSON.stringify({ error: "Password needs to be reset. Please contact the gallery owner." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (storedPassword.length > 50) {
      // PBKDF2 hash (base64 encoded, will be 64+ chars for 16-byte salt + 32-byte hash)
      isValid = await verifyPassword(password, storedPassword);
    } else {
      // Legacy plaintext password - compare directly, then upgrade to hash
      isValid = storedPassword === password;
      
      if (isValid) {
        // Opportunistic upgrade: rehash plaintext password to PBKDF2
        try {
          const encoder = new TextEncoder();
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
          const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
          const combined = new Uint8Array(salt.length + new Uint8Array(hash).length);
          combined.set(salt);
          combined.set(new Uint8Array(hash), salt.length);
          const hashedPassword = btoa(String.fromCharCode(...combined));
          
          await supabase
            .from("galleries")
            .update({ client_password: hashedPassword })
            .eq("client_link", galleryId);
          console.log("Upgraded legacy plaintext password to PBKDF2 hash");
        } catch (e) {
          console.error("Failed to upgrade plaintext password:", e);
        }
      }
    }

    if (!isValid) {
      return new Response(
        JSON.stringify({ valid: false, error: "Incorrect password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Password is correct - generate a session token and store it server-side
    const accessToken = crypto.randomUUID();

    // Store session in database (expires in 24 hours)
    const { error: sessionError } = await supabase
      .from("gallery_sessions")
      .insert({
        gallery_id: gallery.id,
        session_token: accessToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

    if (sessionError) {
      console.error("Failed to create gallery session:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ valid: true, accessToken }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-gallery-password function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
