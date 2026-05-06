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

function pick<T = string>(...candidates: unknown[]): T | undefined {
  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== "") return c as T;
  }
  return undefined;
}

function formatMessage(payload: Record<string, unknown>): string {
  // Sentry sends at least three different payload shapes depending on which
  // integration is calling us:
  //   1. Legacy "Webhook" issue alert  →  flat top-level fields
  //   2. Internal Integration alert rule action  →  { data: { event: {...} } }
  //   3. Internal Integration "issue" subscription  →  { data: { issue: {...} } }
  // We treat all three uniformly by checking every place a given field might
  // live and taking the first non-empty value.
  const data = (payload.data as Record<string, unknown> | undefined) || {};
  const event = (pick<Record<string, unknown>>(data.event, payload.event) as Record<string, unknown> | undefined) || {};
  const issue = (pick<Record<string, unknown>>(data.issue, payload.issue) as Record<string, unknown> | undefined) || {};
  const exception = (event.exception as Record<string, unknown> | undefined) || {};
  const exceptionValue = Array.isArray(exception.values) && exception.values.length
    ? (exception.values[0] as Record<string, unknown>)
    : {};

  const project = pick<string>(
    payload.project_name,
    payload.project_slug,
    payload.project,
    data.project_slug,
    data.project_name,
    event.project,
  ) || "imagick-ai";

  const level = (pick<string>(event.level, issue.level, payload.level) || "error").toUpperCase();

  const env = pick<string>(event.environment, payload.environment, issue.environment) || "production";

  // Title — try a wide set of fields, falling back to exception type+value.
  let title = pick<string>(
    event.title,
    issue.title,
    payload.message,
    event.message,
    issue.message,
    payload.culprit,
  );
  if (!title && exceptionValue.type) {
    const exType = exceptionValue.type as string;
    const exVal = exceptionValue.value as string | undefined;
    title = exVal ? `${exType}: ${exVal}` : exType;
  }
  if (!title) {
    title = "Unknown error (payload missing title)";
  }

  const culprit = pick<string>(event.culprit, issue.culprit, payload.culprit) || "";
  const url = pick<string>(
    event.web_url,
    event.url,
    issue.permalink,
    issue.web_url,
    payload.url,
    payload.web_url,
  ) || "";

  const userObj = (pick<Record<string, unknown>>(event.user, issue.user) as Record<string, unknown> | undefined) || {};
  const userEmail = pick<string>(userObj.email, userObj.username) || "";

  const triggeredRule = pick<string>(data.triggered_rule, payload.triggered_rule);

  const lines = [
    `🚨 <b>${escapeHtml(level)}</b> — <code>${escapeHtml(project)}</code> (${escapeHtml(env)})`,
    "",
    `<b>${escapeHtml(title.slice(0, 400))}</b>`,
  ];
  if (culprit) lines.push(`📍 <code>${escapeHtml(culprit.slice(0, 200))}</code>`);
  if (userEmail) lines.push(`👤 ${escapeHtml(userEmail)}`);
  if (triggeredRule) lines.push(`⚙️ ${escapeHtml(triggeredRule)}`);
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
  // If we couldn't find a real title, log the payload shape so we can see
  // exactly which fields the integration is sending and patch formatMessage.
  if (text.includes("Unknown error (payload missing title)")) {
    console.warn(
      "Sentry payload had no recognisable title. Top-level keys:",
      Object.keys(payload).join(", "),
      "data keys:",
      Object.keys((payload.data as Record<string, unknown>) || {}).join(", "),
      "raw (truncated):",
      rawBody.slice(0, 1500),
    );
  }

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
