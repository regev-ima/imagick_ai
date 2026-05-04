import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Download, Grid, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";

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

  const bgClass = darkMode ? "bg-neutral-950" : "bg-neutral-50";
  const textClass = darkMode ? "text-white" : "text-neutral-900";
  const mutedClass = darkMode ? "text-neutral-400" : "text-neutral-500";
  const accentClass = "text-primary";

  return (
    <div className={cn("min-h-screen", bgClass, textClass)}>
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-inherit/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium tracking-tight">{galleryName}</h1>
            <p className={cn("text-sm", mutedClass)}>{images.length} photos</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGridSize("large")}
              className={cn("p-2 rounded-lg transition-colors", gridSize === "large" ? accentClass : mutedClass)}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setGridSize("small")}
              className={cn("p-2 rounded-lg transition-colors", gridSize === "small" ? accentClass : mutedClass)}
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
          <div className={cn("absolute inset-0 bg-gradient-to-b from-transparent via-transparent", darkMode ? "to-neutral-950" : "to-neutral-50")} />
          <div className="absolute bottom-8 left-6 right-6">
            <h2 className="text-3xl font-light text-white tracking-wide">{galleryName}</h2>
          </div>
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="max-w-3xl mx-auto px-6 py-12 text-center">
          <p className={cn("text-lg", mutedClass)}>{description}</p>
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
            "grid gap-1",
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
              transition={{ delay: Math.min(index * 0.02, 0.4) }}
              className="relative aspect-square group cursor-pointer overflow-hidden"
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
                        ? "bg-red-500 text-white scale-110"
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

              {/* Like indicator */}
              {image.is_liked && (
                <div className="absolute top-2 right-2">
                  <Heart className="w-4 h-4 text-red-500 fill-current" />
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
