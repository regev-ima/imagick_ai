/**
 * gallery-rotate-share-secret
 *
 * KILL SWITCH. Rotates a gallery's share_secret so any leaked URL stops working.
 * Auth required (Bearer). Verifies user owns the gallery, generates a fresh
 * 16-byte hex secret, updates `galleries.share_secret`, and writes a
 * `kill_switch` row to `gallery_audit_log`.
 *
 * If `notifyClients=true` is supplied, we currently only log the intent —
 * actual re-issue of invites is intentionally out of scope for Phase 1 to keep
 * the surface area tight. See TODO below.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RotateRequest {
  galleryId: string;
  notifyClients?: boolean;
}

// In-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20; // 20 rotations per hour per user — kill-switch is rare
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function generateShareSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized - missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) {
      return json({ success: false, error: "Unauthorized - invalid token" }, 401);
    }

    const userId = userData.user.id as string;

    if (!checkRateLimit(userId)) {
      return json({ success: false, error: "Too many rotations. Please try again later." }, 429);
    }

    const { galleryId, notifyClients }: RotateRequest = await req.json();
    if (!galleryId) {
      return json({ success: false, error: "Missing required field: galleryId" }, 400);
    }

    // Verify ownership
    const { data: gallery, error: galleryError } = await supabase
      .from("galleries")
      .select("id, user_id, name")
      .eq("id", galleryId)
      .single();

    if (galleryError || !gallery) {
      return json({ success: false, error: "Gallery not found" }, 404);
    }
    if (gallery.user_id !== userId) {
      return json({ success: false, error: "Forbidden - you do not own this gallery" }, 403);
    }

    // Generate + persist new secret using service-role (RLS-safe)
    const newSecret = generateShareSecret();
    const { error: updateError } = await supabaseAdmin
      .from("galleries")
      .update({ share_secret: newSecret })
      .eq("id", galleryId);

    if (updateError) {
      console.error("[gallery-rotate-share-secret] update failed:", updateError);
      return json({ success: false, error: "Failed to rotate secret" }, 500);
    }

    // Audit log
    const userAgent = req.headers.get("user-agent") || null;
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const { error: auditError } = await supabaseAdmin
      .from("gallery_audit_log")
      .insert({
        gallery_id: galleryId,
        event_type: "kill_switch",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { rotated_by: userId, notify_clients: !!notifyClients },
      });
    if (auditError) {
      console.error("[gallery-rotate-share-secret] audit insert failed:", auditError);
      // Non-fatal — secret already rotated.
    }

    if (notifyClients) {
      // TODO: When re-issue flow is built, enqueue invite re-sends here.
      // For now we just count the recipients and log intent.
      const { data: invites } = await supabaseAdmin
        .from("gallery_invites")
        .select("id, email")
        .eq("gallery_id", galleryId);
      console.log(
        `[gallery-rotate-share-secret] notifyClients requested for gallery ${galleryId}; ` +
          `${invites?.length ?? 0} invites would be re-issued (deferred).`,
      );
    }

    return json({ success: true, newSecret });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[gallery-rotate-share-secret] error:", message);
    return json({ success: false, error: message }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(handler);
