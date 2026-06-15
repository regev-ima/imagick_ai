import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Image, Layers } from "lucide-react";

/** The AI mark — 4-point sparkle (logo star). Inherits currentColor. */
function Sparkle({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface StyleSelectorProps {
  availableStyles: Array<{ id: string; name: string; apiId?: string }>;
  selectedStyle: string;
  onStyleChange: (styleId: string) => void;
  className?: string;
}

/**
 * Horizontal scrollable style selector for gallery view
 * Shows "Original" plus all applied styles
 */
export function StyleSelector({
  availableStyles,
  selectedStyle,
  onStyleChange,
  className,
}: StyleSelectorProps) {
  // Always include "original" as the first option
  const allStyles = [
    { id: "original", name: "Original", apiId: undefined },
    ...availableStyles,
  ];

  return (
    <div className={cn("w-full", className)}>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center gap-2 pb-2">
          {allStyles.map((style) => (
            <Button
              key={style.id}
              variant={selectedStyle === style.id ? "default" : "outline"}
              size="sm"
              className={cn(
                "flex items-center gap-2 shrink-0 transition-all",
                selectedStyle === style.id && "shadow-md"
              )}
              onClick={() => onStyleChange(style.id)}
            >
              {style.id === "original" ? (
                <Image className="w-4 h-4" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
              {style.name}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

interface StyleComparisonProps {
  originalUrl: string;
  editedUrl: string;
  originalFallbackUrl?: string;
  editedFallbackUrl?: string;
  styleName: string;
  className?: string;
}

/**
 * Side-by-side or slider comparison between original and edited image
 * Uses the edited image as the base to determine natural size
 */
export function StyleComparison({
  originalUrl,
  editedUrl,
  originalFallbackUrl,
  editedFallbackUrl,
  styleName,
  className,
}: StyleComparisonProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setContainerSize({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoaded(true);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, fallbackUrl?: string) => {
    const target = e.currentTarget;
    if (fallbackUrl && target.src !== fallbackUrl) {
      target.src = fallbackUrl;
    }
  };

  // Prevent touch events from bubbling to parent swipe handler
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleTouchMoveWithStop = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    handleTouchMove(e);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm cursor-ew-resize select-none bg-black inline-block touch-none plate-keyline",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMoveWithStop}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Base image that determines the container size - NOT absolute */}
      <img
        src={editedUrl}
        alt={`Edited with ${styleName}`}
        className="block w-auto h-auto max-h-[85vh] max-w-[90vw] object-contain"
        onLoad={handleImageLoad}
        onError={(e) => handleImageError(e, editedFallbackUrl || originalUrl)}
      />

      {/* Original Image (clipped overlay) - only show when base image loaded */}
      {imageLoaded && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={originalUrl}
            alt="Original"
            className="block h-full object-contain"
            style={{ 
              width: containerSize.width > 0 ? `${containerSize.width}px` : '100%',
              maxWidth: "none",
              objectPosition: "left center"
            }}
            onError={(e) => handleImageError(e, originalFallbackUrl)}
          />
        </div>
      )}

      {/* Slider Line */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize z-10"
        style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-primary/20">
          <div className="flex items-center gap-0.5">
            <div className="w-0.5 h-5 bg-muted-foreground rounded-full" />
            <div className="w-0.5 h-5 bg-muted-foreground rounded-full" />
          </div>
        </div>
      </div>

      {/* Labels — mono readout chips */}
      <span className="aura-chip absolute top-3 left-3 z-10 bg-background/85 backdrop-blur-sm">
        Original
      </span>
      <span className="aura-chip absolute top-3 right-3 z-10 bg-background/85 backdrop-blur-sm text-primary">
        <Sparkle size={10} className="text-primary" />
        {styleName}
      </span>
    </div>
  );
}
