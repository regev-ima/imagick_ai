import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";

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

  const bgClass = darkMode ? "bg-[#0a0a0f]" : "bg-[#faf9f7]";
  const textClass = darkMode ? "text-white" : "text-gray-900";
  const mutedClass = darkMode ? "text-gray-400" : "text-gray-500";
  const borderClass = darkMode ? "border-white/10" : "border-black/10";

  return (
    <div className={cn("min-h-screen", bgClass, textClass)}>
      {/* Hero Section */}
      {heroImage && (
        <div className="relative h-[85vh] overflow-hidden">
          <img
            src={heroImage}
            alt={galleryName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-16">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl lg:text-6xl font-light tracking-wide text-white mb-3"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {galleryName}
            </motion.h1>
            {description && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg text-white/70 max-w-2xl leading-relaxed"
              >
                {description}
              </motion.p>
            )}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-white/50 mt-4 tracking-widest uppercase"
            >
              {images.length} photographs
            </motion.p>
          </div>
        </div>
      )}

      {/* Gallery Header (if no hero) */}
      {!heroImage && (
        <header className={cn("py-16 px-8 text-center border-b", borderClass)}>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-5xl font-light tracking-wide mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {galleryName}
          </motion.h1>
          {description && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn("text-lg max-w-2xl mx-auto leading-relaxed", mutedClass)}
            >
              {description}
            </motion.p>
          )}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={cn("text-sm mt-4 tracking-widest uppercase", mutedClass)}
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
              transition={{ delay: Math.min(index * 0.03, 0.5) }}
              className="break-inside-avoid mb-6 group cursor-pointer"
              onClick={() => setLightboxImage(image.id)}
            >
              <div className={cn("rounded-lg overflow-hidden border", borderClass)}>
                <div className="relative">
                  <img
                    src={image.original_url}
                    alt={image.filename}
                    loading={index < 4 ? "eager" : "lazy"}
                    className="w-full transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                  {/* Hover Actions */}
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
