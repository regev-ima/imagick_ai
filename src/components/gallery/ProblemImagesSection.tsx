import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, RotateCw, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFailedImages } from "@/components/gallery/FailedImagesContext";

/**
 * "Problem images" strip rendered above the main gallery grid. Lists
 * every tile that's given up retrying its thumbnail so the user can
 * see *which* uploads need attention (by filename) and trigger a
 * batched retry. Hidden when no failures are present.
 *
 * The retry budget per tile is enforced inside ImageCard; this section
 * only orchestrates the batch action and surfaces the list.
 */
export function ProblemImagesSection() {
  const { failed, retryAll } = useFailedImages();
  const [expanded, setExpanded] = useState(true);

  if (failed.length === 0) return null;

  return (
    <div className="mb-3 rounded-[--radius] border border-destructive/40 bg-destructive/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-destructive focus:outline-none focus-visible:underline"
          aria-expanded={expanded}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>
            <span className="folio">{failed.length}</span> image{failed.length === 1 ? "" : "s"} failed to load
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-7 text-xs border-destructive/40 hover:border-destructive/60"
          onClick={retryAll}
        >
          <RotateCw className="w-3 h-3" />
          Retry all
        </Button>
      </div>

      {expanded && (
        <div
          className={cn(
            "px-3 pb-3 pt-1 border-t border-destructive/20",
            "grid gap-1.5",
            // Many small chips — wrap densely. 320px min per chip keeps
            // long filenames readable; narrower screens get 1 column.
            "grid-cols-[repeat(auto-fill,minmax(220px,1fr))]",
          )}
        >
          {failed.map((rec) => (
            <div
              key={rec.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-sm surface-2 border border-border/60 min-w-0"
              title={rec.filename}
            >
              <FileWarning className="w-3.5 h-3.5 text-destructive shrink-0" />
              <span className="text-xs truncate flex-1 min-w-0">{rec.filename}</span>
              <button
                type="button"
                onClick={() => rec.retry()}
                className="text-[11px] text-primary hover:underline focus:outline-none focus:underline shrink-0"
                aria-label={`Retry ${rec.filename}`}
              >
                Retry
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
