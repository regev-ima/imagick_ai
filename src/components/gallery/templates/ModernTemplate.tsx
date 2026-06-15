import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Download, Grid, LayoutGrid, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";

const EASE = [0.2, 0, 0, 1] as const;

/**
 * MODERN — Imagick.ai brand. A clean app: sticky tonal top bar with a grid-
 * density toggle, a tight edge-to-edge square mosaic. Calm chrome, brand royal-
 * blue (#2B50F0) accents on the active toggle, neutral photo-first hero scrim.
 */
export function ModernTemplate({
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
  const [gridSize, setGridSize] = useState<"small" | "large">("large");

  return (
    <div
      className={cn("min-h-screen bg-background text-foreground", darkMode ? "dark" : "light")}
    >
      {/* Sticky Material app bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold tracking-tight truncate">
              {galleryName}
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {images.length} photos
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-full bg-muted/60 border border-border/60">
            <button
              aria-label="Large grid"
              onClick={() => setGridSize("large")}
              className={cn(
                "p-2 rounded-full transition-colors",
                gridSize === "large"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              aria-label="Small grid"
              onClick={() => setGridSize("small")}
              className={cn(
                "p-2 rounded-full transition-colors",
                gridSize === "small"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Grid className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      {heroImage && (
        <div className="relative h-[60vh] overflow-hidden">
          <img src={heroImage} alt={galleryName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-background" />
          <div className="absolute bottom-8 left-6 right-6">
            <h2 className="font-display text-3xl font-semibold text-white tracking-tight">
              {galleryName}
            </h2>
          </div>
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="max-w-3xl mx-auto px-6 py-12 text-center">
          <p className="text-lg text-muted-foreground leading-relaxed">{description}</p>
        </div>
      )}

      {/* Category Nav */}
      <div className="max-w-7xl mx-auto px-6">
        <CategoryNav
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
          darkMode={darkMode}
          totalCount={images.length}
        />
      </div>

      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div
          className={cn(
            "grid gap-1.5",
            gridSize === "large"
              ? "grid-cols-2 md:grid-cols-3"
              : "grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          )}
        >
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(index * 0.02, 0.4), duration: 0.4, ease: EASE }}
              className="relative aspect-square group cursor-pointer overflow-hidden rounded-xl"
              onClick={() => setLightboxImage(image.id)}
            >
              <img
                src={image.original_url}
                alt={image.filename}
                loading={index < 6 ? "eager" : "lazy"}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLike(image.id);
                    }}
                    className={cn(
                      "p-3 rounded-full transition-all",
                      image.is_liked
                        ? "bg-destructive text-destructive-foreground scale-110"
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
                      className="p-3 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* AI rating */}
              {image.ai_rating != null && image.ai_rating > 0 && (
                <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                  <Star className="w-2.5 h-2.5 text-rating fill-rating" />
                  <span className="font-mono text-[9px] text-white tabular-nums">
                    {image.ai_rating.toFixed(1)}
                  </span>
                </div>
              )}

              {/* Like indicator */}
              {image.is_liked && (
                <div className="absolute top-2 right-2">
                  <Heart className="w-4 h-4 text-destructive fill-destructive drop-shadow" />
                </div>
              )}
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
