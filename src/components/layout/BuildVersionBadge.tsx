import { BUILD_SHA, BUILD_TIME_ISO, formatBuildTime } from "@/lib/buildInfo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BuildVersionBadgeProps {
  /** Render compact (icon-only sidebar) or full text. */
  compact?: boolean;
  className?: string;
}

/**
 * Tiny "deploy fingerprint" shown at the bottom of the dashboard
 * sidebar so the user can confirm which build is live. Hover reveals
 * the full ISO timestamp for support / bug reports.
 */
export function BuildVersionBadge({ compact = false, className }: BuildVersionBadgeProps) {
  const friendly = formatBuildTime();
  const tooltipText = `Build ${BUILD_SHA} · ${BUILD_TIME_ISO}`;

  if (compact) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "block text-[10px] text-muted-foreground/70 font-mono text-center select-none cursor-default",
                className,
              )}
            >
              {BUILD_SHA}
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-mono text-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "text-[10px] leading-tight text-muted-foreground/60 font-mono select-none cursor-default text-center",
              className,
            )}
          >
            <span>v{BUILD_SHA}</span>
            <span className="mx-1">·</span>
            <span>{friendly}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="font-mono text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
