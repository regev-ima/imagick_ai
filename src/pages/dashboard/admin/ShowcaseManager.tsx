import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { cn } from "@/lib/utils";
import { SHOWCASE_GALLERY_ID } from "@/lib/constants";

const HIDDEN_STORAGE_KEY = "showcase-hidden-images";

type HiddenMap = Record<string, string[]>; // styleId -> imageId[]

function loadHiddenMap(): HiddenMap {
  try {
    const raw = localStorage.getItem(HIDDEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHiddenMap(map: HiddenMap) {
  localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(map));
}

function ImageWithFallback({ src, alt, className }: { src: string; alt?: string; className?: string }) {
  const [error, setError] = useState(false);
  
  if (error || !src) {
    return (
      <div className={cn("bg-muted flex items-center justify-center", className)}>
        <ImageIcon className="w-6 h-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ""}
      className={className}
      onError={() => setError(true)}
    />
  );
}

export default function ShowcaseManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStyleIds, setProcessingStyleIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [hiddenMap, setHiddenMap] = useState<HiddenMap>(loadHiddenMap);
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());
  // processNewOnly removed — now using unprocessedImageIds logic directly

  // Fetch the fixed showcase gallery
  const { data: showcaseGallery, isLoading: galleryLoading } = useQuery({
    queryKey: ["showcase-gallery", SHOWCASE_GALLERY_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("galleries")
        .select("*")
        .eq("id", SHOWCASE_GALLERY_ID)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch showcase images
  const { data: showcaseImages = [], isLoading: imagesLoading } = useQuery({
    queryKey: ["showcase-images", showcaseGallery?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .eq("gallery_id", showcaseGallery!.id)
        .neq("status", "deleted")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!showcaseGallery?.id,
  });

  // Fetch all preset styles
  const { data: presetStyles = [] } = useQuery({
    queryKey: ["preset-styles-showcase"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("styles")
        .select("id, name, style_id_external, thumbnail_url, before_image_urls, after_image_urls")
        .eq("is_preset", true)
        .neq("status", "deleted")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch image_edits for showcase gallery
  const { data: imageEdits = [] } = useQuery({
    queryKey: ["showcase-edits", showcaseGallery?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("image_edits")
        .select("*")
        .eq("gallery_id", showcaseGallery!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!showcaseGallery?.id,
    refetchInterval: isProcessing ? 5000 : false,
  });

  // Style status
  const styleStatus = useMemo(() => {
    const map: Record<string, { completed: number; total: number; status: "pending" | "processing" | "complete" }> = {};
    const imageCount = showcaseImages.length;

    presetStyles.forEach((style) => {
      const editsForStyle = imageEdits.filter((e) => e.style_id === style.id);
      const completed = editsForStyle.length;
      let status: "pending" | "processing" | "complete" = "pending";
      if (completed > 0 && completed >= imageCount) status = "complete";
      else if (completed > 0) status = "processing";
      map[style.id] = { completed, total: imageCount, status };
    });
    return map;
  }, [presetStyles, imageEdits, showcaseImages]);

  const overallProgress = useMemo(() => {
    const totalExpected = showcaseImages.length * presetStyles.length;
    const totalCompleted = imageEdits.length;
    const allComplete = totalExpected > 0 && totalCompleted >= totalExpected;
    return { totalExpected, totalCompleted, allComplete, percentage: totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0 };
  }, [showcaseImages, presetStyles, imageEdits]);

  useEffect(() => {
    if (isProcessing && overallProgress.allComplete) {
      setIsProcessing(false);
      toast.success("All styles processed successfully!");
    }
  }, [isProcessing, overallProgress.allComplete]);

  // Compute which images are unprocessed (missing edits for at least one style)
  const unprocessedImageIds = useMemo(() => {
    return showcaseImages
      .filter((img) => {
        const editsForImg = imageEdits.filter((e) => e.image_id === img.id);
        const stylesWithEdits = new Set(editsForImg.map((e) => e.style_id));
        return presetStyles.some((s) => !stylesWithEdits.has(s.id));
      })
      .map((img) => img.id);
  }, [showcaseImages, imageEdits, presetStyles]);

  const handleProcessAll = async (onlyNew = false) => {
    if (!showcaseGallery?.id || showcaseImages.length === 0 || presetStyles.length === 0) return;

    setIsProcessing(true);

    const imageIds = onlyNew
      ? unprocessedImageIds
      : showcaseImages.map((img) => img.id);

    if (imageIds.length === 0) {
      toast.info("All images already processed for all styles!");
      setIsProcessing(false);
      return;
    }

    const styleIds = presetStyles.map((s) => s.id);

    try {
      const { error } = await supabase.functions.invoke("process-images", {
        body: { galleryId: showcaseGallery.id, imageIds, styleIds },
      });
      if (error) throw error;
      toast.success(`Processing ${imageIds.length} images × ${styleIds.length} styles`);
      queryClient.invalidateQueries({ queryKey: ["showcase-edits"] });
    } catch (err: any) {
      console.error("Process error:", err);
      toast.error("Failed to start processing");
      setIsProcessing(false);
    }
  };

  const handleProcessSingleStyle = async (styleId: string) => {
    if (!showcaseGallery?.id || showcaseImages.length === 0) return;

    // Find images not yet processed for this style
    const processedForStyle = new Set(imageEdits.filter((e) => e.style_id === styleId).map((e) => e.image_id));
    const imageIds = showcaseImages.filter((img) => !processedForStyle.has(img.id)).map((img) => img.id);

    if (imageIds.length === 0) {
      toast.info("All images already processed for this style");
      return;
    }

    setProcessingStyleIds((prev) => new Set(prev).add(styleId));

    try {
      const { error } = await supabase.functions.invoke("process-images", {
        body: { galleryId: showcaseGallery.id, imageIds, styleIds: [styleId] },
      });
      if (error) throw error;
      toast.success(`Processing ${imageIds.length} new images for this style`);
      queryClient.invalidateQueries({ queryKey: ["showcase-edits"] });
    } catch {
      toast.error("Failed to start processing");
      setProcessingStyleIds((prev) => { const n = new Set(prev); n.delete(styleId); return n; });
    }
  };

  // Per-style unprocessed count
  const unprocessedPerStyle = useMemo(() => {
    const map: Record<string, number> = {};
    presetStyles.forEach((style) => {
      const processedIds = new Set(imageEdits.filter((e) => e.style_id === style.id).map((e) => e.image_id));
      map[style.id] = showcaseImages.filter((img) => !processedIds.has(img.id)).length;
    });
    return map;
  }, [presetStyles, imageEdits, showcaseImages]);

  const toggleHidden = useCallback((styleId: string, imageId: string) => {
    setHiddenMap((prev) => {
      const list = prev[styleId] || [];
      const next = list.includes(imageId)
        ? list.filter((id) => id !== imageId)
        : [...list, imageId];
      const updated = { ...prev, [styleId]: next };
      saveHiddenMap(updated);
      return updated;
    });
  }, []);

  const toggleExpanded = useCallback((styleId: string) => {
    setExpandedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(styleId)) next.delete(styleId);
      else next.add(styleId);
      return next;
    });
  }, []);

  const handleApplyToStyles = async () => {
    if (!showcaseGallery?.id) return;
    setIsApplying(true);
    let updated = 0;

    try {
      for (const style of presetStyles) {
        const editsForStyle = imageEdits.filter((e) => e.style_id === style.id);
        if (editsForStyle.length === 0) continue;

        const hiddenIds = new Set(hiddenMap[style.id] || []);
        const visibleEdits = editsForStyle.filter((e) => !hiddenIds.has(e.image_id));
        if (visibleEdits.length === 0) continue;

        // Build aligned before/after arrays by iterating visibleEdits
        // Use getThumbnailUrl for "before" so RAW files display as WebP
        const beforeUrls: string[] = [];
        const afterUrls: string[] = [];
        for (const edit of visibleEdits) {
          const sourceImage = showcaseImages.find((img) => img.id === edit.image_id);
          if (sourceImage) {
            beforeUrls.push(getThumbnailUrl(sourceImage.original_url));
            afterUrls.push(edit.edited_url);
          }
        }

        const updateData: any = {
          before_image_urls: beforeUrls,
          after_image_urls: afterUrls,
        };
        if (!style.thumbnail_url && afterUrls.length > 0) {
          updateData.thumbnail_url = afterUrls[0];
        }

        const { error } = await supabase.from("styles").update(updateData).eq("id", style.id);
        if (error) console.error(`Failed to update style ${style.name}:`, error);
        else updated++;
      }

      toast.success(`Updated ${updated} styles with before/after images`);
      queryClient.invalidateQueries({ queryKey: ["preset-styles-showcase"] });
    } catch (err) {
      console.error("Apply error:", err);
      toast.error("Failed to apply results");
    } finally {
      setIsApplying(false);
    }
  };


  const handleDeleteEditPair = useCallback(async (styleId: string, imageId: string) => {
    setHiddenMap((prev) => {
      const list = prev[styleId] || [];
      if (!list.includes(imageId)) {
        const updated = { ...prev, [styleId]: [...list, imageId] };
        saveHiddenMap(updated);
        return updated;
      }
      return prev;
    });
    toast.success("Pair removed — it won't be included when applying to styles");
  }, []);

  if (galleryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Showcase Manager</h1>
        <p className="text-muted-foreground mt-1">
          Upload sample images, process through all styles, and manage before/after previews per style
        </p>
      </div>

      {/* Source Images - Link to Collection */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ImageIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Source Images</p>
                <p className="text-sm text-muted-foreground">
                  Manage images in the Showcase collection
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{showcaseImages.length} images</Badge>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/dashboard/galleries/${SHOWCASE_GALLERY_ID}`} className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open Collection
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Style Results */}
      {presetStyles.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Eye className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-lg">Style Results</CardTitle>
                  <CardDescription>Review and manage before/after pairs per style. Hide images that didn't edit well.</CardDescription>
                </div>
              </div>
              <Button onClick={handleApplyToStyles} disabled={isApplying} variant="glow" size="sm">
                {isApplying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                {isApplying ? "Applying..." : "Apply to Styles"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {presetStyles.map((style) => {
              const status = styleStatus[style.id];
              const isExpanded = expandedStyles.has(style.id);
              const editsForStyle = imageEdits.filter((e) => e.style_id === style.id);
              const hiddenIds = new Set(hiddenMap[style.id] || []);
              const hiddenCount = editsForStyle.filter((e) => hiddenIds.has(e.image_id)).length;

              return (
                <div key={style.id} className="border border-border rounded-lg overflow-hidden">
                  {/* Style Row */}
                  <div className="flex items-center">
                  <button
                    onClick={() => toggleExpanded(style.id)}
                    className="flex-1 flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left min-w-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="w-8 h-8 rounded overflow-hidden shrink-0">
                      <ImageWithFallback
                        src={style.thumbnail_url ? getThumbnailUrl(style.thumbnail_url) : ""}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{style.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {editsForStyle.length} / {status?.total || 0} images
                        {hiddenCount > 0 && <span className="text-yellow-500 ml-1">· {hiddenCount} hidden</span>}
                      </p>
                    </div>
                    {status?.status === "complete" && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                    {status?.status === "processing" && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                    {status?.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                  </button>
                  {(() => {
                    const newCount = unprocessedPerStyle[style.id] || 0;
                    const isStyleProcessing = processingStyleIds.has(style.id);
                    if (newCount === 0 && !isStyleProcessing) return null;
                    return (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mr-2 shrink-0"
                        disabled={isStyleProcessing}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProcessSingleStyle(style.id);
                        }}
                      >
                        {isStyleProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {isStyleProcessing ? "Processing..." : `Process ${newCount} New`}
                      </Button>
                    );
                  })()}
                  </div>

                  {/* Expanded: Before/After Grid */}
                  <AnimatePresence>
                    {isExpanded && editsForStyle.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {editsForStyle.map((edit) => {
                            const sourceImage = showcaseImages.find((img) => img.id === edit.image_id);
                            const isHidden = hiddenIds.has(edit.image_id);

                            return (
                              <div
                                key={edit.id}
                                className={cn(
                                  "relative rounded-lg border border-border overflow-hidden transition-opacity",
                                  isHidden && "opacity-40"
                                )}
                              >
                                <div className="grid grid-cols-2 aspect-[5/4]">
                                  <div className="relative">
                                    <ImageWithFallback
                                      src={sourceImage ? getThumbnailUrl(sourceImage.original_url) : ""}
                                      alt="Before"
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute bottom-1 left-1 text-[10px] font-medium bg-black/60 text-white px-1.5 py-0.5 rounded">Before</span>
                                  </div>
                                  <div className="relative">
                                    <ImageWithFallback
                                      src={getThumbnailUrl(edit.edited_url)}
                                      alt="After"
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute bottom-1 left-1 text-[10px] font-medium bg-black/60 text-white px-1.5 py-0.5 rounded">After</span>
                                  </div>
                                </div>
                                {/* Hide/Delete buttons */}
                                <div className="absolute top-1.5 right-1.5 flex gap-1">
                                  <button
                                    onClick={() => toggleHidden(style.id, edit.image_id)}
                                    className={cn(
                                      "p-1.5 rounded-md backdrop-blur-sm transition-colors",
                                      isHidden
                                        ? "bg-yellow-500/80 text-white"
                                        : "bg-background/60 text-foreground hover:bg-background/80"
                                    )}
                                    title={isHidden ? "Show this pair" : "Hide this pair"}
                                  >
                                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEditPair(style.id, edit.image_id)}
                                    className="p-1.5 rounded-md backdrop-blur-sm bg-destructive/70 text-white hover:bg-destructive/90 transition-colors"
                                    title="Delete this pair permanently"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {!overallProgress.allComplete && overallProgress.totalCompleted > 0 && (
              <div className="flex items-center gap-1 text-xs text-yellow-500 pt-2">
                <AlertCircle className="w-3 h-3" />
                <span>Partial results — you can still apply what's complete</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
