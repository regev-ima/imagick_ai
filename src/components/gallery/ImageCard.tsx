import { useState, useCallback, useEffect, useRef, memo } from "react";
import { motion } from "framer-motion";
import { Check, ZoomIn, Star, Heart, Loader2, Upload, AlertTriangle, Clock, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { cullingScoreToStars } from "@/lib/cullingScore";
import { useCullingScoreMode } from "@/hooks/useCullingScoreMode";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isImageLoaded, markImageLoaded } from "@/lib/loadedImageCache";

const ROW_HEIGHT = 160;

interface ImageCardProps {
  image: {
    id: string;
    filename: string;
    original_url: string;
    is_hero: boolean;
    is_liked: boolean;
    ai_rating: number | null;
    culling_score?: number | null;
    width?: number | null;
    height?: number | null;
  };
  index: number;
  thumbnailUrl: string;
  viewMode: "grid" | "masonry";
  isSelected: boolean;
  /** Computed dimensions from justified layout */
  computedWidth?: number;
  computedHeight?: number;
  /** Image processing status */
  status?: string;
  onImageClick: (imageId: string, index: number) => void;
  onSelectionToggle: (imageId: string, index: number, event: React.MouseEvent) => void;
  onOpenLightbox: (imageId: string) => void;
  onToggleLike: (imageId: string) => void;
  /** Processing timing info (admin only) */
  processingInfo?: {
    sentAt: string | null;
    completedAt: string | null;
    attempts: number;
    error: string | null;
  };
}

const MAX_RETRY_DELAY = 10000;

