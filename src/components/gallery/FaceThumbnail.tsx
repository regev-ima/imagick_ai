import { useEffect, useRef, useState } from "react";
import { ScanFace } from "lucide-react";
import { getPreviewUrl } from "@/lib/imageUrls";
import { cn } from "@/lib/utils";

interface BoundingBox {
  top: number;
  left: number;
  width: number;
  height: number;
  x?: number;
  y?: number;
  // Pixel space the bbox coords are expressed in (original-image pixels when
  // known, else the detection frame). We rescale the box from this space into
  // the loaded image's natural dimensions before cropping.
  source_width?: number | null;
  source_height?: number | null;
}

interface FaceThumbnailProps {
  imageUrl: string;
  bbox: BoundingBox;
  size?: number;
  className?: string;
}

/**
 * Crops the representative face onto a <canvas> (the same robust technique the
 * preview uses), instead of the old CSS margin/scale trick that collapsed
 * off-frame into a blank circle. The bbox is resolved into the loaded image's
 * pixel space robustly — via source_* when present, else inferred — so it works
 * for both current-pipeline and legacy rows.
 */
export function FaceThumbnail({ imageUrl, bbox, size = 80, className }: FaceThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Try the (cheap) preview first; fall back to the original if it 404s.
  const [imgSrc, setImgSrc] = useState(() => getPreviewUrl(imageUrl));
  const [triedOriginal, setTriedOriginal] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bbox) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      if (!natW || !natH) return;

      // Resolve bbox into 0..1 normalized coords, robust to unknown pixel space.
      const left = Number(bbox.left ?? bbox.x) || 0;
      const top = Number(bbox.top ?? bbox.y) || 0;
      const bw = Number(bbox.width) || 0;
      const bh = Number(bbox.height) || 0;
      const srcW = Number(bbox.source_width) || 0;
      const srcH = Number(bbox.source_height) || 0;

      let nLeft: number, nTop: number, nW: number, nH: number;
      if (bw <= 0 || bh <= 0) {
        drawCenter(ctx, img, natW, natH, size);
        return;
      }
      if (srcW > 0 && srcH > 0) {
        nLeft = left / srcW; nTop = top / srcH; nW = bw / srcW; nH = bh / srcH;
      } else if (Math.max(left + bw, top + bh) <= 1.5) {
        nLeft = left; nTop = top; nW = bw; nH = bh;
      } else if (left + bw <= natW * 1.02 && top + bh <= natH * 1.02) {
        nLeft = left / natW; nTop = top / natH; nW = bw / natW; nH = bh / natH;
      } else {
        drawCenter(ctx, img, natW, natH, size);
        return;
      }
      if (nW <= 0 || nH <= 0 || nW > 1.5 || nH > 1.5) {
        drawCenter(ctx, img, natW, natH, size);
        return;
      }

      // Face rect in the loaded image's pixels, padded ~40% and squared.
      const pad = 0.4;
      let fx = (nLeft - nW * pad) * natW;
      let fy = (nTop - nH * pad) * natH;
      let fw = nW * (1 + 2 * pad) * natW;
      let fh = nH * (1 + 2 * pad) * natH;
      // Square it around the face centre.
      const cx = fx + fw / 2, cy = fy + fh / 2;
      const dim = Math.max(fw, fh);
      fx = cx - dim / 2; fy = cy - dim / 2; fw = dim; fh = dim;
      // Clamp into the image so the crop always lands on real pixels.
      fx = Math.max(0, Math.min(fx, natW - dim));
      fy = Math.max(0, Math.min(fy, natH - dim));
      const drawDim = Math.min(dim, natW, natH);

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, fx, fy, drawDim, drawDim, 0, 0, size, size);
    };
    img.onerror = () => {
      if (!triedOriginal) {
        setTriedOriginal(true);
        setImgSrc(imageUrl);
      } else {
        setFailed(true);
      }
    };
    img.src = imgSrc;
    return () => { img.onload = null; img.onerror = null; };
  }, [imgSrc, imageUrl, bbox, size, triedOriginal]);

  return (
    <div
      className={cn("rounded-full overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <ScanFace className="w-1/3 h-1/3 text-muted-foreground" />
      ) : (
        <canvas ref={canvasRef} width={size} height={size} className="w-full h-full object-cover" />
      )}
    </div>
  );
}

// Centered square crop of the whole image — the safe fallback when the bbox
// can't be trusted.
function drawCenter(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  natW: number,
  natH: number,
  size: number,
) {
  const dim = Math.min(natW, natH);
  const fx = (natW - dim) / 2;
  const fy = (natH - dim) / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, fx, fy, dim, dim, 0, 0, size, size);
}
