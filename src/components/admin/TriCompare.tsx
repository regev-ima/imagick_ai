import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pairByStem, parseStyleFile, stemOf } from "@/lib/styleFiles";
import { BeforeAfterSlider } from "@/components/styles/BeforeAfterSlider";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileCard } from "@/components/admin/StyleTrainingGalleryDialog";
import { getThumbnailUrl } from "@/lib/imageUrls";
import type { StyleFull } from "@/pages/dashboard/admin/StyleDetailsSheet";

/**
 * Three-way compare (source photo · photographer's edit · model's edit) —
 * the Compare tab of StyleTrainingGalleryDialog. See docs/plans/
 * admin-style-control-upgrade.md, T4 + "Architecture decisions".
 */

interface CompareRow {
  stem: string;
  source?: string;
  photographerEdit?: string;
  modelEdit?: string;
}

type Slot = "source" | "photographerEdit" | "modelEdit";

const SLOT_LABEL: Record<Slot, string> = {
  source: "Source",
  photographerEdit: "Photographer's edit",
  modelEdit: "Model's edit",
};

const SLOTS: Slot[] = ["source", "photographerEdit", "modelEdit"];

interface Props {
  style: StyleFull;
  onGenerateEdits?: () => void;
  generating?: boolean;
  /** Bump this (e.g. after a generate call resolves) to force a refetch even
   * when style.source_gallery_id didn't change (re-processing new images
   * into an already-existing source gallery). */
  refreshToken?: number;
  /** Viewer mode for the style owner — hides the admin-only "Generate model
   * edits" action; the before/after comparison still works. */
  readOnly?: boolean;
}

function AvailabilityDots({ row }: { row: CompareRow }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {SLOTS.map((slot) => (
        <span
          key={slot}
          title={`${SLOT_LABEL[slot]}${row[slot] ? "" : " — not available"}`}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            row[slot] ? "bg-accent" : "bg-transparent ring-1 ring-inset ring-border",
          )}
        />
      ))}
    </span>
  );
}

/** One labeled pane in the side-by-side viewer. RAW is only possible on the
 * source side (before-set files can be RAW) — photographer/model urls are
 * always raster, so they only need the plain onError fallback. */
