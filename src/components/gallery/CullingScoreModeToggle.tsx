import { useUserRole } from "@/hooks/useUserRole";
import { useCullingScoreMode } from "@/hooks/useCullingScoreMode";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** The AI mark — 4-point sparkle (logo star). Inherits currentColor. */
function Sparkle({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
          <div className="flex items-center gap-2 rounded-sm border border-border/60 surface-2 px-2 py-1">
            <Sparkle size={13} className="text-primary" />
            <span className="aura-microlabel hidden sm:inline">Score</span>
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
