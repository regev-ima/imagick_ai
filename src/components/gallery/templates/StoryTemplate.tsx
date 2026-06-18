import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Download, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";

const EASE = [0.2, 0, 0, 1] as const;

/**
 * STORY — Imagick.ai brand. A full-screen, vertically snapping photo story.
 * Chrome floats as clean tonal pills (title fades on scroll, persistent like/
 * download for the active frame, a mono counter). Photos are the hero; the
 * brand royal blue carries through the shared chrome (nav, lightbox).
 */
export function StoryTemplate({
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
  const [headerOpacity, setHeaderOpacity] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track scroll for header fade and visible section
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const y = container.scrollTop;
      setHeaderOpacity(Math.max(0, 1 - y / 300));
    };
    container.addEventListener("scroll", handleScroll, { passive: true });

    const sections = container.querySelectorAll("[data-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.section);
            if (!isNaN(idx)) setVisibleIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );
    sections.forEach((s) => observer.observe(s));

    return () => {
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [images]);

  const floatCtrl =
    "p-3 rounded-full backdrop-blur-md border border-white/15 transition-colors bg-white/10 text-white hover:bg-white/20";

  return (
    <div
      className={cn(
        "h-screen flex flex-col overflow-hidden relative bg-background text-foreground",
        darkMode ? "dark" : "light"
      )}
    >
      {/* Top scrim so floating chrome stays legible over any photo */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-40 z-10 bg-gradient-to-b from-black/50 to-transparent" />

      {/* Fixed Header */}
      <div
        className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-between transition-opacity duration-300"
        style={{ opacity: headerOpacity, pointerEvents: headerOpacity < 0.3 ? "none" : "auto" }}
      >
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-white drop-shadow">
            {galleryName}
          </h1>
          {description && (
            <p className="text-xs text-white/70 drop-shadow">{description}</p>
          )}
        </div>
      </div>

      {/* Fixed Category Nav */}
      <div className="absolute top-16 left-0 right-0 z-20 px-6">
        <CategoryNav
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
          darkMode={darkMode}
          totalCount={images.length}
        />
      </div>

      {/* Fixed Counter */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <span className="font-mono text-xs tabular-nums tracking-widest text-white/80 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md">
          {String(visibleIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
        </span>
      </div>

      {/* Bottom scrim */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 z-10 bg-gradient-to-t from-black/50 to-transparent" />

      {/* Fixed Like / Download for the active frame */}
      {images[visibleIndex] && (
        <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
          {images[visibleIndex].ai_rating != null && images[visibleIndex].ai_rating! > 0 && (
            <div className="flex items-center gap-1 px-3 py-2 rounded-full bg-black/30 backdrop-blur-md border border-white/15">
              <Star className="w-3.5 h-3.5 text-rating fill-rating" />
              <span className="font-mono text-xs text-white/90 tabular-nums">
                {images[visibleIndex].ai_rating!.toFixed(1)}
              </span>
            </div>
          )}
          <button
            onClick={() => onLike(images[visibleIndex].id)}
            className={cn(
              "p-3 rounded-full backdrop-blur-md border transition-colors",
              images[visibleIndex].is_liked
                ? "bg-destructive text-destructive-foreground border-transparent"
                : "bg-white/10 text-white border-white/15 hover:bg-white/20"
            )}
          >
            <Heart className={cn("w-5 h-5", images[visibleIndex].is_liked && "fill-current")} />
          </button>
          {downloadEnabled && (
            <button
              onClick={() => onDownload(images[visibleIndex].id)}
              className={floatCtrl}
            >
              <Download className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Scrollable Sections */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-hide bg-black"
      >
        {images.map((image, index) => (
          <div
            key={image.id}
            data-section={index}
            className="snap-start h-screen w-full flex items-center justify-center p-0 cursor-pointer"
            onClick={() => setLightboxImage(image.id)}
          >
            <motion.img
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: EASE }}
              src={image.original_url}
              alt={image.filename}
              loading={index < 2 ? "eager" : "lazy"}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
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
