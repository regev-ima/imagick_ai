import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Copy, Check, ExternalLink, X, Plus, AlertTriangle, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { breakdownFiles, type FileBreakdown, type StyleFileKind } from "@/lib/styleFiles";
import { formatDuration } from "@/lib/cullingEta";
import { toast } from "sonner";
import { format } from "date-fns";
import { StyleTrainingGalleryDialog } from "@/components/admin/StyleTrainingGalleryDialog";

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
            {KIND_LABELS[k]} {breakdown.byKind[k]}
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

export function StyleDetailsSheet({ style, users, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [modelId, setModelId] = useState("");
  const [addUserId, setAddUserId] = useState("");
  const [remark, setRemark] = useState("");
  const [trainingGalleryOpen, setTrainingGalleryOpen] = useState(false);

  const emailOf = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.email]));
    return (id: string) => map.get(id) || id;
  }, [users]);

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
              <Button size="sm" variant="outline" onClick={() => setTrainingGalleryOpen(true)}>
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Open training gallery
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Method">{style.upload_method || <span className="text-muted-foreground/50">—</span>}</Field>
              <Field label="Imported">{style.total_images_imported ?? 0}{style.total_images_to_import ? ` / ${style.total_images_to_import}` : ""}</Field>
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
              <Field label="Upload duration">
                {durationLabel(style.import_start_date, style.import_completion_date, "Upload took ") ?? (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </Field>
              <Field label="Training duration">
                {!style.training_start_date || !Number.isFinite(new Date(style.training_start_date).getTime()) ? (
                  <span className="text-muted-foreground/50">—</span>
                ) : style.training_completion_date ? (
                  durationLabel(style.training_start_date, style.training_completion_date, "Training took ") ?? (
                    <span className="text-muted-foreground/50">—</span>
                  )
                ) : (
                  <LiveTrainingDuration startIso={style.training_start_date} />
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

          <div className="h-4" />
        </div>

        <StyleTrainingGalleryDialog style={style} open={trainingGalleryOpen} onOpenChange={setTrainingGalleryOpen} />
      </SheetContent>
    </Sheet>
  );
}
