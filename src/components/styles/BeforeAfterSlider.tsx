import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Image as ImageIcon } from "lucide-react";

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  className?: string;
  /** Max height of the slider box (any CSS length). Defaults to 50vh. */
  maxHeight?: string;
}

function SliderImageFallback({ className }: { className?: string }) {
  return (
    <div className={cn("bg-muted flex items-center justify-center", className)}>
      <ImageIcon className="w-10 h-10 text-muted-foreground" />
    </div>
  );
}

export function BeforeAfterSlider({ beforeSrc, afterSrc, className, maxHeight = "50vh" }: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [beforeError, setBeforeError] = useState(false);
  const [afterError, setAfterError] = useState(false);
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(percent);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  }, [updatePosition]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    updatePosition(e.clientX);
  }, [isDragging, updatePosition]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if ((!beforeSrc || beforeError) && (!afterSrc || afterError)) {
    return <SliderImageFallback className={cn("aspect-[3/2] rounded-2xl", className)} />;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-2xl overflow-hidden select-none cursor-col-resize border border-border bg-black/20 mx-auto",
        className
      )}
      style={{ aspectRatio: naturalAspect ? String(naturalAspect) : "3/2", maxHeight, touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* After image (full width background) */}
      {afterError ? (
        <SliderImageFallback className="absolute inset-0" />
      ) : (
        <img
          src={afterSrc}
          alt="After"
          className="absolute inset-0 w-full h-full object-contain"
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (naturalWidth && naturalHeight) {
              setNaturalAspect(naturalWidth / naturalHeight);
            }
          }}
          onError={() => setAfterError(true)}
          draggable={false}
        />
      )}

      {/* Before image (clipped via clip-path for pixel-perfect alignment) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {beforeError ? (
          <SliderImageFallback className="w-full h-full" />
        ) : (
          <img
            src={beforeSrc}
            alt="Before"
            className="absolute inset-0 w-full h-full object-contain"
            onError={() => setBeforeError(true)}
            draggable={false}
          />
        )}
      </div>

      {/* Slider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-foreground/80 z-10"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      >
        {/* Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm border-2 border-foreground/60 flex items-center justify-center shadow-lg">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-foreground">
            <path d="M5 3L2 8L5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 3L14 8L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Labels */}
      <span className="absolute bottom-3 left-3 text-xs font-medium bg-background/70 backdrop-blur-sm text-foreground px-2 py-1 rounded-md z-20">
        Before
      </span>
      <span className="absolute bottom-3 right-3 text-xs font-medium bg-background/70 backdrop-blur-sm text-foreground px-2 py-1 rounded-md z-20">
        After
      </span>
    </div>
  );
}
