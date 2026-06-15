import { useEffect, useRef, useState } from "react";

/**
 * Material You dynamic color — extract a tasteful dominant hue from a hero
 * thumbnail and return it as an HSL triplet string ("H S% L%") suitable for
 * dropping straight into `--dynamic-primary` so utilities like
 * `hsl(var(--dynamic-primary))` light up from the photo itself.
 *
 * Kept deliberately cheap: the image is drawn into a tiny offscreen canvas
 * and we average a coarse sample of pixels, biasing toward saturated, mid-tone
 * colors (so we tint from the subject, not from blown highlights / shadows).
 * On any failure — no URL, load error, or a CORS-tainted canvas — we resolve
 * to `null` and callers fall back to the brand `--primary`.
 */

const SAMPLE_SIZE = 24; // canvas is downscaled to 24×24 before sampling

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function extract(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    // Throws (SecurityError) if the canvas is tainted by a cross-origin image.
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    // Weighted average: favour pixels that carry actual color so the tint
    // reflects the subject rather than neutral grey/white/black regions.
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let weightSum = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 125) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const lum = (max + min) / 2 / 255;
      // de-prioritise near-black / near-white pixels
      const tone = 1 - Math.abs(lum - 0.5) * 1.4;
      const weight = sat * Math.max(tone, 0.05) + 0.02;
      rSum += r * weight;
      gSum += g * weight;
      bSum += b * weight;
      weightSum += weight;
    }

    if (weightSum === 0) return null;

    const r = rSum / weightSum;
    const g = gSum / weightSum;
    const b = bSum / weightSum;

    let [h, s, l] = rgbToHsl(r, g, b);

    // Keep the tint tasteful and legible against graphite: clamp the
    // saturation/lightness into a pleasant Material You range.
    s = Math.min(Math.max(s, 35), 80);
    l = Math.min(Math.max(l, 52), 68);

    return `${h} ${s}% ${l}%`;
  } catch {
    return null;
  }
}

/**
 * @param url  thumbnail URL to sample (pass null/empty to skip).
 * @returns    an "H S% L%" string once resolved, otherwise null (fall back
 *             to `--primary`).
 */
export function useDominantColor(url: string | null | undefined): string | null {
  const [color, setColor] = useState<string | null>(null);
  const cache = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!url) {
      setColor(null);
      return;
    }

    const cached = cache.current.get(url);
    if (cached !== undefined) {
      setColor(cached);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      if (cancelled) return;
      const result = extract(img);
      cache.current.set(url, result);
      setColor(result);
    };
    img.onerror = () => {
      if (cancelled) return;
      cache.current.set(url, null);
      setColor(null);
    };

    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return color;
}
