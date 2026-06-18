import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

interface DockFilmstripProps {
  images: { id: string; original_url: string }[];
  currentIndex: number;
  onGoToImage: (index: number) => void;
  getThumbnailUrl: (url: string) => string;
}

const BASE_H = 48;
const MAX_H = 80;
const RANGE = 180;
const ASPECT = 1.5;
const GAP = 4;
const BASE_W = BASE_H * ASPECT; // 72
const WINDOW_SIZE = 20; // render ±20 around currentIndex

export function DockFilmstrip({ images, currentIndex, onGoToImage, getThumbnailUrl }: DockFilmstripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [containerW, setContainerW] = useState(0);

  // Track container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.offsetWidth);
    measure();
    const obs = new ResizeObserver(() => measure());
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Compute the virtual window of items to render
  const { windowStart, windowEnd } = useMemo(() => {
    const start = Math.max(0, currentIndex - WINDOW_SIZE);
    const end = Math.min(images.length, currentIndex + WINDOW_SIZE + 1);
    return { windowStart: start, windowEnd: end };
  }, [currentIndex, images.length]);

  const itemSlot = BASE_W + GAP;

  // paddingLeft to offset the skipped items
  const paddingLeft = windowStart * itemSlot;

  // Compute translateX purely from math
  const translateX = useMemo(() => {
    if (!containerW || images.length === 0) return 0;
    const activeCenter = currentIndex * itemSlot + BASE_W / 2;
    return containerW / 2 - activeCenter;
  }, [currentIndex, images.length, containerW, itemSlot]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const strip = stripRef.current;
    if (!strip) return;
    const rect = strip.getBoundingClientRect();
    setMouseX(e.clientX - rect.left);
  }, []);

  const getH = useCallback((localIdx: number) => {
    if (mouseX === null || !stripRef.current) return BASE_H;
    const el = stripRef.current.children[localIdx] as HTMLElement;
    if (!el) return BASE_H;
    const center = el.offsetLeft + el.offsetWidth / 2;
    const d = Math.abs(mouseX - center);
    if (d > RANGE) return BASE_H;
    return BASE_H + (MAX_H - BASE_H) * Math.cos((d / RANGE) * Math.PI / 2);
  }, [mouseX]);

  const windowedImages = useMemo(() => {
    return images.slice(windowStart, windowEnd);
  }, [images, windowStart, windowEnd]);

  return (
    <div className="hidden md:block w-full py-2" onClick={(e) => e.stopPropagation()}>
      <div
        ref={containerRef}
        className="relative overflow-hidden w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMouseX(null)}
        style={{ height: MAX_H + 12 }}
      >
        <div
          ref={stripRef}
          className="absolute flex items-end"
          style={{
            bottom: 4,
            left: 0,
            paddingLeft,
            transform: `translateX(${translateX}px)`,
            transition: 'transform 0.3s ease-out',
            gap: GAP,
          }}
        >
          {windowedImages.map((img, localIdx) => {
            const globalIdx = windowStart + localIdx;
            const h = getH(localIdx);
            const w = h * ASPECT;
            const isCurrent = globalIdx === currentIndex;
            return (
              <button
                key={img.id}
                onClick={() => onGoToImage(globalIdx)}
                className={cn(
                  "flex-shrink-0 rounded-sm overflow-hidden origin-bottom",
                  isCurrent
                    ? "ring-2 ring-primary shadow-[0_0_10px_-1px_hsl(var(--primary)/0.55)] opacity-100"
                    : "opacity-45 hover:opacity-80"
                )}
                style={{
                  width: w, height: h,
                  transition: mouseX !== null
                    ? "width 0.1s ease-out, height 0.1s ease-out, opacity 0.15s"
                    : "width 0.3s ease-out, height 0.3s ease-out, opacity 0.15s",
                }}
              >
                <img
                  src={getThumbnailUrl(img.original_url)}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  draggable={false}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes(img.original_url)) target.src = img.original_url;
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="text-center mt-1">
        <span className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground tabular-nums">
          <span className="text-foreground folio">{currentIndex + 1}</span> / {images.length}
        </span>
      </div>
    </div>
  );
}
