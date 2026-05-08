/**
 * Tiny module-scoped cache of thumbnail URLs that successfully loaded
 * during this page lifetime.
 *
 * Why this exists
 * ───────────────
 * Even with `<img>` lazy loading and a virtualized grid, when the
 * user scrolls down and back up, every recycled `ImageCard` mounts
 * fresh and fires a brand-new request — even though the browser HTTP
 * cache likely has it. The browser ALSO has to redecode the image,
 * which is CPU work that drops frames.
 *
 * Tracking which URLs have completed once lets us:
 *   - Skip the fade-in animation when the URL was already loaded
 *     (it was on screen 200ms ago, no point pretending it's new)
 *   - Render the `<img>` as `loaded` from frame 1 (no flash of
 *     skeleton) so scrolling back feels instant.
 *
 * The cache is bounded to MAX_ENTRIES with a simple FIFO eviction so
 * memory doesn't grow unbounded for week-long sessions.
 */

const MAX_ENTRIES = 5000;
const loadedUrls: string[] = [];
const loadedSet = new Set<string>();

export function markImageLoaded(url: string): void {
  if (!url || loadedSet.has(url)) return;
  loadedSet.add(url);
  loadedUrls.push(url);
  if (loadedUrls.length > MAX_ENTRIES) {
    const evicted = loadedUrls.shift();
    if (evicted) loadedSet.delete(evicted);
  }
}

export function isImageLoaded(url: string): boolean {
  return !!url && loadedSet.has(url);
}
