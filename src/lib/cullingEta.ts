/**
 * AI Culling time estimation.
 *
 * Real-world culling is dominated by per-image analysis time, not a flat
 * fee — the API scores every photo (sharpness, composition, expression,
 * similarity grouping) and that work scales linearly with the gallery.
 * Photographers reported runs that legitimately take many minutes, so the
 * old "~90s per 1000 photos" estimate was far too optimistic and tripped
 * the "looks stuck" warning long before a healthy run could finish.
 *
 * The model is intentionally simple and generous:
 *
 *   expected time = 5 minute floor + 10 seconds per image
 *
 *   0     images →  5:00   (floor: cold-start + signed-URL fetch + dispatch)
 *   25    images →  9:10
 *   200   images →  38:20
 *   1000  images →  2h 51m
 *
 * "Stuck" detection uses the SAME estimate: we only tell the user a run
 * looks stuck once the entire expected window has elapsed with no result.
 * Leaning long here is deliberate — a premature "stuck — retry" prompt is
 * far more harmful (it invites a duplicate run that overwrites ratings)
 * than waiting a little longer for a slow-but-healthy run to land.
 */

/** Floor that covers cold-start + dispatch even on a tiny gallery. */
const BASE_CULLING_MS = 5 * 60 * 1000;
/** Marginal cost the API spends analyzing each additional photo. */
const MS_PER_IMAGE = 10 * 1000;

function normalizeCount(imageCount: number): number {
  return Number.isFinite(imageCount) && imageCount > 0 ? Math.floor(imageCount) : 0;
}

/**
 * Estimated milliseconds the culling run will take:
 *   5 minute floor + 10 seconds per image.
 */
export function estimateCullingMs(imageCount: number): number {
  return BASE_CULLING_MS + normalizeCount(imageCount) * MS_PER_IMAGE;
}

/**
 * Threshold past which we consider an in-flight culling run "stuck".
 *
 * Equal to the estimate: we don't surface the retry prompt until the
 * whole expected window has passed. Kept as a separate export so the
 * "stuck" policy can diverge from the displayed ETA later without
 * touching every call site.
 */
export function stuckThresholdMs(imageCount: number): number {
  return estimateCullingMs(imageCount);
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
