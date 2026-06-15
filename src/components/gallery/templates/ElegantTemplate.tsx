import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Download, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";

const EASE = [0.2, 0, 0, 1] as const;

/**
 * ELEGANT — Imagick.ai brand. Airy editorial masonry on a clean tonal surface
 * (porcelain white in light, graphite in dark). A tall photo-first hero with a
 * neutral scrim. Modern Inter type, hairline cards, brand royal-blue (#2B50F0)
 * accents, warm-red likes, amber AI ratings.
 */
export function ElegantTemplate({
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

  return (
    <div
      className={cn("min-h-screen bg-background text-foreground", darkMode ? "dark" : "light")}
    >
      {/* Hero Section */}
      {heroImage && (
        <div className="relative h-[85vh] overflow-hidden">
          <img src={heroImage} alt={galleryName} className="w-full h-full object-cover" />
          {/* Clean neutral scrim — photo stays the hero */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-16">
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="font-display text-4xl lg:text-6xl font-semibold tracking-tight text-white mb-3"
            >
              {galleryName}
            </motion.h1>
            {description && (
              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.7, ease: EASE }}
                className="text-lg text-white/80 max-w-2xl leading-relaxed"
              >
                {description}
              </motion.p>
            )}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6, ease: EASE }}
              className="font-mono text-xs text-white/60 mt-4 tracking-[0.2em] uppercase"
            >
              {images.length} photographs
            </motion.p>
          </div>
        </div>
      )}

      {/* Gallery Header (if no hero) */}
      {!heroImage && (
        <header className="py-16 px-8 text-center border-b border-border/60 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] to-transparent pointer-events-none" />
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="font-display text-4xl lg:text-5xl font-semibold tracking-tight mb-4"
          >
            {galleryName}
          </motion.h1>
          {description && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.7, ease: EASE }}
              className="text-lg max-w-2xl mx-auto leading-relaxed text-muted-foreground"
            >
              {description}
            </motion.p>
          )}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6, ease: EASE }}
            className="font-mono text-xs mt-4 tracking-[0.2em] uppercase text-muted-foreground"
          >
            {images.length} photographs
          </motion.p>
        </header>
      )}

      {/* Category Nav */}
      <div className="px-8 lg:px-16 pt-6">
        <CategoryNav
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
          darkMode={darkMode}
          totalCount={images.length}
        />
      </div>

      {/* Gallery Grid - Masonry */}
      <div className="p-8 lg:p-16">
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6">
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.5, ease: EASE }}
              className="break-inside-avoid mb-6 group cursor-pointer"
              onClick={() => setLightboxImage(image.id)}
            >
              <div className="relative rounded-2xl overflow-hidden surface-1 border border-border/60">
                <img
                  src={image.original_url}
                  alt={image.filename}
                  loading={index < 4 ? "eager" : "lazy"}
                  className="w-full transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />

                {/* AI rating */}
                {image.ai_rating != null && image.ai_rating > 0 && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                    <Star className="w-3 h-3 text-rating fill-rating" />
                    <span className="font-mono text-[10px] text-white tabular-nums">
                      {image.ai_rating.toFixed(1)}
                    </span>
                  </div>
                )}

                {/* Persistent like indicator */}
                {image.is_liked && (
                  <div className="absolute top-3 right-3">
                    <Heart className="w-4 h-4 text-destructive fill-destructive drop-shadow" />
                  </div>
                )}

                {/* Hover Actions — revealed on hover, but kept visible on touch devices
                    (no hover) so the per-photo like/download stay discoverable. */}
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
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
              </div>
            </motion.div>
          ))}
        </div>
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
