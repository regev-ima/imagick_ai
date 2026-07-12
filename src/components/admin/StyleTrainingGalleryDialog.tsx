import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BeforeAfterSlider } from "@/components/styles/BeforeAfterSlider";
import { ChevronLeft, ChevronRight, Eye, EyeOff, ExternalLink, FileImage, Loader2, Star, X } from "lucide-react";
import { parseStyleFile, type StyleFileKind } from "@/lib/styleFiles";
import { getPreviewUrl, getThumbnailUrl, toCdnUrl } from "@/lib/imageUrls";
import { SHOWCASE_GALLERY_ID } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { StyleFull } from "@/pages/dashboard/admin/StyleDetailsSheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TriCompare } from "@/components/admin/TriCompare";

interface Props {
  style: StyleFull | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Viewer mode for the style owner (non-admin) — hides the "Generate model
   * edits" action in the Compare tab and the demo promote/cover controls. */
  readOnly?: boolean;
  /** Which tab to open on. Defaults to "before", or "demo" when the style has
   * no training files (e.g. seeded presets) so it never opens on "No images". */
  initialTab?: GridTab | "compare" | "demo";
}

type GridTab = "before" | "after";

interface LightboxState {
  tab: GridTab;
  index: number;
}

const KIND_LABEL: Record<StyleFileKind, string> = {
  raw: "RAW",
  jpeg: "JPG",
  png: "PNG",
  heic: "HEIC",
  tiff: "TIFF",
  webp: "WEBP",
  other: "FILE",
};

/** Icon + extension badge + filename — the only safe way to represent a RAW
 * (or otherwise unloadable) training file; browsers can't decode CR2/NEF/ARW.
 * Exported so TriCompare.tsx (the Compare tab) can reuse it for the RAW-safe
 * source pane instead of reimplementing the same file-card. */
export function FileCard({ filename, ext, size = "sm" }: { filename: string; ext: string; size?: "sm" | "lg" }) {
  const isLarge = size === "lg";
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-2 p-3 text-center plate-keyline">
      <FileImage className={isLarge ? "h-12 w-12 text-muted-foreground/60" : "h-6 w-6 text-muted-foreground/60"} />
      <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {ext || "raw"}
      </span>
      <span
        className={
          isLarge
            ? "max-w-md break-all font-mono text-xs text-muted-foreground"
            : "line-clamp-2 break-all font-mono text-[9px] leading-tight text-muted-foreground/70"
        }
      >
        {filename}
      </span>
    </div>
  );
}

function GridCell({
  url,
  index,
  onOpen,
}: {
  url: string;
  index: number;
  onOpen: (index: number) => void;
}) {
  const parsed = useMemo(() => parseStyleFile(url), [url]);
  const isImage = parsed.kind !== "raw";
  // Load the pre-generated compressed derivatives, never the full original:
  // 0 = reduced-thumbnail webp (lightest, ideal for a grid), 1 = compressed
  // webp, 2 = edge-cached original (last resort), 3+ = file-card placeholder.
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [url]);

  const showFileCard = !isImage || stage >= 3;

  const src = useMemo(() => {
    if (!isImage) return url;
    if (stage === 0) return getThumbnailUrl(url);
    if (stage === 1) return getPreviewUrl(url);
    return toCdnUrl(url);
  }, [url, isImage, stage]);

  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className="group flex flex-col overflow-hidden rounded-[--radius] border border-border bg-surface-2/40 text-left transition-shadow duration-200 hover:border-muted-foreground/40 hover:shadow-[var(--elevation-2)]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {showFileCard ? (
          <FileCard filename={parsed.filename} ext={parsed.ext} />
        ) : (
          <img
            src={src}
            alt={parsed.filename}
            loading="lazy"
            decoding="async"
            onError={() => setStage((s) => s + 1)}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        )}
        <span className="absolute left-1.5 top-1.5 rounded-sm bg-background/80 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
          {KIND_LABEL[parsed.kind]}
        </span>
      </div>
      <div className="truncate px-1.5 py-1 font-mono text-[10px] text-muted-foreground" title={parsed.filename}>
        {parsed.filename}
      </div>
    </button>
  );
}

function Grid({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (index: number) => void;
}) {
  if (urls.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <span className="aura-microlabel text-muted-foreground">No images</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {urls.map((url, i) => (
        <GridCell key={`${i}-${url}`} url={url} index={i} onOpen={onOpen} />
      ))}
    </div>
  );
}

