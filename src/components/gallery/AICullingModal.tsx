import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { X, Tag, Plus, Check, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Orb } from "@/components/aura/Orb";
import { Card } from "@/components/ui/card";

/** The AI mark — 4-point sparkle (logo star). Inherits currentColor. */
function Sparkle({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCullingLabels, supportedLanguages, type LanguageCode } from "@/lib/cullingLabels";
import { estimateCullingMs, formatCountdown, formatDuration } from "@/lib/cullingEta";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CullingRunOptions {
  tags: string[];      // category labels the model picks from
  cluster: boolean;    // group similar images
  faces: boolean;      // people / face recognition (heavier)
  // True when this is an explicit re-run on an already-fully-culled gallery
  // (no new photos). Scoring is skipped; the parent uses this to force a fresh
  // face re-detection so people clusters rebuild.
  redetect?: boolean;
}

interface AICullingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (opts: CullingRunOptions) => void;
  isProcessing: boolean;
  imageCount: number;
  showCullingRequiredNote?: boolean;
  cullingStatus?: string;
  isCullingStuck?: boolean;
  galleryType?: string | null;
  /** ISO timestamp of the in-flight culling run, used for elapsed time display. */
  cullingStartedAt?: string | null;
  /** True if this gallery already had a successful culling run.
   *  When set, we require an explicit confirm-checkbox before
   *  triggering another one — re-running overwrites ratings & labels
   *  and we don't want a single accidental click to wipe an hour of
   *  the photographer's manual review. */
  hasCompletedCulling?: boolean;
  /** ISO of when the last culling run finished. */
  cullingCompletedAt?: string | null;
  /** ISO of when the last upload batch finished. We compare this to
   *  cullingCompletedAt to know if the user has added more images
   *  since the last culling — if not, re-running is almost always a
   *  no-op and we steer them away from it. */
  uploadCompletedAt?: string | null;
  /** Per-gallery step defaults chosen at creation (seed the toggles). */
  defaultCluster?: boolean;
  defaultFaces?: boolean;
}

