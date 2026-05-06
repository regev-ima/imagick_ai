/**
 * send-email — generic transactional email endpoint called from the frontend.
 *
 * Unauthenticated types (no session required):
 *   welcome_signup          — sent right after signUp (no session yet)
 *
 * Authenticated types (valid Bearer JWT required):
 *   gallery_upload_complete — sent after all files are uploaded
 *   re_edit_submitted       — sent when user submits a re-edit job
 *   gallery_shared          — confirmation to photographer after sharing
 *   subscription_change     — after plan upgrade or credit purchase
 *
 * Internal/service-role types (called from edge functions):
 *   edits_warning_500       — free user has 500 edits remaining
 *   edits_warning_100       — free user has 100 edits remaining
 *   edits_exhausted         — free user has 0 edits remaining
 *   subscription_activated  — subscription activated via webhook
 *   subscription_cancelled  — subscription cancelled
 *   subscription_expired    — subscription expired
 *   payment_failed          — payment failed / suspended
 *   addon_purchased         — add-on purchased
 *   downgrade_scheduled     — downgrade scheduled for period end
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import {
  welcomeEmailTemplate,
  galleryUploadCompleteTemplate,
  reEditSubmittedTemplate,
  gallerySharedConfirmTemplate,
  subscriptionChangeTemplate,
  editsWarningTemplate,
  editsExhaustedTemplate,
  subscriptionActivatedTemplate,
  subscriptionCancelledTemplate,
  subscriptionExpiredTemplate,
  paymentFailedTemplate,
  addonPurchasedTemplate,
  downgradeScheduledTemplate,
} from "../_shared/email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Rate-limit for unauthenticated welcome_signup (1 per email per hour)
const welcomeRateLimit = new Map<string, number>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin   = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { type } = body as { type: string };
    if (!type) return json({ error: "Missing required field: type" }, 400);

    // ── Unauthenticated path: welcome_signup ────────────────────────────
    // Called immediately after supabase.auth.signUp() — user may not have
    // a session yet if email verification is required.
    if (type === "welcome_signup") {
      const { email, name } = body as { email: string; name?: string };
      if (!email) return json({ error: "Missing email" }, 400);

      // Rate-limit: at most 1 welcome per email per hour
      const lastSent = welcomeRateLimit.get(email.toLowerCase()) || 0;
      if (Date.now() - lastSent < 3_600_000) {
        return json({ success: true, skipped: true });
      }
      welcomeRateLimit.set(email.toLowerCase(), Date.now());

      // Verify the user exists AND was created within the last 15 minutes
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const found = listData?.users?.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (!found) return json({ success: true }); // silent fail

      const ageMs = Date.now() - new Date(found.created_at).getTime();
      if (ageMs > 15 * 60 * 1000) return json({ success: true }); // too old, skip

      const displayName = name || found.user_metadata?.full_name || email.split("@")[0];
      const template    = welcomeEmailTemplate(displayName);

      await sendEmail({
        to: email, subject: template.subject, html: template.html,
        emailType: "welcome_email", userId: found.id,
        metadata: { triggered_by: "signup" }, supabaseAdmin,
      });

      // WhatsApp notification for new signup is handled by track-session edge function
      // (includes device info). No need to duplicate here.

      return json({ success: true });
    }

    const appUrl = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");

    // ── Internal types (called from edge functions with service role key) ──
    // These receive userId in the body and look up user info via admin API.
    const INTERNAL_TYPES = [
      "edits_warning_500", "edits_warning_100", "edits_exhausted",
      "subscription_activated", "subscription_cancelled", "subscription_expired",
      "payment_failed", "addon_purchased", "downgrade_scheduled",
    ];

    if (INTERNAL_TYPES.includes(type)) {
      // Verify caller is an internal service (must provide service role key)
      const internalAuth = req.headers.get("Authorization");
      if (!internalAuth?.startsWith("Bearer ") || internalAuth.replace("Bearer ", "") !== serviceRoleKey) {
        return json({ error: "Forbidden" }, 403);
      }

      const { userId, remaining, planName, billingCycle, periodEnd,
              addonLabel, quantity, amount, currentPlan, targetPlan, switchDate } = body;
      if (!userId) return json({ error: "Missing userId for internal email" }, 400);

      const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (!userRecord?.user?.email) return json({ error: "User not found or no email" }, 404);

      const userEmail = userRecord.user.email;
      const billingUrl = `${appUrl}/dashboard/billing`;
      let template: { subject: string; html: string } | null = null;

      switch (type) {
        case "edits_warning_500":
          template = editsWarningTemplate(500, billingUrl);
          break;
        case "edits_warning_100":
          template = editsWarningTemplate(100, billingUrl);
          break;
        case "edits_exhausted":
          template = editsExhaustedTemplate(billingUrl);
          break;
        case "subscription_activated":
          template = subscriptionActivatedTemplate(planName || "Paid", billingCycle || "monthly", periodEnd || "", billingUrl);
          break;
        case "subscription_cancelled":
          template = subscriptionCancelledTemplate(planName || "Paid", periodEnd || "", billingUrl);
          break;
        case "subscription_expired":
          template = subscriptionExpiredTemplate(planName || "Paid", billingUrl);
          break;
        case "payment_failed":
          template = paymentFailedTemplate(planName || "Paid", billingUrl);
          break;
        case "addon_purchased":
          template = addonPurchasedTemplate(addonLabel || "Add-on", quantity || 1, amount || "0", billingUrl);
          break;
        case "downgrade_scheduled":
          template = downgradeScheduledTemplate(currentPlan || "Current", targetPlan || "Target", switchDate || "", billingUrl);
          break;
      }

      if (!template) return json({ error: "Failed to build template" }, 500);

      const result = await sendEmail({
        to: userEmail, subject: template.subject, html: template.html,
        emailType: type, userId,
        metadata: { triggered_by: "internal", type },
        supabaseAdmin,
      });

      return json(result);
    }

    // ── Authenticated path (frontend calls with user JWT) ─────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);

    const userId    = userData.user.id as string;
    const userEmail = userData.user.email as string;
    const userName  = (userData.user.user_metadata as any)?.full_name
      || userEmail?.split("@")[0]
      || "Photographer";

    let template: { subject: string; html: string } | null = null;
    let emailType = type;

    switch (type) {
      case "gallery_upload_complete": {
        const { galleryName, imageCount, galleryId } = body;
        if (!galleryName || !galleryId) return json({ error: "Missing galleryName or galleryId" }, 400);
        template  = galleryUploadCompleteTemplate(galleryName, imageCount || 0, `${appUrl}/dashboard/galleries/${galleryId}`);
        emailType = "gallery_upload_complete";
        break;
      }

      case "re_edit_submitted": {
        const { galleryName, galleryId, imageCount, styleNames } = body;
        if (!galleryName || !galleryId) return json({ error: "Missing galleryName or galleryId" }, 400);
        template  = reEditSubmittedTemplate(galleryName, imageCount || 0, styleNames || [], `${appUrl}/dashboard/galleries/${galleryId}`);
        emailType = "re_edit_submitted";
        break;
      }

      case "gallery_shared": {
        const { galleryName, galleryId, clientEmail } = body;
        if (!galleryName || !galleryId || !clientEmail) return json({ error: "Missing galleryName, galleryId or clientEmail" }, 400);
        template  = gallerySharedConfirmTemplate(galleryName, clientEmail, `${appUrl}/dashboard/galleries/${galleryId}`);
        emailType = "gallery_shared";
        break;
      }

      case "subscription_change": {
        const { planName, changeType, creditsAdded } = body;
        if (!planName && !creditsAdded) return json({ error: "Missing planName or creditsAdded" }, 400);
        template  = subscriptionChangeTemplate(planName || "Custom", changeType || "upgrade", creditsAdded, `${appUrl}/dashboard/billing`);
        emailType = "subscription_change";
        break;
      }

      default:
        return json({ error: `Unknown email type: ${type}` }, 400);
    }

    if (!template) return json({ error: "Failed to build template" }, 500);

    const result = await sendEmail({
      to: userEmail, subject: template.subject, html: template.html,
      emailType, userId,
      metadata: { triggered_by: "frontend", type },
      supabaseAdmin,
    });

    // WhatsApp notification is sent by image-webhook when processing completes
    return json(result);
  } catch (err) {
    console.error("send-email error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
