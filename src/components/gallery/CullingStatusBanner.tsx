import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CullingStatusBannerProps {
  /** Database-backed status — "processing" / "ready" / "idle" / null. */
  status: string | null | undefined;
  /** When the current culling run started, ISO string from DB. */
  startedAt: string | null | undefined;
  /** True after >20 minutes with no completion — shows a 'looks stuck' hint. */
  isStuck?: boolean;
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
  isStuck = false,
  className,
}: CullingStatusBannerProps) {
  // Tick once a minute so the elapsed-time text stays current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "processing") return;
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [status]);

  if (status !== "processing") return null;

  const elapsedMs = startedAt ? now - new Date(startedAt).getTime() : 0;
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  const elapsedSeconds = Math.max(0, Math.floor((elapsedMs / 1_000) % 60));

  const elapsedText =
    elapsedMinutes > 0
      ? `${elapsedMinutes} min ${elapsedSeconds}s elapsed`
      : `${elapsedSeconds}s elapsed`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 border-b",
        isStuck
          ? "bg-orange-500/10 border-orange-500/30 text-orange-200"
          : "bg-primary/10 border-primary/30 text-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative shrink-0">
        {isStuck ? (
          <Sparkles className="w-4 h-4 text-orange-400" />
        ) : (
          <>
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="absolute inset-0 rounded-full bg-primary/30 blur-md -z-10" aria-hidden />
          </>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {isStuck
            ? "AI Culling looks stuck — you can retry from the sidebar."
            : "AI Culling in progress…"}
        </p>
        <p className="text-xs text-muted-foreground">
          {isStuck ? (
            <>It's been {elapsedText} with no result. Sometimes the API throttles us — restarting usually works.</>
          ) : (
            <>
              {elapsedText}. Typically completes in 5-10 minutes for ~1000 photos.
              You can keep working on other things — we'll update the gallery automatically.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
