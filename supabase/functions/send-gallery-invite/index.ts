/**
 * send-gallery-invite
 *
 * Sends a branded gallery invite to the client (recipient email).
 * Also sends a short confirmation to the photographer (gallery owner).
 * Logs both sends to email_logs.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import { galleryClientInviteTemplate, gallerySharedConfirmTemplate } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InviteRequest {
  galleryId: string;
  email: string;
  clientName?: string;
  galleryName: string;
  galleryUrl: string;
  password?: string;
  template: string;
  darkMode: boolean;
}

// In-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10; // Max emails per hour per user
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized - missing authorization header" }, 401);
    }

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify user token
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) {
      return json({ error: "Unauthorized - invalid token" }, 401);
    }

    const userId = userData.user.id as string;

    if (!checkRateLimit(userId)) {
      return json({ error: "Too many emails sent. Please try again later." }, 429);
    }

    const {
      galleryId,
      email,
      clientName,
      galleryName,
      galleryUrl,
      password,
    }: InviteRequest = await req.json();

    if (!email || !galleryName || !galleryUrl || !galleryId) {
      return json({ error: "Missing required fields: email, galleryId, galleryName, or galleryUrl" }, 400);
    }

    // Verify gallery ownership
    const { data: gallery, error: galleryError } = await supabase
      .from("galleries")
      .select("id, user_id")
      .eq("id", galleryId)
      .single();

    if (galleryError || !gallery) return json({ error: "Gallery not found" }, 404);
    if (gallery.user_id !== userId) return json({ error: "Forbidden - you do not own this gallery" }, 403);

    // Fetch photographer name for the invite email
    const { data: photographerRecord } = await supabaseAdmin.auth.admin.getUserById(userId);
    const photographerName = photographerRecord?.user?.user_metadata?.full_name ||
      photographerRecord?.user?.email?.split("@")[0] || "Your photographer";
    const photographerEmail = photographerRecord?.user?.email;

    // ── Send invite to client ─────────────────────────────────────────────
    const clientTemplate = galleryClientInviteTemplate(
      clientName || email.split("@")[0],
      photographerName,
      galleryName,
      galleryUrl,
      password
    );

    const clientResult = await sendEmail({
      to:           email,
      subject:      clientTemplate.subject,
      html:         clientTemplate.html,
      emailType:    "gallery_shared_client", // no pref check for client emails
      metadata:     { galleryId, galleryName, invitedBy: userId },
      supabaseAdmin,
    });

    // ── Send confirmation to photographer ────────────────────────────────
    if (photographerEmail) {
      const confirmTemplate = gallerySharedConfirmTemplate(galleryName, email, galleryUrl);
      await sendEmail({
        to:           photographerEmail,
        subject:      confirmTemplate.subject,
        html:         confirmTemplate.html,
        emailType:    "gallery_shared",
        userId,
        metadata:     { galleryId, clientEmail: email },
        supabaseAdmin,
      });
    }

    return json({ success: true, data: { id: clientResult.messageId } });
  } catch (error: any) {
    console.error("Error in send-gallery-invite:", error);
    return json({ error: error.message }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(handler);
