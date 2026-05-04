import { useState, useEffect, useRef } from "react";

/**
 * Detects real image dimensions by loading images in the background.
 * Only loads dimensions for images that don't already have width/height in the DB.
 * Returns a map of imageId -> { width, height }.
 */
export function useImageDimensions(
  images: Array<{ id: string; width?: number | null; height?: number | null; original_url: string }>,
  getUrl: (originalUrl: string) => string
): Map<string, { width: number; height: number }> {
  const [dimensions, setDimensions] = useState<Map<string, { width: number; height: number }>>(new Map());
  const loadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const toLoad = images.filter(
      (img) => !img.width && !img.height && !loadedRef.current.has(img.id)
    );

    if (toLoad.length === 0) return;

    toLoad.forEach((img) => loadedRef.current.add(img.id));

    const BATCH_SIZE = 20;
    let batchIndex = 0;

    function loadBatch() {
      const batch = toLoad.slice(batchIndex, batchIndex + BATCH_SIZE);
      if (batch.length === 0) return;

      batch.forEach((img) => {
        const el = new Image();
        el.onload = () => {
          setDimensions((prev) => {
            const next = new Map(prev);
            next.set(img.id, { width: el.naturalWidth, height: el.naturalHeight });
            return next;
          });
        };
        el.onerror = () => {
          console.warn(`Failed to load image dimensions for: ${img.id}`);
        };
        // Use the same URL that's displayed so we hit browser cache
        el.src = getUrl(img.original_url);
      });

      batchIndex += BATCH_SIZE;
      if (batchIndex < toLoad.length) {
        setTimeout(loadBatch, 100);
      }
    }

    loadBatch();
  }, [images, getUrl]);

  return dimensions;
}
