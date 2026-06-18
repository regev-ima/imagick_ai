import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Download, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";

const EASE = [0.2, 0, 0, 1] as const;

/**
 * CLASSIC — Imagick.ai brand. A timeless gallery: a full-bleed cover with a
 * centered title over a clean neutral scrim, then a composed uniform 3:2 grid.
 * Calm, formal, modern Inter type, hairline rules, brand royal-blue accents,
 * warm-red likes.
 */
export function ClassicTemplate({
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

  const coverImage = heroImage || (images.length > 0 ? images[0].original_url : null);

  return (
    <div
      className={cn("min-h-screen bg-background text-foreground", darkMode ? "dark" : "light")}
    >
      {/* Full-height Hero Cover */}
      {coverImage && (
        <div className="relative h-[90vh] overflow-hidden">
          <img src={coverImage} alt={galleryName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/20" />
          <div className="absolute inset-0 flex items-center justify-center text-center px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              <h1 className="font-display text-5xl lg:text-7xl font-semibold text-white tracking-tight mb-4">
                {galleryName}
              </h1>
              {description && (
                <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
                  {description}
                </p>
              )}
              <p className="font-mono text-xs text-white/60 mt-6 tracking-[0.3em] uppercase">
                {images.length} photographs
              </p>
            </motion.div>
          </div>
        </div>
      )}

      {/* No-cover header */}
      {!coverImage && (
        <header className="py-20 px-8 text-center border-b border-border/60">
          <h1 className="font-display text-5xl lg:text-6xl font-semibold tracking-tight mb-4">
            {galleryName}
          </h1>
          {description && (
            <p className="text-lg max-w-2xl mx-auto leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
          <p className="font-mono text-xs mt-6 tracking-[0.3em] uppercase text-muted-foreground">
            {images.length} photographs
          </p>
        </header>
      )}

      {/* Category Nav */}
      <div className="max-w-7xl mx-auto px-6 pt-8">
        <CategoryNav
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
          darkMode={darkMode}
          totalCount={images.length}
        />
      </div>

      {/* Uniform Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.5, ease: EASE }}
              className="relative group cursor-pointer overflow-hidden rounded-2xl surface-1 border border-border/60"
              onClick={() => setLightboxImage(image.id)}
            >
              <img
                src={image.original_url}
                alt={image.filename}
                loading={index < 6 ? "eager" : "lazy"}
                className="w-full aspect-[3/2] object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />

              {/* AI rating */}
              {image.ai_rating != null && image.ai_rating > 0 && (
                <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                  <Star className="w-3 h-3 text-rating fill-rating" />
                  <span className="font-mono text-[10px] text-white tabular-nums">
                    {image.ai_rating.toFixed(1)}
                  </span>
                </div>
              )}

              {/* Hover actions — kept visible on touch devices (no hover) so the
                  per-photo like/download remain discoverable. */}
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

              {image.is_liked && (
                <div className="absolute top-3 right-3">
                  <Heart className="w-4 h-4 text-destructive fill-destructive drop-shadow" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 text-center border-t border-border/60">
        <p className="font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
          &copy; {new Date().getFullYear()} &middot; {galleryName}
        </p>
      </footer>

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
