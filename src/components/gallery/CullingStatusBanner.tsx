import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { estimateCullingMs, formatDuration } from "@/lib/cullingEta";

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

interface CullingStatusBannerProps {
  /** Database-backed status — "processing" / "ready" / "idle" / null. */
  status: string | null | undefined;
  /** When the current culling run started, ISO string from DB. */
  startedAt: string | null | undefined;
  /** Image count so we can compute ETA + the "looks stuck" threshold. */
  imageCount?: number;
  /** Pre-computed stuck flag from the page (matches the gallery's image count). */
  isStuck?: boolean;
  /** True when culling DATA already exists on the rows (ratings, labels).
   *  When set we never show the banner — the run actually finished even
   *  if gallery.culling_status was never updated by the webhook. */
  hasCullingData?: boolean;
  /** When provided AND the run is healthy (not stuck), the banner turns
   *  into a button that reopens the minimized "AI is working" overlay. */
  onReopenProgress?: () => void;
  className?: string;
}

/**
 * Persistent top-of-gallery banner shown while AI Culling is running.
 *
 * Why this exists
 * ───────────────
 * Previously the only running-indicator was a small spinner icon on
 * the sidebar's AI Culling button. If the user closed the sidebar,
 * collapsed the modal, or just looked away, they had no way to know
 * culling was still in progress — and the user reported they (or
 * their clients) sometimes re-clicked, thinking nothing happened.
 *
 * The banner is sourced from `galleries.culling_status` so it's
 * persistent across page reloads and tab switches.
 */
export function CullingStatusBanner({
  status,
  startedAt,
  imageCount = 0,
  isStuck = false,
  hasCullingData = false,
  onReopenProgress,
  className,
}: CullingStatusBannerProps) {
  // Tick once a minute so the elapsed-time text stays current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "processing") return;
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, [status]);

  if (status !== "processing") return null;
  // The data has already landed but the webhook didn't flip the
  // status flag — don't show "in progress" for a run that's actually
  // finished. The page-level self-healer will repair the row.
  if (hasCullingData) return null;

  const elapsedMs = startedAt ? now - new Date(startedAt).getTime() : 0;
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  const elapsedSeconds = Math.max(0, Math.floor((elapsedMs / 1_000) % 60));

  const elapsedText =
    elapsedMinutes > 0
      ? `${elapsedMinutes} min ${elapsedSeconds}s elapsed`
      : `${elapsedSeconds}s elapsed`;

  const etaMs = estimateCullingMs(imageCount);
  const etaText = formatDuration(etaMs);
  const remainingMs = Math.max(0, etaMs - elapsedMs);
  const remainingText = remainingMs > 0 ? `~${formatDuration(remainingMs)} remaining` : "wrapping up…";

  // While the run is healthy and an overlay-reopen handler is wired, the
  // whole banner is a button that brings the live "AI is working" view
  // back. We don't do this when stuck — the action there is "retry",
  // which lives in the sidebar.
  const canReopen = !isStuck && !!onReopenProgress;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 border-b",
        isStuck
          ? "bg-rating/10 border-rating/30 text-rating"
          : "bg-primary/10 border-primary/30 text-foreground",
        canReopen && "cursor-pointer hover:bg-primary/[0.16] transition-colors",
        className,
      )}
      role={canReopen ? "button" : "status"}
      tabIndex={canReopen ? 0 : undefined}
      aria-live="polite"
      onClick={canReopen ? onReopenProgress : undefined}
      onKeyDown={
        canReopen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onReopenProgress?.();
              }
            }
          : undefined
      }
    >
      <div className="relative shrink-0 flex items-center justify-center">
        {isStuck ? (
          <Sparkle size={16} className="text-rating" />
        ) : (
          <>
            <Sparkle size={16} className="text-primary animate-pulse" />
            <span className="absolute inset-0 rounded-full bg-primary/30 blur-md -z-10" aria-hidden />
          </>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium flex items-center gap-2">
          <span className="aura-microlabel text-current">{isStuck ? "AI Culling" : "Aura Culling"}</span>
          {isStuck
            ? "looks stuck — you can retry from the sidebar."
            : `in progress · ${remainingText}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {isStuck ? (
            <>It's been {elapsedText} with no result. Sometimes the API throttles us — restarting usually works.</>
          ) : (
            <>
              {elapsedText} · estimated total {etaText} for {imageCount.toLocaleString()} photos.
              You can keep working on other things — we'll update the gallery automatically.
            </>
          )}
        </p>
      </div>

      {canReopen && (
        <span className="shrink-0 text-xs font-medium text-primary border border-primary/40 rounded-sm px-2 py-1">
          View progress
        </span>
      )}
    </div>
  );
}
