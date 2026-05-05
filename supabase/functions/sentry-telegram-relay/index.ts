/**
 * sentry-telegram-relay — receives a Sentry "Send notification via webhook"
 * payload and forwards a concise alert to Telegram.
 *
 * Configure in Sentry:
 *   Project → Alerts → Create Alert → "When a new issue is created"
 *   → "Send a notification via webhook" → URL = this function's URL.
 *
 * Required Edge Function Secrets:
 *   TELEGRAM_BOT_TOKEN  — token from BotFather, e.g. "1234:abcd"
 *   TELEGRAM_CHAT_ID    — numeric chat id of the recipient
 *
 * Optional secrets:
 *   SENTRY_WEBHOOK_SECRET — if set, the X-Sentry-Hook-Signature header is
 *                           validated (HMAC-SHA256 of raw body using this
 *                           secret as the key). Requests with a bad signature
 *                           return 401.
 */
import { corsHeaders } from "../_shared/cors.ts";

const TELEGRAM_API = "https://api.telegram.org";

async function verifySignature(rawBody: string, headerValue: string | null, secret: string): Promise<boolean> {
  if (!headerValue) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === headerValue;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatMessage(payload: Record<string, unknown>): string {
  const project = (payload.project_name as string) || (payload.project as string) || "imagick-ai";
  const level = ((payload.level as string) || "error").toUpperCase();
  const culprit = (payload.culprit as string) || "";
  const url = (payload.url as string) || "";

  // Sentry sends either { message } at the top level (legacy) or nests it
  // under { event: { title | message } } (newer integrations).
  const event = (payload.event as Record<string, unknown> | undefined) || {};
  const title =
    (payload.message as string) ||
    (event.title as string) ||
    (event.message as string) ||
    "Unknown error";

  const env = (event.environment as string) || "production";
  const userEmail =
    ((event.user as Record<string, unknown> | undefined)?.email as string) || "";

  const lines = [
    `🚨 <b>${escapeHtml(level)}</b> — <code>${escapeHtml(project)}</code> (${escapeHtml(env)})`,
    "",
    `<b>${escapeHtml(title)}</b>`,
  ];
  if (culprit) lines.push(`📍 <code>${escapeHtml(culprit)}</code>`);
  if (userEmail) lines.push(`👤 ${escapeHtml(userEmail)}`);
  if (url) lines.push("", `🔗 <a href="${escapeHtml(url)}">Open in Sentry</a>`);
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!botToken || !chatId) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID secret");
    return new Response(JSON.stringify({ error: "Telegram secrets not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  const webhookSecret = Deno.env.get("SENTRY_WEBHOOK_SECRET");
  if (webhookSecret) {
    const sig = req.headers.get("sentry-hook-signature") || req.headers.get("x-sentry-hook-signature");
    const ok = await verifySignature(rawBody, sig, webhookSecret);
    if (!ok) {
      console.warn("Sentry webhook signature mismatch");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const text = formatMessage(payload);

  try {
    const tgRes = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const tgBody = await tgRes.json();
    if (!tgRes.ok || tgBody.ok === false) {
      console.error("Telegram sendMessage failed:", tgRes.status, tgBody);
      return new Response(JSON.stringify({ ok: false, telegram: tgBody }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Telegram fetch error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
