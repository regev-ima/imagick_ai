import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, ExternalLink, X, Plus, AlertTriangle, ImageIcon, GitBranch, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { cn } from "@/lib/utils";
import { SHOWCASE_GALLERY_ID } from "@/lib/constants";
import { breakdownFiles, type FileBreakdown, type StyleFileKind } from "@/lib/styleFiles";
import { formatDuration } from "@/lib/cullingEta";
import { toast } from "sonner";
import { format } from "date-fns";
import { StyleTrainingGalleryDialog } from "@/components/admin/StyleTrainingGalleryDialog";
import { RetrainStyleDialog } from "@/components/admin/RetrainStyleDialog";

const KIND_LABELS: Record<StyleFileKind, string> = {
  raw: "RAW",
  jpeg: "JPG",
  png: "PNG",
  heic: "HEIC",
  tiff: "TIFF",
  webp: "WEBP",
  other: "Other",
};

/** Every column the admin might want — mirrors the styles Row. */
export interface StyleFull {
  id: string;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  is_preset: boolean;
  is_active: boolean;
  recommended: boolean | null;
  category: string | null;
  slug: string | null;
  user_id: string;
  style_id_external: string | null;
  thumbnail_url: string | null;
  allowed_user_ids: string[] | null;
  before_image_urls: string[] | null;
  after_image_urls: string[] | null;
  google_before_urls: string[] | null;
  google_after_urls: string[] | null;
  manual_link_before: string | null;
  manual_link_after: string | null;
  upload_method: string | null;
  total_images_imported: number | null;
  total_images_to_import: number | null;
  matching_images_count: number | null;
  training_sessions_count: number | null;
  associated_tags: string[] | null;
  error_details: string[] | null;
  team_remarks: string[] | null;
  created_at: string;
  updated_at: string;
  import_start_date: string | null;
  import_completion_date: string | null;
  training_start_date: string | null;
  training_completion_date: string | null;
  father_style_id: string | null;
  source_gallery_id: string | null;
}

export interface AdminUserLite {
  id: string;
  email: string;
  full_name: string | null;
}

interface Props {
  style: StyleFull | null;
  users: AdminUserLite[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenParent?: (parentId: string) => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="aura-microlabel text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function fmt(d: string | null) {
  if (!d) return <span className="text-muted-foreground/50">—</span>;
  try {
    return <span className="tabular-nums">{format(new Date(d), "MMM d, yyyy · HH:mm")}</span>;
  } catch {
    return d;
  }
}

/** Renders a strip of image thumbnails (B2 urls) with a count. */
function ImageStrip({ urls }: { urls: string[] | null | undefined }) {
  if (!urls || urls.length === 0) return <span className="text-muted-foreground/50">none</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {urls.slice(0, 12).map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noreferrer" className="block h-12 w-12 overflow-hidden rounded-[--radius] ring-1 ring-border">
          <img src={getThumbnailUrl(u)} alt="" className="h-full w-full object-cover" loading="lazy" />
        </a>
      ))}
      {urls.length > 12 && (
        <span className="grid h-12 w-12 place-items-center rounded-[--radius] bg-muted text-xs font-medium text-muted-foreground">
          +{urls.length - 12}
        </span>
      )}
    </div>
  );
}

/** Renders external (Google Drive) links as a list. */
function LinkList({ urls }: { urls: string[] | null | undefined }) {
  if (!urls || urls.length === 0) return <span className="text-muted-foreground/50">none</span>;
  return (
    <div className="space-y-1">
      {urls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{u}</span>
        </a>
      ))}
    </div>
  );
}

