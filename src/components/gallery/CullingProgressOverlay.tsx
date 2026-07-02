import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Minus, Star, Tag, Copy, Focus } from "lucide-react";
import { Orb } from "@/components/aura/Orb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { estimateCullingMs, formatCountdown, formatDuration } from "@/lib/cullingEta";

/** The AI mark — 4-point sparkle (logo star). Inherits currentColor. */
function Sparkle({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface CullingProgressOverlayProps {
  isOpen: boolean;
  /** Total photos in the run — drives the ETA + copy. */
  imageCount: number;
  /** A handful of thumbnails to animate through the "scanner". Each carries a
   *  cheap thumb URL plus the original as a fallback, so a not-yet-generated
   *  thumbnail (CDN lag mid-processing) never renders as a broken image. */
  thumbnails: { thumb: string; full: string }[];
  /** ISO timestamp the run started (DB-backed). */
  startedAt: string | null | undefined;
  /** Hide the overlay but keep the run going. */
  onMinimize: () => void;
}

/** The work the engine narrates while it scans — purely cosmetic, but it
 *  mirrors the real culling passes (rating, tagging, grouping) so the
 *  "thinking" feels honest rather than a fake spinner. */
const PHASES = [
  { icon: Focus, label: "Reading sharpness & focus" },
  { icon: Star, label: "Scoring composition & expression" },
  { icon: Tag, label: "Categorizing with smart tags" },
  { icon: Copy, label: "Grouping similar & duplicate shots" },
] as const;

/** Cosmetic progress is capped here until the run actually lands — we
 *  never want the bar to read 100% before the gallery updates, which
 *  would make a slow-but-healthy run look broken. */
const PROGRESS_CAP = 0.92;

/**
 * Full-screen "AI is working" overlay shown while AI Culling runs.
 *
 * Why this exists
 * ───────────────
 * Culling is a long, server-side job (≈10s per photo) with no streaming
 * progress. Previously the only feedback was a thin banner, and a missing
 * `culling_started_at` made the UI scream "stuck" at 0s — so users
 * re-clicked, firing duplicate runs that overwrote ratings. This overlay
 * gives the run a confident, living presence: the engine visibly scans
 * the gallery's own thumbnails, narrates the passes it's making, and
 * shows a realistic countdown. It is purely presentational — completion
 * is driven by the real DB state in the parent, never by this animation.
 *
 * It is intentionally NON-blocking: the user can minimize it and keep
 * working; the parent keeps the run alive and reopens the overlay from
 * the status banner.
 */
export function CullingProgressOverlay({
  isOpen,
  imageCount,
  thumbnails,
  startedAt,
  onMinimize,
}: CullingProgressOverlayProps) {
  const reduceMotion = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  // One ticking clock drives the countdown, the progress bar and the
  // thumbnail/phase cycling so they stay in lock-step. Cheap — runs only
  // while the overlay is mounted.
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [isOpen]);

  const etaMs = useMemo(() => estimateCullingMs(imageCount), [imageCount]);
  const elapsedMs = startedAt ? Math.max(0, now - new Date(startedAt).getTime()) : 0;

  // Cosmetic progress: elapsed / ETA, eased toward but never reaching the
  // cap so a long run never looks finished-but-stuck.
  const rawProgress = etaMs > 0 ? elapsedMs / etaMs : 0;
  const progress = Math.min(PROGRESS_CAP, rawProgress);
  const remainingMs = Math.max(0, etaMs - elapsedMs);
  const pastEstimate = elapsedMs >= etaMs;

  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  // Show a small, stable window of thumbnails (the gallery can have
  // thousands — we only need a representative strip to animate). Kept to
  // five so the strip never overflows a phone screen.
  const strip = useMemo(() => thumbnails.slice(0, 5), [thumbnails]);
  // Cycle the active thumbnail + narrated phase roughly once a second.
  const activeIndex = strip.length > 0 ? elapsedSeconds % strip.length : 0;
  const phase = PHASES[Math.floor(elapsedSeconds / 3) % PHASES.length];
  const PhaseIcon = phase.icon;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-4"
      role="status"
      aria-live="polite"
      aria-label={`AI Culling in progress — analyzing ${imageCount} photos`}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 8 }}
        className="w-full max-w-xl"
      >
        <div className="glass-card aura-ai-border border border-primary/30 rounded-[--radius] p-6 sm:p-8 relative overflow-hidden">
          {/* Minimize — keeps the run going in the background. */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMinimize}
            className="absolute top-3 right-3 z-10"
            aria-label="Minimize — keep culling in the background"
          >
            <Minus className="w-5 h-5" />
          </Button>

          {/* Engine presence */}
          <div className="flex flex-col items-center text-center">
            <Orb className="w-16 h-16 mb-4" />
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkle size={16} className="text-primary" />
              AI Culling
            </h2>
            <p className="aura-microlabel mt-1">
              Analyzing <span className="folio text-foreground">{imageCount.toLocaleString()}</span> photos
            </p>
          </div>

          {/* The scanner — gallery's own thumbnails passing under a sweep
              of light, one "in focus" at a time. */}
          {strip.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-2 overflow-hidden">
              {strip.map((src, i) => {
                const active = i === activeIndex;
                return (
                  <motion.div
                    key={`${src.thumb}-${i}`}
                    className={cn(
                      "relative rounded-sm overflow-hidden border shrink-0",
                      active ? "border-primary" : "border-border/50",
                    )}
                    animate={
                      reduceMotion
                        ? undefined
                        : { width: active ? 76 : 48, height: active ? 76 : 48, opacity: active ? 1 : 0.55 }
                    }
                    style={reduceMotion ? { width: 60, height: 60, opacity: active ? 1 : 0.6 } : undefined}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                  >
                    <ScanThumb thumb={src.thumb} full={src.full} />
                    {/* scan sweep over the focused frame */}
                    {active && !reduceMotion && (
                      <motion.div
                        className="absolute inset-x-0 h-1/2 bg-gradient-to-b from-primary/0 via-primary/40 to-primary/0"
                        initial={{ top: "-50%" }}
                        animate={{ top: "100%" }}
                        transition={{ duration: 1, ease: "linear", repeat: Infinity }}
                      />
                    )}
                    {active && (
                      <span className="absolute inset-0 ring-2 ring-primary/60 rounded-sm" aria-hidden />
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Narrated phase */}
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-foreground">
            <PhaseIcon className="w-4 h-4 text-primary shrink-0" />
            <AnimatePresence mode="wait">
              <motion.span
                key={phase.label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="font-medium"
              >
                {phase.label}
              </motion.span>
            </AnimatePresence>
            <span className="flex items-center gap-1 ml-1" aria-hidden>
              <span className="thinking-dot thinking-dot-1" />
              <span className="thinking-dot thinking-dot-2" />
              <span className="thinking-dot thinking-dot-3" />
            </span>
          </div>

          {/* Progress */}
          <div className="mt-5">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ ease: "linear", duration: 0.8 }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
              <span>{formatDuration(elapsedMs)} elapsed</span>
              <span>
                {pastEstimate ? "wrapping up…" : <>~{formatCountdown(remainingMs)} remaining</>}
              </span>
            </div>
          </div>

          {/* Reassurance + escape hatch */}
          <p className="mt-5 text-xs text-center text-muted-foreground leading-relaxed">
            Estimated <span className="text-foreground font-medium">{formatDuration(etaMs)}</span> for{" "}
            {imageCount.toLocaleString()} photos. You can keep working — we'll update the gallery
            automatically when it's done.
          </p>
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={onMinimize} className="gap-2">
              <Minus className="w-4 h-4" />
              Run in background
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * A scanner thumbnail that never shows a broken image. It tries the cheap thumb
 * first; if that 404s (a preview not yet generated mid-processing) it falls back
 * to the original, and if that also fails it renders a subtle shimmer tile — so
 * the strip always looks intentional, never broken.
 */
function ScanThumb({ thumb, full }: { thumb: string; full: string }) {
  const [src, setSrc] = useState(thumb);
  const [triedFull, setTriedFull] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset when the underlying image changes (the strip is stable, but be safe).
  useEffect(() => {
    setSrc(thumb);
    setTriedFull(false);
    setFailed(false);
  }, [thumb, full]);

  if (failed) {
    return <div className="w-full h-full bg-gradient-to-br from-muted to-muted/40 animate-pulse" aria-hidden />;
  }
  return (
    <img
      src={src}
      alt=""
      className="w-full h-full object-cover"
      draggable={false}
      onError={() => {
        if (!triedFull && full && full !== src) {
          setTriedFull(true);
          setSrc(full);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
