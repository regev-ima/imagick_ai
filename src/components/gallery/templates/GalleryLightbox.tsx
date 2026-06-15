import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Download, ChevronLeft, ChevronRight, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateImage } from "./types";

interface GalleryLightboxProps {
  images: TemplateImage[];
  currentImageId: string | null;
  onClose: () => void;
  onNavigate: (imageId: string) => void;
  onLike: (imageId: string) => void;
  onDownload: (imageId: string) => void;
  downloadEnabled: boolean;
}

const EASE = [0.2, 0, 0, 1] as const;

/**
 * PRISM lightbox — immersive graphite scrim so the photo is the hero. Chrome is
 * Material tonal: rounded-full controls, hairline borders, soft elevation. The
 * like is Google red; the counter + AI rating use Roboto Mono / amber. Keyboard
 * (Esc / ← / →), touch-swipe, prev/next/close all preserved.
 */
export function GalleryLightbox({
  images,
  currentImageId,
  onClose,
  onNavigate,
  onLike,
  onDownload,
  downloadEnabled,
}: GalleryLightboxProps) {
  const touchStartX = useRef(0);
  const currentIndex = currentImageId
    ? images.findIndex((img) => img.id === currentImageId)
    : -1;
  const currentImage = currentIndex >= 0 ? images[currentIndex] : null;

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(images[currentIndex - 1].id);
  }, [currentIndex, images, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) onNavigate(images[currentIndex + 1].id);
  }, [currentIndex, images, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!currentImageId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentImageId, onClose, goPrev, goNext]);

  if (!currentImageId || !currentImage) return null;

  const ctrl =
    "p-3 rounded-full bg-white/10 text-white backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0c0e]/96 backdrop-blur-sm"
        onClick={onClose}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(delta) > 50) {
            if (delta > 0) goPrev();
            else goNext();
          }
        }}
      >
        {/* Close */}
        <button
          aria-label="Close lightbox"
          className={cn("absolute top-4 right-4 z-10", ctrl)}
          onClick={onClose}
        >
          <X className="w-6 h-6" />
        </button>

        {/* Prev */}
        <button
          aria-label="Previous image"
          className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 z-10",
            ctrl,
            currentIndex === 0 && "opacity-30 pointer-events-none"
          )}
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        {/* Next */}
        <button
          aria-label="Next image"
          className={cn(
            "absolute right-4 top-1/2 -translate-y-1/2 z-10",
            ctrl,
            currentIndex === images.length - 1 && "opacity-30 pointer-events-none"
          )}
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
        >
          <ChevronRight className="w-8 h-8" />
        </button>

        {/* Image */}
        <motion.img
          key={currentImageId}
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          src={currentImage.original_url}
          alt={currentImage.filename}
          className="max-h-[84vh] max-w-[88vw] object-contain select-none rounded-xl shadow-2xl"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />

        {/* AI rating chip — amber, top-left */}
        {currentImage.ai_rating != null && currentImage.ai_rating > 0 && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
            <Star className="w-3.5 h-3.5 text-rating fill-rating" />
            <span className="font-mono text-xs text-white/90 tabular-nums">
              {currentImage.ai_rating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike(currentImageId);
            }}
            className={cn(
              "px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-medium transition-colors backdrop-blur-md border",
              currentImage.is_liked
                ? "bg-destructive text-destructive-foreground border-transparent"
                : "bg-white/10 text-white border-white/10 hover:bg-white/20"
            )}
          >
            <Heart className={cn("w-4 h-4", currentImage.is_liked && "fill-current")} />
            {currentImage.is_liked ? "Liked" : "Like"}
          </button>
          {downloadEnabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(currentImageId);
              }}
              className="px-5 py-2.5 rounded-full bg-white/10 text-white border border-white/10 backdrop-blur-md hover:bg-white/20 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          )}
          <span className="font-mono text-white/60 text-xs tabular-nums ml-2 tracking-widest">
            {String(currentIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
