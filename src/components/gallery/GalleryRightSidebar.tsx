import { useEffect, useMemo, useState } from "react";
import { Layers, Star, Images, Wand2, Filter, Heart, Share2, Settings, Loader2, Tag, Check, RotateCcw, X, Download, Copy, Info, Clock, Upload, ImageIcon, Scissors, ScanFace, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import { estimateCullingMs, formatCountdown } from "@/lib/cullingEta";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { FilterOptions } from "@/components/gallery/filter-types";

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

// Culling rating tiers
const CULLING_TIERS = [
  { stars: 5, label: "Top Picks", color: "text-rating" },
  { stars: 4, label: "Strong Candidates", color: "text-rating/80" },
  { stars: 3, label: "Decent Options", color: "text-muted-foreground" },
  { stars: 2, label: "Less Relevant", color: "text-muted-foreground" },
  { stars: 1, label: "Not Recommended", color: "text-muted-foreground" },
] as const;

// Style color palette for visual distinction
const STYLE_COLORS = [
  "bg-primary",
  "bg-secondary",
  "bg-green-500",
  "bg-blue-500",
  "bg-orange-500",
  "bg-cyan-500",
];

type AccordionId = "styles" | "filter" | "info";

const SIDEBAR_OPEN_STATE_KEY = "imagick.gallery-sidebar-open-sections";

interface GalleryRightSidebarProps {
  // Applied Styles
  availableStyles: Array<{ id: string; name: string; apiId?: string; coverUrl?: string }>;
  selectedStyle: string;
  onStyleChange: (styleId: string) => void;

  // Culling data
  hasCullingData: boolean;
  cullingCounts: Record<number, number>;

  // Similar Images / Grouping
  similarityLevel: "loose" | "medium" | "strict";
  onSimilarityLevelChange: (level: "loose" | "medium" | "strict") => void;
  duplicateLimit: number;
  onDuplicateLimitChange: (limit: number) => void;
  groupCounts: { loose: number; medium: number; strict: number };

  // Action callbacks
  onAddImages?: () => void;
  onRunCulling?: () => void;
  isCullingRunning?: boolean;
  isCullingStuck?: boolean;
  /** Culling was opted-in at creation and will auto-start when upload finishes —
   *  it's queued, not idle, so don't offer an actionable "Run AI Culling". */
  isCullingQueued?: boolean;
  /** ISO timestamp of when the in-flight culling run started.
   *  Used to render the live X:XX countdown on the running button. */
  cullingStartedAt?: string | null;
  /** Photo count for the gallery — needed to compute the ETA the
   *  countdown counts down from. */
  cullingImageCount?: number;
  hasActiveFilters?: boolean;

  // Face search
  onOpenFaceSearch?: () => void;
  faceSearchStatus?: string;

  // New props
  onShare?: () => void;
  onChooseClientPhotos?: () => void;
  onToggleLikedFilter?: () => void;
  isLikedFilterActive?: boolean;
  onOpenSettings?: () => void;
  onDownload?: () => void;
  filters?: FilterOptions;
  onFiltersChange?: (filters: FilterOptions) => void;
  availableTags?: string[];

  // Label filtering
  availableLabels?: Array<{ label: string; count: number }>;

  // Gallery analytics
  canViewAnalytics?: boolean;
  galleryTimingData?: {
    createdAt: string | null;
    uploadStartedAt: string | null;
    uploadCompletedAt: string | null;
    processingStartedAt: string | null;
    processingCompletedAt: string | null;
    cullingStartedAt: string | null;
    cullingCompletedAt: string | null;
    sourceType: "google" | "upload";
    totalImages: number;
  };

  // Processing progress
  processingStats?: {
    total: number;
    ready: number;
    processing: number;
    error: number;
    percentage: number;
  };

  className?: string;
  isMobileSheet?: boolean;
}

export function GalleryRightSidebar({
  availableStyles,
  selectedStyle,
  onStyleChange,
  hasCullingData,
  cullingCounts,
  similarityLevel,
  onSimilarityLevelChange,
  duplicateLimit,
  onDuplicateLimitChange,
  groupCounts,
  onAddImages,
  onRunCulling,
  isCullingRunning,
  isCullingStuck,
  isCullingQueued,
  cullingStartedAt,
  cullingImageCount = 0,
  hasActiveFilters,
  onOpenFaceSearch,
  faceSearchStatus,
  onShare,
  onChooseClientPhotos,
  onToggleLikedFilter,
  isLikedFilterActive,
  onOpenSettings,
  onDownload,
  filters,
  onFiltersChange,
  availableTags = [],
  availableLabels = [],
  canViewAnalytics,
  galleryTimingData,
  processingStats,
  className,
  isMobileSheet,
}: GalleryRightSidebarProps) {
  // 1-second tick while culling is running so the X:XX countdown on
  // the AI Features button keeps moving. No-op when idle.
  const [, setCullingTick] = useState(0);
  useEffect(() => {
    if (!isCullingRunning) return;
    const t = setInterval(() => setCullingTick((v) => v + 1), 1_000);
    return () => clearInterval(t);
  }, [isCullingRunning]);

  const cullingEtaMs = useMemo(() => estimateCullingMs(cullingImageCount), [cullingImageCount]);
  const cullingRemainingMs = isCullingRunning && cullingStartedAt
    ? Math.max(0, cullingEtaMs - (Date.now() - new Date(cullingStartedAt).getTime()))
    : 0;
  const cullingCountdown = formatCountdown(cullingRemainingMs);

  // Persist accordion open state + collapsed mode across reloads.
  const [openSections, setOpenSections] = useState<Set<AccordionId>>(() => {
    if (typeof window === "undefined") return new Set(["styles", "filter"]);
    try {
      const raw = window.localStorage.getItem(SIDEBAR_OPEN_STATE_KEY);
      if (!raw) return new Set(["styles", "filter"]);
      return new Set(JSON.parse(raw) as AccordionId[]);
    } catch {
      return new Set(["styles", "filter"]);
    }
  });
  const totalCullingImages = Object.values(cullingCounts).reduce((a, b) => a + b, 0);

  const allStyles = [
    { id: "original", name: "Original", apiId: undefined },
    ...availableStyles,
  ];

  const toggleAccordion = (id: AccordionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(SIDEBAR_OPEN_STATE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  };

  // Count discrete filters that are non-default. Used for the badge
  // on the FILTER section header so the user can see at a glance that
  // some filters are restricting the grid even when the section is
  // collapsed.
  const activeFilterCount = filters
    ? (filters.selectedRatings.length > 0 ? 1 : 0) +
      (filters.minRating > 0 ? 1 : 0) +
      (filters.showLikedOnly ? 1 : 0) +
      (filters.showHeroOnly ? 1 : 0) +
      (filters.showKeeperOnly ? 1 : 0) +
      (filters.eyesOpenOnly ? 1 : 0) +
      (filters.hideIssues ? 1 : 0) +
      (filters.showPeopleOnly ? 1 : 0) +
      (filters.selectedTags.length > 0 ? 1 : 0) +
      (filters.selectedLabels.length > 0 ? 1 : 0) +
      (filters.groupingLevel !== "none" ? 1 : 0) +
      (duplicateLimit !== 0 ? 1 : 0)
    : 0;

  // In mobile sheet mode, always show expanded content
  if (isMobileSheet) {
    return (
      <div className={cn("flex flex-col h-full min-h-0", className)}>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-4">
            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {onAddImages && (
                <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={onAddImages}>
                  <Images className="w-3.5 h-3.5" />
                  Add Images
                </Button>
              )}
              {onRunCulling && (
                <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={onRunCulling} disabled={isCullingRunning || isCullingQueued}>
                  {isCullingRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isCullingQueued ? <Clock className="w-3.5 h-3.5 text-primary" /> : <Sparkle size={13} className="text-primary" />}
                  {isCullingQueued ? "Culling queued" : "AI Culling"}
                </Button>
              )}
              {onOpenFaceSearch && (
                <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={onOpenFaceSearch}>
                  {faceSearchStatus === "processing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanFace className="w-3.5 h-3.5" />}
                  Faces
                </Button>
              )}
            </div>
            <Separator />
            <StylesPanel allStyles={allStyles} selectedStyle={selectedStyle} onStyleChange={onStyleChange} />
            <Separator />
            {filters && onFiltersChange && (
              <UnifiedFilterPanel
                hasCullingData={hasCullingData}
                cullingCounts={cullingCounts}
                totalCullingImages={totalCullingImages}
                filters={filters}
                onFiltersChange={onFiltersChange}
                availableLabels={availableLabels}
                availableTags={availableTags}
                similarityLevel={similarityLevel}
                onSimilarityLevelChange={onSimilarityLevelChange}
                duplicateLimit={duplicateLimit}
                onDuplicateLimitChange={onDuplicateLimitChange}
                groupCounts={groupCounts}
                onRunCulling={onRunCulling}
                isCullingRunning={isCullingRunning}
                isCullingStuck={isCullingStuck}
                isCullingQueued={isCullingQueued}
                cullingCountdown={cullingCountdown}
                onToggleLikedFilter={onToggleLikedFilter}
              />
            )}
            {canViewAnalytics && galleryTimingData && (
              <>
                <Separator />
                <GalleryInfoPanel data={galleryTimingData} processingStats={processingStats} />
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Always-expanded sidebar with stacked accordion sections. Power-
  // user collapse-to-icons mode was removed because the user reported
  // bare icons aren't intuitive — every action button needs a label.
  //
  // Layout note: we use CSS grid `[auto, minmax(0,1fr), auto]` rather
  // than flex-col + flex-1 + min-h-0. The flex pattern was leaving the
  // pinned-bottom Actions strip clipped on shorter viewports because
  // some path was letting the middle ScrollArea's intrinsic height
  // win. Grid with explicit `minmax(0,1fr)` GUARANTEES the middle row
  // takes exactly the remaining space and never expands the parent.
  return (
    <div
      className={cn(
        "shrink-0 border-l border-border/50 glass-card grid grid-rows-[auto_minmax(0,1fr)_auto] w-[340px] h-full",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <Sparkle size={13} className="text-primary" />
        <span className="caption text-foreground">Develop</span>
      </div>

      <div className="overflow-y-auto min-h-0">
        <div className="p-3 space-y-3">
          {/* ── VIEW: Styles ── */}
          <SidebarSection
            title="View"
            id="styles"
            icon={<Layers className="w-3.5 h-3.5" />}
            badge={selectedStyle !== "original" ? "1" : undefined}
            isOpen={openSections.has("styles")}
            onToggle={() => toggleAccordion("styles")}
          >
            <StylesPanel allStyles={allStyles} selectedStyle={selectedStyle} onStyleChange={onStyleChange} />
          </SidebarSection>

          {/* ── FILTER ── */}
          {filters && onFiltersChange && (
            <SidebarSection
              title="Filter"
              id="filter"
              icon={<Filter className="w-3.5 h-3.5" />}
              badge={activeFilterCount > 0 ? String(activeFilterCount) : undefined}
              isOpen={openSections.has("filter")}
              onToggle={() => toggleAccordion("filter")}
            >
              <UnifiedFilterPanel
                hasCullingData={hasCullingData}
                cullingCounts={cullingCounts}
                totalCullingImages={totalCullingImages}
                filters={filters}
                onFiltersChange={onFiltersChange}
                availableLabels={availableLabels}
                availableTags={availableTags}
                similarityLevel={similarityLevel}
                onSimilarityLevelChange={onSimilarityLevelChange}
                duplicateLimit={duplicateLimit}
                onDuplicateLimitChange={onDuplicateLimitChange}
                groupCounts={groupCounts}
                onRunCulling={onRunCulling}
                isCullingRunning={isCullingRunning}
                isCullingStuck={isCullingStuck}
                isCullingQueued={isCullingQueued}
                cullingCountdown={cullingCountdown}
                onToggleLikedFilter={onToggleLikedFilter}
              />
            </SidebarSection>
          )}

          {/* ── INFO (admin only) ── */}
          {canViewAnalytics && galleryTimingData && (
            <SidebarSection
              title="Info"
              id="info"
              icon={<Info className="w-3.5 h-3.5" />}
              isOpen={openSections.has("info")}
              onToggle={() => toggleAccordion("info")}
            >
              <GalleryInfoPanel data={galleryTimingData} processingStats={processingStats} />
            </SidebarSection>
          )}
        </div>
      </div>

      {/* ── ACTIONS: pinned bottom strip ─────────────────────────────
          Labelled buttons in a 2-column grid so users can read what
          each one does (the previous icon-only strip was the main
          'not intuitive' complaint). Grouped by purpose:
          – content management: Add, AI Cull, Faces
          – delivery: Share, Download
          – admin: Settings
        */}
      <div className="border-t border-border/30 px-3 py-2 space-y-1.5">
        <div className="aura-microlabel px-1">
          Actions
        </div>
        <div className="grid grid-cols-2 gap-1">
          {onAddImages && (
            <ActionButton icon={<Images className="w-3 h-3" />} label="Add photos" onClick={onAddImages} />
          )}
          {onRunCulling && (
            <ActionButton
              icon={
                isCullingRunning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : isCullingStuck ? (
                  <Sparkle size={12} className="text-rating" />
                ) : (
                  <Sparkle size={12} className="text-primary" />
                )
              }
              label="AI Culling"
              onClick={onRunCulling}
              disabled={isCullingRunning}
            />
          )}
          {onOpenFaceSearch && (
            <ActionButton
              icon={
                faceSearchStatus === "processing" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : faceSearchStatus === "completed" ? (
                  <ScanFace className="w-3 h-3 text-secondary" />
                ) : (
                  <ScanFace className="w-3 h-3" />
                )
              }
              label="Faces"
              onClick={onOpenFaceSearch}
            />
          )}
          {onDownload && (
            <ActionButton icon={<Download className="w-3 h-3" />} label="Download" onClick={onDownload} />
          )}
          {onOpenSettings && (
            <ActionButton icon={<Settings className="w-3 h-3" />} label="Settings" onClick={onOpenSettings} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Accordion-style section with header chevron + badge ─────────── */
function SidebarSection({
  title,
  icon,
  badge,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  id: AccordionId;
  icon: React.ReactNode;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[--radius] border border-border/50 surface-1 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 surface-2 hover:bg-muted/40 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="caption flex items-center gap-2 text-muted-foreground">
          {icon}
          {title}
          {badge && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-sm bg-primary text-primary-foreground text-[10px] font-bold leading-none folio">
              {badge}
            </span>
          )}
        </span>
        <span
          className={cn(
            "text-muted-foreground transition-transform duration-150",
            isOpen ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {isOpen && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

/* ── Action button (icon + label, in 2-col grid at bottom) ───────── */
function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 justify-start gap-1.5 text-[11px] font-medium px-2"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
}

/* ── Styles Panel ── */
function StylesPanel({
  allStyles,
  selectedStyle,
  onStyleChange,
}: {
  allStyles: Array<{ id: string; name: string; apiId?: string; coverUrl?: string }>;
  selectedStyle: string;
  onStyleChange: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      {allStyles.map((style, i) => {
        const isSelected = selectedStyle === style.id;
        const isOriginal = style.id === "original";
        const color = isOriginal ? "bg-muted-foreground" : STYLE_COLORS[i % STYLE_COLORS.length];

        return (
          <button
            key={style.id}
            className={cn(
              "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all text-left",
              isSelected
                ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            onClick={() => onStyleChange(style.id)}
          >
            {/* Thumbnail or color dot */}
            {style.coverUrl ? (
              <div className={cn(
                "w-8 h-8 rounded-full shrink-0 overflow-hidden ring-2 transition-all",
                isSelected ? "ring-primary" : "ring-border/50"
              )}>
                <img
                  src={style.coverUrl}
                  alt={style.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className={cn(
                  "w-8 h-8 rounded-full shrink-0 flex items-center justify-center ring-2 transition-all",
                  isSelected ? "ring-primary" : "ring-border/50",
                  isOriginal ? "bg-muted" : `${color}/20`
                )}
              >
                {isOriginal ? (
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <Sparkle size={14} className={color.replace("bg-", "text-")} />
                )}
              </div>
            )}
            <span className="truncate flex-1 font-medium">{style.name}</span>
            {isSelected && (
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Unified Filter Panel ── */
function UnifiedFilterPanel({
  hasCullingData,
  cullingCounts,
  totalCullingImages,
  filters,
  onFiltersChange,
  availableLabels,
  availableTags,
  similarityLevel,
  onSimilarityLevelChange,
  duplicateLimit,
  onDuplicateLimitChange,
  groupCounts,
  onRunCulling,
  isCullingRunning,
  isCullingStuck,
  isCullingQueued,
  cullingCountdown,
  onToggleLikedFilter,
}: {
  hasCullingData: boolean;
  cullingCounts: Record<number, number>;
  totalCullingImages: number;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableLabels: Array<{ label: string; count: number }>;
  availableTags: string[];
  similarityLevel: "loose" | "medium" | "strict";
  onSimilarityLevelChange: (level: "loose" | "medium" | "strict") => void;
  duplicateLimit: number;
  onDuplicateLimitChange: (limit: number) => void;
  groupCounts: { loose: number; medium: number; strict: number };
  onRunCulling?: () => void;
  isCullingRunning?: boolean;
  isCullingStuck?: boolean;
  isCullingQueued?: boolean;
  cullingCountdown?: string;
  onToggleLikedFilter?: () => void;
}) {
  const toggleRating = (star: number) => {
    const current = filters.selectedRatings || [];
    const next = current.includes(star)
      ? current.filter(s => s !== star)
      : [...current, star];
    onFiltersChange({ ...filters, selectedRatings: next, minRating: 0 });
  };

  const toggleLabel = (label: string) => {
    const current = filters.selectedLabels || [];
    const next = current.includes(label)
      ? current.filter(l => l !== label)
      : [...current, label];
    onFiltersChange({ ...filters, selectedLabels: next });
  };

  const toggleTag = (tag: string) => {
    onFiltersChange({
      ...filters,
      selectedTags: filters.selectedTags.includes(tag)
        ? filters.selectedTags.filter(t => t !== tag)
        : [...filters.selectedTags, tag]
    });
  };

  const hasAnyActiveFilter =
    filters.selectedTags.length > 0 ||
    filters.showHeroOnly ||
    filters.showLikedOnly ||
    filters.showKeeperOnly ||
    filters.eyesOpenOnly ||
    filters.hideIssues ||
    filters.showPeopleOnly ||
    (filters.selectedRatings?.length || 0) > 0 ||
    (filters.selectedLabels?.length || 0) > 0 ||
    duplicateLimit !== 0;

  return (
    <div className="space-y-4">
      {/* Quick Filters */}
      <div className="space-y-2">
        <Label className="aura-microlabel">Quick Filters</Label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onToggleLikedFilter?.()}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-2 rounded-sm text-xs font-medium transition-all border",
              filters.showLikedOnly
                ? "bg-accent/15 border-accent/30 text-accent"
                : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", filters.showLikedOnly && "fill-accent")} />
            Liked
          </button>
          <button
            onClick={() => onFiltersChange({ ...filters, showHeroOnly: !filters.showHeroOnly })}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-2 rounded-sm text-xs font-medium transition-all border",
              filters.showHeroOnly
                ? "bg-rating/15 border-rating/30 text-rating"
                : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Star className={cn("w-3.5 h-3.5", filters.showHeroOnly && "fill-rating")} />
            Hero
          </button>
          {/* VLM extra-signal filters — only meaningful once culling has run
              (they read AI signals that are null before then, so showing them
              pre-culling would silently empty the grid on click). */}
          {hasCullingData && (
            <>
              <button
                onClick={() => onFiltersChange({ ...filters, showKeeperOnly: !filters.showKeeperOnly })}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-2 rounded-sm text-xs font-medium transition-all border",
                  filters.showKeeperOnly
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
                    : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Keepers
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, eyesOpenOnly: !filters.eyesOpenOnly })}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-2 rounded-sm text-xs font-medium transition-all border",
                  filters.eyesOpenOnly
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                Eyes open
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, hideIssues: !filters.hideIssues })}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-2 rounded-sm text-xs font-medium transition-all border",
                  filters.hideIssues
                    ? "bg-red-500/15 border-red-500/30 text-red-500"
                    : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                No issues
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, showPeopleOnly: !filters.showPeopleOnly })}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-2 rounded-sm text-xs font-medium transition-all border",
                  filters.showPeopleOnly
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                Has people
              </button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Star Rating */}
      {hasCullingData ? (
        <div className="space-y-2">
          <Label className="aura-microlabel">Star Rating</Label>
          <div className="space-y-0.5">
            {CULLING_TIERS.filter(tier => {
              // Hide rating tiers with zero photos UNLESS the user has
              // already toggled them on (so we don't suddenly hide a
              // selected filter). The 0-count rows were the main
              // 'looks messy' complaint after culling completes.
              const c = cullingCounts[tier.stars] || 0;
              return c > 0 || filters.selectedRatings.includes(tier.stars);
            }).map(tier => {
              const count = cullingCounts[tier.stars] || 0;
              const isSelected = filters.selectedRatings.includes(tier.stars);
              const pct = totalCullingImages > 0 ? Math.round((count / totalCullingImages) * 100) : 0;
              return (
                <button
                  key={tier.stars}
                  onClick={() => toggleRating(tier.stars)}
                  className={cn(
                    "w-full relative flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all overflow-hidden",
                    isSelected
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-lg transition-all",
                      isSelected ? "bg-rating/15" : "bg-muted/30"
                    )}
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                  <div className="relative flex items-center gap-1.5">
                    {isSelected && <Check className="w-3 h-3 text-primary" />}
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "w-2.5 h-2.5",
                            i < tier.stars ? "text-rating fill-rating" : "text-muted-foreground/20"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="relative text-[10px] tabular-nums font-medium">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="aura-microlabel flex items-center gap-1.5">
            <Sparkle size={10} className="text-primary" /> AI Features
          </Label>
          <div className="aura-ai-border rounded-[--radius] border border-primary/25 bg-primary/[0.06] p-3 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-sm bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <Sparkle size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">AI Culling</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {isCullingQueued ? "Queued — starts automatically after upload" : "Auto-rate, categorize & find duplicates"}
                </p>
              </div>
            </div>
            {onRunCulling && (
              <Button
                variant="glow"
                size="sm"
                className={cn(
                  "w-full gap-1.5 text-xs h-8 transition-colors",
                  (isCullingRunning || isCullingQueued) && "cursor-not-allowed",
                  isCullingStuck && "bg-rating/10 border-rating/30 text-rating hover:bg-rating/20",
                )}
                onClick={onRunCulling}
                disabled={isCullingRunning || isCullingQueued}
                aria-busy={isCullingRunning || isCullingQueued || undefined}
              >
                {isCullingRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Running… <span className="tabular-nums font-mono">{cullingCountdown ?? ""}</span>
                  </>
                ) : isCullingQueued ? (
                  <>
                    <Clock className="w-3.5 h-3.5 text-current" />
                    Culling queued
                  </>
                ) : isCullingStuck ? (
                  <>
                    <Sparkle size={13} className="text-current" />
                    Retry AI Culling
                  </>
                ) : (
                  <>
                    <Sparkle size={13} className="text-current" />
                    Run AI Culling
                  </>
                )}
              </Button>
            )}
            {isCullingQueued && (
              <p className="text-[10px] text-muted-foreground leading-tight text-center">
                You chose AI Culling when creating this collection — Aura will start the moment your photos finish uploading.
              </p>
            )}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <div className="text-center">
                <Star className="w-3.5 h-3.5 text-rating mx-auto mb-0.5" />
                <p className="text-[9px] text-muted-foreground leading-tight">Star Ratings</p>
              </div>
              <div className="text-center">
                <Tag className="w-3.5 h-3.5 text-primary mx-auto mb-0.5" />
                <p className="text-[9px] text-muted-foreground leading-tight">Categories</p>
              </div>
              <div className="text-center">
                <Copy className="w-3.5 h-3.5 text-primary mx-auto mb-0.5" />
                <p className="text-[9px] text-muted-foreground leading-tight">Duplicates</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories (only when culling data exists and labels available) */}
      {hasCullingData && availableLabels.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="aura-microlabel">Categories</Label>
              <button
                onClick={() => {
                  const allSelected = availableLabels.every(({ label }) => filters.selectedLabels?.includes(label));
                  if (allSelected) {
                    availableLabels.forEach(({ label }) => {
                      if (filters.selectedLabels?.includes(label)) toggleLabel(label);
                    });
                  } else {
                    availableLabels.forEach(({ label }) => {
                      if (!filters.selectedLabels?.includes(label)) toggleLabel(label);
                    });
                  }
                }}
                className="text-[10px] text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {availableLabels.every(({ label }) => filters.selectedLabels?.includes(label)) ? "Clear" : "Select All"}
              </button>
            </div>
            <CategoryList
              availableLabels={availableLabels}
              selectedLabels={filters.selectedLabels || []}
              onToggle={toggleLabel}
            />
          </div>
        </>
      )}

      {/* Tags */}
      {availableTags.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <Label className="aura-microlabel">Tags</Label>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-medium transition-all",
                    filters.selectedTags.includes(tag)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Hide duplicates — a FILTER on the main grid (distinct from the
          "Groups" view up top, which is for browsing). It collapses
          near-identical burst frames and keeps only the best N of each, so the
          photographer doesn't deliver ten shots of the same moment. */}
      {hasCullingData && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="aura-microlabel">Hide duplicates</Label>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Collapse near-identical burst frames in this grid and keep only the
              best of each. To browse the full groups, use the{" "}
              <span className="text-foreground">Groups</span> view up top.
            </p>
            <Select
              value={String(duplicateLimit)}
              onValueChange={(v) => onDuplicateLimitChange(Number(v))}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Show all frames</SelectItem>
                <SelectItem value="1">Keep 1 best per burst</SelectItem>
                <SelectItem value="2">Keep 2 best per burst</SelectItem>
                <SelectItem value="3">Keep 3 best per burst</SelectItem>
                <SelectItem value="5">Keep 5 best per burst</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
              {duplicateLimit > 0
                ? `Keeping the best ${duplicateLimit} of each burst; the extra frames are hidden.`
                : "Showing every frame."}
            </p>
          </div>
        </>
      )}

      <Separator />

      {/* Reset All Filters */}
      {hasAnyActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            onFiltersChange({
              ...filters,
              selectedRatings: [],
              minRating: 0,
              selectedLabels: [],
              selectedTags: [],
              showHeroOnly: false,
              showLikedOnly: false,
              showKeeperOnly: false,
              eyesOpenOnly: false,
              hideIssues: false,
              showPeopleOnly: false,
            });
            onDuplicateLimitChange(0);
          }}
        >
          <RotateCcw className="w-3 h-3" />
          Reset All Filters
        </Button>
      )}
    </div>
  );
}

/* ── Gallery Info Panel (visual timeline) ── */
function GalleryInfoPanel({
  data,
  processingStats,
}: {
  data: NonNullable<GalleryRightSidebarProps["galleryTimingData"]>;
  processingStats?: GalleryRightSidebarProps["processingStats"];
}) {
  const formatTime = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" });
  };

  const duration = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 0) return null;
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins < 60) return `${mins}m ${remSecs}s`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  type StageStatus = "completed" | "active" | "idle";

  const stages: Array<{
    icon: React.ReactNode;
    label: string;
    startedAt: string | null;
    completedAt: string | null;
    status: StageStatus;
    color: string;
    bgColor: string;
  }> = [
    {
      icon: <Upload className="w-3.5 h-3.5" />,
      label: "Upload",
      startedAt: data.uploadStartedAt,
      completedAt: data.uploadCompletedAt,
      status: data.uploadCompletedAt ? "completed" : data.uploadStartedAt ? "active" : "idle",
      color: "text-primary",
      bgColor: "bg-primary",
    },
    {
      icon: <Scissors className="w-3.5 h-3.5" />,
      label: "Processing",
      startedAt: data.processingStartedAt,
      completedAt: data.processingCompletedAt,
      status: data.processingCompletedAt ? "completed" : data.processingStartedAt ? "active" : "idle",
      color: "text-primary",
      bgColor: "bg-primary",
    },
    {
      icon: <Wand2 className="w-3.5 h-3.5" />,
      label: "AI Culling",
      startedAt: data.cullingStartedAt,
      completedAt: data.cullingCompletedAt,
      status: data.cullingCompletedAt ? "completed" : data.cullingStartedAt ? "active" : "idle",
      color: "text-primary",
      bgColor: "bg-primary",
    },
  ];

  // Total pipeline duration (from first start to last completion)
  const allStarts = [data.uploadStartedAt, data.processingStartedAt, data.cullingStartedAt].filter(Boolean) as string[];
  const allEnds = [data.uploadCompletedAt, data.processingCompletedAt, data.cullingCompletedAt].filter(Boolean) as string[];
  const pipelineStart = allStarts.length > 0 ? allStarts.reduce((a, b) => a < b ? a : b) : null;
  const pipelineEnd = allEnds.length > 0 ? allEnds.reduce((a, b) => a > b ? a : b) : null;
  const totalDuration = duration(pipelineStart, pipelineEnd);

  return (
    <div className="space-y-3">
      {/* Gallery summary */}
      <div className="rounded-lg bg-muted/30 border border-border/50 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ImageIcon className="w-3 h-3" />
            {data.totalImages} images
          </span>
          <span className="text-muted-foreground">
            {data.sourceType === "google" ? "Google Drive" : "Direct Upload"}
          </span>
        </div>
        {data.createdAt && (
          <p className="text-[10px] text-muted-foreground/70">
            Created {formatDate(data.createdAt)} {formatTime(data.createdAt)}
          </p>
        )}
      </div>

      {/* Processing progress (shown when processing is active or has errors) */}
      {processingStats && (
        <div className="rounded-lg bg-muted/30 border border-border/50 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Processing Progress</span>
            <span className="text-[10px] tabular-nums text-muted-foreground font-medium">
              {processingStats.percentage}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${processingStats.percentage}%` }}
            />
          </div>
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm bg-secondary/15 text-secondary font-medium font-mono tabular-nums">
              <Check className="w-2.5 h-2.5" />
              {processingStats.ready} Ready
            </span>
            {processingStats.processing > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm bg-rating/15 text-rating font-medium font-mono tabular-nums">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {processingStats.processing} Processing
              </span>
            )}
            {processingStats.error > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm bg-destructive/15 text-destructive font-medium font-mono tabular-nums">
                <X className="w-2.5 h-2.5" />
                {processingStats.error} Error
              </span>
            )}
          </div>
        </div>
      )}

      {/* Visual pipeline timeline */}
      <div className="relative">
        {stages.map((stage, i) => {
          const dur = duration(stage.startedAt, stage.completedAt);
          const isLast = i === stages.length - 1;

          return (
            <div key={stage.label} className="relative flex gap-2.5">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors",
                    stage.status === "completed" && `${stage.bgColor}/20 ${stage.color}`,
                    stage.status === "active" && `${stage.bgColor}/30 ${stage.color} ring-2 ring-offset-1 ring-offset-background ring-current`,
                    stage.status === "idle" && "bg-muted/50 text-muted-foreground/40"
                  )}
                >
                  {stage.status === "completed" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : stage.status === "active" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    stage.icon
                  )}
                </div>
                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "w-px flex-1 min-h-[16px]",
                      stage.status === "completed" ? `${stage.bgColor}/30` : "bg-border/50"
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className={cn("pb-3 flex-1 min-w-0", isLast && "pb-0")}>
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      stage.status === "idle" ? "text-muted-foreground/50" : "text-foreground"
                    )}
                  >
                    {stage.label}
                  </span>
                  {dur && (
                    <span className={cn("text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full", `${stage.bgColor}/15 ${stage.color}`)}>
                      {dur}
                    </span>
                  )}
                  {stage.status === "active" && (
                    <span className="text-[10px] text-rating animate-pulse">In progress</span>
                  )}
                </div>
                {stage.startedAt && (
                  <p className="text-[10px] text-muted-foreground/70 tabular-nums mt-0.5">
                    {formatTime(stage.startedAt)}
                    {stage.completedAt && ` → ${formatTime(stage.completedAt)}`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total duration footer */}
      {totalDuration && (
        <div className="rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-1.5 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Total pipeline
          </span>
          <span className="text-xs font-semibold text-primary tabular-nums">{totalDuration}</span>
        </div>
      )}
    </div>
  );
}

/* ── Category list with collapsible long lists ─────────────────────
 * Galleries with 30+ AI-generated categories were rendering all of
 * them in a 192px scroll area. Looked busy and hid the actions row.
 * Now: top 6 by count by default, with a "Show all (N)" toggle.
 */
function CategoryList({
  availableLabels,
  selectedLabels,
  onToggle,
}: {
  availableLabels: Array<{ label: string; count: number }>;
  selectedLabels: string[];
  onToggle: (label: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...availableLabels].sort((a, b) => b.count - a.count);
  const PREVIEW_COUNT = 6;
  // Always show selected items even if they're not in the top N, so a
  // user can see + unselect them without expanding.
  const visible = showAll
    ? sorted
    : sorted.filter((l, i) => i < PREVIEW_COUNT || selectedLabels.includes(l.label));
  const hiddenCount = sorted.length - visible.length;
  const maxCount = Math.max(...sorted.map((l) => l.count), 1);

  return (
    <div className="space-y-0.5">
      {visible.map(({ label, count }) => {
        const isSelected = selectedLabels.includes(label);
        const pct = Math.round((count / maxCount) * 100);
        return (
          <button
            key={label}
            onClick={() => onToggle(label)}
            className={cn(
              "w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all overflow-hidden",
              isSelected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-lg transition-all",
                isSelected ? "bg-primary/15" : "bg-muted/30",
              )}
              style={{ width: `${pct}%` }}
            />
            <div className="relative flex items-center gap-1.5">
              {isSelected && <Check className="w-3 h-3 text-primary" />}
              <span className="font-medium">{label}</span>
            </div>
            <span className="relative text-[10px] tabular-nums opacity-70">{count}</span>
          </button>
        );
      })}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full text-center text-[11px] text-primary hover:text-primary/80 font-medium py-1.5 transition-colors"
        >
          Show all {sorted.length} categories
        </button>
      )}
      {showAll && sorted.length > PREVIEW_COUNT && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground font-medium py-1.5 transition-colors"
        >
          Show fewer
        </button>
      )}
    </div>
  );
}
