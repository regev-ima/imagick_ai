/**
 * gallery-finalize-selection
 *
 * Called when a client taps "Send to photographer" after picking their
 * album photos. Public endpoint — validated by gallery existence + the
 * fact that the gallery is currently shareable (client_link set, not
 * revoked, not expired).
 *
 * Side effects:
 *   1. Counts the current `selected=true` rows for this (gallery, email).
 *   2. Inserts `gallery_audit_log` row (event_type='selection_submitted').
 *   3. Emails the photographer (gallery owner) using the existing
 *      sendEmail helper + the new selectionSubmittedTemplate.
 *
 * Rate-limited by gallery_id + client_email so we don't spam photographers
 * if the client double-taps the submit button.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import { selectionSubmittedTemplate } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FinalizeRequest {
  galleryId: string;
  clientEmail: string;
  clientName?: string;
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5; // 5 finalize submits per 10 min per gallery+email
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

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

function getStudioUrl(): string {
  return (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { galleryId, clientEmail, clientName }: FinalizeRequest = await req.json();
    if (!galleryId || !clientEmail) {
      return json({ success: false, error: "Missing required fields: galleryId, clientEmail" }, 400);
    }
    // Basic email shape check (server-side belt + suspenders)
    if (!/^\S+@\S+\.\S+$/.test(clientEmail)) {
      return json({ success: false, error: "Invalid clientEmail" }, 400);
    }

    if (!checkRateLimit(`${galleryId}:${clientEmail.toLowerCase()}`)) {
      return json({ success: false, error: "Too many submissions for this client. Please wait." }, 429);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify gallery is live + grab name and owner
    const { data: gallery, error: galleryError } = await supabaseAdmin
      .from("galleries")
      .select("id, user_id, name, client_link, revoked_at, expiry_date")
      .eq("id", galleryId)
      .maybeSingle();

    if (galleryError) {
      console.error("[gallery-finalize-selection] gallery lookup failed:", galleryError);
      return json({ success: false, error: "Gallery lookup failed" }, 500);
    }
    if (!gallery || !gallery.client_link || gallery.revoked_at) {
      return json({ success: false, error: "Gallery is not available" }, 404);
    }
    if (gallery.expiry_date && new Date(gallery.expiry_date) < new Date()) {
      return json({ success: false, error: "Gallery has expired" }, 410);
    }

    // Count the client's current selections
    const { count, error: countError } = await supabaseAdmin
      .from("gallery_selections")
      .select("id", { count: "exact", head: true })
      .eq("gallery_id", galleryId)
      .eq("client_email", clientEmail)
      .eq("selected", true);

    if (countError) {
      console.error("[gallery-finalize-selection] count failed:", countError);
      return json({ success: false, error: "Failed to count selections" }, 500);
    }

    const selectedCount = count ?? 0;

    // Audit log
    const userAgent = req.headers.get("user-agent") || null;
    const ip = getClientIp(req);
    const { error: auditError } = await supabaseAdmin
      .from("gallery_audit_log")
      .insert({
        gallery_id: galleryId,
        event_type: "selection_submitted",
        ip_address: ip === "unknown" ? null : ip,
        user_agent: userAgent,
        metadata: {
          client_email: clientEmail,
          client_name: clientName ?? null,
          count: selectedCount,
        },
      });
    if (auditError) {
      console.error("[gallery-finalize-selection] audit insert failed:", auditError);
      // Non-fatal — keep going so the client doesn't see a failure.
    }

    // Notify photographer (best-effort; we don't fail the request if email errors)
    try {
      const { data: photographerRecord } = await supabaseAdmin.auth.admin.getUserById(gallery.user_id);
      const photographerEmail = photographerRecord?.user?.email;
      if (photographerEmail) {
        const studioUrl = getStudioUrl();
        const dashboardUrl = `${studioUrl}/dashboard/galleries/${gallery.id}/selections`;
        const template = selectionSubmittedTemplate(
          gallery.name || "your gallery",
          clientName || clientEmail.split("@")[0] || "",
          selectedCount,
          dashboardUrl,
        );
        await sendEmail({
          to: photographerEmail,
          subject: template.subject,
          html: template.html,
          emailType: "gallery_shared", // reuse existing pref bucket
          userId: gallery.user_id,
          metadata: {
            galleryId: gallery.id,
            clientEmail,
            selectedCount,
            event: "selection_submitted",
          },
          supabaseAdmin,
        });
      } else {
        console.warn("[gallery-finalize-selection] no photographer email for user", gallery.user_id);
      }
    } catch (notifyErr) {
      console.error("[gallery-finalize-selection] notify photographer failed:", notifyErr);
      // Swallow — selection is recorded, photographer can still see it in dashboard.
    }

    // TODO: also push a WhatsApp notification via notify-whatsapp once the
    // per-photographer phone number is wired up (Phase 1b).

    return json({ success: true, data: { ok: true, count: selectedCount } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[gallery-finalize-selection] error:", message);
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
