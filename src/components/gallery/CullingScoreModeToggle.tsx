import { useUserRole } from "@/hooks/useUserRole";
import { useCullingScoreMode } from "@/hooks/useCullingScoreMode";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";

/**
 * Admin-only debug toggle to switch how culling_score is converted to stars.
 * - Linear:     score * 5 (raw mapping, default — what end users see).
 * - Normalized: percentile-stretched [0.43–0.74] → [0–1].
 * - Raw:        shows the underlying 0–1 number where supported.
 *
 * Persisted in localStorage. Renders nothing for non-admins.
 */
export function CullingScoreModeToggle() {
  const { isAdmin } = useUserRole();
  const { mode, setMode } = useCullingScoreMode();

  if (!isAdmin) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-2 py-1">
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Score</span>
            <ToggleGroup
              type="single"
              size="sm"
              value={mode}
              onValueChange={(v) => v && setMode(v as typeof mode)}
              className="gap-0.5"
            >
              <ToggleGroupItem value="normalized" className="h-7 px-2 text-xs">
                Norm
              </ToggleGroupItem>
              <ToggleGroupItem value="linear" className="h-7 px-2 text-xs">
                Linear
              </ToggleGroupItem>
              <ToggleGroupItem value="raw" className="h-7 px-2 text-xs">
                Raw
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">
              <strong>Admin only.</strong> Switch how culling scores are mapped to stars.
              <br />
              <strong>Linear (default):</strong> score×5 (0.20/0.40/0.60/0.80).
              <br />
              <strong>Norm:</strong> linear stretch [0.43–0.74] → [0–1], then 5 equal buckets.
              <br />
              <strong>Raw:</strong> shows the 0–1 number alongside stars.
            </p>
          </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
