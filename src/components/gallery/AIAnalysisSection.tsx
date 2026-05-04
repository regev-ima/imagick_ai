import { useState } from "react";
import { Star, Eye, Focus, Grid3X3, Smile } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { cullingScoreToStars } from "@/lib/cullingScore";
import { SimilarImagesGrid } from "./SimilarImagesGrid";

interface AIMetrics {
  culling_score: number | null;
  culling_label: string | null;
  background_sharpness: number | null;
  subject_sharpness: number | null;
  thirds_rule: number | null;
  intended_facial_expression: number | null;
}

interface SimilarImage {
  id: string;
  original_url: string;
  culling_score: number | null;
}

export type SimilarityLevel = "loose" | "medium" | "strict";

interface AIAnalysisSectionProps {
  metrics: AIMetrics;
  similarImages: SimilarImage[];
  currentImageId: string;
  onSimilarImageClick: (imageId: string) => void;
  similarityLevel?: SimilarityLevel;
  onSimilarityLevelChange?: (level: SimilarityLevel) => void;
}

// Normalize long labels to shorter, readable format
const normalizeLabel = (label: string): string => {
  if (!label || label === "N/A" || label === "none") return "Uncategorized";
  
  // If it's a long sentence, extract key terms
  if (label.length > 40) {
    const words = label.split(' ').slice(0, 4);
    return words.join(' ') + '...';
  }
  
  // Convert underscore to spaces and title case
  return label
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

// Check if face was detected (value > 0)
const hasFaceDetected = (value: number | null): boolean => {
  if (value === null || value === undefined) return false;
  return value > 0;
};

export function AIAnalysisSection({ 
  metrics, 
  similarImages, 
  currentImageId,
  onSimilarImageClick,
  similarityLevel = "medium",
  onSimilarityLevelChange
}: AIAnalysisSectionProps) {
  const stars = cullingScoreToStars(metrics.culling_score);

  const hasQualityMetrics = 
    metrics.background_sharpness !== null || 
    metrics.subject_sharpness !== null || 
    metrics.thirds_rule !== null;

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      {metrics.culling_score !== null && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">AI Score</span>
            <span className="text-sm text-muted-foreground">
              {(metrics.culling_score * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-5 h-5 transition-colors",
                  i < stars 
                    ? "text-yellow-500 fill-yellow-500" 
                    : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Category */}
      {metrics.culling_label && (
        <div>
          <span className="text-sm font-medium block mb-1.5">Category</span>
           <span className="inline-flex px-3 py-1 rounded-full text-xs bg-muted text-foreground">
            {normalizeLabel(metrics.culling_label)}
          </span>
        </div>
      )}

      {/* Quality Metrics */}
      {hasQualityMetrics && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-3">Quality Metrics</h4>
            <div className="space-y-2">
              {metrics.subject_sharpness !== null && (
                <MetricRow 
                  icon={<Focus className="w-3.5 h-3.5" />}
                  label="Subject"
                  value={metrics.subject_sharpness}
                />
              )}
              {metrics.background_sharpness !== null && (
                <MetricRow 
                  icon={<Eye className="w-3.5 h-3.5" />}
                  label="Background"
                  value={metrics.background_sharpness}
                />
              )}
              {metrics.thirds_rule !== null && (
                <MetricRow 
                  icon={<Grid3X3 className="w-3.5 h-3.5" />}
                  label="Thirds"
                  value={metrics.thirds_rule}
                />
              )}
              {metrics.intended_facial_expression !== null && (
                hasFaceDetected(metrics.intended_facial_expression) ? (
                  <MetricRow 
                    icon={<Smile className="w-3.5 h-3.5" />}
                    label="Expression"
                    value={metrics.intended_facial_expression}
                  />
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Smile className="w-3.5 h-3.5" />
                      <span>Expression</span>
                    </div>
                    <span className="text-muted-foreground">No face</span>
                  </div>
                )
              )}
            </div>
          </div>
        </>
      )}

      {/* Similar Images */}
      {similarImages.length > 1 && (
        <>
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">
                Similar Images ({similarImages.length})
              </h4>
            </div>
            {/* Similarity Level Selector */}
            {onSimilarityLevelChange && (
              <div className="flex gap-1 mb-3">
                {(["loose", "medium", "strict"] as const).map(level => (
                  <button
                    key={level}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSimilarityLevelChange(level);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                      similarityLevel === level
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {level === "loose" ? "Low" : level === "medium" ? "Med" : "High"}
                  </button>
                ))}
              </div>
            )}
            <SimilarImagesGrid
              images={similarImages}
              currentImageId={currentImageId}
              onImageClick={onSimilarImageClick}
            />
          </div>
        </>
      )}
    </div>
  );
}

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

function MetricRow({ icon, label, value }: MetricRowProps) {
  const percentage = Math.round(value * 100);
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground min-w-[80px]">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-foreground/60 rounded-full transition-all" 
          style={{ width: `${percentage}%` }} 
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">{percentage}%</span>
    </div>
  );
}
