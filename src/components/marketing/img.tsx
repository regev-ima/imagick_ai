// ────────────────────────────────────────────────────────────────────
// Fast images for the marketing site.
//
// Blog covers live in Supabase Storage as full-size PNGs. Loading them at
// native resolution is slow. Supabase can resize + re-encode (to WebP/AVIF,
// negotiated by the browser's Accept header) on the fly via its image-render
// endpoint:  /storage/v1/object/public/…  →  /storage/v1/render/image/public/…?width=…&quality=…
//
// <SmartImage> requests a right-sized, compressed version and serves a
// responsive srcset. If image transformations aren't available on the project
// it fails gracefully: onError swaps back to the original object URL, so the
// worst case is exactly today's behaviour (plus one tiny 404). OG/social image
// URLs deliberately keep the original (see Seo) so scrapers never depend on it.
// ────────────────────────────────────────────────────────────────────
import { useState } from "react";

const OBJECT = "/storage/v1/object/public/";
const RENDER = "/storage/v1/render/image/public/";

export function isSupabasePublic(url?: string | null): url is string {
  return !!url && url.includes(OBJECT);
}

/** A resized/compressed Supabase render URL (auto WebP/AVIF). */
export function supaThumb(url: string, width: number, quality = 70): string {
  if (!isSupabasePublic(url)) return url;
  const base = url.replace(OBJECT, RENDER);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}width=${width}&quality=${quality}`;
}

export function supaSrcSet(url: string, widths: number[], quality = 70): string {
  return widths.map((w) => `${supaThumb(url, w, quality)} ${w}w`).join(", ");
}

type SmartImageProps = {
  src: string;
  alt: string;
  widths?: number[];
  sizes?: string;
  quality?: number;
  className?: string;
  width?: number;
  height?: number;
  /** Above-the-fold: load immediately (default lazy). */
  eager?: boolean;
  /** LCP hint. */
  priority?: boolean;
};

export function SmartImage({
  src,
  alt,
  widths = [320, 480, 640, 800],
  sizes = "100vw",
  quality = 70,
  className,
  width,
  height,
  eager,
  priority,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);
  const canTransform = isSupabasePublic(src) && !failed;
  const largest = widths[widths.length - 1];

  return (
    <img
      src={canTransform ? supaThumb(src, largest, quality) : src}
      srcSet={canTransform ? supaSrcSet(src, widths, quality) : undefined}
      sizes={canTransform ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={className}
      onError={canTransform ? () => setFailed(true) : undefined}
    />
  );
}
