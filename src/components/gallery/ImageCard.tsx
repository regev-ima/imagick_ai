import { useState, useCallback, useEffect, useRef, memo } from "react";
import { motion } from "framer-motion";
import { Check, ZoomIn, Star, Heart, Upload, AlertTriangle, Clock, Info, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { cullingScoreToStars } from "@/lib/cullingScore";
import { useCullingScoreMode } from "@/hooks/useCullingScoreMode";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isImageLoaded, markImageLoaded } from "@/lib/loadedImageCache";
import { useFailedImages } from "@/components/gallery/FailedImagesContext";
import { getPreviewUrl } from "@/lib/imageUrls";

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
  /** Number of similar photos in this image's group at the active sensitivity
   *  (>1). Renders a "stacked frames ×N" badge so the user can see the photo
   *  is one of a burst/near-duplicate set. Undefined = not in a group. */
  groupSize?: number;
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
// Stop retrying broken thumbnails after this many attempts (~31s with the
// exponential backoff capped at MAX_RETRY_DELAY). Without a cap the tile
// would loop forever and the user just sees an empty white square — see
// the "stuck tile" cluster reported when an upload finished but a thumb
// 404'd on the CDN.
const MAX_THUMBNAIL_RETRIES = 5;
// User-initiated retries on top of the auto-retry budget. After this many
// click-to-retry attempts we stop offering the button — the file almost
// certainly isn't coming back and we don't want to keep hammering the CDN
// or letting the user spam it. The tile transitions to a "Re-upload"
// final state with the filename shown so the user knows what to do next.
const MAX_MANUAL_RETRIES = 2;

