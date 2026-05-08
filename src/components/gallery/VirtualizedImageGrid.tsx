import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/**
 * Render a fixed-aspect-ratio image grid where only the rows visible
 * in the scroll container (plus an overscan buffer) are mounted.
 *
 * Why this exists
 * ───────────────
 * The previous gallery editor used an infinite-scroll pattern that
 * grew the DOM monotonically — by the time the user scrolled to the
 * bottom of a 3000-photo wedding gallery, the page held 3000 ImageCard
 * trees, 3000 IntersectionObservers, and 3000 React reconciliations
 * for every state change. That's the actual bottleneck behind the
 * "feels slow on big galleries" complaint.
 *
 * This component recycles DOM nodes as the user scrolls, so the
 * mounted card count stays around `columns × visibleRows + overscan`
 * (~30-80) regardless of gallery size.
 */
interface VirtualizedImageGridProps<T> {
  items: T[];
  /** The page's existing scrolling container (we just listen to it). */
  scrollContainerRef: RefObject<HTMLElement>;
  /** Stable key per item — required for React reconciliation. */
  getKey: (item: T, index: number) => string;
  /** Renders one cell. Receives the original index in `items`. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Optional content rendered AFTER the grid (e.g. upload skeletons). */
  trailing?: ReactNode;
  /**
   * Rows to render outside the viewport on each side. We use a
   * relatively large value (8) because users scroll fast — the
   * default of 1-2 means thumbnails are still being requested while
   * the user is already past them. 8 rows × ~160px ≈ 1280px buffer
   * each direction, which covers a normal flick scroll.
   */
  overscanRows?: number;
  /** Gap between cells in px. Defaults to 2 (Tailwind gap-0.5). */
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
  overscanRows = 6,
  gap = 2,
}: VirtualizedImageGridProps<T>) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  /**
   * Adaptive overscan based on scroll velocity. When the user is
   * stationary we keep a modest buffer (overscanRows). When they
   * flick-scroll we widen it dynamically — by the time they stop,
   * the rows they're about to see are already mounted with
   * thumbnail fetches in flight.
   */
  const [dynamicOverscan, setDynamicOverscan] = useState(overscanRows);

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

  // Track scroll velocity on the parent scroll container.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let lastTop = el.scrollTop;
    let lastTime = performance.now();
    let raf: number | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const now = performance.now();
        const dy = Math.abs(el.scrollTop - lastTop);
        const dt = now - lastTime || 1;
        lastTop = el.scrollTop;
        lastTime = now;
        const velocity = dy / dt; // px / ms

        // Map velocity → overscan. 0 px/ms = base (6),
        // 5 px/ms (≈300px/frame) = max (24).
        const next = Math.min(24, Math.max(overscanRows, Math.round(overscanRows + velocity * 4)));
        setDynamicOverscan(next);

        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => setDynamicOverscan(overscanRows), 150);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [scrollContainerRef, overscanRows]);

  const columns = pickColumnCount(containerWidth || 1024);

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
    overscan: dynamicOverscan,
  });

  // Force the virtualizer to remeasure when the column count changes
  // (resize past a breakpoint).
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
