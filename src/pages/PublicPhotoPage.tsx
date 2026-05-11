import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Copy, Instagram, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
//  PublicPhotoPage
//
//  /gallery/:galleryId/photo/:imageId — the destination of WhatsApp /
//  Instagram share links. Pure editorial: bright paper-white background,
//  Playfair serif, the photographer's brand colour rendered as a single
//  2px accent stroke under the gallery name. The photo dominates; chrome
//  is intentionally faint.
// ─────────────────────────────────────────────────────────────────────────────

interface PublicPhoto {
  id: string;
  filename: string;
  thumbnail_url: string | null;
  original_url: string;
  width: number | null;
  height: number | null;
  gallery_name: string;
  brand_logo_url: string | null;
  brand_primary_color: string | null;
  client_link: string | null;
}

const DEFAULT_BRAND = "#222222";

export default function PublicPhotoPage() {
  const { galleryId, imageId } = useParams<{
    galleryId: string;
    imageId: string;
  }>();

  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const { data, isLoading, isError } = useQuery<PublicPhoto | null>({
    queryKey: ["public-photo", galleryId, imageId],
    queryFn: async () => {
      if (!galleryId || !imageId) return null;
      const { data, error } = await (supabase.rpc as any)(
        "get_public_gallery_image",
        { p_gallery_id: galleryId, p_image_id: imageId },
      );
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0] as PublicPhoto;
    },
    enabled: !!galleryId && !!imageId,
    staleTime: 5 * 60 * 1000,
  });

  // Current URL — recomputed when params change (e.g. SPA nav between photos).
  const currentUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, [galleryId, imageId]);

  const brand = data?.brand_primary_color || DEFAULT_BRAND;

  // ── Inject OG meta + <title> into <head> ────────────────────────────────
  // NOTE: React injects these client-side, so WhatsApp's preview crawler
  // (which doesn't run JS) won't see them. TODO: add SSR / pre-rendering
  // before this page becomes the canonical share URL. For now, share-card
  // unfurls rely on the edge function URL being passed directly when the
  // photographer shares (see gallery-share-card-og edge function).
  useEffect(() => {
    if (!data) return;
    const supabaseUrl =
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      "https://zfcltfqgrhytpvgqkkfo.supabase.co";
    const ogImage = `${supabaseUrl}/functions/v1/gallery-share-card-og?galleryId=${encodeURIComponent(
      galleryId || "",
    )}&imageId=${encodeURIComponent(imageId || "")}`;

    const title = `${data.gallery_name} — A photo`;
    const description = `A photo from ${data.gallery_name}`;

    const prevTitle = document.title;
    document.title = title;

    const tags: Array<[string, string, string]> = [
      ["property", "og:title", data.gallery_name],
      ["property", "og:description", description],
      ["property", "og:image", ogImage],
      ["property", "og:image:width", "1200"],
      ["property", "og:image:height", "630"],
      ["property", "og:url", currentUrl],
      ["property", "og:type", "article"],
      ["name", "twitter:card", "summary_large_image"],
      ["name", "twitter:title", data.gallery_name],
      ["name", "twitter:description", description],
      ["name", "twitter:image", ogImage],
    ];

    const created: HTMLMetaElement[] = [];
    const mutated: Array<{ el: HTMLMetaElement; prev: string | null }> = [];

    for (const [attr, key, value] of tags) {
      const selector = `meta[${attr}="${key}"]`;
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (el) {
        mutated.push({ el, prev: el.getAttribute("content") });
        el.setAttribute("content", value);
      } else {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        el.setAttribute("content", value);
        document.head.appendChild(el);
        created.push(el);
      }
    }

    return () => {
      document.title = prevTitle;
      for (const el of created) el.remove();
      for (const { el, prev } of mutated) {
        if (prev === null) el.removeAttribute("content");
        else el.setAttribute("content", prev);
      }
    };
  }, [data, galleryId, imageId, currentUrl]);

  // ── Fire-and-forget share beacon ────────────────────────────────────────
  const recordShare = (channel: "whatsapp" | "instagram" | "copy") => {
    if (!galleryId || !imageId) return;
    // We intentionally don't await — sharing must feel instant.
    void supabase.functions
      .invoke("gallery-record-share", {
        body: { galleryId, imageId, channel },
      })
      .catch(() => {
        /* swallow */
      });
  };

  // ── Share actions ───────────────────────────────────────────────────────
  const handleWhatsApp = () => {
    recordShare("whatsapp");
    const text = encodeURIComponent(
      `${data?.gallery_name || "A photo"}\n${currentUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const handleInstagram = () => {
    recordShare("instagram");
    // Instagram's deeplink can't pre-fill a story image from a URL, but it
    // opens the app for users who want to share via story manually. We
    // also copy the link so they can paste in DM.
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl).catch(() => {});
    }
    window.location.href = "instagram://camera";
  };

  const handleCopy = async () => {
    recordShare("copy");
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be unavailable; quietly fail */
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafaf7] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (isError || !data) {
    return <PhotoNotFound />;
  }

  const aspectStyle: React.CSSProperties =
    data.width && data.height
      ? { aspectRatio: `${data.width} / ${data.height}` }
      : {};

  return (
    <div
      className="min-h-screen bg-[#fafaf7] text-neutral-900 antialiased"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="px-6 pt-8 pb-4 sm:pt-12">
        <div className="mx-auto max-w-3xl flex items-center justify-center">
          {data.brand_logo_url ? (
            <img
              src={data.brand_logo_url}
              alt={data.gallery_name}
              className="h-10 w-auto object-contain"
              style={{ maxWidth: "60vw" }}
            />
          ) : (
            <div
              className="text-xl sm:text-[22px] tracking-[0.02em] text-neutral-800"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 500,
              }}
            >
              {data.gallery_name}
            </div>
          )}
        </div>
      </header>

      {/* ── Photo ─────────────────────────────────────────────────────── */}
      <main className="px-4 sm:px-6">
        <motion.figure
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl"
        >
          <div
            className={cn(
              "relative mx-auto overflow-hidden rounded-[2px]",
              "shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35),0_8px_20px_-10px_rgba(0,0,0,0.15)]",
            )}
            style={{
              ...aspectStyle,
              maxHeight: "80vh",
              maxWidth: "100%",
            }}
          >
            {!imgLoaded && (
              <div className="absolute inset-0 bg-neutral-200/60 animate-pulse" />
            )}
            <img
              src={data.original_url}
              alt={data.filename}
              onLoad={() => setImgLoaded(true)}
              className={cn(
                "h-full w-full object-contain bg-white transition-opacity duration-500",
                imgLoaded ? "opacity-100" : "opacity-0",
              )}
            />
          </div>
        </motion.figure>
      </main>

      {/* ── Gallery name + accent ─────────────────────────────────────── */}
      <section className="px-6 pt-10 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <div
            className="text-[11px] uppercase tracking-[0.42em] text-neutral-500"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            From the gallery
          </div>
          <h1
            className="mt-3 text-[24px] sm:text-[28px] leading-tight text-neutral-900"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 500,
              letterSpacing: "-0.005em",
            }}
          >
            {data.gallery_name}
          </h1>
          <div
            className="mx-auto mt-3 h-[2px] w-10 rounded-full"
            style={{ background: brand }}
            aria-hidden
          />
        </motion.div>
      </section>

      {/* ── Share row ─────────────────────────────────────────────────── */}
      <section className="px-6 pt-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-md"
        >
          <div
            className="mb-4 text-center text-[10px] uppercase tracking-[0.4em] text-neutral-400"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Share this photo
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ShareButton
              label="WhatsApp"
              onClick={handleWhatsApp}
              icon={<WhatsAppGlyph />}
            />
            <ShareButton
              label="Instagram"
              onClick={handleInstagram}
              icon={<Instagram className="h-[18px] w-[18px]" strokeWidth={1.6} />}
            />
            <ShareButton
              label={copied ? "Copied" : "Copy link"}
              onClick={handleCopy}
              icon={
                copied ? (
                  <Check className="h-[18px] w-[18px]" strokeWidth={1.8} />
                ) : (
                  <Copy className="h-[18px] w-[18px]" strokeWidth={1.6} />
                )
              }
              active={copied}
              accent={brand}
            />
          </div>
        </motion.div>
      </section>

      {/* ── Back to gallery ───────────────────────────────────────────── */}
      <footer className="px-6 py-16 mt-8">
        <div className="mx-auto max-w-3xl text-center">
          {data.client_link ? (
            <Link
              to={`/gallery/${data.client_link}`}
              className="inline-flex items-center gap-2 text-[13px] tracking-wide text-neutral-600 transition-colors hover:text-neutral-900 group"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span
                className="border-b border-neutral-300 pb-0.5 group-hover:border-neutral-900 transition-colors"
                style={{ fontFamily: "'Playfair Display', serif", fontSize: 15 }}
              >
                View the full gallery
              </span>
            </Link>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

// ─── Share button — restrained, paper-card feel ──────────────────────────
function ShareButton({
  label,
  onClick,
  icon,
  active,
  accent,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center justify-center gap-2 rounded-xl border bg-white px-3 py-4 transition-all",
        "border-neutral-200 hover:border-neutral-400 hover:-translate-y-0.5",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)]",
      )}
      style={
        active && accent
          ? { borderColor: accent, color: accent }
          : undefined
      }
    >
      <span className="text-neutral-700 transition-colors group-hover:text-neutral-900">
        {icon}
      </span>
      <span
        className="text-[11px] tracking-wide text-neutral-600 group-hover:text-neutral-900"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── WhatsApp glyph — lucide doesn't ship one, so a stroke-clean inline SVG ──
function WhatsAppGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21l1.65-4.85A8 8 0 1 1 8 19.6L3 21z" />
      <path d="M8.5 9.5c0 3 3 5.5 6 5.5l1.5-1.5-2-1-1 1c-1 0-2.5-1.5-2.5-2.5l1-1-1-2L9.5 8c-.6 0-1 .5-1 1.5z" />
    </svg>
  );
}

// ─── Not-found fallback ──────────────────────────────────────────────────
function PhotoNotFound() {
  return (
    <div
      className="min-h-screen bg-[#fafaf7] text-neutral-900 flex items-center justify-center px-6"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-md"
      >
        <div className="mx-auto mb-6 h-px w-10 bg-neutral-300" />
        <h1
          className="text-[28px] sm:text-[32px] leading-tight text-neutral-900"
          style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500 }}
        >
          This photo has slipped away
        </h1>
        <p
          className="mt-4 text-[14px] leading-relaxed text-neutral-500"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          The link may have expired, or the gallery is no longer being shared.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 text-[13px] tracking-wide text-neutral-700 hover:text-neutral-900 transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span
            className="border-b border-neutral-300 pb-0.5 group-hover:border-neutral-900 transition-colors"
            style={{ fontFamily: "'Playfair Display', serif", fontSize: 15 }}
          >
            Back to imagick.ai
          </span>
        </Link>
      </motion.div>
    </div>
  );
}
