import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";

export function StoryTemplate({
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
  const [headerOpacity, setHeaderOpacity] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const bgClass = darkMode ? "bg-black" : "bg-white";
  const textClass = darkMode ? "text-white" : "text-gray-900";
  const mutedClass = darkMode ? "text-white/40" : "text-gray-400";

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

  return (
    <div className={cn("h-screen flex flex-col overflow-hidden relative", bgClass, textClass)}>
      {/* Fixed Header */}
      <div
        className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-between transition-opacity duration-300"
        style={{ opacity: headerOpacity, pointerEvents: headerOpacity < 0.3 ? "none" : "auto" }}
      >
        <div>
          <h1 className="text-lg font-medium tracking-tight">{galleryName}</h1>
          {description && <p className={cn("text-xs", mutedClass)}>{description}</p>}
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
        <span className={cn("text-sm tabular-nums tracking-widest", mutedClass)}>
          {visibleIndex + 1} / {images.length}
        </span>
      </div>

      {/* Fixed Like Button */}
      {images[visibleIndex] && (
        <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
          <button
            onClick={() => onLike(images[visibleIndex].id)}
            className={cn(
              "p-3 rounded-full backdrop-blur-sm transition-all",
              images[visibleIndex].is_liked
                ? "bg-red-500 text-white"
                : darkMode
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-black/10 text-gray-900 hover:bg-black/20"
            )}
          >
            <Heart className={cn("w-5 h-5", images[visibleIndex].is_liked && "fill-current")} />
          </button>
          {downloadEnabled && (
            <button
              onClick={() => onDownload(images[visibleIndex].id)}
              className={cn(
                "p-3 rounded-full backdrop-blur-sm transition-colors",
                darkMode
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-black/10 text-gray-900 hover:bg-black/20"
              )}
            >
              <Download className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Scrollable Sections */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-hide"
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
              transition={{ duration: 0.6 }}
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
