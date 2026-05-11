import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//  CinemaIntro
//
//  A 60-90s curated, dark, cinematic slideshow that plays once on first
//  gallery open. Pure presentational — the parent handles "first open"
//  gating (see localStorage helper `cinemaIntroSeen` below). Inspired by
//  film-festival opens: serif title card, slow Ken Burns, cross-fades,
//  a faint film-grain veil. The photographer's brand colour shows up
//  exclusively on the progress bar and the closing arrow — a single
//  thread of identity through an otherwise black room.
// ─────────────────────────────────────────────────────────────────────────────

export type CinemaImage = { url: string; alt?: string };

export interface CinemaIntroProps {
  images: CinemaImage[];
  galleryName: string;
  brandPrimaryColor?: string;
  brandFontDisplay?: string;
  musicUrl?: string;
  durationSec?: number;
  onComplete: () => void;
}

// Helper the parent (ClientGalleryPage) can call to decide whether to show
// the intro. We keep it on the component so consumers have a single import.
export const cinemaIntroSeen = (galleryId: string): boolean => {
  try {
    return window.localStorage.getItem(`cinema_seen_${galleryId}`) === "1";
  } catch {
    return false;
  }
};

export const markCinemaIntroSeen = (galleryId: string): void => {
  try {
    window.localStorage.setItem(`cinema_seen_${galleryId}`, "1");
  } catch {
    /* ignore quota / private-browsing errors */
  }
};

const DEFAULT_BRAND = "#FF1493";
const TITLE_CARD_MS = 3600; // fade-in (1s) + hold (2s) + fade-out (600ms)
const END_CARD_LEAD_MS = 500;

// Restrained pan vectors — small, deliberate, never showy.
const PAN_VECTORS: Array<{ x: number; y: number }> = [
  { x: -24, y: 0 },
  { x: 24, y: 0 },
  { x: 0, y: -20 },
  { x: 0, y: 20 },
  { x: -18, y: -14 },
  { x: 18, y: 14 },
  { x: -18, y: 14 },
  { x: 18, y: -14 },
];

function pickPan(seed: number): { x: number; y: number } {
  return PAN_VECTORS[seed % PAN_VECTORS.length];
}

