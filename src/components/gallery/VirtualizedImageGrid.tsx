import { useRef, useEffect, useState, useMemo, type ReactNode, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/**
 * Render a fixed-aspect-ratio image grid where only the rows visible
 * in the scroll container are mounted to the DOM. With 3000 photos,
 * a non-virtualized grid mounts 3000 ImageCard components and asks
 * the browser to lay out + decode 3000 thumbnails — ~1 GB of GPU/RAM,
 * minutes of jank, and frequent crashes.
 *
 * This component recycles DOM nodes as the user scrolls, so the
 * mounted count stays around `columns × visibleRows` (~30-60) no
 * matter how big the gallery is.
 *
 * Each cell is rendered at aspect-square; the grid uses CSS Grid for
 * column layout and the virtualizer for row layout. Column count is
 * picked from the container width to mirror the previous Tailwind
 * breakpoint behaviour (3 / 4 / 6 / 8 cols).
 */

interface VirtualizedImageGridProps<T> {
  items: T[];
  /** Existing scroll container (the page's main scrolling div). */
  scrollContainerRef: RefObject<HTMLElement>;
  /** Stable key for each item — required for React reconciliation. */
  getKey: (item: T, index: number) => string;
  /** Renders a single cell. Receives the original index in `items`. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Optional extra elements rendered AFTER the grid (e.g. upload skeletons). */
  trailing?: ReactNode;
  /** How many rows to render outside the viewport on each side. Default 4. */
  overscanRows?: number;
  /** Gap between cells in pixels. Defaults to 2 (matches Tailwind gap-0.5). */
  gap?: number;
}

function pickColumnCount(width: number): number {
  if (width >= 1280) return 8;
  if (width >= 1024) return 6;
  if (width >= 640) return 4;
  return 3;
}

export function VirtualizedImageGrid<T>({
  items,
  scrollContainerRef,
  getKey,
  renderItem,
  trailing,
  overscanRows = 4,
  gap = 2,
}: VirtualizedImageGridProps<T>) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setContainerWidth(w);
    });
    observer.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const columns = pickColumnCount(containerWidth || 1024);

  // Cell width = (containerWidth - (columns - 1) × gap) / columns; squared for height.
  const cellSize = useMemo(() => {
    if (!containerWidth) return 0;
    return (containerWidth - (columns - 1) * gap) / columns;
  }, [containerWidth, columns, gap]);
  const rowHeight = cellSize + gap;

  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: overscanRows,
  });

  // Force the virtualizer to remeasure when the column count changes
  // (resize past a breakpoint). Without this, the totalSize lags by a
  // frame and the scrollbar jumps.
  useEffect(() => {
    virtualizer.measure();
  }, [columns, rowHeight, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  if (cellSize <= 0) {
    // First paint before ResizeObserver fires — render an empty
    // placeholder so the page doesn't flicker.
    return <div ref={innerRef} className="w-full" />;
  }

  return (
    <div ref={innerRef} className="w-full">
      <div style={{ height: totalHeight, position: "relative" }}>
        {virtualRows.map((row) => {
          const startIdx = row.index * columns;
          const endIdx = Math.min(startIdx + columns, items.length);
          const rowItems: T[] = [];
          for (let i = startIdx; i < endIdx; i++) rowItems.push(items[i]);

          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: row.start,
                left: 0,
                width: "100%",
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: `${gap}px`,
              }}
            >
              {rowItems.map((item, colIdx) => {
                const idx = startIdx + colIdx;
                return (
                  <div
                    key={getKey(item, idx)}
                    style={{ width: "100%", aspectRatio: "1 / 1" }}
                  >
                    {renderItem(item, idx)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}
