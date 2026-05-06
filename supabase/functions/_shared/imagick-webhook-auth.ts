/**
 * Shared shared-secret authentication for Imagick API → Supabase webhooks.
 *
 * Why: image-webhook, grouping-webhook, train-webhook, and gd-transfer-webhook
 * are all unauthenticated edge functions (verify_jwt = false) that mutate user
 * data based on payload fields like userId / imageId. Without a check, anyone
 * who knows the URL can spoof completion callbacks — e.g. mark a victim's
 * image "ready" with an attacker-controlled URL, decrement their edit
 * balance, or replace style before/after pairs.
 *
 * The fix: append `?token=<IMAGICK_WEBHOOK_SECRET>` when constructing the
 * callback URL on the outbound call, and verify that token on the inbound
 * webhook. The Imagick API echoes the URL byte-for-byte, so the query string
 * survives the round-trip.
 *
 * Backwards-compatibility: if `IMAGICK_WEBHOOK_SECRET` is unset on the
 * receiver side, verification is skipped (logged as a warning). This lets us
 * deploy code first, then rotate in the secret, then enforce.
 */

const SECRET_QUERY_PARAM = "token";

export function getWebhookSecret(): string | null {
  const v = Deno.env.get("IMAGICK_WEBHOOK_SECRET");
  return v && v.length > 0 ? v : null;
}

/**
 * Append the shared secret as a query string parameter to the given
 * callback URL. Returns the URL unchanged if no secret is configured.
 */
export function appendWebhookSecret(url: string): string {
  const secret = getWebhookSecret();
  if (!secret) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${SECRET_QUERY_PARAM}=${encodeURIComponent(secret)}`;
}

/**
 * Verify the inbound webhook request carries a matching shared secret.
 * Accepts the secret from either:
 *   - `?token=<secret>` query param (the standard path)
 *   - `X-Imagick-Webhook-Secret` request header (alt path for callers that
 *     can pass headers but rewrite query strings)
 *
 * Returns true (allowed) when:
 *   - no IMAGICK_WEBHOOK_SECRET is configured (backwards compat), OR
 *   - the supplied token matches via constant-time comparison
 */
export async function verifyWebhookSecret(req: Request): Promise<boolean> {
  const expected = getWebhookSecret();
  if (!expected) {
    console.warn("IMAGICK_WEBHOOK_SECRET not configured — skipping webhook auth check");
    return true;
  }

  const url = new URL(req.url);
  const fromQuery = url.searchParams.get(SECRET_QUERY_PARAM);
  const fromHeader = req.headers.get("x-imagick-webhook-secret");
  const supplied = fromQuery || fromHeader || "";

  if (!supplied) return false;
  return await timingSafeEqual(supplied, expected);
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const ah = await crypto.subtle.digest("SHA-256", enc.encode(a));
  const bh = await crypto.subtle.digest("SHA-256", enc.encode(b));
  const av = new Uint8Array(ah);
  const bv = new Uint8Array(bh);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}
