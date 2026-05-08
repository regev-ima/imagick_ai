/**
 * AI Culling time estimation.
 *
 * The user reports culling takes roughly 1 minute per 1000 photos in
 * production. We add a 30-second-per-1000 safety buffer and cap the
 * minimum at 60 seconds (covers the cold-start + signed-URL fetch
 * even on a tiny gallery).
 *
 *   1000 images → 90 seconds
 *   2000 images → 180 seconds (the user's "up to 3 minutes" example)
 *   500  images →  60 seconds (floor)
 *
 * "Stuck" detection scales with the same estimate so we don't show
 * "looks stuck — retry" until we're well past the realistic
 * completion window: stuckThresholdSeconds = ceil(estimate × 1.5),
 * minimum 5 minutes.
 */

const MS_PER_THOUSAND_BASE = 60 * 1000;
const MS_PER_THOUSAND_BUFFER = 30 * 1000;
const MIN_ESTIMATE_MS = 60 * 1000;
const MIN_STUCK_MS = 5 * 60 * 1000;
const STUCK_MULTIPLIER = 1.5;

/** Estimated milliseconds the culling run will take, rounded up to the second. */
export function estimateCullingMs(imageCount: number): number {
  if (!imageCount || imageCount <= 0) return MIN_ESTIMATE_MS;
  const thousands = imageCount / 1000;
  const ms = Math.ceil(thousands * (MS_PER_THOUSAND_BASE + MS_PER_THOUSAND_BUFFER));
  return Math.max(MIN_ESTIMATE_MS, Math.ceil(ms / 1000) * 1000);
}

/** Threshold past which we consider an in-flight culling run "stuck". */
export function stuckThresholdMs(imageCount: number): number {
  return Math.max(MIN_STUCK_MS, Math.ceil(estimateCullingMs(imageCount) * STUCK_MULTIPLIER));
}

/** Format ms as a human-friendly duration like "3 min" or "45 s". */
export function formatDuration(ms: number): string {
  if (ms < 60_000) {
    return `${Math.max(1, Math.round(ms / 1000))} s`;
  }
  const minutes = Math.round(ms / 60_000);
  return `${minutes} min`;
}
