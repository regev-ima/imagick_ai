import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, ExternalLink, FileImage, X } from "lucide-react";
import { parseStyleFile, type StyleFileKind } from "@/lib/styleFiles";
import type { StyleFull } from "@/pages/dashboard/admin/StyleDetailsSheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TriCompare } from "@/components/admin/TriCompare";

interface Props {
  style: StyleFull | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

function GridCell({ url, index, onOpen }: { url: string; index: number; onOpen: (index: number) => void }) {
  const parsed = useMemo(() => parseStyleFile(url), [url]);
  const [errored, setErrored] = useState(false);
  const showFileCard = parsed.kind === "raw" || errored;

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
            src={url}
            alt={parsed.filename}
            loading="lazy"
            onError={() => setErrored(true)}
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

function Grid({ urls, onOpen }: { urls: string[]; onOpen: (index: number) => void }) {
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
  const [errored, setErrored] = useState(false);

  useEffect(() => setErrored(false), [url]);

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
  const showFileCard = parsed.kind === "raw" || errored;

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
            src={url}
            alt={parsed.filename}
            onError={() => setErrored(true)}
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

export function StyleTrainingGalleryDialog({ style, open, onOpenChange }: Props) {
  const [tab, setTab] = useState<GridTab | "compare">("before");
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

  // Reset transient state whenever the dialog closes so the next open starts clean.
  useEffect(() => {
    if (!open) {
      setLightbox(null);
      setTab("before");
      setGenerating(false);
    }
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
          onValueChange={(v) => setTab(v as GridTab | "compare")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 border-b border-border px-6 py-3">
            <TabsList>
              <TabsTrigger value="before">Before ({beforeUrls.length})</TabsTrigger>
              <TabsTrigger value="after">After ({afterUrls.length})</TabsTrigger>
              <TabsTrigger value="compare">Compare</TabsTrigger>
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
              onGenerateEdits={handleGenerateEdits}
              generating={generating}
              refreshToken={refreshToken}
            />
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
