import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Download, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";

export function EditorialTemplate({
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

  const bgClass = darkMode ? "bg-zinc-900" : "bg-stone-100";
  const textClass = darkMode ? "text-white" : "text-zinc-900";
  const mutedClass = darkMode ? "text-zinc-400" : "text-zinc-500";

  // Split images into editorial sections
  const heroImages = images.slice(0, 1);
  const pairImages = images.slice(1, 5);
  const gridImages = images.slice(5);

  const ImageOverlay = ({ image }: { image: (typeof images)[0] }) => (
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike(image.id);
          }}
          className={cn(
            "p-3 rounded-full transition-colors",
            image.is_liked ? "bg-red-500 text-white" : "bg-white/20 text-white"
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
            className="p-3 rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            <Download className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn("min-h-screen", bgClass, textClass)}>
      {/* Magazine Header */}
      <header className="py-16 lg:py-24 px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className={cn("text-sm tracking-[0.3em] uppercase mb-4", mutedClass)}>
            Gallery Collection
          </p>
          <h1
            className="text-5xl lg:text-7xl font-extralight tracking-tight mb-6"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            {galleryName}
          </h1>
          {description && (
            <p className={cn("text-lg max-w-xl mx-auto leading-relaxed", mutedClass)}>
              {description}
            </p>
          )}
          <div className="mt-8 flex items-center justify-center gap-2">
            <span className={cn("text-sm", mutedClass)}>{images.length} photographs</span>
            <ArrowRight className={cn("w-4 h-4", mutedClass)} />
          </div>
        </motion.div>
      </header>

      {/* Category Nav */}
      <div className="px-8 lg:px-16 mb-8">
        <CategoryNav
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
          darkMode={darkMode}
          totalCount={images.length}
        />
      </div>

      {/* Hero Image */}
      {heroImages[0] && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative px-8 lg:px-16 mb-16"
        >
          <div
            className="relative overflow-hidden cursor-pointer group"
            onClick={() => setLightboxImage(heroImages[0].id)}
          >
            <img
              src={heroImages[0].original_url}
              alt={heroImages[0].filename}
              className="w-full h-[70vh] object-cover transition-transform duration-700 group-hover:scale-105"
              style={{ animation: "kenburns 20s ease-in-out infinite alternate" }}
            />
            <ImageOverlay image={heroImages[0]} />
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-sm tracking-wide">Featured Image</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Paired Images */}
      {pairImages.length > 0 && (
        <div className="px-8 lg:px-16 mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pairImages.map((image, index) => (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="relative overflow-hidden cursor-pointer group"
                onClick={() => setLightboxImage(image.id)}
              >
                <img
                  src={image.original_url}
                  alt={image.filename}
                  loading="lazy"
                  className="w-full aspect-[4/5] object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <ImageOverlay image={image} />
                {image.is_liked && (
                  <div className="absolute top-4 right-4">
                    <Heart className="w-5 h-5 text-red-500 fill-current" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Staggered Grid */}
      {gridImages.length > 0 && (
        <div className="px-8 lg:px-16 pb-16">
          <div className={cn("w-full border-t mb-12", darkMode ? "border-zinc-700" : "border-stone-300")} />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {gridImages.map((image, index) => (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(0.1 + index * 0.03, 0.5) }}
                className={cn(
                  "relative overflow-hidden cursor-pointer group",
                  index % 5 === 0 && "lg:col-span-2 lg:row-span-2"
                )}
                onClick={() => setLightboxImage(image.id)}
              >
                <img
                  src={image.original_url}
                  alt={image.filename}
                  loading="lazy"
                  className={cn(
                    "w-full object-cover transition-transform duration-500 group-hover:scale-105",
                    index % 5 === 0 ? "aspect-square" : "aspect-[3/4]"
                  )}
                />
                <ImageOverlay image={image} />
                {image.is_liked && (
                  <div className="absolute top-4 right-4">
                    <Heart className="w-5 h-5 text-red-500 fill-current" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={cn("py-12 text-center border-t", darkMode ? "border-zinc-800" : "border-stone-200")}>
        <p className={cn("text-sm", mutedClass)}>
          &copy; {new Date().getFullYear()} &middot; {galleryName}
        </p>
      </footer>

      {/* Ken Burns CSS */}
      <style>{`
        @keyframes kenburns {
          from { transform: scale(1); }
          to { transform: scale(1.05); }
        }
      `}</style>

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
