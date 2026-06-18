import { Skeleton } from "@/components/ui/skeleton";

/**
 * Consistent loading placeholder for admin lists/tables — shimmer rows with a
 * screen-reader announcement, instead of a static "Loading…" caption.
 */
export function AdminLoading({
  rows = 6,
  label = "Loading…",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className="space-y-2.5 p-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-[--radius]" />
      ))}
    </div>
  );
}
