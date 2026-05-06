/**
 * Imagick.ai — Core email sending utility.
 *
 * 1. Checks user_email_preferences to honour opt-outs
 * 2. Calls Resend REST API
 * 3. Logs every attempt to email_logs (sent / failed / skipped)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException } from "./sentry.ts";

export const FROM_ADDRESS = "noreply@imagick.ai";
export const FROM_DISPLAY  = `Imagick.ai <${FROM_ADDRESS}>`;
export const REPLY_TO      = "contact@imagick.ai";

// Map email_type → column in user_email_preferences
const PREF_COLUMN: Record<string, string> = {
  welcome_email:           "welcome_email",
  gallery_upload_complete: "gallery_upload_complete",
  gallery_images_ready:    "gallery_images_ready",
  style_training_started:  "style_training_started",
  style_ready:             "style_ready",
  re_edit_submitted:       "re_edit_submitted",
  re_edit_complete:        "re_edit_complete",
  gallery_shared:          "gallery_shared",
  subscription_change:     "subscription_change",
  culling_ready:           "culling_ready",
  gd_import_started:       "gd_import_started",
  gd_import_complete:      "gd_import_complete",
  journey_email:           "journey_emails",
  // password_reset always sends — no opt-out
};

interface SendEmailOptions {
  /** Recipient email address */
  to: string;
  /** Subject line */
  subject: string;
  /** Full HTML body */
  html: string;
  /** Logical email type (used for pref check + logging) */
  emailType: string;
  /** User ID for preference lookup and log association (optional for system emails) */
  userId?: string;
  /** Extra metadata to store in the log */
  metadata?: Record<string, unknown>;
  /** Optional custom sender email (for sender profiles) */
  fromEmail?: string;
  /** Optional custom sender display name */
  fromName?: string;
  /** Optional custom reply-to address */
  replyTo?: string;
  /** Supply a pre-created admin Supabase client (service role) */
  supabaseAdmin: any;
}

export interface SendEmailResult {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const {
    to,
    subject,
    html,
    emailType,
    userId,
    metadata = {},
    fromEmail,
    fromName,
    replyTo,
    supabaseAdmin,
  } = opts;

  // ── 1. Check user preference (skip for password_reset or when no userId) ─
  if (userId && PREF_COLUMN[emailType]) {
    const col = PREF_COLUMN[emailType];
    const { data: prefs } = await supabaseAdmin
      .from("user_email_preferences")
      .select(col)
      .eq("user_id", userId)
      .maybeSingle();

    if (prefs && prefs[col] === false) {
      // User opted out — log it and return
      await logEmail(supabaseAdmin, { userId, to, emailType, subject, status: "skipped", metadata });
      console.log(`Email skipped (user opted out): ${emailType} → ${to}`);
      return { success: true, skipped: true };
    }
  }

  // ── 2. Send via Resend ───────────────────────────────────────────────────
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  if (!RESEND_API_KEY) {
    // Dev / staging fallback — log the would-be email
    console.log(`[DEV] Would send email: ${emailType} → ${to} — "${subject}"`);
    await logEmail(supabaseAdmin, { userId, to, emailType, subject, status: "sent", metadata: { ...metadata, dev_mode: true } });
    return { success: true, messageId: "dev-mode" };
  }

  let resendMessageId: string | undefined;
  let sendError: string | undefined;

  try {
    const senderDisplay =
      fromEmail || fromName
        ? `${fromName || "Imagick.ai"} <${fromEmail || FROM_ADDRESS}>`
        : FROM_DISPLAY;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: senderDisplay,
        reply_to: replyTo || REPLY_TO,
        to: [to],
        subject,
        html,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      sendError = JSON.stringify(body);
      console.error(`Resend error (${res.status}):`, sendError);
    } else {
      resendMessageId = body.id;
      console.log(`Email sent: ${emailType} → ${to} (id: ${resendMessageId})`);
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
    console.error("Resend fetch error:", sendError);
    await captureException(err, {
      tags: { fn: "email-sender", emailType },
      extra: { to, subject },
      user: userId ? { id: userId } : undefined,
    });
  }

  // ── 3. Log to email_logs ─────────────────────────────────────────────────
  await logEmail(supabaseAdmin, {
    userId,
    to,
    emailType,
    subject,
    status: sendError ? "failed" : "sent",
    resendMessageId,
    errorMessage: sendError,
    metadata,
  });

  if (sendError) {
    return { success: false, error: sendError };
  }
  return { success: true, messageId: resendMessageId };
}

// ─── Internal logging helper ──────────────────────────────────────────────────

async function logEmail(
  supabaseAdmin: any,
  opts: {
    userId?: string;
    to: string;
    emailType: string;
    subject: string;
    status: string;
    resendMessageId?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabaseAdmin.from("email_logs").insert({
    user_id:            opts.userId ?? null,
    recipient_email:    opts.to,
    email_type:         opts.emailType,
    subject:            opts.subject,
    status:             opts.status,
    resend_message_id:  opts.resendMessageId ?? null,
    error_message:      opts.errorMessage ?? null,
    metadata:           opts.metadata ?? {},
  });

  if (error) {
    console.error("Failed to write email_log:", error.message);
  }
}
