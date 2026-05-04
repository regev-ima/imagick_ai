import { useState, useMemo } from "react";
import { Star, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { getThumbnailUrl } from "@/lib/imageUrls";

export type GroupingLevel = "loose" | "medium" | "strict";

interface GalleryImage {
  id: string;
  original_url: string;
  culling_score: number | null;
  similarity_group_1: number | null;
  similarity_group_2: number | null;
  similarity_group_3: number | null;
}

interface GroupingViewProps {
  images: GalleryImage[];
  onImageClick: (imageId: string) => void;
  onSelectionToggle: (imageId: string, index: number, event: React.MouseEvent) => void;
  selectedImages: string[];
}

export function GroupingView({ 
  images, 
  onImageClick,
  onSelectionToggle,
  selectedImages 
}: GroupingViewProps) {
  const [level, setLevel] = useState<GroupingLevel>("medium");
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  // Group images by similarity level
  const groups = useMemo(() => {
    const field = level === "loose" 
      ? "similarity_group_1" 
      : level === "medium" 
        ? "similarity_group_2" 
        : "similarity_group_3";
    
    const groupMap: Record<number, GalleryImage[]> = {};
    
    images.forEach(img => {
      const groupId = img[field];
      if (groupId == null) return;
      if (!groupMap[groupId]) groupMap[groupId] = [];
      groupMap[groupId].push(img);
    });
    
    // Sort each group by score (best first) and return as array
    return Object.entries(groupMap)
      .map(([groupId, groupImages]) => ({
        id: parseInt(groupId),
        images: groupImages.sort((a, b) => (b.culling_score ?? 0) - (a.culling_score ?? 0))
      }))
      .sort((a, b) => {
        // Sort groups by best image score
        const aScore = a.images[0]?.culling_score ?? 0;
        const bScore = b.images[0]?.culling_score ?? 0;
        return bScore - aScore;
      });
  }, [images, level]);

  // Get star rating from culling score
  const getStars = (score: number | null) => {
    if (score === null) return 0;
    return Math.max(1, Math.min(5, Math.round(score * 5)));
  };

  const renderStars = (score: number | null) => {
    const stars = getStars(score);
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              "w-3 h-3",
              i < stars ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Level Selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Similarity Level:</span>
          <ToggleGroup 
            type="single" 
            value={level} 
            onValueChange={(v) => v && setLevel(v as GroupingLevel)}
            className="gap-1"
          >
            <ToggleGroupItem value="loose" className="px-3 text-xs">
              Loose (50%)
            </ToggleGroupItem>
            <ToggleGroupItem value="medium" className="px-3 text-xs">
              Medium (70%)
            </ToggleGroupItem>
            <ToggleGroupItem value="strict" className="px-3 text-xs">
              Strict (90%)
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <span className="text-sm text-muted-foreground">
          {groups.length} groups found
        </span>
      </div>

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No similarity groups found at this level
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {groups.map((group) => {
            const representative = group.images[0];
            const isExpanded = expandedGroup === group.id;
            const avgScore = group.images.reduce((sum, img) => sum + (img.culling_score ?? 0), 0) / group.images.length;

            return (
              <Card
                key={group.id}
                className={cn(
                  "overflow-hidden cursor-pointer transition-all duration-200",
                  "hover:shadow-lg hover:border-primary/50",
                  isExpanded && "col-span-full"
                )}
                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
              >
                {!isExpanded ? (
                  // Collapsed view - show representative image
                  <div className="p-2">
                    <div className="relative aspect-square rounded-md overflow-hidden mb-2">
                      <img
                        src={getThumbnailUrl(representative.original_url)}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-xs">
                        <span>{group.images.length} images</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Group #{group.id}</span>
                      {renderStars(avgScore)}
                    </div>
                  </div>
                ) : (
                  // Expanded view - show all images
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold">Group #{group.id}</span>
                        <span className="text-sm text-muted-foreground">
                          {group.images.length} images
                        </span>
                        {renderStars(avgScore)}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedGroup(null);
                        }}
                      >
                        <ChevronUp className="w-4 h-4" />
                        Collapse
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                      {group.images.map((img, idx) => (
                        <div
                          key={img.id}
                          className={cn(
                            "relative aspect-square rounded-md overflow-hidden cursor-pointer",
                            "border-2 transition-all",
                            selectedImages.includes(img.id) 
                              ? "border-primary" 
                              : "border-transparent hover:border-primary/50",
                            idx === 0 && "ring-2 ring-yellow-500 ring-offset-2"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onImageClick(img.id);
                          }}
                        >
                          <img
                            src={getThumbnailUrl(img.original_url)}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {idx === 0 && (
                            <div className="absolute top-1 left-1 bg-yellow-500 text-black text-[10px] px-1.5 py-0.5 rounded font-medium">
                              Best
                            </div>
                          )}
                          {img.culling_score !== null && (
                            <div className="absolute bottom-1 right-1 bg-background/80 backdrop-blur-sm text-[10px] px-1 rounded">
                              {Math.round(img.culling_score * 100)}%
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
