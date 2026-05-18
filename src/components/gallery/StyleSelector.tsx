import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Image, Layers } from "lucide-react";

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
        // Container fills the parent's bounded box and lets the base
        // <img> size itself within those bounds via max-h-full /
        // max-w-full. Was inline-block + max-h-[85vh]/max-w-[90vw]
        // which is viewport-relative and didn't account for the
        // lightbox chrome (top bar + thumbnail strip) — so on shorter
        // viewports the badges anchored at top-3 got clipped under
        // the top bar.
        "relative overflow-hidden rounded-lg cursor-ew-resize select-none bg-black max-h-full max-w-full touch-none",
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
        className="block w-auto h-auto max-h-full max-w-full object-contain"
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

      {/* Labels — solid-dark pill so they're readable over any image
          regardless of app theme (these overlays sit on a photo, not
          on the page surface, so they shouldn't track theme tokens). */}
      <Badge
        variant="secondary"
        className="absolute top-3 left-3 bg-black/70 text-white border-transparent backdrop-blur-sm z-10"
      >
        Original
      </Badge>
      <Badge
        variant="secondary"
        className="absolute top-3 right-3 bg-black/70 text-white border-transparent backdrop-blur-sm z-10"
      >
        {styleName}
      </Badge>
    </div>
  );
}
