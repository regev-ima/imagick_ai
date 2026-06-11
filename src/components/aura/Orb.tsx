import { cn } from "@/lib/utils";

/**
 * The living Aura core — the engine's visual presence across the app.
 * Pure CSS: ring/core/halo classes live in index.css (AURA effect kit)
 * and read the theme tokens, so the orb adapts to light/dark.
 */
export function Orb({ className }: { className?: string }) {
  return (
    <div className={cn("aura-orb relative", className)} aria-hidden="true">
      <div className="aura-orb-halo" />
      <div className="aura-orb-ring" />
      <div className="aura-orb-core" />
    </div>
  );
}
