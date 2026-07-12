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
  Star,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  // Styles whose edits are dispatched and still landing (drives the live
  // "processing now" state; cleared automatically when a style's edits reach
  // the image count).
  const [processingStyleIds, setProcessingStyleIds] = useState<Set<string>>(new Set());
  // Which styles the admin has ticked for a bulk run.
  const [selectedStyleIds, setSelectedStyleIds] = useState<Set<string>>(new Set());
  // How many image×style edits the last dispatch sent per style (this session)
  // — answers "how many were sent to editing".
  const [sentCounts, setSentCounts] = useState<Record<string, number>>({});
  const [isApplying, setIsApplying] = useState(false);
  const [hiddenMap, setHiddenMap] = useState<HiddenMap>(loadHiddenMap);
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());

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
    refetchInterval: (isProcessing || processingStyleIds.size > 0) ? 4000 : false,
  });

  // Style status. "processing" is authoritative from processingStyleIds (a
  // style we actually dispatched and is still landing) — NOT merely
  // "partially done", which would pin a half-finished historic style as
  // "processing" forever.
  const styleStatus = useMemo(() => {
    const map: Record<string, { completed: number; total: number; status: "idle" | "processing" | "complete" }> = {};
    const imageCount = showcaseImages.length;

    presetStyles.forEach((style) => {
      const completed = imageEdits.filter((e) => e.style_id === style.id).length;
      let status: "idle" | "processing" | "complete" = "idle";
      if (processingStyleIds.has(style.id)) status = "processing";
      else if (imageCount > 0 && completed >= imageCount) status = "complete";
      map[style.id] = { completed, total: imageCount, status };
    });
    return map;
  }, [presetStyles, imageEdits, showcaseImages, processingStyleIds]);

  // Clear a style from the in-flight set once its edits reach the image count.
  useEffect(() => {
    if (processingStyleIds.size === 0 || showcaseImages.length === 0) return;
    setProcessingStyleIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const sid of prev) {
        const completed = imageEdits.filter((e) => e.style_id === sid).length;
        if (completed >= showcaseImages.length) { next.delete(sid); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [imageEdits, showcaseImages, processingStyleIds]);

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

  // Images this style still needs an edit for. This is THE smart filter — the
  // engine only ever receives photos it hasn't edited in this style, so no
  // photo is ever re-edited (the backend also dedups per (image,style), a
  // second guard).
  const unprocessedForStyle = useCallback((styleId: string) => {
    const processed = new Set(imageEdits.filter((e) => e.style_id === styleId).map((e) => e.image_id));
    return showcaseImages.filter((img) => !processed.has(img.id));
  }, [imageEdits, showcaseImages]);

  const handleProcessSingleStyle = async (styleId: string) => {
    if (!showcaseGallery?.id || showcaseImages.length === 0) return;

    const imageIds = unprocessedForStyle(styleId).map((img) => img.id);
    if (imageIds.length === 0) {
      toast.info("All images already edited for this style");
      return;
    }

    setProcessingStyleIds((prev) => new Set(prev).add(styleId));
    setSentCounts((prev) => ({ ...prev, [styleId]: imageIds.length }));

    try {
      const { error } = await supabase.functions.invoke("process-images", {
        body: { galleryId: showcaseGallery.id, imageIds, styleIds: [styleId] },
      });
      if (error) throw error;
      toast.success(`Sent ${imageIds.length} new image(s) to editing for this style`);
      queryClient.invalidateQueries({ queryKey: ["showcase-edits"] });
    } catch {
      toast.error("Failed to start processing");
      setProcessingStyleIds((prev) => { const n = new Set(prev); n.delete(styleId); return n; });
    }
  };

  // ── Bulk: process only the SELECTED styles, only their new images ──
  const processSelected = async () => {
    if (!showcaseGallery?.id) return;
    const styleIds = [...selectedStyleIds];
    if (styleIds.length === 0) { toast.info("Tick at least one style first"); return; }

    // Union of images that need at least one of the selected styles, plus a
    // per-style "will send" count. The engine skips any (image,style) already
    // edited, so a photo already done in style A but new to style B is sent
    // once and only edited for B.
    const imageIdSet = new Set<string>();
    const perStyleSent: Record<string, number> = {};
    for (const sid of styleIds) {
      const todo = unprocessedForStyle(sid);
      perStyleSent[sid] = todo.length;
      todo.forEach((img) => imageIdSet.add(img.id));
    }
    const imageIds = [...imageIdSet];
    if (imageIds.length === 0) {
      toast.info("Everything selected is already edited — nothing new to send.");
      return;
    }

    setProcessingStyleIds((prev) => new Set([...prev, ...styleIds.filter((s) => perStyleSent[s] > 0)]));
    setSentCounts((prev) => ({ ...prev, ...perStyleSent }));

    try {
      const { error } = await supabase.functions.invoke("process-images", {
        body: { galleryId: showcaseGallery.id, imageIds, styleIds },
      });
      if (error) throw error;
      const totalPairs = Object.values(perStyleSent).reduce((a, b) => a + b, 0);
      toast.success(`Sent ${totalPairs} new image×style edit(s) across ${styleIds.filter((s) => perStyleSent[s] > 0).length} style(s)`);
      queryClient.invalidateQueries({ queryKey: ["showcase-edits"] });
    } catch {
      toast.error("Failed to start processing");
      setProcessingStyleIds((prev) => { const n = new Set(prev); styleIds.forEach((s) => n.delete(s)); return n; });
    }
  };

  const toggleSelect = useCallback((styleId: string) => {
    setSelectedStyleIds((prev) => {
      const n = new Set(prev);
      n.has(styleId) ? n.delete(styleId) : n.add(styleId);
      return n;
    });
  }, []);

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


  // Pick which edited image represents the style (its card/preview cover).
  // Writes thumbnail_url, which resolveStyleCover now prioritises so the choice
  // sticks across every picker and the public style library.
  const handleSetCover = useCallback(async (styleId: string, afterUrl: string) => {
    const { error } = await supabase.from("styles").update({ thumbnail_url: afterUrl } as never).eq("id", styleId);
    if (error) {
      console.error("Set cover error:", error);
      toast.error("Failed to set cover image");
      return;
    }
    toast.success("Cover image updated");
    queryClient.invalidateQueries({ queryKey: ["preset-styles-showcase"] });
    queryClient.invalidateQueries({ queryKey: ["showcase-covers"] });
    queryClient.invalidateQueries({ queryKey: ["styles"] });
  }, [queryClient]);

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Showcase Manager</h1>
        <p className="caption mt-1.5 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-accent" />
          Upload sample images, process through all styles, and manage before/after previews per style
        </p>
      </div>

      {/* Source Images - Link to Collection */}
      <div className="glass-card overflow-hidden rounded-[--radius]">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-[--radius] bg-primary/10 p-2">
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
            <Badge variant="secondary"><span className="folio">{showcaseImages.length}</span>&nbsp;images</Badge>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/dashboard/galleries/${SHOWCASE_GALLERY_ID}`} className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Open Collection
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Style Results */}
      {presetStyles.length > 0 && (
        <div className="glass-card overflow-hidden rounded-[--radius]">
          {/* Mono module header with AI action */}
          <div className="flex items-center justify-between gap-3 border-b border-border bg-primary/[0.06] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-accent" />
              <div>
                <span className="aura-microlabel text-accent">Style Results</span>
                <p className="mt-0.5 text-xs text-muted-foreground">Review and manage before/after pairs per style. Hide images that didn't edit well.</p>
              </div>
            </div>
            <Button onClick={handleApplyToStyles} disabled={isApplying} variant="glow" size="sm">
              {isApplying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              {isApplying ? "Applying..." : "Save previews to styles"}
            </Button>
          </div>

          {/* Selection toolbar — tick styles, then process only their NEW images */}
          {(() => {
            const allSelected = presetStyles.length > 0 && presetStyles.every((s) => selectedStyleIds.has(s.id));
            const stylesWithNew = presetStyles.filter((s) => (unprocessedPerStyle[s.id] || 0) > 0);
            const selectedNewTotal = [...selectedStyleIds].reduce((sum, id) => sum + (unprocessedPerStyle[id] || 0), 0);
            const processingNames = presetStyles.filter((s) => processingStyleIds.has(s.id)).map((s) => s.name);
            return (
              <div className="space-y-2 border-b border-border bg-background/40 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() => setSelectedStyleIds(allSelected ? new Set() : new Set(presetStyles.map((s) => s.id)))}
                    />
                    Select all
                  </label>
                  <span className="text-xs text-muted-foreground">{selectedStyleIds.size} selected</span>
                  {stylesWithNew.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setSelectedStyleIds(new Set(stylesWithNew.map((s) => s.id)))}
                    >
                      Select {stylesWithNew.length} with new images
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {selectedStyleIds.size > 0 && (
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedStyleIds(new Set())}>
                        Clear
                      </button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={selectedStyleIds.size === 0 || selectedNewTotal === 0}
                      onClick={processSelected}
                      title="Sends only images not yet edited in each selected style — never re-edits."
                    >
                      <Play className="h-3.5 w-3.5" />
                      Process selected{selectedNewTotal > 0 ? ` (${selectedNewTotal} new)` : ""}
                    </Button>
                  </div>
                </div>
                {processingNames.length > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-accent">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing now: {processingNames.slice(0, 4).join(", ")}{processingNames.length > 4 ? ` +${processingNames.length - 4}` : ""}
                  </p>
                )}
              </div>
            );
          })()}

          <div className="space-y-2 p-4">
            {presetStyles.map((style) => {
              const status = styleStatus[style.id];
              const isExpanded = expandedStyles.has(style.id);
              const editsForStyle = imageEdits.filter((e) => e.style_id === style.id);
              const hiddenIds = new Set(hiddenMap[style.id] || []);
              const hiddenCount = editsForStyle.filter((e) => hiddenIds.has(e.image_id)).length;

              return (
                <div key={style.id} className={cn("border rounded-lg overflow-hidden transition-colors", selectedStyleIds.has(style.id) ? "border-primary/50 bg-primary/[0.04]" : "border-border")}>
                  {/* Style Row */}
                  <div className="flex items-center">
                  {/* Real selection checkbox (was a non-interactive status dot). */}
                  <div className="pl-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedStyleIds.has(style.id)}
                      onCheckedChange={() => toggleSelect(style.id)}
                      aria-label={`Select ${style.name}`}
                    />
                  </div>
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
                      <p className="font-mono text-xs text-muted-foreground">
                        {editsForStyle.length} / {status?.total || 0} edited
                        {(unprocessedPerStyle[style.id] || 0) > 0 && <span className="ml-1 text-[hsl(var(--rating))]">· {unprocessedPerStyle[style.id]} new</span>}
                        {sentCounts[style.id] > 0 && <span className="ml-1 text-accent">· sent {sentCounts[style.id]}</span>}
                        {hiddenCount > 0 && <span className="ml-1 text-[hsl(var(--rating))]">· {hiddenCount} hidden</span>}
                      </p>
                    </div>
                    {status?.status === "processing"
                      ? <span className="flex items-center gap-1 text-[10px] font-medium text-accent shrink-0"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing</span>
                      : status?.status === "complete"
                        ? <span className="flex items-center gap-1 text-[10px] font-medium text-secondary shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> Complete</span>
                        : <span className="text-[10px] font-medium text-muted-foreground/60 shrink-0">Idle</span>}
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
                                {/* Set-as-cover / Hide / Delete buttons */}
                                <div className="absolute top-1.5 right-1.5 flex gap-1">
                                  <button
                                    onClick={() => handleSetCover(style.id, edit.edited_url)}
                                    className={cn(
                                      "p-1.5 rounded-md backdrop-blur-sm transition-colors",
                                      style.thumbnail_url === edit.edited_url
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-background/60 text-foreground hover:bg-background/80"
                                    )}
                                    title={style.thumbnail_url === edit.edited_url ? "Cover image" : "Set as cover"}
                                  >
                                    <Star className={cn("w-3.5 h-3.5", style.thumbnail_url === edit.edited_url && "fill-current")} />
                                  </button>
                                  <button
                                    onClick={() => toggleHidden(style.id, edit.image_id)}
                                    className={cn(
                                      "p-1.5 rounded-md backdrop-blur-sm transition-colors",
                                      isHidden
                                        ? "bg-[hsl(var(--rating))] text-white"
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
              <div className="flex items-center gap-1.5 pt-2 font-mono text-xs text-[hsl(var(--rating))]">
                <AlertCircle className="w-3 h-3" />
                <span>Partial results — you can still apply what's complete</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
