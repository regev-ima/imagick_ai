import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Download, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";
import { useDominantColor } from "@/hooks/useDominantColor";

const EASE = [0.2, 0, 0, 1] as const;

/**
 * FILMSTRIP — PRISM. A cinematic horizontal reel: a calm tonal top bar, full
 * snap-scrolling frames centered on screen, and a Roboto-Mono frame counter.
 * The active frame's progress and accents tint from the photography.
 */
export function FilmstripTemplate({
  galleryName,
  description,
  images,
  heroImage,
  darkMode,
  downloadEnabled,
  onLike,
  onDownload,
  categories,
  activeCategory,
  onCategoryChange,
}: TemplateProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sampleUrl = heroImage || images[0]?.original_url;
  const dynamic = useDominantColor(sampleUrl);
  const dynamicStyle = dynamic
    ? ({ "--dynamic-primary": dynamic } as React.CSSProperties)
    : undefined;

  // Track visible slide via IntersectionObserver
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const slides = container.querySelectorAll("[data-slide]");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.slide);
            if (!isNaN(idx)) setVisibleIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );

    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [images]);

  const progress = images.length > 1 ? (visibleIndex / (images.length - 1)) * 100 : 100;

  return (
    <div
      className={cn(
        "h-screen flex flex-col overflow-hidden bg-background text-foreground",
        darkMode ? "dark" : "light"
      )}
      style={dynamicStyle}
    >
      {/* Fixed Top Bar */}
      <header className="shrink-0 px-6 py-4 flex items-center justify-between gap-4 z-10 border-b border-border/60">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-semibold tracking-tight truncate">
            {galleryName}
          </h1>
          {description && (
            <p className="text-xs mt-0.5 text-muted-foreground truncate">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <CategoryNav
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={onCategoryChange}
            darkMode={darkMode}
            totalCount={images.length}
          />
        </div>
      </header>

      {/* Horizontal Filmstrip */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex items-center scrollbar-hide"
      >
        {images.map((image, index) => (
          <div
            key={image.id}
            data-slide={index}
            className="snap-center shrink-0 flex items-center justify-center px-4 h-full w-[85vw] md:w-[62vw]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.5, ease: EASE }}
              className="relative group cursor-pointer max-h-[80vh] w-full"
              onClick={() => setLightboxImage(image.id)}
            >
              <img
                src={image.original_url}
                alt={image.filename}
                loading={index < 3 ? "eager" : "lazy"}
                className="w-full h-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-2xl" />

              {/* AI rating */}
              {image.ai_rating != null && image.ai_rating > 0 && (
                <div className="absolute top-4 left-4 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                  <Star className="w-3 h-3 text-rating fill-rating" />
                  <span className="font-mono text-[10px] text-white tabular-nums">
                    {image.ai_rating.toFixed(1)}
                  </span>
                </div>
              )}

              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLike(image.id);
                  }}
                  className={cn(
                    "p-2.5 rounded-full backdrop-blur-md transition-colors",
                    image.is_liked
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-white/20 text-white hover:bg-white/30"
                  )}
                >
                  <Heart className={cn("w-5 h-5", image.is_liked && "fill-current")} />
                </button>
                {downloadEnabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(image.id);
                    }}
                    className="p-2.5 rounded-full bg-white/20 text-white backdrop-blur-md hover:bg-white/30 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                )}
              </div>

              {image.is_liked && (
                <div className="absolute top-4 right-4">
                  <Heart className="w-4 h-4 text-destructive fill-destructive drop-shadow" />
                </div>
              )}
            </motion.div>
          </div>
        ))}
      </div>

      {/* Bottom counter + progress */}
      <div className="shrink-0 px-6 py-4 flex flex-col items-center gap-2 border-t border-border/60">
        <div className="w-40 h-0.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[hsl(var(--dynamic-primary))]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: EASE }}
          />
        </div>
        <span className="font-mono text-xs tabular-nums tracking-widest text-muted-foreground">
          {String(visibleIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
        </span>
      </div>

      {/* Lightbox */}
      <GalleryLightbox
        images={images}
        currentImageId={lightboxImage}
        onClose={() => setLightboxImage(null)}
        onNavigate={setLightboxImage}
        onLike={onLike}
        onDownload={onDownload}
        downloadEnabled={downloadEnabled}
      />
    </div>
  );
}
