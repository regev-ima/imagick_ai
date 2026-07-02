import { useState } from "react";
import { getPreviewUrl } from "@/lib/imageUrls";
import { cn } from "@/lib/utils";

interface BoundingBox {
  top: number;
  left: number;
  width: number;
  height: number;
  // Pixel space the bbox coords are expressed in (original-image pixels when
  // known, else the detection frame). The thumbnail is a RESIZED preview, so we
  // rescale the box from this space into the loaded image's natural dimensions.
  source_width?: number | null;
  source_height?: number | null;
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
    let bboxTop = Number(bbox.top) || 0;
    let bboxLeft = Number(bbox.left) || 0;
    let bboxWidth = Number(bbox.width) || 0;
    let bboxHeight = Number(bbox.height) || 0;

    // The bbox is stored in ORIGINAL-image (or detection-frame) pixels, but the
    // <img> we render is a smaller preview with different natural dimensions.
    // Rescale the box from its source space into the loaded image's natural
    // dims, otherwise the crop offsets are computed against the wrong scale and
    // the face lands entirely off-frame (blank/garbage circle). If source dims
    // are missing (legacy rows) we assume the box already matches the image.
    const srcW = Number(bbox.source_width) || 0;
    const srcH = Number(bbox.source_height) || 0;
    if (srcW > 0 && srcH > 0) {
      const sx = natW / srcW;
      const sy = natH / srcH;
      bboxLeft *= sx;
      bboxWidth *= sx;
      bboxTop *= sy;
      bboxHeight *= sy;
    }

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