export function AICullingModal({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  imageCount,
  showCullingRequiredNote,
  cullingStatus = "idle",
  isCullingStuck = false,
  galleryType,
  cullingStartedAt = null,
  hasCompletedCulling = false,
  cullingCompletedAt = null,
  uploadCompletedAt = null,
  defaultCluster = true,
  defaultFaces = false,
}: AICullingModalProps) {
  const { user } = useAuth();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  // Photographer-chosen steps. Rating + tags always run (the core); grouping is on
  // by default; faces (people) is the heavier, opt-in step.
  const [doCluster, setDoCluster] = useState(defaultCluster);
  const [doFaces, setDoFaces] = useState(defaultFaces);
  // Re-seed from the gallery's saved prefs each time the modal opens.
  useEffect(() => {
    if (isOpen) { setDoCluster(defaultCluster); setDoFaces(defaultFaces); }
  }, [isOpen, defaultCluster, defaultFaces]);
  const [cullingLanguage, setCullingLanguage] = useState<LanguageCode>("en");
  const [languageLoaded, setLanguageLoaded] = useState(false);
  /** Tick every second so the countdown on the running button ticks
   *  smoothly. Cheap — runs only while the modal is open AND culling
   *  is in progress. */
  const [, setNowTick] = useState(0);
  useEffect(() => {
    if (cullingStatus !== "processing") return;
    const id = setInterval(() => setNowTick((t) => t + 1), 1_000);
    return () => clearInterval(id);
  }, [cullingStatus]);
  const isCurrentlyRunning = cullingStatus === "processing" && !isCullingStuck;
  const elapsedText = useMemo(() => {
    if (!cullingStartedAt) return "";
    const elapsedMs = Date.now() - new Date(cullingStartedAt).getTime();
    const minutes = Math.max(0, Math.floor(elapsedMs / 60_000));
    const seconds = Math.max(0, Math.floor((elapsedMs / 1000) % 60));
    return minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`;
  }, [cullingStartedAt, cullingStatus]);
  // Detect "nothing changed since last culling": last upload batch
  // completed before the last culling completion — every current photo
  // already has a rating.
  const noNewImagesSinceCulling =
    !!cullingCompletedAt &&
    (!uploadCompletedAt || new Date(uploadCompletedAt).getTime() <= new Date(cullingCompletedAt).getTime());

  // Fully lock re-running: once a gallery is completely culled with no new
  // photos, NOTHING re-runs — not scoring, not grouping, not faces. The whole
  // run is blocked. Adding new photos is the only thing that re-enables it (and
  // then it processes only those new photos). This is a deliberate policy choice
  // to avoid any accidental/wasteful re-runs on a finished gallery.
  const allAlreadyCulled = hasCompletedCulling && noNewImagesSinceCulling && !isCurrentlyRunning;

  // Estimated wall-clock for this run, shown next to the button so
  // users know what to expect ("up to ~3 min for 2,000 photos").
  const etaMs = useMemo(() => estimateCullingMs(imageCount), [imageCount]);
  const etaText = formatDuration(etaMs);
  // Live "X:XX" countdown shown ON the running button.
  const remainingMs = isCurrentlyRunning && cullingStartedAt
    ? Math.max(0, etaMs - (Date.now() - new Date(cullingStartedAt).getTime()))
    : etaMs;
  const countdownText = formatCountdown(remainingMs);

  // Fetch user's preferred language
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_subscriptions")
      .select("preferred_language")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.preferred_language) {
          setCullingLanguage(data.preferred_language as LanguageCode);
        }
        setLanguageLoaded(true);
      });
  }, [user]);

  // Get localized labels based on gallery type and language
  const labels = useMemo(() => {
    return getCullingLabels(galleryType || "wedding", cullingLanguage);
  }, [galleryType, cullingLanguage]);

  // Reset selections when language changes
  useEffect(() => {
    if (!languageLoaded) return;
    setSelectedTags([]);
  }, [cullingLanguage, languageLoaded]);

  // Save language preference when changed
  const handleLanguageChange = async (lang: LanguageCode) => {
    setCullingLanguage(lang);
    if (user) {
      await supabase
        .from("user_subscriptions")
        .update({ preferred_language: lang })
        .eq("user_id", user.id);
    }
  };

  const allLabels = useMemo(() => {
    const custom = selectedTags.filter(t => !labels.includes(t));
    return [...labels, ...custom];
  }, [labels, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (prev.length >= 20) return prev;
      return [...prev, tag];
    });
  };

  const handleSelectAll = () => {
    const allSelected = labels.every(l => selectedTags.includes(l));
    if (allSelected) {
      // Deselect all label-based tags, keep custom ones
      setSelectedTags(prev => prev.filter(t => !labels.includes(t)));
    } else {
      // Select all labels (up to 20 cap)
      setSelectedTags(prev => {
        const custom = prev.filter(t => !labels.includes(t));
        const remaining = 20 - custom.length;
        return [...custom, ...labels.slice(0, remaining)];
      });
    }
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed && !selectedTags.includes(trimmed) && selectedTags.length < 20) {
      setSelectedTags(prev => [...prev, trimmed]);
      setCustomTag("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomTag();
    }
  };

  const handleConfirm = () => {
    // When the photographer picked no categories, fall back to the curated
    // shoot-type label set (same behaviour as the create-gallery wizard) so the
    // model always culls against sensible topics instead of the pipeline's
    // stale built-in defaults.
    const tags = selectedTags.length > 0 ? selectedTags : labels;
    onConfirm({ tags, cluster: doCluster, faces: doFaces, redetect: allAlreadyCulled });
  };

  const handleClose = () => {
    setSelectedTags([]);
    setCustomTag("");
    onClose();
  };

  const allLabelsSelected = labels.length > 0 && labels.every(l => selectedTags.includes(l));

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="glass-card border-border rounded-[--radius] p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Orb className="w-10 h-10 shrink-0" />
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkle size={16} className="text-primary" />
                  AI Culling
                </h2>
                <p className="aura-microlabel mt-0.5">
                  Analyze <span className="folio text-foreground">{imageCount}</span> images
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Culling Processing Note */}
          {cullingStatus === "processing" && !isCullingStuck && (
            <div className="p-3 rounded-sm bg-rating/10 border border-rating/25 mb-4">
              <p className="text-sm text-rating font-medium">
                ⏳ AI Culling is currently in progress. Please wait for it to finish before running again.
              </p>
            </div>
          )}

          {/* Culling Stuck Note */}
          {cullingStatus === "processing" && isCullingStuck && (
            <div className="p-3 rounded-sm bg-rating/10 border border-rating/25 mb-4">
              <p className="text-sm text-rating font-medium">
                ⚠️ AI Culling seems stuck. You can try running it again.
              </p>
            </div>
          )}

          {/* Culling Required Note */}
          {showCullingRequiredNote && cullingStatus !== "processing" && cullingStatus !== "ready" && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
              <p className="text-sm text-primary font-medium">
                ⭐ Star ratings and duplicate detection are only available after running AI Culling
              </p>
            </div>
          )}

          {/* Description — only relevant when scoring will actually run. */}
          {!allAlreadyCulled && (
            <div className="p-4 rounded-[--radius] surface-2 border border-border/60 mb-4">
              <p className="text-sm text-muted-foreground">
                AI Culling will analyze your images and provide:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Quality ratings (1-5 stars) & smart tags</li>
                <li>• Category for each photo</li>
              </ul>
            </div>
          )}

          {/* Steps the photographer can toggle. Rating + tags always run; grouping
              and people (faces) are optional. Model/timing are admin settings.
              Hidden once the gallery is fully culled — nothing re-runs then. */}
          {!allAlreadyCulled && (
          <div className="mb-6 space-y-2">
            <label className="flex items-center justify-between p-3 rounded-[--radius] surface-2 border border-border/60 cursor-pointer">
              <span className="text-sm text-foreground">Group similar images</span>
              <input type="checkbox" checked={doCluster} onChange={(e) => setDoCluster(e.target.checked)}
                className="w-4 h-4 rounded accent-primary" disabled={isCurrentlyRunning} />
            </label>
            <label className="flex items-center justify-between p-3 rounded-[--radius] surface-2 border border-border/60 cursor-pointer">
              <span className="text-sm text-foreground">
                Recognize people (faces)
                <span className="ms-2 text-xs text-muted-foreground">heavier step</span>
              </span>
              <input type="checkbox" checked={doFaces} onChange={(e) => setDoFaces(e.target.checked)}
                className="w-4 h-4 rounded accent-primary" disabled={isCurrentlyRunning} />
            </label>
          </div>
          )}

          {/* Tag Selection — only when scoring will run (topics guide the VLM). */}
          {!allAlreadyCulled && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                <span className="font-medium">Select Topics ({selectedTags.length}/20)</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <Select value={cullingLanguage} onValueChange={(v) => handleLanguageChange(v as LanguageCode)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs bg-muted/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedLanguages.map(lang => (
                      <SelectItem key={lang.code} value={lang.code} className="text-xs">
                        {lang.name} ({lang.englishName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                Choose relevant topics to improve AI accuracy
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={handleSelectAll}
              >
                {allLabelsSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
            
            {/* Labels */}
            <div className="flex flex-wrap gap-2 mb-4">
              {allLabels.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  disabled={selectedTags.length >= 20 && !selectedTags.includes(tag)}
                  className={cn(
                    "px-3 py-1.5 rounded-sm text-sm font-medium transition-all border",
                    selectedTags.includes(tag)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "surface-2 border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
                    selectedTags.length >= 20 && !selectedTags.includes(tag) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {selectedTags.includes(tag) && (
                    <Check className="w-3 h-3 inline mr-1" />
                  )}
                  {tag}
                </button>
              ))}
            </div>

            {/* Custom Tag Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Add custom topic..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyPress={handleKeyPress}
                className="bg-muted/50 border-border/50"
                disabled={selectedTags.length >= 20}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={addCustomTag}
                disabled={!customTag.trim() || selectedTags.length >= 20}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          )}

          {/* In-progress panel — shown ONLY when culling is currently
              running (status=processing && not stuck). Replaces the
              action buttons with status info so users can't click
              'Start' a second time and trigger a duplicate API call. */}
          {isCurrentlyRunning && (
            <div className="flex items-start gap-3 p-4 mb-4 rounded-[--radius] border border-primary/30 bg-primary/5">
              <Orb className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  AI Culling already in progress
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {elapsedText && <>Elapsed: <span className="text-foreground font-medium">{elapsedText}</span>. </>}
                  Estimated total <span className="text-foreground font-medium">{etaText}</span> for{" "}
                  {imageCount.toLocaleString()} photos. You can close this dialog —
                  we'll update the gallery automatically when it completes.
                </p>
              </div>
            </div>
          )}

          {/* Fully-culled note. Once every photo is culled and nothing new was
              added, the whole run is locked — no scoring, grouping or faces
              re-run. Adding photos is what re-enables it. */}
          {allAlreadyCulled && (
            <div className="flex items-start gap-3 p-4 mb-4 rounded-sm border border-border/60 surface-2">
              <Check className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  This gallery is fully culled
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every photo already has an AI rating and no new photos were
                  added, so there's nothing to run. Add photos to cull new ones.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            {!isCurrentlyRunning && !allAlreadyCulled && (
              <span className="text-xs text-muted-foreground mr-auto">
                Estimated time: <span className="text-foreground font-medium">~{etaText}</span> for{" "}
                {imageCount.toLocaleString()} photos
              </span>
            )}
            <Button variant="outline" onClick={handleClose}>
              {isCurrentlyRunning ? "Close" : "Cancel"}
            </Button>
            <Button
              variant="glow"
              onClick={handleConfirm}
              disabled={isProcessing || isCurrentlyRunning || allAlreadyCulled}
              aria-busy={isCurrentlyRunning || undefined}
              className="gap-2 min-w-[180px]"
            >
              {isCurrentlyRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running… <span className="tabular-nums font-mono">{countdownText}</span>
                </>
              ) : isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : allAlreadyCulled ? (
                <>
                  <Sparkle size={15} className="text-current" />
                  Nothing to run
                </>
              ) : hasCompletedCulling ? (
                <>
                  <Sparkle size={15} className="text-current" />
                  Cull new photos
                </>
              ) : (
                <>
                  <Sparkle size={15} className="text-current" />
                  Start AI Culling
                </>
              )}
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
