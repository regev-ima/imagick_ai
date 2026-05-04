import { useMemo } from "react";

interface ImageDimensions {
  id: string;
  width?: number | null;
  height?: number | null;
}

interface JustifiedItem {
  id: string;
  width: number;
  height: number;
}

/**
 * Computes a Google Photos-style justified layout (pure function).
 * Each row has a target height; images are scaled proportionally
 * and the row is stretched so its total width equals containerWidth.
 */
export function computeJustifiedLayout(
  images: ImageDimensions[],
  containerWidth: number,
  targetRowHeight: number = 160,
  gap: number = 2
): Map<string, { width: number; height: number }> {
  const result = new Map<string, { width: number; height: number }>();
  if (!containerWidth || images.length === 0) return result;

  // Compute scaled widths at target row height
  const items: JustifiedItem[] = images.map((img) => {
    const w = img.width || 1600;
    const h = img.height || 1067;
    const aspect = w / h;
    return {
      id: img.id,
      width: targetRowHeight * aspect,
      height: targetRowHeight,
    };
  });

  let rowStart = 0;

  while (rowStart < items.length) {
    let rowWidth = 0;
    let rowEnd = rowStart;

    // Fill the row until it exceeds container width
    while (rowEnd < items.length) {
      const gapSpace = rowEnd > rowStart ? gap : 0;
      if (rowWidth + items[rowEnd].width + gapSpace > containerWidth && rowEnd > rowStart) {
        break;
      }
      rowWidth += items[rowEnd].width + (rowEnd > rowStart ? gap : 0);
      rowEnd++;
    }

    // Calculate scale factor to fill the row
    const numGaps = rowEnd - rowStart - 1;
    const totalGapWidth = numGaps * gap;
    const totalImageWidth = rowWidth - totalGapWidth;
    const availableWidth = containerWidth - totalGapWidth;

    // For the last row, don't stretch if it has only one image and is less than 40% filled
    const isLastRow = rowEnd >= items.length;
    const fillRatio = totalImageWidth / availableWidth;
    const scale = isLastRow && fillRatio < 0.4 && (rowEnd - rowStart) <= 1 ? 1 : availableWidth / totalImageWidth;

    const rowHeight = targetRowHeight * scale;

    for (let i = rowStart; i < rowEnd; i++) {
      result.set(items[i].id, {
        width: Math.round(items[i].width * scale),
        height: Math.round(rowHeight),
      });
    }

    rowStart = rowEnd;
  }

  return result;
}

/**
 * React hook wrapper around computeJustifiedLayout.
 */
export function useJustifiedLayout(
  images: ImageDimensions[],
  containerWidth: number,
  targetRowHeight: number = 160,
  gap: number = 2
): Map<string, { width: number; height: number }> {
  return useMemo(
    () => computeJustifiedLayout(images, containerWidth, targetRowHeight, gap),
    [images, containerWidth, targetRowHeight, gap]
  );
}