function ImageCardImpl({
  image,
  groupSize,
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
  const [manualRetryCount, setManualRetryCount] = useState(0);
  // Graceful fallback ladder: when the thumbnail repeatedly fails to
  // load (404 / corrupt / never-generated), fall through to the
  // compressed preview, then to the original. The original always
  // exists (the user just saw it in the lightbox at 4MB) so this
  // turns "blank tile" into "actual image, slightly slower to load"
  // — far better UX than asking the user to re-upload.
  //   0 = thumbnail (default, fastest)
  //   1 = preview / compressed (medium)
  //   2 = original (slowest, always present)
  const [fallbackLevel, setFallbackLevel] = useState<0 | 1 | 2>(0);
  // Surfaces a visible "stuck" state once the retry budget is spent so
  // the user can click to retry instead of staring at an empty tile.
  const [hasFailed, setHasFailed] = useState(false);
  // True between a manual-retry click and the next load/error event —
  // drives the "thinking" dots so the user gets feedback that the click
  // did something. Distinct from the auto-retry path (which is fast
  // enough that the empty placeholder reads as "still loading").
  const [isRetrying, setIsRetrying] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(thumbnailUrl);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { reportFailed, reportRecovered } = useFailedImages();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isReady = status === "ready";

  useEffect(() => {
    setRetryCount(0);
    setHasFailed(false);
    setFallbackLevel(0);
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

  // Compute the URL for a given level in the fallback ladder. Each
  // level is a different physical asset, so the browser cache won't
  // hide the fact that level 0 was broken when we ask for level 1.
  const urlForLevel = useCallback(
    (level: 0 | 1 | 2): string => {
      if (level === 0) return thumbnailUrl;
      if (level === 1) return getPreviewUrl(image.original_url);
      return image.original_url;
    },
    [thumbnailUrl, image.original_url],
  );

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
    setIsRetrying(false);
    markImageLoaded(currentSrc);
  }, [currentSrc]);

  const handleImageError = useCallback(() => {
    if (!isReady) return;
    setIsRetrying(false);
    if (retryCount >= MAX_THUMBNAIL_RETRIES) {
      // Spent the retry budget at the current ladder level. Try the
      // next fallback level before declaring the tile failed — the
      // original almost always works even when the thumbnail is
      // missing, and a slow-but-correct image beats a blank tile.
      if (fallbackLevel < 2) {
        const nextLevel = (fallbackLevel + 1) as 1 | 2;
        setFallbackLevel(nextLevel);
        setRetryCount(0);
        setCurrentSrc(`${urlForLevel(nextLevel)}?retry=${Date.now()}`);
        return;
      }
      setHasFailed(true);
      return;
    }
    const delay = Math.min(Math.pow(2, retryCount + 1) * 1000, MAX_RETRY_DELAY);
    retryTimeoutRef.current = setTimeout(() => {
      setCurrentSrc(`${urlForLevel(fallbackLevel)}?retry=${Date.now()}`);
      setRetryCount(prev => prev + 1);
    }, delay);
  }, [retryCount, isReady, fallbackLevel, urlForLevel]);

  // Manual retry from the failed-tile UI: reset state and refetch with
  // a cache-busting query string so we don't hit the same poisoned CDN
  // entry. Capped at MAX_MANUAL_RETRIES — past that the tile shows a
  // terminal "Re-upload" state with the filename so the user can
  // identify the file in their source folder and re-upload it.
  const handleManualRetry = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (manualRetryCount >= MAX_MANUAL_RETRIES) return;
    setHasFailed(false);
    setIsRetrying(true);
    setRetryCount(0);
    setFallbackLevel(0);
    setIsLoaded(false);
    setManualRetryCount(prev => prev + 1);
    setCurrentSrc(`${thumbnailUrl}?retry=${Date.now()}`);
  }, [thumbnailUrl, manualRetryCount]);

  // Register / unregister with the gallery-level FailedImagesProvider so
  // a "Problem images" section can list all failed tiles and offer
  // Retry-all in one click. Done in an effect so we only update the
  // context when the failure state actually transitions.
  useEffect(() => {
    if (hasFailed) {
      reportFailed({
        id: image.id,
        filename: image.filename,
        retry: () => handleManualRetry({ stopPropagation: () => {} } as React.MouseEvent),
      });
    } else {
      reportRecovered(image.id);
    }
  }, [hasFailed, image.id, image.filename, reportFailed, reportRecovered, handleManualRetry]);

  const { mode: cullingScoreMode } = useCullingScoreMode();
  // Match the star mapping used by the sidebar counts, rating filter and the
  // detail panel: culling_score → stars, falling back to legacy ai_rating so a
  // photo's star presence is identical everywhere it appears.
  const starRating = cullingScoreToStars(image.culling_score, cullingScoreMode) || (image.ai_rating || 0);
  const hasRating = starRating > 0;
  const showRawScore = cullingScoreMode === "raw" && typeof image.culling_score === "number";

  // Use computed dimensions from justified layout, or fallback
  const aspectRatio = (image.width && image.height) ? image.width / image.height : 1.5;
  const itemWidth = viewMode === "masonry" ? (computedWidth ?? ROW_HEIGHT * aspectRatio) : undefined;
  const itemHeight = viewMode === "masonry" ? (computedHeight ?? ROW_HEIGHT) : undefined;

  // "Thinking" dots — three pink dots that pulse in succession.
  // Lighter than a spinner and reads as "working on it". Used both
  // for the initial-processing state and during a manual retry click.
  const thinkingDots = (
    <div className="flex items-center gap-1" aria-label="Processing">
      <span className="thinking-dot thinking-dot-1" />
      <span className="thinking-dot thinking-dot-2" />
      <span className="thinking-dot thinking-dot-3" />
    </div>
  );

  // Overlay that wraps the thinking dots — shown during a manual retry
  // while we wait for load/error to fire, so the user gets immediate
  // feedback that their click did something.
  const renderRetryingOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-sm z-10 bg-surface-2/80 backdrop-blur-sm">
      {thinkingDots}
    </div>
  );

  // Render the failed-thumbnail tile — shown when retry budget is
  // exhausted. Two visual states:
  //   1) Manual retries remaining → AlertTriangle + Retry button.
  //   2) Manual retries spent     → AlertTriangle + "Re-upload"
  //      label + filename, no clickable retry. At this point the file
  //      probably isn't coming back from the CDN and we don't want
  //      the user spamming the storage layer with cache-busting GETs.
  const renderFailedTile = () => {
    const manualRetriesLeft = MAX_MANUAL_RETRIES - manualRetryCount;
    const terminal = manualRetriesLeft <= 0;
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-sm z-10 bg-surface-2/80 backdrop-blur-sm gap-1.5 px-2 text-center">
        <AlertTriangle className={cn("w-5 h-5", terminal ? "text-destructive" : "text-muted-foreground")} />
        {terminal ? (
          <>
            <span className="aura-microlabel text-destructive">Re-upload</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-full" title={image.filename}>
              {image.filename}
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleManualRetry}
              className="text-[11px] text-primary hover:underline focus:outline-none focus:underline"
              aria-label={`Retry loading thumbnail for ${image.filename}`}
            >
              Retry
            </button>
            <span className="text-[9px] text-muted-foreground truncate max-w-full" title={image.filename}>
              {image.filename}
            </span>
          </>
        )}
      </div>
    );
  };

  // Render status overlay for non-ready images
  const renderStatusOverlay = () => {
    if (isReady) return null;

    return (
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center rounded-sm z-10",
        status === "error"
          ? "bg-destructive/20 backdrop-blur-sm"
          : "bg-surface-2/80 backdrop-blur-sm"
      )}>
        {status === "uploading" && (
          <Upload className="w-6 h-6 text-primary animate-pulse" />
        )}
        {status === "pending" && (
          <Clock className="w-5 h-5 text-muted-foreground" />
        )}
        {status === "error" && (
          <AlertTriangle className="w-6 h-6 text-destructive" />
        )}
        {/* Default + "processing" state — also covers anything we
            haven't explicitly mapped (e.g. a freshly-uploaded image
            with no thumbnail yet that's queued for AI scoring). */}
        {status !== "uploading" && status !== "pending" && status !== "error" && thinkingDots}
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
      {/* Placeholder shown when not in view, not loaded, or not yet
          processed. The !isReady branch was previously gated on
          !isInView, leaving freshly-uploaded images as invisible
          empty tiles in the grid (the actual <img> below only renders
          for ready images). Always render the skeleton when not
          ready so the user sees the slot the image will live in.   */}
      {(!isInView || !isReady || (!isLoaded && isReady) || hasFailed || isRetrying) && (
        <div className={cn(
          "rounded-sm overflow-hidden border relative",
          isSelected ? "border-primary ring-2 ring-primary/50" : "border-border/60",
          "bg-surface-2 thumbnail-shimmer plate-keyline",
          viewMode === "grid" ? "aspect-square" : "w-full h-full"
        )}
          onClick={() => onImageClick(image.id, index)}
        >
          {isRetrying
            ? renderRetryingOverlay()
            : hasFailed
              ? renderFailedTile()
              : !isReady && renderStatusOverlay()}
          {/* Selection checkbox on placeholder */}
          <button
            type="button"
            aria-label={isSelected ? "Deselect image" : "Select image"}
            aria-pressed={isSelected}
            className={cn(
              "absolute top-1.5 left-1.5 w-5 h-5 rounded-sm border-[1.5px] flex items-center justify-center transition-all duration-150 cursor-pointer z-20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "bg-primary border-primary opacity-100 scale-100"
                : "border-white/80 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:scale-110"
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
      {isInView && isReady && !hasFailed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isLoaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(!isLoaded && "absolute inset-0", "h-full")}
        >
          <div
            className={cn(
              "relative rounded-sm overflow-hidden border transition-all duration-200 h-full plate-keyline",
              isSelected
                ? "border-primary ring-2 ring-primary/50"
                : "border-border/40 hover:border-border"
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
                "absolute top-1.5 left-1.5 w-5 h-5 rounded-sm border-[1.5px] flex items-center justify-center transition-all duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "bg-primary border-primary opacity-100 scale-100"
                  : "border-white/80 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:scale-110"
              )}
              onClick={(e) => onSelectionToggle(image.id, index, e)}
            >
              {isSelected && (
                <Check className="w-3 h-3 text-primary-foreground" />
              )}
            </button>

            {/* Hero Badge — top-left, shifts when selected (pick flag) */}
            {image.is_hero && (
              <div className={cn(
                "absolute top-1.5 px-1.5 py-0.5 rounded-sm font-mono text-[8px] font-semibold uppercase tracking-[0.14em] bg-primary text-primary-foreground",
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
                className="w-6 h-6 rounded-sm bg-black/45 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/65 transition-colors opacity-0 group-hover:opacity-100"
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
                  "w-6 h-6 rounded-sm flex items-center justify-center transition-colors",
                  image.is_liked
                    ? "bg-destructive text-white"
                    : "bg-black/45 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/65"
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
                        {new Date(processingInfo.sentAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    )}
                    {processingInfo.completedAt && (
                      <p className="tabular-nums">
                        <span className="text-muted-foreground">Completed: </span>
                        {new Date(processingInfo.completedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
                "absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-black/55 backdrop-blur-sm transition-opacity duration-200",
                isSelected ? "opacity-100" : "opacity-80 group-hover:opacity-100"
              )}>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-2.5 h-2.5",
                        i < starRating
                          ? "text-rating fill-rating"
                          : "text-white/20"
                      )}
                    />
                  ))}
                </div>
                {showRawScore && (
                  <span className="font-mono text-[10px] text-white/90 tabular-nums folio">
                    {(image.culling_score as number).toFixed(2)}
                  </span>
                )}
              </div>
            )}

            {/* Similar-group badge — this photo is one of N near-duplicate
                frames at the active sensitivity. Bottom-right, out of the way
                of the star rating (bottom-left) and Pick/like badges. */}
            {groupSize && groupSize > 1 && (
              <div
                className={cn(
                  "absolute bottom-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-black/55 backdrop-blur-sm text-white/90 transition-opacity duration-200",
                  isSelected ? "opacity-100" : "opacity-80 group-hover:opacity-100"
                )}
                title={`One of ${groupSize} similar photos`}
              >
                <Layers className="w-2.5 h-2.5" />
                <span className="font-mono text-[10px] tabular-nums folio">{groupSize}</span>
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
    prev.index !== next.index ||
    prev.groupSize !== next.groupSize
  ) {
    return false;
  }
  // Callback identity changes are fine — they're stable from
  // useCallback in the parent. Skip them in the comparison so we
  // don't churn on referential equality for callbacks.
  return true;
});
