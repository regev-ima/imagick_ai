import { cn } from "@/lib/utils";
import { getThumbnailUrl } from "@/lib/imageUrls";

interface SimilarImage {
  id: string;
  original_url: string;
  culling_score: number | null;
}

interface SimilarImagesGridProps {
  images: SimilarImage[];
  currentImageId: string;
  onImageClick: (imageId: string) => void;
  maxDisplay?: number;
}

export function SimilarImagesGrid({ 
  images, 
  currentImageId, 
  onImageClick,
  maxDisplay
}: SimilarImagesGridProps) {
  // Show all images including current; highlight current instead of hiding it
  const displayImages = maxDisplay ? images.slice(0, maxDisplay) : images;
  const remaining = maxDisplay ? images.length - displayImages.length : 0;
  
  if (displayImages.length <= 1) {
    return (
      <p className="text-xs text-muted-foreground">No similar images in this group</p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
      {displayImages.map((img) => (
        <button
          key={img.id}
          onClick={(e) => {
            e.stopPropagation();
            onImageClick(img.id);
          }}
          className={cn(
            "relative aspect-square rounded-sm overflow-hidden transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
            img.id === currentImageId
              ? "ring-2 ring-primary shadow-[0_0_8px_-1px_hsl(var(--primary)/0.45)] opacity-60"
              : "border border-border/40 hover:border-primary/40"
          )}
        >
          <img
            src={getThumbnailUrl(img.original_url)}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Score badge */}
          {img.culling_score !== null && (
            <div className="absolute bottom-0.5 right-0.5 font-mono text-[10px] bg-black/70 backdrop-blur-sm px-1 rounded-sm tabular-nums text-white/90">
              {Math.round(img.culling_score * 100)}%
            </div>
          )}
        </button>
      ))}
      {remaining > 0 && (
        <div className="aspect-square rounded-sm surface-2 border border-border/60 flex items-center justify-center font-mono text-xs text-muted-foreground folio">
          +{remaining}
        </div>
      )}
    </div>
  );
}
