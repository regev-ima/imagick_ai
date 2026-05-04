import { ArrowLeft, LayoutGrid, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { cn } from "@/lib/utils";
import { useFaceClusterImages } from "@/hooks/useFaceSearch";

interface FaceClusterImagesProps {
  clusterId: string;
  onBack: () => void;
  onBackToGallery?: () => void;
  onImageClick?: (imageId: string) => void;
}

export function FaceClusterImages({ clusterId, onBack, onBackToGallery, onImageClick }: FaceClusterImagesProps) {
  const { data: detections, isLoading } = useFaceClusterImages(clusterId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Deduplicate by image id (a person may have multiple detections in one image)
  const uniqueImages = new Map<string, { id: string; original_url: string; filename: string }>();
  for (const det of detections || []) {
    if (det.image && !uniqueImages.has(det.image.id)) {
      uniqueImages.set(det.image.id, det.image);
    }
  }

  const images = Array.from(uniqueImages.values());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back to faces
        </Button>
        {onBackToGallery && (
          <Button variant="ghost" size="sm" onClick={onBackToGallery} className="gap-1.5">
            <LayoutGrid className="w-4 h-4" />
            Back to Gallery
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {images.length} {images.length === 1 ? "photo" : "photos"}
        </span>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No photos found for this face.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1">
          {images.map((image) => (
            <div
              key={image.id}
              className={cn(
                "aspect-square overflow-hidden cursor-pointer rounded-md",
                "hover:ring-2 hover:ring-primary/50 transition-all"
              )}
              onClick={() => onImageClick?.(image.id)}
            >
              <img
                src={getThumbnailUrl(image.original_url)}
                alt={image.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