/** Chips of file-type counts (RAW 24 / JPG 96 / ...) plus an expandable full filename list. */
function FileTypeBreakdown({ breakdown }: { breakdown: FileBreakdown }) {
  const [expanded, setExpanded] = useState(false);
  if (breakdown.total === 0) return <span className="text-muted-foreground/50">none</span>;
  const kinds = (Object.keys(breakdown.byKind) as StyleFileKind[]).filter((k) => breakdown.byKind[k] > 0);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {kinds.map((k) => (
          <Badge key={k} variant="outline" className="text-[10px]">
            {KIND_LABELS[k]}
          </Badge>
        ))}
        <button
          type="button"
          className="text-[10px] text-primary hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide files" : "Show all files"}
        </button>
      </div>
      {expanded && (
        <div className="max-h-48 overflow-y-auto font-mono text-xs">
          {breakdown.files.map((f, i) => (
            <div key={i} className="truncate" title={f.filename}>
              {f.filename} — {KIND_LABELS[f.kind]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Computes `${prefix}<formatted duration>`, guarding against missing/invalid/negative diffs. Returns null when there's nothing sane to show. */
function durationLabel(startIso: string | null, endIso: string | null, prefix: string): string | null {
  if (!startIso || !endIso) return null;
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const diffMs = endMs - startMs;
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  return `${prefix}${formatDuration(diffMs)}`;
}

/** Live-ticking "Training running — Xh Ym" that recomputes every second while training is in flight. */
function LiveTrainingDuration({ startIso }: { startIso: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const startMs = new Date(startIso).getTime();
  const elapsedMs = Number.isFinite(startMs) ? Math.max(0, Date.now() - startMs) : 0;
  return <span>Training running — {formatDuration(elapsedMs)}</span>;
}

/**
 * Demo preview — runs THIS style over the shared, reusable demo gallery
 * (SHOWCASE_GALLERY_ID) so a style with no training photos still gets a
 * before/after showcase. The demo photos are uploaded once (Showcase Manager)
 * and reused for every style; the resulting image_edits already power the
 * customer style page and card covers, so this needs no per-style upload.
 */
function StyleDemoPreview({ styleId, onOpenGallery }: { styleId: string; onOpenGallery: () => void }) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

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
    queryKey: ["style-demo-edits", styleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("image_edits")
        .select("image_id, edited_url")
        .eq("style_id", styleId)
        .eq("gallery_id", SHOWCASE_GALLERY_ID);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: running ? 4000 : false,
  });

  const total = demoImages.length;
  const done = demoEdits.length;

  // Stop the spinner once every demo photo has an edit; refresh covers so the
  // style's card thumbnail picks up the freshly generated demo.
  useEffect(() => {
    if (running && total > 0 && done >= total) {
      setRunning(false);
      toast.success("Demo edits ready");
      queryClient.invalidateQueries({ queryKey: ["showcase-covers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-styles"] });
    }
  }, [running, done, total, queryClient]);

  const runDemo = async () => {
    if (total === 0) {
      toast.error("No demo photos yet — add them once in the Showcase Manager.");
      return;
    }
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("process-images", {
        body: { galleryId: SHOWCASE_GALLERY_ID, imageIds: demoImages.map((i) => i.id), styleIds: [styleId] },
      });
      if (error) throw error;
      toast.success(`Editing ${total} demo photo${total === 1 ? "" : "s"} with this style…`);
    } catch (err) {
      console.error("Edit with demo failed:", err);
      toast.error("Failed to start demo edit");
      setRunning(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="aura-microlabel text-primary">Demo preview</div>
          <p className="mt-0.5 text-xs text-muted-foreground">Runs this style on the shared demo photos — no re-upload.</p>
        </div>
        <Button size="sm" variant="glow" disabled={running || total === 0} onClick={runDemo}>
          {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          Edit with this demo
        </Button>
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted-foreground/60">
          No demo photos yet. Add them once to the shared demo collection and they're reusable for every style.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="aura-microlabel text-muted-foreground">
            {done} / {total} demo photos edited
            {running && <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin align-[-1px]" />}
          </div>
          {/* The before/after grid + cover/hide/promote controls live in the
              training gallery's Demo tab — one place for all style images. */}
          <Button size="sm" variant="outline" onClick={onOpenGallery}>
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> View demos & save previews
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * Live upload monitor — while a client is still uploading a style's source
 * photos, the DB only knows the *target* (total_images_to_import, stamped at
 * the start) and the final count (stamped at the end); it has no mid-upload
 * progress, because the browser uploads straight to B2. So we count the actual
 * objects that have landed in the style's before/ + after/ prefixes (the same
 * count-files the pipeline uses) every few seconds. That gives a truthful
 * "X of Y uploaded · N%", and — by watching whether the count is still moving —
 * a real "still uploading" vs "looks stuck" signal.
 */
function StyleUploadMonitor({ style }: { style: StyleFull }) {
  // The sheet's `style` prop is a snapshot frozen at open time, so read the
  // live status/target straight from the row (cheap, only while uploading).
  const { data: live } = useQuery({
    queryKey: ["style-upload-live", style.id],
    initialData: {
      status: style.status,
      total_images_to_import: style.total_images_to_import,
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("styles")
        .select("status, total_images_to_import")
        .eq("id", style.id)
        .single();
      if (error) throw error;
      return data as { status: string; total_images_to_import: number | null };
    },
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "uploading" || s === "importing" ? 5000 : false;
    },
  });

  // Covers both direct browser upload ("uploading") and Google-Drive import
  // ("importing") — both land in the same before/ + after/ prefixes.
  const uploading = live?.status === "uploading" || live?.status === "importing";
  const target = live?.total_images_to_import ?? style.total_images_to_import ?? 0;

  // Count the objects actually in storage right now (before + after). Mirrors
  // the working useImportProgress call: no bucket arg, guard on data.success.
  const { data: counts, isError } = useQuery({
    queryKey: ["style-upload-count", style.id],
    enabled: uploading,
    refetchInterval: uploading ? 5000 : false,
    queryFn: async () => {
      const countFolder = async (sub: "before" | "after") => {
        const { data, error } = await supabase.functions.invoke("count-files", {
          body: { folder: `styles/${style.user_id}/${style.id}/${sub}/` },
        });
        if (error || !data?.success) throw new Error("count-files failed");
        return Number(data?.fileCount ?? 0);
      };
      const [before, after] = await Promise.all([countFolder("before"), countFolder("after")]);
      return { before, after, total: before + after, at: Date.now() };
    },
  });

  // Stall detection: remember when the landed count last moved; if it hasn't
  // budged for a while (and we're short of the target), the upload looks stuck.
  const STALL_MS = 45_000;
  const progressRef = useRef<{ lastTotal: number; lastChangedAt: number }>({ lastTotal: -1, lastChangedAt: 0 });
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!counts) return;
    const r = progressRef.current;
    if (counts.total !== r.lastTotal) {
      r.lastTotal = counts.total;
      r.lastChangedAt = counts.at;
      setStalled(false);
    } else if (target > 0 && counts.total < target && counts.at - r.lastChangedAt > STALL_MS) {
      setStalled(true);
    }
  }, [counts, target]);

  if (!uploading) return null;

  const landed = counts?.total ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((landed / target) * 100)) : 0;
  const complete = target > 0 && landed >= target;

  return (
    <section className="aura-ai-border glass-card space-y-3 rounded-[--radius] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="aura-microlabel text-primary">Live upload</div>
        {target > 0 && (
          <span className="folio text-sm tabular-nums text-foreground">{landed} / {target} · {pct}%</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            complete
              ? "bg-secondary"
              : stalled
                ? "bg-rating"
                : "bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-gradient-x",
          )}
          style={{ width: `${target > 0 ? pct : (landed > 0 ? 100 : 6)}%` }}
        />
      </div>

      {/* Status line */}
      <div className="flex items-center gap-2 text-xs">
        {isError ? (
          <><AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rating" /><span className="text-muted-foreground">Couldn't read the upload folder — retrying…</span></>
        ) : complete ? (
          <><Check className="h-3.5 w-3.5 shrink-0 text-secondary" /><span className="text-foreground">All photos uploaded — finalizing &amp; starting training.</span></>
        ) : stalled ? (
          <><AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rating" /><span className="text-foreground">No new photos in {Math.round(STALL_MS / 1000)}s — the upload may be paused or stuck.</span></>
        ) : (
          <><Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" /><span className="text-muted-foreground">Uploading… {counts ? `${counts.before} before · ${counts.after} after` : "counting files…"}</span></>
        )}
      </div>
    </section>
  );
}

export function StyleDetailsSheet({ style, users, open, onOpenChange, onOpenParent }: Props) {
  const queryClient = useQueryClient();
  const [modelId, setModelId] = useState("");
  const [addUserId, setAddUserId] = useState("");
  const [remark, setRemark] = useState("");
  const [trainingGalleryOpen, setTrainingGalleryOpen] = useState(false);
  // Which tab the training gallery opens on — "demo" when launched from the
  // Demo preview section, otherwise its default (before / training files).
  const [galleryInitialTab, setGalleryInitialTab] = useState<"before" | "demo" | undefined>(undefined);
  const [retrainOpen, setRetrainOpen] = useState(false);
  const [children, setChildren] = useState<{ id: string; name: string; status: string; created_at: string }[]>([]);
  const [parentName, setParentName] = useState<string | null>(null);

  const emailOf = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.email]));
    return (id: string) => map.get(id) || id;
  }, [users]);

  // Lineage: the parent this style was retrained from (name only, for the badge).
  useEffect(() => {
    if (!style?.father_style_id) {
      setParentName(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("styles")
      .select("id,name")
      .eq("id", style.father_style_id)
      .single()
      .then(({ data }) => {
        if (!cancelled) setParentName(data?.name ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [style?.father_style_id]);

  // Lineage: styles retrained FROM this one.
  useEffect(() => {
    if (!style?.id) {
      setChildren([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("styles")
      .select("id,name,status,created_at")
      .eq("father_style_id", style.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setChildren(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [style?.id]);

  const patch = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!style) return;
      const { error } = await supabase.from("styles").update(updates as never).eq("id", style.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-styles"] });
      toast.success("Style updated");
    },
    onError: (e) => {
      console.error(e);
      toast.error("Update failed");
    },
  });

  if (!style) return null;

  const beforeBreakdown = breakdownFiles(style.before_image_urls);
  const afterBreakdown = breakdownFiles(style.after_image_urls);
  const bothFileListsEmpty = beforeBreakdown.total === 0 && afterBreakdown.total === 0;
  // Training happens on before↔after PAIRS, so the meaningful "imported"
  // number is the pair count (211) — not before+after summed (422, which the
  // stored total_images_imported double-counts).
  const pairCount = Math.min(beforeBreakdown.total, afterBreakdown.total);

  const allowed = style.allowed_user_ids ?? [];
  const isPublic = style.visibility === "public";
  const addableUsers = users.filter((u) => u.id !== style.user_id && !allowed.includes(u.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2">
            {style.name}
            {!style.style_id_external && (
              <Badge variant="outline" className="border-rating/40 text-[10px] text-rating">No model</Badge>
            )}
          </SheetTitle>
          <SheetDescription>{style.description || "No description"}</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-6">
          {/* ── Live upload monitor (only while a client is still uploading) ── */}
          <StyleUploadMonitor style={style} />

          {/* ── Identity ── */}
          <section className="space-y-3">
            <div className="aura-microlabel text-primary">Identity</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Internal ID">
                <span className="inline-flex items-center gap-1 font-mono text-xs">{style.id}<CopyButton value={style.id} /></span>
              </Field>
              <Field label="Owner">
                <span className="truncate" title={emailOf(style.user_id)}>{emailOf(style.user_id)}</span>
              </Field>
              <Field label="Slug">{style.slug || <span className="text-muted-foreground/50">—</span>}</Field>
              <Field label="Category">{style.category || <span className="text-muted-foreground/50">—</span>}</Field>
            </div>

            {/* Engine model id — the value actually sent to the editing engine */}
            <div className="space-y-1.5">
              <Label className="aura-microlabel text-muted-foreground">Engine model ID (style_id_external)</Label>
              <div className="flex items-center gap-2">
                {style.style_id_external ? (
                  <span className="inline-flex items-center gap-1 rounded-[--radius] bg-muted px-2 py-1 font-mono text-xs">
                    {style.style_id_external}<CopyButton value={style.style_id_external} />
                  </span>
                ) : (
                  <span className="text-xs text-rating">No model attached — this look can't edit photos.</span>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder={style.style_id_external ? "New model id (or empty to unlink)" : "e.g. 42 or model-abc123"}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={patch.isPending}
                  onClick={() => patch.mutate({ style_id_external: modelId.trim() || null }, { onSuccess: () => setModelId("") })}
                >
                  Save
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          {/* ── State & access ── */}
          <section className="space-y-3">
            <div className="aura-microlabel text-primary">State &amp; access</div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Public</p>
                <p className="text-xs text-muted-foreground">Visible &amp; usable by every account.</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={(v) => patch.mutate({ visibility: v ? "public" : "private" })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Off = hidden from every picker.</p>
              </div>
              <Switch checked={style.is_active} onCheckedChange={(v) => patch.mutate({ is_active: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Preset</p>
                <p className="text-xs text-muted-foreground">Featured as an official Aura look.</p>
              </div>
              <Switch checked={style.is_preset} onCheckedChange={(v) => patch.mutate({ is_preset: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Recommended</p>
                <p className="text-xs text-muted-foreground">Gets the "Pick" hint in the grid.</p>
              </div>
              <Switch checked={!!style.recommended} onCheckedChange={(v) => patch.mutate({ recommended: v })} />
            </div>
          </section>

          <Separator />

          {/* ── Allowed accounts ── */}
          <section className="space-y-3">
            <div className="aura-microlabel text-primary">Allowed accounts (private sharing)</div>
            <p className="text-xs text-muted-foreground">
              {isPublic
                ? "This style is Public, so everyone can use it regardless of this list."
                : "A private style is usable by its owner plus the accounts below."}
            </p>
            {allowed.length > 0 ? (
              <div className="space-y-1.5">
                {allowed.map((uid) => (
                  <div key={uid} className="flex items-center justify-between rounded-[--radius] border border-border bg-surface-2/40 px-2.5 py-1.5">
                    <span className="truncate text-xs">{emailOf(uid)}</span>
                    <button
                      type="button"
                      className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-destructive"
                      onClick={() => patch.mutate({ allowed_user_ids: allowed.filter((x) => x !== uid) })}
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60">No extra accounts.</p>
            )}
            <div className="flex items-center gap-2">
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Add an account…" /></SelectTrigger>
                <SelectContent>
                  {addableUsers.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No accounts to add</div>
                  ) : (
                    addableUsers.slice(0, 200).map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">{u.email}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!addUserId || patch.isPending}
                onClick={() => patch.mutate(
                  { allowed_user_ids: [...new Set([...allowed, addUserId])] },
                  { onSuccess: () => setAddUserId("") },
                )}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </section>

          <Separator />

          {/* ── Training data ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="aura-microlabel text-primary">Training data</div>
              <Button size="sm" variant="outline" onClick={() => { setGalleryInitialTab(undefined); setTrainingGalleryOpen(true); }}>
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Open training gallery
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Method">{style.upload_method || <span className="text-muted-foreground/50">—</span>}</Field>
              <Field label="Imported">
                {bothFileListsEmpty
                  ? <>{style.total_images_imported ?? 0} files</>
                  : <>{pairCount} {pairCount === 1 ? "pair" : "pairs"}</>}
              </Field>
              <Field label="Sessions">{style.training_sessions_count ?? 0}</Field>
            </div>
            {bothFileListsEmpty ? (
              <Field label="File count">
                {style.total_images_imported ?? 0} files imported <span className="text-muted-foreground/50">(before/after breakdown unavailable)</span>
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Before files">Before: {beforeBreakdown.total} files</Field>
                <Field label="After files">After: {afterBreakdown.total} files</Field>
              </div>
            )}
            <Field label={`Before images (${style.before_image_urls?.length ?? 0})`}>
              <ImageStrip urls={style.before_image_urls} />
            </Field>
            <Field label={`After images (${style.after_image_urls?.length ?? 0})`}>
              <ImageStrip urls={style.after_image_urls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Before file types">
                <FileTypeBreakdown breakdown={beforeBreakdown} />
              </Field>
              <Field label="After file types">
                <FileTypeBreakdown breakdown={afterBreakdown} />
              </Field>
            </div>
            {(style.google_before_urls?.length || style.google_after_urls?.length) ? (
              <>
                <Field label={`Google Drive — before (${style.google_before_urls?.length ?? 0})`}>
                  <LinkList urls={style.google_before_urls} />
                </Field>
                <Field label={`Google Drive — after (${style.google_after_urls?.length ?? 0})`}>
                  <LinkList urls={style.google_after_urls} />
                </Field>
              </>
            ) : null}
            {(style.manual_link_before || style.manual_link_after) && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Manual link (before)"><LinkList urls={style.manual_link_before ? [style.manual_link_before] : null} /></Field>
                <Field label="Manual link (after)"><LinkList urls={style.manual_link_after ? [style.manual_link_after] : null} /></Field>
              </div>
            )}
            {style.associated_tags && style.associated_tags.length > 0 && (
              <Field label="Tags">
                <div className="flex flex-wrap gap-1">
                  {style.associated_tags.map((t, i) => <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>)}
                </div>
              </Field>
            )}
          </section>

          <Separator />

          {/* ── Demo preview — run this style on the shared demo gallery ── */}
          <StyleDemoPreview
            styleId={style.id}
            onOpenGallery={() => { setGalleryInitialTab("demo"); setTrainingGalleryOpen(true); }}
          />

          <Separator />

          {/* ── Timeline ── */}
          <section className="space-y-3">
            <div className="aura-microlabel text-primary">Timeline</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Created">{fmt(style.created_at)}</Field>
              <Field label="Updated">{fmt(style.updated_at)}</Field>
              <Field label="Import started">{fmt(style.import_start_date)}</Field>
              <Field label="Import completed">{fmt(style.import_completion_date)}</Field>
              <Field label="Training started">{fmt(style.training_start_date)}</Field>
              <Field label="Training completed">{fmt(style.training_completion_date)}</Field>
              {/* Upload/import phase only. */}
              <Field label="Upload duration">
                {durationLabel(style.import_start_date, style.import_completion_date, "") ?? (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </Field>
              {/* Isolated training time (live-ticks while still running). */}
              <Field label="Training duration">
                {!style.training_start_date || !Number.isFinite(new Date(style.training_start_date).getTime()) ? (
                  <span className="text-muted-foreground/50">—</span>
                ) : style.training_completion_date ? (
                  durationLabel(style.training_start_date, style.training_completion_date, "") ?? (
                    <span className="text-muted-foreground/50">—</span>
                  )
                ) : (
                  <LiveTrainingDuration startIso={style.training_start_date} />
                )}
              </Field>
              {/* Whole lifecycle: record created → model ready (final approval). */}
              <Field label="Total (upload → approval)">
                {durationLabel(style.created_at, style.training_completion_date, "") ?? (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </Field>
              {/* Full processing span: import began → training finished. */}
              <Field label="Import → training end">
                {durationLabel(style.import_start_date, style.training_completion_date, "") ?? (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </Field>
            </div>
          </section>

          <Separator />

          {/* ── Diagnostics ── */}
          <section className="space-y-3">
            <div className="aura-microlabel text-primary">Diagnostics</div>
            {style.error_details && style.error_details.length > 0 ? (
              <div className="space-y-1.5">
                {style.error_details.map((e, i) => (
                  <div key={i} dir="auto" className="flex items-start gap-2 rounded-[--radius] border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    <span className="min-w-0 break-words font-mono leading-relaxed">{e}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60">No errors recorded.</p>
            )}

            {/* Team remarks */}
            <div className="space-y-1.5">
              <div className="aura-microlabel text-muted-foreground">Team remarks</div>
              {style.team_remarks && style.team_remarks.length > 0 && (
                <div className="space-y-1">
                  {style.team_remarks.map((r, i) => (
                    <div key={i} dir="auto" className="rounded-[--radius] bg-surface-2/50 px-2.5 py-1.5 text-xs text-muted-foreground">{r}</div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Add a note…" className="h-8 text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!remark.trim() || patch.isPending}
                  onClick={() => patch.mutate(
                    { team_remarks: [...(style.team_remarks ?? []), remark.trim()] },
                    { onSuccess: () => setRemark("") },
                  )}
                >
                  Add
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Lineage & retrain ── */}
          <section className="space-y-3">
            <div className="aura-microlabel text-primary">Lineage &amp; retrain</div>

            {style.father_style_id && (
              <button
                type="button"
                onClick={() => onOpenParent?.(style.father_style_id as string)}
                className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-surface-2/40 px-2.5 py-1.5 text-xs text-primary transition-colors hover:border-primary/50 hover:underline"
              >
                <GitBranch className="h-3.5 w-3.5 shrink-0" />
                Retrained from {parentName ?? "…"}
              </button>
            )}

            {children.length > 0 && (
              <div className="space-y-1.5">
                <div className="aura-microlabel text-muted-foreground">
                  Retrained children ({children.length})
                </div>
                {children.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpenParent?.(c.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-[--radius] border border-border bg-surface-2/40 px-2.5 py-1.5 text-left transition-colors hover:border-primary/50"
                  >
                    <span className="truncate text-xs">{c.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{c.status}</Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">{fmt(c.created_at)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!style.father_style_id && children.length === 0 && (
              <p className="text-xs text-muted-foreground/60">No retrain history yet.</p>
            )}

            <Button variant="glow" onClick={() => setRetrainOpen(true)}>Retrain…</Button>
          </section>

          <div className="h-4" />
        </div>

        {/* Nested INSIDE SheetContent on purpose: Radix DismissableLayer builds
            its layer stack from the React tree, so a stacked modal must be a
            descendant of the layer it sits on top of. As a sibling of
            SheetContent it registered as a peer layer and the Sheet's own
            focus/pointer settling read as an outside-interaction, dismissing it
            the instant it opened. Its own portal (position: fixed) still renders
            it full-screen regardless of where it lives in the tree. */}
        <StyleTrainingGalleryDialog style={style} open={trainingGalleryOpen} onOpenChange={setTrainingGalleryOpen} initialTab={galleryInitialTab} />
      </SheetContent>
      <RetrainStyleDialog
        parent={style}
        open={retrainOpen}
        onOpenChange={setRetrainOpen}
        onCreated={(newId) => {
          setRetrainOpen(false);
          onOpenParent?.(newId);
        }}
      />
    </Sheet>
  );
}
