import { LayoutGrid, Layers, ScanFace } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

// "stars"/"categories" remain in the union for backwards-compat but are no
// longer offered as views — star/category browsing lives in the sidebar
// filters. The selector surfaces the three views that actually exist:
// the default grid, the similarity Groups view, and the People (faces) view.
export type CatalogMode = "default" | "stars" | "categories" | "grouping" | "faces";

interface CatalogModeSelectorProps {
  mode: CatalogMode;
  onModeChange: (mode: CatalogMode) => void;
  hasAIData: boolean;
  /** Number of detected people/face clusters — badges the Faces tab so the
   *  user can see at a glance that people were found. */
  faceCount?: number;
  className?: string;
}

export function CatalogModeSelector({
  mode,
  onModeChange,
  hasAIData,
  faceCount = 0,
  className,
}: CatalogModeSelectorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="aura-microlabel">View</span>
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => value && onModeChange(value as CatalogMode)}
        className="gap-1"
      >
        <ToggleGroupItem value="default" aria-label="Default grid view" className="gap-1.5 px-3">
          <LayoutGrid className="w-4 h-4" />
          <span className="hidden sm:inline">Photos</span>
        </ToggleGroupItem>

        <ToggleGroupItem
          value="grouping"
          aria-label="View similar-photo groups"
          className="gap-1.5 px-3"
          disabled={!hasAIData}
        >
          <Layers className="w-4 h-4" />
          <span className="hidden sm:inline">Groups</span>
        </ToggleGroupItem>

        <ToggleGroupItem value="faces" aria-label="People / faces" className="gap-1.5 px-3">
          <ScanFace className="w-4 h-4" />
          <span className="hidden sm:inline">People</span>
          {faceCount > 0 && (
            <span className="ml-0.5 min-w-[1.1rem] rounded-full bg-secondary/20 px-1 text-[10px] font-semibold tabular-nums text-secondary">
              {faceCount}
            </span>
          )}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