export default function CinemaIntro({
  images,
  galleryName,
  brandPrimaryColor,
  brandFontDisplay,
  musicUrl,
  durationSec = 75,
  onComplete,
}: CinemaIntroProps) {
  const reduceMotion = useReducedMotion();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAt = useRef<number>(performance.now());
  const completedRef = useRef(false);

  const brand = brandPrimaryColor || DEFAULT_BRAND;
  const displayFont =
    brandFontDisplay || "'Playfair Display', 'Cormorant Garamond', serif";

  // ── Slideshow plan ────────────────────────────────────────────────────────
  // Cap at 24 frames so dwell stays ~3s minimum; if photographer delivered
  // fewer, loop the supplied list rather than letting frames stretch.
  const slides = useMemo<CinemaImage[]>(() => {
    if (!images || images.length === 0) return [];
    if (images.length >= 24) return images.slice(0, 24);
    const out: CinemaImage[] = [];
    while (out.length < Math.min(24, images.length * 3)) {
      out.push(images[out.length % images.length]);
    }
    return out;
  }, [images]);

  const slideCount = slides.length;
  const slideMs = slideCount > 0 ? (durationSec * 1000) / slideCount : 3000;

  // ── Playback state ────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<"title" | "slides" | "end">("title");
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1

  // Title card → first slide
  useEffect(() => {
    const t = window.setTimeout(() => setPhase("slides"), TITLE_CARD_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Drive slides & progress
  useEffect(() => {
    if (phase !== "slides") return;
    if (slideCount === 0) {
      // No images: skip straight to end card so onComplete still fires.
      setPhase("end");
      return;
    }

    const slideTimer = window.setTimeout(() => {
      if (index + 1 >= slideCount) {
        setPhase("end");
      } else {
        setIndex((i) => i + 1);
      }
    }, slideMs);

    return () => window.clearTimeout(slideTimer);
  }, [phase, index, slideCount, slideMs]);

  // Progress bar — single rAF loop so it stays smooth & cancels cleanly.
  useEffect(() => {
    let raf = 0;
    const totalMs = durationSec * 1000;
    const tick = () => {
      const elapsed = performance.now() - startedAt.current;
      const p = Math.min(1, elapsed / totalMs);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationSec]);

  // End card → onComplete after a short hold
  useEffect(() => {
    if (phase !== "end") return;
    const t = window.setTimeout(() => fire(), 2200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Music: optional, fade in to 0.6, fade out over the last 2s ────────────
  useEffect(() => {
    if (!musicUrl) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0;
    const playPromise = audio.play();
    // Autoplay may be rejected; that's fine — we stay silent.
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }

    const FADE_IN_MS = 2000;
    const FADE_OUT_MS = 2000;
    const TOTAL_MS = durationSec * 1000;
    let raf = 0;
    const start = performance.now();

    const tick = () => {
      const t = performance.now() - start;
      let v: number;
      if (t < FADE_IN_MS) {
        v = (t / FADE_IN_MS) * 0.6;
      } else if (t > TOTAL_MS - FADE_OUT_MS) {
        v = Math.max(0, ((TOTAL_MS - t) / FADE_OUT_MS) * 0.6);
      } else {
        v = 0.6;
      }
      audio.volume = Math.max(0, Math.min(0.6, v));
      if (t < TOTAL_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
    };
  }, [musicUrl, durationSec]);

  // ── Skip / complete ───────────────────────────────────────────────────────
  const fire = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  // Esc to skip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fire();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock body scroll while playing.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const showEndCardEarly =
    phase === "slides" &&
    slideCount > 0 &&
    index === slideCount - 1 &&
    progress * durationSec * 1000 >
      durationSec * 1000 - END_CARD_LEAD_MS - slideMs * 0.2;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-hidden select-none"
      role="dialog"
      aria-label={`Cinematic intro for ${galleryName}`}
    >
      {/* Optional music */}
      {musicUrl && (
        <audio ref={audioRef} src={musicUrl} loop preload="auto" playsInline />
      )}

      {/* ── Slides layer ─────────────────────────────────────────────────── */}
      {phase !== "title" && slideCount > 0 && (
        <AnimatePresence mode="sync">
          <motion.div
            key={`slide-${index}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <KenBurnsFrame
              src={slides[index].url}
              alt={slides[index].alt || ""}
              durationMs={slideMs}
              pan={pickPan(index)}
              reduced={!!reduceMotion}
            />
            {/* Soft vignette — keeps eye on the centre, hides JPEG edges. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
              }}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Film grain overlay ──────────────────────────────────────────── */}
      <FilmGrain />

      {/* ── Title card ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "title" && (
          <motion.div
            key="title-card"
            className="absolute inset-0 flex items-center justify-center px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{
                duration: 1.0,
                ease: [0.22, 1, 0.36, 1],
                exit: { duration: 0.6 },
              }}
              className="text-center"
            >
              <div
                className="mx-auto mb-6 h-px w-12"
                style={{ background: brand, opacity: 0.85 }}
              />
              <h1
                className="text-white/95 leading-[1.05]"
                style={{
                  fontFamily: displayFont,
                  fontSize: "clamp(48px, 9vw, 80px)",
                  fontWeight: 400,
                  letterSpacing: "-0.01em",
                }}
              >
                {galleryName}
              </h1>
              <div
                className="mt-6 text-[10px] uppercase tracking-[0.4em] text-white/40"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                A film of moments
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── End card ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === "end" || showEndCardEarly) && (
          <motion.div
            key="end-card"
            className="absolute inset-0 flex items-center justify-center px-8 bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <div
                className="text-[10px] uppercase tracking-[0.45em] text-white/50 mb-4"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {galleryName}
              </div>
              <div
                className="flex items-center justify-center gap-4 text-white/95"
                style={{
                  fontFamily: displayFont,
                  fontSize: "clamp(28px, 5vw, 44px)",
                  fontWeight: 400,
                }}
              >
                <span>View full gallery</span>
                <motion.span
                  aria-hidden
                  animate={
                    reduceMotion
                      ? undefined
                      : { x: [0, 6, 0], opacity: [0.7, 1, 0.7] }
                  }
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  style={{ color: brand }}
                >
                  →
                </motion.span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Skip ────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={fire}
        className="absolute top-5 right-5 z-10 group flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.25em] text-white/40 backdrop-blur-md transition-colors hover:text-white hover:border-white/30"
        style={{ fontFamily: "'Inter', sans-serif" }}
        aria-label="Skip intro"
      >
        <span>Skip</span>
        <X className="h-3 w-3 transition-transform group-hover:rotate-90" />
      </button>

      {/* ── Progress bar ────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-white/10"
        aria-hidden
      >
        <div
          className="h-full transition-[width] duration-150 ease-linear"
          style={{
            width: `${progress * 100}%`,
            background: brand,
            boxShadow: `0 0 12px ${brand}80`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Ken Burns frame ──────────────────────────────────────────────────────
// Scale 1 → 1.08 over the dwell, with a small random pan. When the user
// prefers reduced motion we collapse to a still image + the parent's
// cross-fade only.
function KenBurnsFrame({
  src,
  alt,
  durationMs,
  pan,
  reduced,
}: {
  src: string;
  alt: string;
  durationMs: number;
  pan: { x: number; y: number };
  reduced: boolean;
}) {
  if (reduced) {
    return (
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
    );
  }
  return (
    <motion.img
      src={src}
      alt={alt}
      draggable={false}
      className="absolute inset-0 w-full h-full object-cover will-change-transform"
      initial={{ scale: 1, x: 0, y: 0 }}
      animate={{ scale: 1.08, x: pan.x, y: pan.y }}
      transition={{ duration: durationMs / 1000, ease: "linear" }}
    />
  );
}

// ─── Film grain ───────────────────────────────────────────────────────────
// SVG-based feTurbulence noise, painted at 8% opacity, blended in screen
// mode. Cheap (one element, no animation), and gives the otherwise-clean
// fades a tangible "shot on film" quality.
function FilmGrain() {
  return (
    <div
      className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.12]"
      aria-hidden
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        backgroundSize: "200px 200px",
      }}
    />
  );
}
