import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Download, ArrowRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateProps } from "./types";
import { GalleryLightbox } from "./GalleryLightbox";
import { CategoryNav } from "./CategoryNav";
import { useDominantColor } from "@/hooks/useDominantColor";

const EASE = [0.2, 0, 0, 1] as const;

/**
 * EDITORIAL — PRISM. A magazine: a typographic masthead, a featured full-bleed
 * image, a paired spread, then an asymmetric staggered grid. Unified PRISM type
 * (Figtree) with a single tasteful italic masthead accent for editorial
 * identity. Dynamic-color rule + accents drawn from the photography.
 */
export function EditorialTemplate({
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

  // Split images into editorial sections
  const heroImages = images.slice(0, 1);
  const pairImages = images.slice(1, 5);
  const gridImages = images.slice(5);

  const sampleUrl = heroImage || heroImages[0]?.original_url;
  const dynamic = useDominantColor(sampleUrl);
  const dynamicStyle = dynamic
    ? ({ "--dynamic-primary": dynamic } as React.CSSProperties)
    : undefined;

  const ImageOverlay = ({ image }: { image: (typeof images)[0] }) => (
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike(image.id);
          }}
          className={cn(
            "p-3 rounded-full backdrop-blur-md transition-colors",
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
            className="p-3 rounded-full bg-white/20 text-white backdrop-blur-md hover:bg-white/30 transition-colors"
          >
            <Download className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );

  const LikedBadge = ({ liked }: { liked: boolean }) =>
    liked ? (
      <div className="absolute top-4 right-4">
        <Heart className="w-5 h-5 text-destructive fill-destructive drop-shadow" />
      </div>
    ) : null;

  return (
    <div
      className={cn("min-h-screen bg-background text-foreground", darkMode ? "dark" : "light")}
      style={dynamicStyle}
    >
      {/* Magazine Masthead */}
      <header className="py-16 lg:py-24 px-8 text-center relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--dynamic-primary)/0.5)] to-transparent" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <p className="font-mono text-xs tracking-[0.32em] uppercase mb-5 text-[hsl(var(--dynamic-primary))]">
            Gallery Collection
          </p>
          <h1 className="font-display text-5xl lg:text-7xl font-light italic tracking-tight mb-6">
            {galleryName}
          </h1>
          {description && (
            <p className="text-lg max-w-xl mx-auto leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
          <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
            <span className="font-mono text-xs uppercase tracking-widest">
              {images.length} photographs
            </span>
            <ArrowRight className="w-4 h-4" />
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

      {/* Featured Image */}
      {heroImages[0] && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6, ease: EASE }}
          className="relative px-8 lg:px-16 mb-16"
        >
          <div
            className="relative overflow-hidden rounded-3xl cursor-pointer group"
            onClick={() => setLightboxImage(heroImages[0].id)}
          >
            <img
              src={heroImages[0].original_url}
              alt={heroImages[0].filename}
              className="w-full h-[70vh] object-cover transition-transform duration-700 group-hover:scale-105"
              style={{ animation: "kenburns 20s ease-in-out infinite alternate" }}
            />
            <ImageOverlay image={heroImages[0]} />
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/60 to-transparent">
              <p className="font-mono text-white text-xs uppercase tracking-[0.2em]">Featured</p>
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
                transition={{ delay: 0.2 + index * 0.1, duration: 0.5, ease: EASE }}
                className="relative overflow-hidden rounded-2xl cursor-pointer group"
                onClick={() => setLightboxImage(image.id)}
              >
                <img
                  src={image.original_url}
                  alt={image.filename}
                  loading="lazy"
                  className="w-full aspect-[4/5] object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <ImageOverlay image={image} />
                <LikedBadge liked={image.is_liked} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Staggered Grid */}
      {gridImages.length > 0 && (
        <div className="px-8 lg:px-16 pb-16">
          <div className="w-full border-t border-border/60 mb-12" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {gridImages.map((image, index) => (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(0.1 + index * 0.03, 0.5), duration: 0.5, ease: EASE }}
                className={cn(
                  "relative overflow-hidden rounded-2xl cursor-pointer group",
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
                {image.ai_rating != null && image.ai_rating > 0 && (
                  <div className="absolute top-4 left-4 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                    <Star className="w-3 h-3 text-rating fill-rating" />
                    <span className="font-mono text-[10px] text-white tabular-nums">
                      {image.ai_rating.toFixed(1)}
                    </span>
                  </div>
                )}
                <LikedBadge liked={image.is_liked} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-12 text-center border-t border-border/60">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
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
