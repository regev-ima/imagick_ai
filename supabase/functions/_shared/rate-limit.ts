/**
 * Shared rate limiter for public-facing edge functions.
 *
 * Backed by the `rate_limit_buckets` table and `check_rate_limit` SQL
 * function (see migration 20260506073000_rate_limit_buckets.sql). The
 * limiter is strictly more accurate than the legacy in-memory Map-based
 * limiters because all instances of an edge function share the same DB,
 * so a burst from one IP can't be split across cold-started instances
 * to bypass the cap.
 *
 * Usage:
 *   import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";
 *
 *   const ip = getClientIp(req);
 *   const limit = await checkRateLimit(supabaseAdmin, {
 *     key: `pwreset:${ip}`,
 *     maxRequests: 10,
 *     windowSeconds: 3600,
 *   });
 *   if (!limit.allowed) {
 *     return new Response(JSON.stringify({ error: "rate_limited" }), {
 *       status: 429,
 *       headers: { ...corsHeaders, "Retry-After": String(limit.retryAfter) },
 *     });
 *   }
 */

export interface RateLimitConfig {
  /** Unique key for this bucket. Combine endpoint name + identifier (IP / email / token / etc.). */
  key: string;
  /** Maximum allowed calls in the window. */
  maxRequests: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying. 0 when allowed. */
  retryAfter: number;
}

export async function checkRateLimit(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  cfg: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: cfg.key,
      p_max_requests: cfg.maxRequests,
      p_window_seconds: cfg.windowSeconds,
    });

    if (error) {
      console.warn("Rate limit check failed, allowing request:", error);
      return { allowed: true, retryAfter: 0 };
    }

    const row = (data as { allowed?: boolean; retry_after?: number } | null) ?? null;
    if (!row) {
      // Fail open — never block legitimate users due to a rate-limit infra bug.
      return { allowed: true, retryAfter: 0 };
    }
    return {
      allowed: row.allowed !== false,
      retryAfter: typeof row.retry_after === "number" ? row.retry_after : 0,
    };
  } catch (err) {
    console.warn("Rate limit check threw, allowing request:", err);
    return { allowed: true, retryAfter: 0 };
  }
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
