import { useCallback } from "react";
import { useShowcaseCovers } from "./useShowcaseCovers";

/** Minimal shape needed to resolve a style's demo/preview cover. */
export interface StyleCoverInput {
  id: string;
  thumbnail_url?: string | null;
  after_image_urls?: string[] | null;
}

/**
 * Resolve the single best "edited-by-this-style" preview URL.
 *
 * Priority:
 *   1. showcase edit — a real result the style produced on the shared sample
 *      gallery (auto-generated for every style when training completes).
 *   2. after_image_urls[0] — curated result images on the style row.
 *   3. thumbnail_url — a manually set cover.
 *
 * Returns undefined when the style has no demo anywhere (caller shows a
 * placeholder). Keeping this in one place means every style picker/card shows
 * the same image instead of each surface reinventing the fallback chain — the
 * bug where some pickers ignored the showcase demos and looked empty.
 */
export function resolveStyleCover(
  style: StyleCoverInput,
  showcaseCovers?: Record<string, string>,
): string | undefined {
  return (
    showcaseCovers?.[style.id] ||
    style.after_image_urls?.[0] ||
    style.thumbnail_url ||
    undefined
  );
}

/**
 * Hook wrapper: loads the shared showcase-cover map once (React Query dedupes
 * it across callers) and hands back a stable resolver plus the raw map.
 */
export function useStyleCovers(options: { enabled?: boolean } = {}) {
  const { data: covers } = useShowcaseCovers(options);
  const coverFor = useCallback(
    (style: StyleCoverInput) => resolveStyleCover(style, covers),
    [covers],
  );
  return { covers: covers ?? {}, coverFor };
}
