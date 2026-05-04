import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";

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

  const bgClass = darkMode ? "bg-[#0c0c0c]" : "bg-white";
  const textClass = darkMode ? "text-white" : "text-gray-900";
  const mutedClass = darkMode ? "text-gray-500" : "text-gray-400";
  const borderClass = darkMode ? "border-white/10" : "border-gray-200";

  const coverImage = heroImage || (images.length > 0 ? images[0].original_url : null);

  return (
    <div className={cn("min-h-screen", bgClass, textClass)}>
      {/* Full-height Hero Cover */}
      {coverImage && (
        <div className="relative h-[90vh] overflow-hidden">
          <img
            src={coverImage}
            alt={galleryName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
          <div className="absolute inset-0 flex items-center justify-center text-center px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1
                className="text-5xl lg:text-7xl font-light text-white tracking-wide mb-4"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {galleryName}
              </h1>
              {description && (
                <p className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
                  {description}
                </p>
              )}
              <p className="text-sm text-white/40 mt-6 tracking-[0.3em] uppercase">
                {images.length} photographs
              </p>
            </motion.div>
          </div>
        </div>
      )}

      {/* No-cover header */}
      {!coverImage && (
        <header className={cn("py-20 px-8 text-center border-b", borderClass)}>
          <h1
            className="text-5xl lg:text-6xl font-light tracking-wide mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {galleryName}
          </h1>
          {description && (
            <p className={cn("text-lg max-w-2xl mx-auto leading-relaxed", mutedClass)}>
              {description}
            </p>
          )}
          <p className={cn("text-sm mt-6 tracking-[0.3em] uppercase", mutedClass)}>
            {images.length} photographs
          </p>
        </header>
      )}

      {/* Separator */}
      <div className={cn("border-t mx-8 lg:mx-16", borderClass)} />

      {/* Category Nav */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
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
              transition={{ delay: Math.min(index * 0.03, 0.5) }}
              className="relative group cursor-pointer overflow-hidden rounded-sm"
              onClick={() => setLightboxImage(image.id)}
            >
              <img
                src={image.original_url}
                alt={image.filename}
                loading={index < 6 ? "eager" : "lazy"}
                className="w-full aspect-[3/2] object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />

              {/* Hover actions */}
              <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLike(image.id);
                  }}
                  className={cn(
                    "p-2 rounded-full backdrop-blur-sm transition-colors",
                    image.is_liked
                      ? "bg-red-500/80 text-white"
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
                    className="p-2 rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                )}
              </div>

              {image.is_liked && (
                <div className="absolute top-3 right-3">
                  <Heart className="w-4 h-4 text-red-500 fill-current" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className={cn("py-10 text-center border-t", borderClass)}>
        <p className={cn("text-xs tracking-widest uppercase", mutedClass)}>
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
