/**
 * gallery-record-share
 *
 * Public beacon. Called from the client gallery whenever a viewer taps a
 * share button (WhatsApp / email / copy / Instagram / Facebook / Twitter).
 * Powers the "viral" insights & engagement_score.
 *
 * No auth required. Anti-spam: 10 events / minute / IP in an in-memory map.
 * The gallery must be live (client_link not null, not revoked, not expired).
 *
 * Writes:
 *   1. gallery_share_events (channel, image_id, ip, user agent, session token)
 *   2. gallery_audit_log    (event_type='share', metadata { channel, image_id })
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ShareChannel = "whatsapp" | "email" | "copy" | "instagram" | "facebook" | "twitter" | "other";
const VALID_CHANNELS: ShareChannel[] = [
  "whatsapp", "email", "copy", "instagram", "facebook", "twitter", "other",
];

interface ShareRequest {
  galleryId: string;
  imageId?: string;
  channel: ShareChannel;
  sessionToken?: string;
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 10 events / minute / IP

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

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return json({ success: false, error: "Too many share events. Please slow down." }, 429);
    }

    const { galleryId, imageId, channel, sessionToken }: ShareRequest = await req.json();
    if (!galleryId || !channel) {
      return json({ success: false, error: "Missing required fields: galleryId, channel" }, 400);
    }
    if (!VALID_CHANNELS.includes(channel)) {
      return json({ success: false, error: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(", ")}` }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify gallery is shareable
    const { data: gallery, error: galleryError } = await supabaseAdmin
      .from("galleries")
      .select("id, client_link, revoked_at, expiry_date")
      .eq("id", galleryId)
      .maybeSingle();

    if (galleryError) {
      console.error("[gallery-record-share] gallery lookup failed:", galleryError);
      return json({ success: false, error: "Gallery lookup failed" }, 500);
    }
    if (!gallery || !gallery.client_link || gallery.revoked_at) {
      return json({ success: false, error: "Gallery is not shareable" }, 404);
    }
    if (gallery.expiry_date && new Date(gallery.expiry_date) < new Date()) {
      return json({ success: false, error: "Gallery has expired" }, 410);
    }

    const userAgent = req.headers.get("user-agent") || null;

    const { error: shareError } = await supabaseAdmin
      .from("gallery_share_events")
      .insert({
        gallery_id: galleryId,
        image_id: imageId || null,
        channel,
        session_token: sessionToken || null,
        ip_address: ip === "unknown" ? null : ip,
        user_agent: userAgent,
      });
    if (shareError) {
      console.error("[gallery-record-share] share insert failed:", shareError);
      return json({ success: false, error: "Failed to record share event" }, 500);
    }

    const { error: auditError } = await supabaseAdmin
      .from("gallery_audit_log")
      .insert({
        gallery_id: galleryId,
        event_type: "share",
        ip_address: ip === "unknown" ? null : ip,
        user_agent: userAgent,
        session_token: sessionToken || null,
        metadata: { channel, image_id: imageId || null },
      });
    if (auditError) {
      console.error("[gallery-record-share] audit insert failed:", auditError);
      // Non-fatal — share event already recorded.
    }

    return json({ success: true, data: { ok: true } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[gallery-record-share] error:", message);
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
