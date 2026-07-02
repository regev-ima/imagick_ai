import { useState } from "react";
import { ScanFace } from "lucide-react";
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

  // A plain centered square crop of the whole image — the safe fallback we use
  // whenever the bbox can't be trusted (missing/invalid/foreign coordinate
  // space). Better to show the photo centered than a blank circle.
  const centerCrop = (natW: number, natH: number): React.CSSProperties => {
    const imgScale = size / Math.min(natW, natH);
    return {
      width: `${natW * imgScale}px`,
      height: "auto",
      marginLeft: `${-(natW * imgScale - size) / 2}px`,
      marginTop: `${-(natH * imgScale - size) / 2}px`,
      opacity: 1,
    };
  };

  const getStyle = (): React.CSSProperties => {
    if (!naturalDims) return { opacity: 0 };
    const { w: natW, h: natH } = naturalDims;

    // Ensure bbox values are numbers (DB jsonb can return strings).
    const left = Number(bbox.left) || 0;
    const top = Number(bbox.top) || 0;
    const bw = Number(bbox.width) || 0;
    const bh = Number(bbox.height) || 0;
    if (bw <= 0 || bh <= 0) return centerCrop(natW, natH);

    // Resolve the bbox into 0..1 NORMALIZED coords, robust to whatever pixel
    // space it was stored in. This is the crux of the "blank circle" fix:
    // legacy rows (old browser engine / pre-source_* pipeline) store the box in
    // the ORIGINAL image's pixels with no source dims, so blindly using them
    // against a smaller preview collapsed the crop off-frame. We now:
    //   1. divide by source_* when present (current pipeline),
    //   2. treat values already in 0..1 as normalized,
    //   3. divide by the loaded image's own dims when the box fits inside them,
    //   4. otherwise DON'T trust the coords → center-crop.
    const srcW = Number(bbox.source_width) || 0;
    const srcH = Number(bbox.source_height) || 0;
    let nLeft: number, nTop: number, nW: number, nH: number;
    if (srcW > 0 && srcH > 0) {
      nLeft = left / srcW; nTop = top / srcH; nW = bw / srcW; nH = bh / srcH;
    } else if (Math.max(left + bw, top + bh) <= 1.5) {
      nLeft = left; nTop = top; nW = bw; nH = bh;
    } else if (left + bw <= natW * 1.02 && top + bh <= natH * 1.02) {
      nLeft = left / natW; nTop = top / natH; nW = bw / natW; nH = bh / natH;
    } else {
      return centerCrop(natW, natH);
    }
    if (nW <= 0 || nH <= 0 || nW > 1.5 || nH > 1.5) return centerCrop(natW, natH);

    // Face box in the LOADED image's pixel space.
    const pxLeft = nLeft * natW, pxTop = nTop * natH;
    const pxW = nW * natW, pxH = nH * natH;

    // Pad ~30% around the face and square-crop.
    const padding = Math.max(pxW, pxH) * 0.3;
    const faceLeft = Math.max(0, pxLeft - padding);
    const faceTop = Math.max(0, pxTop - padding);
    const faceW = pxW + padding * 2;
    const faceH = pxH + padding * 2;
    const faceDim = Math.max(faceW, faceH);
    const scale = size / faceDim;

    const imgW = natW * scale;
    const imgH = natH * scale;
    // If the box is somehow larger than the whole image, the coords are bogus.
    if (imgW < size || imgH < size) return centerCrop(natW, natH);

    let marginLeft = -(faceLeft + (faceW - faceDim) / 2) * scale;
    let marginTop = -(faceTop + (faceH - faceDim) / 2) * scale;
    // Clamp so the crop window ALWAYS overlaps the image — worst case we show
    // the wrong region, never a blank circle.
    marginLeft = Math.min(0, Math.max(marginLeft, -(imgW - size)));
    marginTop = Math.min(0, Math.max(marginTop, -(imgH - size)));

    return { width: `${imgW}px`, height: "auto", marginLeft: `${marginLeft}px`, marginTop: `${marginTop}px`, opacity: 1 };
  };

  return (
    <div
      className={cn("rounded-full overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <ScanFace className="w-1/3 h-1/3 text-muted-foreground" />
      ) : (
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
