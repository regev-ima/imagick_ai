/**
 * Display modes for culling scores.
 * - 'normalized': percentile-based mapping, stretches the 0.6–0.8 band into 1–5 stars (default).
 * - 'linear':     linear mapping score*5 (0.20→1, 0.40→2, 0.60→3, 0.80→4, 1.0→5).
 * - 'raw':        no conversion — caller renders the raw 0–1 number directly.
 */
export type CullingScoreMode = "normalized" | "linear" | "raw";

const STORAGE_KEY = "admin_culling_score_mode";

export function getStoredCullingScoreMode(): CullingScoreMode {
  // The admin Norm/Linear/Raw toggle was removed — "linear" is now the single
  // source of truth for star mapping across the grid, sidebar, lightbox and the
  // image detail panel. We deliberately IGNORE any stale localStorage value
  // (e.g. a "normalized" left over from the old toggle) so every surface always
  // computes the same star count for a given culling_score. Do NOT reintroduce
  // per-surface modes without unifying every call site.
  return "linear";
}

export function setStoredCullingScoreMode(mode: CullingScoreMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent("culling-score-mode-change", { detail: mode }));
}

/**
 * Converts a culling_score (0–1) to a 1–5 star rating.
 * Returns 0 if score is null/undefined/0.
 */
export function cullingScoreToStars(
  score: number | null | undefined,
  mode: CullingScoreMode = "linear"
): number {
  if (!score || score <= 0) return 0;

  if (mode === "linear") {
    // 0.20→1, 0.40→2, 0.60→3, 0.80→4, 1.0→5
    const stars = Math.ceil(score * 5);
    return Math.max(1, Math.min(5, stars));
  }

  if (mode === "raw") {
    // Raw mode still returns a 1–5 bucket for code paths that need an integer
    // (sorting, filtering). UI components that want the raw number should read
    // culling_score directly.
    const stars = Math.ceil(score * 5);
    return Math.max(1, Math.min(5, stars));
  }

  // normalized (default) — linear stretch of the real-world score range to 0–1.
  // Baseline calibrated from gallery 62173511-3cf1-47fa-bf17-140c2c6a3994
  // (337 scored images): actual range ~0.18–0.83, p05=0.43, p95=0.74.
  // We stretch [MIN..MAX] linearly to [0..1], then bucket into 5 equal stars.
  // This fixes the "edges" problem (everything clustered in the middle) without
  // changing the relative ordering between images.
  const MIN = 0.43; // anything ≤ this maps to 0 → 1★
  const MAX = 0.74; // anything ≥ this maps to 1 → 5★
  const stretched = (score - MIN) / (MAX - MIN);
  const clamped = Math.max(0, Math.min(1, stretched));
  const stars = Math.ceil(clamped * 5);
  return Math.max(1, Math.min(5, stars));
}
