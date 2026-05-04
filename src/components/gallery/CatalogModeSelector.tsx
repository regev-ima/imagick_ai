import { LayoutGrid, Star, Tag, Layers, ScanFace } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type CatalogMode = "default" | "stars" | "categories" | "grouping" | "faces";

interface CatalogModeSelectorProps {
  mode: CatalogMode;
  onModeChange: (mode: CatalogMode) => void;
  hasAIData: boolean;
  hasFaceData?: boolean;
  className?: string;
}

export function CatalogModeSelector({
  mode,
  onModeChange,
  hasAIData,
  hasFaceData,
  className
}: CatalogModeSelectorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">View:</span>
      <ToggleGroup 
        type="single" 
        value={mode} 
        onValueChange={(value) => value && onModeChange(value as CatalogMode)}
        className="gap-1"
      >
        <ToggleGroupItem 
          value="default" 
          aria-label="Default grid view"
          className="gap-1.5 px-3"
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="hidden sm:inline">Default</span>
        </ToggleGroupItem>
        
        <ToggleGroupItem 
          value="stars" 
          aria-label="Group by rating"
          className="gap-1.5 px-3"
          disabled={!hasAIData}
        >
          <Star className="w-4 h-4" />
          <span className="hidden sm:inline">Stars</span>
        </ToggleGroupItem>
        
        <ToggleGroupItem 
          value="categories" 
          aria-label="Group by category"
          className="gap-1.5 px-3"
          disabled={!hasAIData}
        >
          <Tag className="w-4 h-4" />
          <span className="hidden sm:inline">Categories</span>
        </ToggleGroupItem>
        
        <ToggleGroupItem
          value="grouping"
          aria-label="View similarity groups"
          className="gap-1.5 px-3"
          disabled={!hasAIData}
        >
          <Layers className="w-4 h-4" />
          <span className="hidden sm:inline">Groups</span>
        </ToggleGroupItem>

        <ToggleGroupItem
          value="faces"
          aria-label="Face search"
          className="gap-1.5 px-3"
        >
          <ScanFace className="w-4 h-4" />
          <span className="hidden sm:inline">Faces</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