function ImagePane({ label, url, allowRawCard }: { label: string; url?: string; allowRawCard?: boolean }) {
  const parsed = useMemo(() => (url ? parseStyleFile(url) : null), [url]);
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [url]);

  const showFileCard = !!(allowRawCard && parsed?.kind === "raw");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <span className="aura-microlabel text-muted-foreground">{label}</span>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[--radius] border border-border bg-surface-2/40 plate-keyline">
        {!url ? (
          <span className="px-3 text-center text-xs text-muted-foreground/50">Not available</span>
        ) : showFileCard && parsed ? (
          <FileCard filename={parsed.filename} ext={parsed.ext} size="lg" />
        ) : errored ? (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
            <ImageIcon className="h-8 w-8" />
            <span className="text-[10px]">Failed to load</span>
          </div>
        ) : (
          <img
            src={url}
            alt={label}
            onError={() => setErrored(true)}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}

function SlotSelect({ label, value, onChange }: { label: string; value: Slot; onChange: (v: Slot) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="aura-microlabel shrink-0 text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as Slot)}>
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SLOTS.map((slot) => (
            <SelectItem key={slot} value={slot} className="text-xs">
              {SLOT_LABEL[slot]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function TriCompare({ style, onGenerateEdits, generating, refreshToken, readOnly }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  // Default Photographer vs Model — "the money shot" per the plan.
  const [beforeSlot, setBeforeSlot] = useState<Slot>("photographerEdit");
  const [afterSlot, setAfterSlot] = useState<Slot>("modelEdit");

  useEffect(() => {
    setSelectedIndex(0);
  }, [style.id]);

  // Source photo <-> photographer's edit pairing — synchronous, no network
  // (before/after urls are already loaded on the style row).
  const baseRows = useMemo(
    () => pairByStem(style.before_image_urls, style.after_image_urls),
    [style.before_image_urls, style.after_image_urls],
  );

  // Model edits — fetched once against the style's source gallery, then
  // merged into baseRows by filename stem.
  const { data: modelEditByStem, isFetching: modelEditsLoading } = useQuery({
    queryKey: ["style-tri-compare-model-edits", style.id, style.source_gallery_id, refreshToken],
    queryFn: async () => {
      const galleryId = style.source_gallery_id;
      if (!galleryId) return new Map<string, string>();

      const [{ data: edits, error: editsError }, { data: images, error: imagesError }] = await Promise.all([
        supabase
          .from("image_edits")
          .select("image_id, edited_url")
          .eq("gallery_id", galleryId)
          .eq("style_id", style.id),
        supabase.from("gallery_images").select("id, filename").eq("gallery_id", galleryId),
      ]);
      if (editsError) throw editsError;
      if (imagesError) throw imagesError;

      const filenameById = new Map((images ?? []).map((img) => [img.id, img.filename]));
      const map = new Map<string, string>();
      for (const edit of edits ?? []) {
        const filename = filenameById.get(edit.image_id);
        if (!filename) continue;
        map.set(stemOf(filename), edit.edited_url);
      }
      return map;
    },
    enabled: !!style.source_gallery_id,
  });

  const rows: CompareRow[] = useMemo(
    () =>
      baseRows.map((r) => ({
        stem: r.stem,
        source: r.before,
        photographerEdit: r.after,
        modelEdit: modelEditByStem?.get(r.stem),
      })),
    [baseRows, modelEditByStem],
  );

  const clampedIndex = rows.length === 0 ? 0 : Math.min(selectedIndex, rows.length - 1);
  const activeRow = rows[clampedIndex] as CompareRow | undefined;

  const beforeUrl = activeRow?.[beforeSlot];
  const afterUrl = activeRow?.[afterSlot];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {!style.source_gallery_id && (
        <div className="flex shrink-0 flex-col items-start justify-between gap-3 rounded-[--radius] border border-dashed border-border bg-surface-2/40 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> No model edits yet
            </p>
            <p className="mt-0.5 max-w-md text-xs text-muted-foreground">
              {readOnly
                ? "The model's own edits aren't available for this style yet — compare your before and after training photos below."
                : "Generate the model's edits on this style's own source photos to unlock the full three-way compare."}
            </p>
          </div>
          {!readOnly && (
            <Button
              size="sm"
              variant="glow"
              disabled={generating}
              onClick={() => onGenerateEdits?.()}
              className="shrink-0 gap-1.5"
            >
              {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Generate model edits
            </Button>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <span className="aura-microlabel text-muted-foreground">No files to compare</span>
          <p className="max-w-sm text-sm text-muted-foreground">
            This style has no matched before/after files yet.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Left: compact preview panel — thumbnail · name · availability */}
          <div className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto rounded-[--radius] border border-border bg-surface-2/20 p-2">
            {rows.map((row, i) => (
              <button
                key={row.stem}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[--radius] border px-2 py-1.5 text-left transition-colors",
                  i === clampedIndex
                    ? "border-primary/60 bg-primary/5"
                    : "border-transparent hover:border-border hover:bg-surface-2/40",
                )}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[--radius] border border-border bg-surface-2">
                  {row.source ? (
                    <img
                      src={getThumbnailUrl(row.source)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                    />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground" title={row.stem}>
                  {row.stem}
                </span>
                <AvailabilityDots row={row} />
              </button>
            ))}
          </div>

          {/* Right: viewer — controls sit in one right-aligned toolbar above a
              large image so the comparison gets almost all the vertical space. */}
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
              {modelEditsLoading && (
                <span className="mr-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading model edits…
                </span>
              )}
              {viewMode === "slider" && (
                <>
                  <SlotSelect label="Before" value={beforeSlot} onChange={setBeforeSlot} />
                  <SlotSelect label="After" value={afterSlot} onChange={setAfterSlot} />
                </>
              )}
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={viewMode}
                onValueChange={(v) => v && setViewMode(v as "slider" | "side-by-side")}
              >
                <ToggleGroupItem value="slider" className="text-xs">Slider</ToggleGroupItem>
                <ToggleGroupItem value="side-by-side" className="text-xs">Side-by-side</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {viewMode === "side-by-side" ? (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                <ImagePane label="Source" url={activeRow?.source} allowRawCard />
                <ImagePane label="Photographer's edit" url={activeRow?.photographerEdit} />
                <ImagePane label="Model's edit" url={activeRow?.modelEdit} />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                {beforeUrl && afterUrl ? (
                  <BeforeAfterSlider
                    key={`${clampedIndex}-${beforeSlot}-${afterSlot}`}
                    beforeSrc={beforeUrl}
                    afterSrc={afterUrl}
                    maxHeight="100%"
                    className="h-full max-w-full"
                  />
                ) : (
                  <p className="max-w-sm text-center text-sm text-muted-foreground">
                    {SLOT_LABEL[beforeSlot]} vs {SLOT_LABEL[afterSlot]} — one or both aren't available for this photo.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
