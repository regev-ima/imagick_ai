import { useState } from "react";
import { Sparkle } from "./Sparkle";

type Props = {
  src: string;
  alt: string;
  /** CSS filter applied to the "before" (unedited / SOOC) layer. */
  beforeFilter?: string;
  className?: string;
  /** Aspect ratio utility class, e.g. "aspect-[4/3]". */
  ratio?: string;
};

/**
 * Interactive before/after reveal. The "after" layer is the real photo; the
 * "before" layer is the same frame, flattened with a CSS filter to mimic an
 * unedited capture. Driven by an accessible range input (keyboard + pointer).
 */
export function BeforeAfter({
  src,
  alt,
  beforeFilter = "saturate(0.55) contrast(0.82) brightness(1.08)",
  className = "",
  ratio = "aspect-[4/5]",
}: Props) {
  const [pos, setPos] = useState(52);

  return (
    <div
      className={`group relative ${ratio} w-full overflow-hidden rounded-lg border border-border bg-card select-none ${className}`}
    >
      {/* After (edited) — base layer */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Before (flattened) — clipped to the left of the handle */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: beforeFilter, clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />

      {/* Corner labels */}
      <span className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-black/55 px-2 py-1 caption !text-white/90 backdrop-blur-sm">
        Original
      </span>
      <span className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded bg-primary px-2 py-1 caption !text-white">
        <Sparkle size={11} className="text-white" />
        Your style
      </span>

      {/* Divider + grip (visual only) */}
      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white/80 shadow-[0_0_12px_rgba(0,0,0,0.4)]"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-background/90 text-foreground shadow-[var(--elevation-2)] backdrop-blur">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 6-6 6 6 6" />
            <path d="m9 6 6 6-6 6" opacity="0.55" />
          </svg>
        </div>
      </div>

      {/* Accessible control */}
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`Before and after: ${alt}. Drag to reveal the edited version.`}
        className="ba-range absolute inset-0 z-20 h-full w-full cursor-ew-resize appearance-none bg-transparent"
      />
    </div>
  );
}