function ImageCardImpl({
  image,
  index,
  thumbnailUrl,
  viewMode,
  isSelected,
  computedWidth,
  computedHeight,
  status = "ready",
  onImageClick,
  onSelectionToggle,
  onOpenLightbox,
  onToggleLike,
  processingInfo
}: ImageCardProps) {
  // If we've already loaded this exact URL during this session, the
  // browser has it in its HTTP/decode cache. Skip the fade-in and
  // mount it as already-loaded so scrolling back feels instant.
  const wasAlreadyLoaded = isImageLoaded(thumbnailUrl);
  const [isLoaded, setIsLoaded] = useState(wasAlreadyLoaded);
  /** True when the card is within ~1000px of the viewport (prefetch zone). */
  const [isInView, setIsInView] = useState(wasAlreadyLoaded);
  /** True when the card is actually inside the viewport — used to bump
   *  fetch priority so the browser delivers visible thumbnails first. */
  const [isActiveViewport, setIsActiveViewport] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(thumbnailUrl);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isReady = status === "ready";

  useEffect(() => {
    setRetryCount(0);
    setCurrentSrc(thumbnailUrl);
    // If this URL is already in the in-memory cache (we've shown it
    // before this session) keep isLoaded=true so the user doesn't
    // see a flash of skeleton when scrolling back.
    setIsLoaded(isImageLoaded(thumbnailUrl));
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, [thumbnailUrl, status]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Two IntersectionObservers tier the loading behaviour:
  //
  //   1. Buffer (1500px margin) → render the <img> at low priority.
  //      When the card scrolls OUT of the buffer we tear the <img>
  //      down which cancels any in-flight network request for it
  //      (browsers cancel pending image fetches on element removal).
  //      Without this, fast scrolling across 100s of cards leaves
  //      hundreds of stale fetches stuck behind the connection cap,
  //      starving the cards the user actually wants to see.
  //
  //   2. Active viewport (0px margin) → flip the SAME <img> to high
  //      priority. The browser's HTTP/2 / priority-hints stack will
  //      reorder its request queue so the user's currently-visible
  //      thumbnails get served before the speculative prefetches.
  //
  // Cards that loaded once stay isInView=true permanently (they're
  // in the loadedImageCache and re-rendering them is essentially
  // free) — only the fresh ones get torn down.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const buffer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        } else {
          // Only un-render if we haven't loaded yet — otherwise we'd
          // throw away decoded pixels we just paid for.
          setIsInView((prev) => (isImageLoaded(thumbnailUrl) ? prev : false));
        }
      },
      { rootMargin: "1500px" }
    );
    const active = new IntersectionObserver(
      ([entry]) => {
        setIsActiveViewport(entry.isIntersecting);
      },
      { rootMargin: "0px", threshold: 0 }
    );
    buffer.observe(el);
    active.observe(el);
    return () => {
      buffer.disconnect();
      active.disconnect();
    };
  }, [thumbnailUrl]);

  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
    markImageLoaded(currentSrc);
  }, [currentSrc]);

  const handleImageError = useCallback(() => {
    if (!isReady) return;
    const delay = Math.min(Math.pow(2, retryCount + 1) * 1000, MAX_RETRY_DELAY);
    retryTimeoutRef.current = setTimeout(() => {
      setCurrentSrc(`${thumbnailUrl}?retry=${Date.now()}`);
      setRetryCount(prev => prev + 1);
    }, delay);
  }, [retryCount, thumbnailUrl, isReady]);

  const { mode: cullingScoreMode } = useCullingScoreMode();
  const starRating = cullingScoreToStars(image.culling_score, cullingScoreMode);
  const hasRating = starRating > 0;
  const showRawScore = cullingScoreMode === "raw" && typeof image.culling_score === "number";

  // Use computed dimensions from justified layout, or fallback
  const aspectRatio = (image.width && image.height) ? image.width / image.height : 1.5;
  const itemWidth = viewMode === "masonry" ? (computedWidth ?? ROW_HEIGHT * aspectRatio) : undefined;
  const itemHeight = viewMode === "masonry" ? (computedHeight ?? ROW_HEIGHT) : undefined;

  // Render status overlay for non-ready images
  const renderStatusOverlay = () => {
    if (isReady) return null;

    return (
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center rounded-md z-10",
        status === "error"
          ? "bg-destructive/20 backdrop-blur-sm"
          : "bg-muted/80 backdrop-blur-sm"
      )}>
        {status === "processing" && (
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        )}
        {status === "uploading" && (
          <Upload className="w-6 h-6 text-primary animate-pulse" />
        )}
        {status === "pending" && (
          <Clock className="w-5 h-5 text-muted-foreground" />
        )}
        {status === "error" && (
          <AlertTriangle className="w-6 h-6 text-destructive" />
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative group cursor-pointer flex-shrink-0 flex-grow-0",
        viewMode === "grid" && "w-full"
      )}
      style={viewMode === "masonry" ? { width: itemWidth, height: itemHeight } : undefined}
    >
      {/* Placeholder shown when not in view or not loaded.
          Animated shimmer so the user sees motion ("loading") rather
          than a wall of identical gray boxes when scrolling fast. */}
      {(!isInView || (!isLoaded && isReady)) && (
        <div className={cn(
          "rounded-md overflow-hidden border-2 relative",
          isSelected ? "border-primary ring-1 ring-primary/30" : "border-transparent",
          !isReady ? "" : "bg-muted/30 thumbnail-shimmer",
          viewMode === "grid" ? "aspect-square" : "w-full h-full"
        )}
          onClick={() => onImageClick(image.id, index)}
        >
          {!isReady && renderStatusOverlay()}
          {/* Selection checkbox on placeholder */}
          <button
            type="button"
            aria-label={isSelected ? "Deselect image" : "Select image"}
            aria-pressed={isSelected}
            className={cn(
              "absolute top-1.5 left-1.5 w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-150 cursor-pointer z-20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "bg-primary border-primary opacity-100 scale-100"
                : "border-white/80 bg-black/30 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:scale-110"
            )}
            onClick={(e) => onSelectionToggle(image.id, index, e)}
          >
            {isSelected && (
              <Check className="w-3 h-3 text-primary-foreground" />
            )}
          </button>
        </div>
      )}

      {/* Actual card - only render when in view AND ready */}
      {isInView && isReady && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isLoaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(!isLoaded && "absolute inset-0", "h-full")}
        >
          <div
            className={cn(
              "relative rounded-md overflow-hidden border transition-all duration-200 h-full",
              isSelected
                ? "border-primary ring-1 ring-primary/30"
                : "border-transparent hover:border-white/10"
            )}
            onClick={() => onImageClick(image.id, index)}
          >
            <img
              src={currentSrc}
              alt={image.filename}
              loading={isActiveViewport ? "eager" : "lazy"}
              decoding="async"
              // High priority for currently-visible thumbnails so the
              // browser serves them ahead of the prefetched ones in
              // the buffer zone. Browsers (Chrome, Edge, Safari TP)
              // honour fetchpriority changes on already-in-flight
              // requests via HTTP/2 priority hints.
              fetchPriority={isActiveViewport ? "high" : "low"}
              className={cn(
                "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
                viewMode === "grid" ? "w-full aspect-square" : "h-full w-full"
              )}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />

            {/* Hover gradient */}
            <div className={cn(
              "absolute inset-0 transition-opacity duration-200 pointer-events-none",
              "bg-gradient-to-t from-black/60 via-transparent to-black/20",
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )} />

            {/* Selection Checkbox — top-left */}
            <button
              type="button"
              aria-label={isSelected ? "Deselect image" : "Select image"}
              aria-pressed={isSelected}
              className={cn(
                "absolute top-1.5 left-1.5 w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "bg-primary border-primary opacity-100 scale-100"
                  : "border-white/80 bg-black/30 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:scale-110"
              )}
              onClick={(e) => onSelectionToggle(image.id, index, e)}
            >
              {isSelected && (
                <Check className="w-3 h-3 text-primary-foreground" />
              )}
            </button>

            {/* Hero Badge — top-left, shifts when selected */}
            {image.is_hero && (
              <div className={cn(
                "absolute top-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-primary/90 text-primary-foreground",
                isSelected ? "left-8" : "left-1.5 group-hover:left-8"
              )} style={{ transition: "left 0.2s ease" }}>
                Hero
              </div>
            )}

            {/* Top-right: Zoom + Like */}
            <div className={cn(
              "absolute top-1.5 right-1.5 flex items-center gap-1 transition-opacity duration-200",
              image.is_liked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              <button
                type="button"
                className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLightbox(image.id);
                }}
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              <button
                type="button"
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                  image.is_liked
                    ? "bg-red-500/90 text-white"
                    : "bg-black/40 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/60"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike(image.id);
                }}
              >
                <Heart className={cn(
                  "w-3 h-3",
                  image.is_liked && "fill-white"
                )} />
              </button>
            </div>

            {/* Processing info tooltip (admin only) */}
            {processingInfo && (processingInfo.sentAt || processingInfo.error) && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-opacity duration-200 z-10",
                        processingInfo.error
                          ? "bg-destructive/80 text-white opacity-80"
                          : "bg-black/50 backdrop-blur-sm text-white/70 opacity-0 group-hover:opacity-100"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-[11px] space-y-0.5 p-2">
                    {processingInfo.sentAt && (
                      <p className="tabular-nums">
                        <span className="text-muted-foreground">Sent: </span>
                        {new Date(processingInfo.sentAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    )}
                    {processingInfo.completedAt && (
                      <p className="tabular-nums">
                        <span className="text-muted-foreground">Completed: </span>
                        {new Date(processingInfo.completedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    )}
                    {processingInfo.attempts > 0 && (
                      <p>
                        <span className="text-muted-foreground">Attempts: </span>
                        {processingInfo.attempts}
                      </p>
                    )}
                    {processingInfo.error && (
                      <p className="text-destructive truncate">
                        {processingInfo.error.length > 80 ? processingInfo.error.slice(0, 80) + "…" : processingInfo.error}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Bottom: Star rating (when culling has run) */}
            {hasRating && (
              <div className={cn(
                "absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm transition-opacity duration-200",
                isSelected ? "opacity-100" : "opacity-80 group-hover:opacity-100"
              )}>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-2.5 h-2.5",
                        i < starRating
                          ? "text-amber-400 fill-amber-400"
                          : "text-white/20"
                      )}
                    />
                  ))}
                </div>
                {showRawScore && (
                  <span className="text-[10px] font-mono text-white/90 tabular-nums">
                    {(image.culling_score as number).toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Wrapped in React.memo so a state change in the parent (selection,
 * filter, hover etc.) doesn't re-render all 3000 cards. The custom
 * comparator only triggers a re-render when something this card
 * actually displays changes — image identity, status, selection,
 * thumbnail URL, computed dimensions, processing info. Internal
 * isActiveViewport / isInView state changes drive their own renders
 * via React's normal hooks flow and aren't compared here.
 */
export const ImageCard = memo(ImageCardImpl, (prev, next) => {
  if (prev.image !== next.image) {
    if (
      prev.image.id !== next.image.id ||
      prev.image.is_hero !== next.image.is_hero ||
      prev.image.is_liked !== next.image.is_liked ||
      prev.image.ai_rating !== next.image.ai_rating ||
      prev.image.culling_score !== next.image.culling_score
    ) {
      return false;
    }
  }
  if (
    prev.thumbnailUrl !== next.thumbnailUrl ||
    prev.viewMode !== next.viewMode ||
    prev.isSelected !== next.isSelected ||
    prev.computedWidth !== next.computedWidth ||
    prev.computedHeight !== next.computedHeight ||
    prev.status !== next.status ||
    prev.index !== next.index
  ) {
    return false;
  }
  // Callback identity changes are fine — they're stable from
  // useCallback in the parent. Skip them in the comparison so we
  // don't churn on referential equality for callbacks.
  return true;
});
