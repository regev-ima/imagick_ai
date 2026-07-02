/**
 * AI Culling time estimation.
 *
 * The current engine (Modal CLIP grouping + ArcFace faces + batched
 * OpenRouter culling/tagging) is an order of magnitude faster than the
 * old per-image API. Real runs land around ~1 second per photo end to
 * end (e.g. ~1–2 min for 200 photos, dominated by the batched VLM pass),
 * plus a small fixed floor for cold-start and dispatch.
 *
 * The displayed estimate is intentionally realistic:
 *
 *   expected time = 20 second floor + 1 second per image
 *
 *   0     images →  0:20
 *   25    images →  0:45
 *   200   images →  3:40
 *   1000  images →  17:00
 *
 * "Stuck" detection uses a SEPARATE, much more generous window (see
 * stuckThresholdMs) so a slow-but-healthy run is never flagged early —
 * a premature "stuck — retry" prompt is far more harmful (it invites a
 * duplicate run) than waiting a little longer.
 */

/** Floor that covers cold-start + dispatch even on a tiny gallery. */
const BASE_CULLING_MS = 20 * 1000;
/** Marginal wall-clock the engine spends per additional photo. */
const MS_PER_IMAGE = 1000;

function normalizeCount(imageCount: number): number {
  return Number.isFinite(imageCount) && imageCount > 0 ? Math.floor(imageCount) : 0;
}

/**
 * Estimated milliseconds the culling run will take:
 *   20 second floor + 1 second per image.
 */
export function estimateCullingMs(imageCount: number): number {
  return BASE_CULLING_MS + normalizeCount(imageCount) * MS_PER_IMAGE;
}

/**
 * Threshold past which we consider an in-flight culling run "stuck".
 *
 * Deliberately far more generous than the displayed estimate (3 min
 * floor + 3 s/image ≈ 3–4× the ETA) so we only surface the retry prompt
 * once a run is genuinely hung, never merely slow.
 */
export function stuckThresholdMs(imageCount: number): number {
  return 3 * 60 * 1000 + normalizeCount(imageCount) * 3 * 1000;
}

/** Format ms as a human-friendly duration like "2h 51m", "38 min" or "45 s". */
export function formatDuration(ms: number): string {
  if (ms < 60_000) {
    return `${Math.max(1, Math.round(ms / 1000))} s`;
  }
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * Format ms as a digital countdown like "2:34" (or "1:05:00" past an
 * hour) — used on the 'Running... X:XX' culling button and the progress
 * overlay so the user has a continuously updating sense of how much
 * longer it'll be.
 *
 * Negative inputs (run is already past its estimate) are clamped to
 * 0:00 because we don't want to display nonsense numbers — the
 * server might just be slow today.
 */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