/** Absolutely-positioned overlay INSIDE the dialog — not a nested Dialog. */
function LightboxLayer({
  urls,
  index,
  onNavigate,
  onClose,
}: {
  urls: string[];
  index: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
}) {
  const url = urls[index];
  const parsed = useMemo(() => (url ? parseStyleFile(url) : null), [url]);
  // 0 = compressed preview webp, 1 = edge-cached original, 2+ = FileCard.
  const [stage, setStage] = useState(0);

  useEffect(() => setStage(0), [url]);

  const isImage = parsed ? parsed.kind !== "raw" : false;
  const displaySrc = useMemo(() => {
    if (!url || !isImage) return url;
    if (stage === 0) return getPreviewUrl(url);
    return toCdnUrl(url);
  }, [url, isImage, stage]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onNavigate((index - 1 + urls.length) % urls.length);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNavigate((index + 1) % urls.length);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, urls.length, onNavigate, onClose]);

  if (!url || !parsed) return null;
  const showFileCard = parsed.kind === "raw" || stage >= 2;

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background/98 backdrop-blur-xl">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <span className="aura-microlabel shrink-0 tabular-nums text-muted-foreground">
          {index + 1}/{urls.length}
        </span>
        <span className="min-w-0 flex-1 truncate text-center font-mono text-xs text-foreground" title={parsed.filename}>
          {parsed.filename}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" /> Open original
          </a>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close lightbox (back to grid)">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6">
        {showFileCard ? (
          <div className="max-w-md">
            <FileCard filename={parsed.filename} ext={parsed.ext} size="lg" />
          </div>
        ) : (
          <img
            src={displaySrc}
            alt={parsed.filename}
            decoding="async"
            onError={() => setStage((s) => s + 1)}
            className="max-h-full max-w-full object-contain"
          />
        )}

        {urls.length > 1 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full"
              onClick={() => onNavigate((index - 1 + urls.length) % urls.length)}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full"
              onClick={() => onNavigate((index + 1) % urls.length)}
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// Per-style hidden demo images (excluded when promoting demo edits to the
// style's public previews). Kept in localStorage, keyed by style — carries
// over the behaviour the old global Showcase Manager stored the same way.
const DEMO_HIDDEN_KEY = "showcase-hidden-images";
function loadHidden(styleId: string): Set<string> {
  try {
    const raw = localStorage.getItem(DEMO_HIDDEN_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    return new Set(map[styleId] || []);
  } catch {
    return new Set();
  }
}
function saveHidden(styleId: string, ids: Set<string>) {
  try {
    const raw = localStorage.getItem(DEMO_HIDDEN_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    map[styleId] = [...ids];
    localStorage.setItem(DEMO_HIDDEN_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota/parse errors — hiding is a convenience only */
  }
}

/**
 * Demo tab — the style run over the shared demo photos (SHOWCASE_GALLERY_ID).
 * This replaces the old standalone Showcase Manager: view the before/after
 * demo pairs, pick a cover, hide any that didn't edit well, and promote the
 * set to the style's public before/after previews. Generating the edits still
 * happens from the drawer's "Edit with this demo" button.
 */
function StyleDemoTab({ style, readOnly }: { style: StyleFull; readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [hidden, setHidden] = useState<Set<string>>(() => loadHidden(style.id));
  const [saving, setSaving] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("side-by-side");
  // The `style` prop is a snapshot from the admin table and won't pick up a
  // freshly-saved cover, so track it locally for instant ★ feedback.
  const [coverUrl, setCoverUrl] = useState<string | null>(style.thumbnail_url);

  useEffect(() => {
    setHidden(loadHidden(style.id));
    setSelectedIndex(0);
  }, [style.id]);
  useEffect(() => setCoverUrl(style.thumbnail_url), [style.id, style.thumbnail_url]);

  const { data: demoImages = [] } = useQuery({
    queryKey: ["demo-gallery-images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("id, original_url, thumbnail_url, filename")
        .eq("gallery_id", SHOWCASE_GALLERY_ID)
        .neq("status", "deleted")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: demoEdits = [] } = useQuery({
    queryKey: ["style-demo-edits", style.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("image_edits")
        .select("image_id, edited_url")
        .eq("style_id", style.id)
        .eq("gallery_id", SHOWCASE_GALLERY_ID);
      if (error) throw error;
      return data ?? [];
    },
  });

  const editedByImage = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of demoEdits) if (e.image_id && e.edited_url) m.set(e.image_id, e.edited_url);
    return m;
  }, [demoEdits]);

  const total = demoImages.length;
  const done = demoEdits.length;

  function toggleHidden(imageId: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      saveHidden(style.id, next);
      return next;
    });
  }

  async function setCover(afterUrl: string) {
    // Store the REDUCED thumbnail (webp) — the styles table and pickers render
    // thumbnail_url directly, so a full-res edited url would load slowly.
    const thumb = getThumbnailUrl(afterUrl);
    const { error } = await supabase.from("styles").update({ thumbnail_url: thumb } as never).eq("id", style.id);
    if (error) {
      toast.error("Failed to set cover");
      return;
    }
    setCoverUrl(thumb);
    toast.success("Cover updated");
    queryClient.invalidateQueries({ queryKey: ["admin-styles"] });
    queryClient.invalidateQueries({ queryKey: ["showcase-covers"] });
  }

  // Promote the visible demo edits to the style's public before/after previews
  // (and pick a cover if none is set) — the per-style version of the old
  // Showcase Manager "Save previews to styles".
  async function saveAsPreviews() {
    setSaving(true);
    try {
      const before: string[] = [];
      const after: string[] = [];
      for (const img of demoImages) {
        if (hidden.has(img.id)) continue;
        const edit = editedByImage.get(img.id);
        if (!edit) continue;
        before.push(getThumbnailUrl(img.original_url));
        after.push(edit);
      }
      if (after.length === 0) {
        toast.error("No visible demo edits to save.");
        return;
      }
      const updateData: Record<string, unknown> = {
        before_image_urls: before,
        after_image_urls: after,
      };
      // Pick a reduced-thumbnail cover if none chosen yet.
      if (!coverUrl) {
        const thumb = getThumbnailUrl(after[0]);
        updateData.thumbnail_url = thumb;
        setCoverUrl(thumb);
      }
      const { error } = await supabase.from("styles").update(updateData as never).eq("id", style.id);
      if (error) throw error;
      toast.success(`Saved ${after.length} before/after previews to this style`);
      queryClient.invalidateQueries({ queryKey: ["admin-styles"] });
      queryClient.invalidateQueries({ queryKey: ["showcase-covers"] });
    } catch (err) {
      console.error("Save previews failed:", err);
      toast.error("Failed to save previews");
    } finally {
      setSaving(false);
    }
  }

  if (total === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
        <span className="aura-microlabel text-muted-foreground">No demo photos</span>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add demo photos once to the shared collection and they're reusable for every style.
        </p>
        {!readOnly && (
          <Button asChild size="sm" variant="outline" className="mt-1.5">
            <Link to={`/dashboard/galleries/${SHOWCASE_GALLERY_ID}`}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Manage demo photos
            </Link>
          </Button>
        )}
      </div>
    );
  }

  const coverKey = coverUrl ? getThumbnailUrl(coverUrl) : null;
  const activeIndex = Math.min(selectedIndex, total - 1);
  const active = demoImages[activeIndex];
  const activeAfter = active ? editedByImage.get(active.id) : undefined;
  const activeHidden = active ? hidden.has(active.id) : false;
  const activeIsCover = !!activeAfter && !!coverKey && getThumbnailUrl(activeAfter) === coverKey;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span className="aura-microlabel text-muted-foreground">
          {done} / {total} demo photos edited{hidden.size > 0 ? ` · ${hidden.size} hidden` : ""}
        </span>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to={`/dashboard/galleries/${SHOWCASE_GALLERY_ID}`}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Manage demo photos
              </Link>
            </Button>
            <Button size="sm" variant="glow" disabled={saving || done === 0} onClick={saveAsPreviews}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save as style previews
            </Button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left: every demo photo — thumbnail · name · cover/hidden markers. */}
        <div className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto rounded-[--radius] border border-border bg-surface-2/20 p-2">
          {demoImages.map((img, i) => {
            const after = editedByImage.get(img.id);
            const isCover = !!after && !!coverKey && getThumbnailUrl(after) === coverKey;
            const isHidden = hidden.has(img.id);
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[--radius] border px-2 py-1.5 text-left transition-colors",
                  i === activeIndex
                    ? "border-primary/60 bg-primary/5"
                    : "border-transparent hover:border-border hover:bg-surface-2/40",
                  isHidden && "opacity-50",
                )}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[--radius] border border-border bg-surface-2">
                  <img src={getThumbnailUrl(img.original_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground" title={img.filename || `#${i + 1}`}>
                  {img.filename || `#${i + 1}`}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {isCover && <Star className="h-3 w-3 fill-current text-rating" />}
                  {isHidden && <EyeOff className="h-3 w-3 text-muted-foreground/50" />}
                  {!after && <span className="h-1.5 w-1.5 rounded-full ring-1 ring-inset ring-border" title="Not edited yet" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: the selected photo large — before/after with cover + hide. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground" title={active?.filename}>
              {active?.filename || `#${activeIndex + 1}`}
              {activeAfter ? "" : " · not edited yet"}
            </span>
            <div className="flex items-center gap-2">
              {!readOnly && (
                <>
                  <Button
                    size="sm"
                    variant={activeIsCover ? "secondary" : "outline"}
                    disabled={!activeAfter}
                    onClick={() => activeAfter && setCover(activeAfter)}
                  >
                    <Star className={cn("mr-1.5 h-3.5 w-3.5", activeIsCover && "fill-current text-rating")} />
                    {activeIsCover ? "Cover" : "Set as cover"}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!active} onClick={() => active && toggleHidden(active.id)}>
                    {activeHidden ? <Eye className="mr-1.5 h-3.5 w-3.5" /> : <EyeOff className="mr-1.5 h-3.5 w-3.5" />}
                    {activeHidden ? "Show" : "Hide"}
                  </Button>
                </>
              )}
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={viewMode}
                onValueChange={(v) => v && setViewMode(v as "slider" | "side-by-side")}
              >
                <ToggleGroupItem value="side-by-side" className="text-xs">Side-by-side</ToggleGroupItem>
                <ToggleGroupItem value="slider" className="text-xs">Slider</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a photo</div>
          ) : viewMode === "side-by-side" ? (
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
              <DemoPane label="Before" src={getPreviewUrl(active.original_url)} />
              {activeAfter ? (
                <DemoPane label="After" src={getPreviewUrl(activeAfter)} />
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-[--radius] border border-border bg-surface-2/40 text-xs text-muted-foreground/50 plate-keyline">
                  Not edited yet
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
              {activeAfter ? (
                <BeforeAfterSlider
                  key={`${active.id}-${activeAfter}`}
                  beforeSrc={getPreviewUrl(active.original_url)}
                  afterSrc={getPreviewUrl(activeAfter)}
                  maxHeight="100%"
                  className="h-full max-w-full"
                />
              ) : (
                <p className="max-w-sm text-center text-sm text-muted-foreground">
                  This photo hasn't been edited with this style yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One labeled, large pane in the demo side-by-side view. */
function DemoPane({ label, src }: { label: string; src: string }) {
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[--radius] border border-border bg-surface-2/40 plate-keyline">
      <span className="absolute left-1.5 top-1.5 z-10 rounded-sm bg-background/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
        {label}
      </span>
      <img src={src} alt={label} decoding="async" className="max-h-full max-w-full object-contain" />
    </div>
  );
}

export function StyleTrainingGalleryDialog({ style, open, onOpenChange, readOnly, initialTab }: Props) {
  const [tab, setTab] = useState<GridTab | "compare" | "demo">("before");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  // Compare tab: "Generate model edits" in-flight state + a way to force
  // TriCompare to refetch once it resolves (see handleGenerateEdits below).
  const [generating, setGenerating] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  // The `style` prop is a snapshot passed down from the admin table/sheet —
  // it won't pick up a freshly-created source_gallery_id on its own after a
  // successful generate call, so track the fresh value locally and merge it
  // into what TriCompare sees.
  const [sourceGalleryIdOverride, setSourceGalleryIdOverride] = useState<string | null>(null);

  const beforeUrls = useMemo(
    () => (style?.before_image_urls ?? []).filter((u): u is string => !!u),
    [style],
  );
  const afterUrls = useMemo(
    () => (style?.after_image_urls ?? []).filter((u): u is string => !!u),
    [style],
  );

  // On open, land on the requested tab — or "demo" when there are no training
  // files (seeded presets) so we never open on an empty "No images" grid.
  // Reset transient state whenever the dialog closes so the next open is clean.
  useEffect(() => {
    if (open) {
      const noTrainingFiles = beforeUrls.length === 0 && afterUrls.length === 0;
      setTab(initialTab ?? (noTrainingFiles ? "demo" : "before"));
    } else {
      setLightbox(null);
      setGenerating(false);
    }
    // Only re-run on open toggle; initialTab/urls are stable for a given open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset the override/refetch counter whenever a different style is shown.
  useEffect(() => {
    setSourceGalleryIdOverride(null);
    setRefreshToken(0);
  }, [style?.id]);

  if (!style) return null;

  const lightboxUrls = lightbox?.tab === "after" ? afterUrls : beforeUrls;

  const compareStyle: StyleFull = sourceGalleryIdOverride
    ? { ...style, source_gallery_id: sourceGalleryIdOverride }
    : style;

  async function handleGenerateEdits() {
    if (!style) return;
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("style-source-edit", {
        body: { styleId: style.id },
      });
      if (error) throw error;

      // Pick up a freshly-created source_gallery_id (legacy styles that had
      // none yet) so TriCompare's query key changes and it actually fetches.
      const { data: refreshed } = await supabase
        .from("styles")
        .select("source_gallery_id")
        .eq("id", style.id)
        .maybeSingle();
      if (refreshed?.source_gallery_id) {
        setSourceGalleryIdOverride(refreshed.source_gallery_id as string);
      }
      setRefreshToken((n) => n + 1);
      toast.success("Model edits generated");
    } catch (err) {
      console.error("Generate model edits failed:", err);
      toast.error("Failed to generate model edits");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onEscapeKeyDown={(e) => {
          // While the lightbox is open, Esc backs out of it — not the whole dialog.
          if (lightbox) e.preventDefault();
        }}
        // Pin to a fixed inset box instead of the shared DialogContent's
        // translate-centering. `fixed` (not `relative`!) is essential: with
        // `relative`, tailwind-merge drops the base `fixed` and the panel is no
        // longer viewport-anchored, so it floats into flow and renders half-
        // height. `fixed` still acts as the containing block for the absolute
        // lightbox layer, so `relative` isn't needed. Explicit top/right/bottom/
        // left insets + translate-0 mean position never depends on a transform.
        className="fixed flex flex-col gap-0 overflow-hidden p-0 left-[2.5vw] right-[2.5vw] top-[3vh] bottom-[3vh] h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">{style.name}</DialogTitle>
          <DialogDescription className="aura-microlabel text-muted-foreground">
            Before {beforeUrls.length} · After {afterUrls.length}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as GridTab | "compare" | "demo")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 border-b border-border px-6 py-3">
            <TabsList>
              <TabsTrigger value="before">Before ({beforeUrls.length})</TabsTrigger>
              <TabsTrigger value="after">After ({afterUrls.length})</TabsTrigger>
              <TabsTrigger value="compare">Compare</TabsTrigger>
              <TabsTrigger value="demo">Demo</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="before" className="mt-0 min-h-0 flex-1 overflow-y-auto p-6">
            <Grid urls={beforeUrls} onOpen={(index) => setLightbox({ tab: "before", index })} />
          </TabsContent>
          <TabsContent value="after" className="mt-0 min-h-0 flex-1 overflow-y-auto p-6">
            <Grid urls={afterUrls} onOpen={(index) => setLightbox({ tab: "after", index })} />
          </TabsContent>
          {/* Three-way compare: source photo · photographer's edit · model's edit. */}
          <TabsContent value="compare" className="mt-0 min-h-0 flex-1 overflow-hidden p-6">
            <TriCompare
              style={compareStyle}
              onGenerateEdits={readOnly ? undefined : handleGenerateEdits}
              generating={generating}
              refreshToken={refreshToken}
              readOnly={readOnly}
            />
          </TabsContent>
          {/* Demo: this style over the shared demo photos — replaces the old
              standalone Showcase Manager (view · cover · hide · promote). */}
          <TabsContent value="demo" className="mt-0 min-h-0 flex-1 overflow-hidden p-6">
            <StyleDemoTab style={style} readOnly={readOnly} />
          </TabsContent>
        </Tabs>

        {lightbox && (
          <LightboxLayer
            urls={lightboxUrls}
            index={lightbox.index}
            onNavigate={(index) => setLightbox((prev) => (prev ? { ...prev, index } : prev))}
            onClose={() => setLightbox(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
