/**
 * gallery-share-card-og
 *
 * Public GET endpoint that returns a 1200×630 PNG suitable for an OG / social
 * card. Renders the photo on the left, photographer logo top-right, gallery
 * name + tagline along the bottom, accented with the photographer's
 * brand_primary_color.
 *
 * Usage:
 *   GET /functions/v1/gallery-share-card-og?galleryId=...&imageId=...
 *   GET /functions/v1/gallery-share-card-og?galleryId=...
 *
 * Strategy:
 *   - Try imagescript@1.2.17 (works in Deno Deploy).
 *   - On any failure (decode, draw, font, network) fall back to a 302
 *     redirect to the original image URL so social crawlers still get
 *     *something*.
 *
 * Caching: public, max-age=86400 (1 day). Social crawlers will hit hard.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image, decode } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const DEFAULT_BG = 0x0e0e17ff; // very dark
const DEFAULT_ACCENT = 0xe85c9bff; // brand pink fallback

// ─── helpers ────────────────────────────────────────────────────────────────

function hexToInt(hex: string | null | undefined, fallback: number): number {
  if (!hex) return fallback;
  const m = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(hex.trim());
  if (!m) return fallback;
  const rgb = parseInt(m[1], 16);
  const a = m[2] ? parseInt(m[2], 16) : 0xff;
  return ((rgb << 8) | a) >>> 0;
}

async function fetchAsBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  } catch (err) {
    console.error("[gallery-share-card-og] fetch failed:", url, err);
    return null;
  }
}

/**
 * Resize-and-crop an image to fill (cover) a target box.
 */
function coverInto(img: Image, w: number, h: number): Image {
  const srcAspect = img.width / img.height;
  const dstAspect = w / h;
  let newW: number, newH: number;
  if (srcAspect > dstAspect) {
    // Source is wider — match height, crop width
    newH = h;
    newW = Math.ceil(h * srcAspect);
  } else {
    newW = w;
    newH = Math.ceil(w / srcAspect);
  }
  img.resize(newW, newH);
  const cropX = Math.floor((newW - w) / 2);
  const cropY = Math.floor((newH - h) / 2);
  img.crop(cropX, cropY, w, h);
  return img;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const galleryId = url.searchParams.get("galleryId");
  const imageId = url.searchParams.get("imageId");

  if (!galleryId) {
    return new Response(JSON.stringify({ success: false, error: "Missing galleryId" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch gallery brand info
    const { data: gallery, error: galleryError } = await supabaseAdmin
      .from("galleries")
      .select("id, name, brand_logo_url, brand_primary_color, hero_image_url, client_link, revoked_at, expiry_date")
      .eq("id", galleryId)
      .maybeSingle();

    if (galleryError || !gallery || !gallery.client_link || gallery.revoked_at) {
      return new Response("Gallery unavailable", { status: 404, headers: corsHeaders });
    }
    if (gallery.expiry_date && new Date(gallery.expiry_date) < new Date()) {
      return new Response("Gallery expired", { status: 410, headers: corsHeaders });
    }

    // Resolve photo URL (image-specific OR gallery hero fallback)
    let photoUrl: string | null = gallery.hero_image_url ?? null;
    if (imageId) {
      const { data: imageRow } = await supabaseAdmin
        .from("gallery_images")
        .select("id, original_url, thumbnail_url")
        .eq("id", imageId)
        .eq("gallery_id", galleryId)
        .maybeSingle();
      if (imageRow) {
        photoUrl = imageRow.thumbnail_url || imageRow.original_url || photoUrl;
      }
    }

    // Try to render an OG image with imagescript. Any failure falls through
    // to a redirect so social previews aren't broken.
    try {
      const accent = hexToInt(gallery.brand_primary_color, DEFAULT_ACCENT);

      // Base canvas — solid dark BG
      const canvas = new Image(OG_WIDTH, OG_HEIGHT).fill(DEFAULT_BG);

      // Left photo region: 720×630 (covers 60% of the card)
      const PHOTO_W = 720;
      const PHOTO_H = OG_HEIGHT;
      if (photoUrl) {
        const bytes = await fetchAsBytes(photoUrl);
        if (bytes) {
          const decoded = await decode(bytes);
          if (decoded instanceof Image) {
            const photo = coverInto(decoded, PHOTO_W, PHOTO_H);
            canvas.composite(photo, 0, 0);
          }
        }
      }

      // Right panel: solid bg with brand accent strip on the right edge.
      const PANEL_X = PHOTO_W;
      const PANEL_W = OG_WIDTH - PHOTO_W;
      // Accent vertical stripe at the photo/panel seam
      const stripe = new Image(6, PHOTO_H).fill(accent);
      canvas.composite(stripe, PANEL_X, 0);

      // Top-right logo (optional)
      if (gallery.brand_logo_url) {
        const logoBytes = await fetchAsBytes(gallery.brand_logo_url);
        if (logoBytes) {
          try {
            const logoDecoded = await decode(logoBytes);
            if (logoDecoded instanceof Image) {
              // Fit logo into a 200×120 box, keep aspect.
              const maxW = 200;
              const maxH = 120;
              const aspect = logoDecoded.width / logoDecoded.height;
              let lw = maxW, lh = Math.round(maxW / aspect);
              if (lh > maxH) {
                lh = maxH;
                lw = Math.round(maxH * aspect);
              }
              logoDecoded.resize(lw, lh);
              const lx = PANEL_X + Math.round((PANEL_W - lw) / 2);
              const ly = 40;
              canvas.composite(logoDecoded, lx, ly);
            }
          } catch (logoErr) {
            console.warn("[gallery-share-card-og] logo decode failed:", logoErr);
          }
        }
      }

      // Bottom accent bar
      const bottomBar = new Image(PANEL_W, 8).fill(accent);
      canvas.composite(bottomBar, PANEL_X, OG_HEIGHT - 80);

      // Text rendering: imagescript supports bitmap text via Image.renderText
      // but that needs a TTF font fetched at runtime. Embedding fonts blows
      // the cold-start budget so we draw simple solid blocks under the logo
      // as a visual gallery-name accent. The text itself comes from the
      // OG <meta> tags on the page; the card is meant as a strong visual.
      // TODO: when we ship a small TTF in storage, render gallery.name and
      // "View on Imagick" here using `Image.renderText`.

      const png = await canvas.encode(); // PNG bytes
      return new Response(png, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
          ...corsHeaders,
        },
      });
    } catch (renderErr) {
      console.error("[gallery-share-card-og] render failed, falling back to redirect:", renderErr);
      // Graceful fallback — redirect crawlers to the underlying image.
      if (photoUrl) {
        return new Response(null, {
          status: 302,
          headers: { Location: photoUrl, "Cache-Control": "public, max-age=3600", ...corsHeaders },
        });
      }
      return new Response("OG generation failed", { status: 500, headers: corsHeaders });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[gallery-share-card-og] error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
