import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";

export function FilmstripTemplate({
  galleryName,
  description,
  images,
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

  const bgClass = darkMode ? "bg-black" : "bg-stone-50";
  const textClass = darkMode ? "text-white" : "text-gray-900";
  const mutedClass = darkMode ? "text-white/50" : "text-gray-400";

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

  return (
    <div className={cn("h-screen flex flex-col overflow-hidden", bgClass, textClass)}>
      {/* Fixed Top Bar */}
      <header className="shrink-0 px-6 py-4 flex items-center justify-between z-10">
        <div>
          <h1 className="text-lg font-medium tracking-tight">{galleryName}</h1>
          {description && <p className={cn("text-xs mt-0.5", mutedClass)}>{description}</p>}
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
            className="snap-start shrink-0 flex items-center justify-center px-4 h-full w-[85vw] md:w-[60vw]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(index * 0.05, 0.3) }}
              className="relative group cursor-pointer max-h-[80vh] w-full"
              onClick={() => setLightboxImage(image.id)}
            >
              <img
                src={image.original_url}
                alt={image.filename}
                loading={index < 3 ? "eager" : "lazy"}
                className="w-full h-full max-h-[80vh] object-contain rounded-sm"
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-sm" />
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLike(image.id);
                  }}
                  className={cn(
                    "p-2.5 rounded-full backdrop-blur-sm transition-colors",
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
                    className="p-2.5 rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                )}
              </div>

              {image.is_liked && (
                <div className="absolute top-4 right-4">
                  <Heart className="w-4 h-4 text-red-500 fill-current" />
                </div>
              )}
            </motion.div>
          </div>
        ))}
      </div>

      {/* Bottom counter */}
      <div className="shrink-0 px-6 py-3 flex items-center justify-center">
        <span className={cn("text-sm tabular-nums tracking-widest", mutedClass)}>
          {visibleIndex + 1} / {images.length}
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
