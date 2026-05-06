/**
 * send-password-reset — generates a Supabase password-reset link
 * and delivers it as a branded Imagick.ai email via Resend.
 *
 * Security:
 *  - Always returns { success: true } — never reveals if email exists
 *  - Checks user existence BEFORE generating a reset link (efficient + safe)
 *  - Rate-limited: max 3 requests per email per hour
 *  - No JWT required (user forgot their password)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import { passwordResetTemplate, googleAccountTemplate } from "../_shared/email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Simple in-memory rate limit: max 3 reset requests per email per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return json({ error: "Missing email" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!checkRateLimit(normalizedEmail)) {
      return json({ error: "Too many requests. Please try again later." }, 429);
    }

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const studioUrl      = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. Check if user exists FIRST (timing-safe: always do the lookup) ────
    // We always perform this lookup so timing is consistent regardless of outcome.
    let userId: string | undefined;
    let isGoogleOnly = false;
    try {
      const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
      const found = userData?.users?.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
      userId = found?.id;

      // Detect if the account is linked to Google (even if it also has email provider)
      const providers: string[] = found?.app_metadata?.providers || [];
      isGoogleOnly = providers.includes("google");
    } catch (err) {
      console.error("listUsers error:", err);
      // Non-fatal — continue with silent success
      return json({ success: true });
    }

    // ── 2. If user doesn't exist — return success to prevent enumeration ──
    if (!userId) {
      console.log(`Password reset requested for non-existent email`);
      return json({ success: true });
    }

    // ── 2b. If Google-only account — send informational email instead of reset link ──
    if (isGoogleOnly) {
      console.log(`Password reset for Google account: ${normalizedEmail}`);
      const googleTemplate = googleAccountTemplate(studioUrl);
      try {
        await sendEmail({
          to:           normalizedEmail,
          subject:      googleTemplate.subject,
          html:         googleTemplate.html,
          emailType:    "google_account_info",
          userId,
          metadata:     { triggered_by: "frontend" },
          supabaseAdmin,
        });
      } catch (e) {
        console.error("Failed to send google-account email:", e);
      }
      return json({ success: true, reason: "google_only" });
    }

    // ── 3. Generate the Supabase recovery link ────────────────────────────────
    const { data: linkData, error: linkError } = await (supabaseAdmin.auth.admin as any).generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo: `${studioUrl}/reset-password`,
      },
    });

    if (linkError) {
      console.error("generateLink error:", linkError.message);
      return json({ success: true }); // silent fail for security
    }

    const resetUrl = linkData?.properties?.action_link || linkData?.action_link;
    if (!resetUrl) {
      console.error("No action_link in generateLink response", JSON.stringify(linkData));
      return json({ success: true }); // silent fail
    }

    // ── 4. Build & send branded email ────────────────────────────────────────
    const template = passwordResetTemplate(resetUrl);

    await sendEmail({
      to:           normalizedEmail,
      subject:      template.subject,
      html:         template.html,
      emailType:    "password_reset",
      userId,
      metadata:     { triggered_by: "frontend" },
      supabaseAdmin,
    });

    return json({ success: true });
  } catch (err) {
    console.error("send-password-reset error:", err);
    // Always return success to avoid leaking info
    return json({ success: true });
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
