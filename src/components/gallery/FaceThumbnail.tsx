import { useState } from "react";
import { getPreviewUrl } from "@/lib/imageUrls";
import { cn } from "@/lib/utils";

interface BoundingBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface FaceThumbnailProps {
  imageUrl: string;
  bbox: BoundingBox;
  size?: number;
  className?: string;
}

export function FaceThumbnail({ imageUrl, bbox, size = 80, className }: FaceThumbnailProps) {
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);
  // Start with preview URL (same image used for face detection)
  // Fallback: original URL (if preview 404, detection also used original)
  const [imgSrc, setImgSrc] = useState(() => getPreviewUrl(imageUrl));
  const [triedOriginal, setTriedOriginal] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (!triedOriginal) {
      // Preview 404 — try original (detection also fell back to original)
      setImgSrc(imageUrl);
      setTriedOriginal(true);
    } else {
      // Both failed — show placeholder
      setFailed(true);
    }
  };

  const getStyle = (): React.CSSProperties => {
    if (!naturalDims) return { opacity: 0 };

    const { w: natW, h: natH } = naturalDims;

    // Ensure bbox values are numbers (DB jsonb can return strings)
    const bboxTop = Number(bbox.top) || 0;
    const bboxLeft = Number(bbox.left) || 0;
    const bboxWidth = Number(bbox.width) || 0;
    const bboxHeight = Number(bbox.height) || 0;

    // If bbox is invalid, show center-cropped image
    if (bboxWidth <= 0 || bboxHeight <= 0) {
      const imgScale = size / Math.min(natW, natH);
      return {
        width: `${natW * imgScale}px`,
        height: "auto",
        marginLeft: `${-(natW * imgScale - size) / 2}px`,
        marginTop: `${-(natH * imgScale - size) / 2}px`,
        opacity: 1,
      };
    }

    // Add padding around the face
    const padding = Math.max(bboxWidth, bboxHeight) * 0.3;
    const faceLeft = Math.max(0, bboxLeft - padding);
    const faceTop = Math.max(0, bboxTop - padding);
    const faceW = bboxWidth + padding * 2;
    const faceH = bboxHeight + padding * 2;

    // Square crop around face
    const faceDim = Math.max(faceW, faceH);
    const scale = size / faceDim;

    return {
      width: `${natW * scale}px`,
      height: "auto",
      marginLeft: `${-(faceLeft + (faceW - faceDim) / 2) * scale}px`,
      marginTop: `${-(faceTop + (faceH - faceDim) / 2) * scale}px`,
      opacity: 1,
    };
  };

  return (
    <div
      className={cn("rounded-full overflow-hidden bg-muted flex-shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {!failed && (
        <img
          src={imgSrc}
          alt="Face"
          style={getStyle()}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
          }}
          onError={handleError}
          draggable={false}
        />
      )}
    </div>
  );
}
