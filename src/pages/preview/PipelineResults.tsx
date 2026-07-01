import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, Users, LayoutGrid, Star, X, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getThumbnailUrl, getPreviewUrl } from "@/lib/imageUrls";
import { toast } from "sonner";

/**
 * Pipeline results — reads Phase-A/B output from the DB (image_features +
 * face_detections/face_clusters) and shows a gallery's visual clusters, people,
 * and best-first ranking. "Process gallery" kicks off the process-pipeline
 * edge function (Modal engine). Populates once the engine has run.
 */

// New pipeline tables aren't in the generated Supabase types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface GalleryRow { id: string; name: string }
interface ImageRow { id: string; original_url: string; filename: string }
interface Tag { tag: string; score: number; src?: "user" | "general" }
interface Label { tag: string; src: "user" | "general" }
interface Feature { image_id: string; aesthetic: number | null; visual_cluster: number | null; tags: Tag[] | null }
interface FaceDet { image_id: string; cluster_id: string | null }
type Bbox = { x: number; y: number; width: number; height: number };
interface FaceCluster { id: string; face_count: number; representative_image_id: string | null; representative_bbox: Bbox | null }
interface Timing { download_ms?: number; clip_ms?: number; faces_ms?: number; wall_ms?: number; images?: number; faces_provider?: string | null }

export default function PipelineResults() {
  const [galleryId, setGalleryId] = useState<string>("");
  const [view, setView] = useState<"clusters" | "people" | "top">("clusters");
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Which steps to run. Faces (people) is the heavy, premium-gated step; the rest
  // ride on the single cheap CLIP embedding.
  const [opts, setOpts] = useState<{ cluster: boolean; faces: boolean; tags: boolean; source: "preview" | "thumbnail" }>(
    { cluster: true, faces: true, tags: true, source: "preview" },
  );
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const galleries = useQuery({
    queryKey: ["pipeline-galleries"],
    queryFn: async (): Promise<GalleryRow[]> => {
      // Only id/name so the picker works even before the pipeline migration runs.
      const { data, error } = await supabase
        .from("galleries").select("id, name").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as GalleryRow[]) ?? [];
    },
  });

  const results = useQuery({
    enabled: !!galleryId,
    queryKey: ["pipeline-results", galleryId],
    refetchInterval: (q) => ((q.state.data as { status?: string } | undefined)?.status === "processing" ? 4000 : false),
    queryFn: async () => {
      const [gRes, fRes, fdRes, fcRes, imgRes] = await Promise.all([
        supabase.from("galleries").select("pipeline_status, pipeline_timing").eq("id", galleryId).single(),
        db.from("image_features").select("image_id, aesthetic, visual_cluster, tags").eq("gallery_id", galleryId),
        supabase.from("face_detections").select("image_id, cluster_id").eq("gallery_id", galleryId).not("cluster_id", "is", null),
        supabase.from("face_clusters").select("id, face_count, representative_image_id, representative_bbox").eq("gallery_id", galleryId).order("face_count", { ascending: false }),
        supabase.from("gallery_images").select("id, original_url, filename").eq("gallery_id", galleryId),
      ]);
      const g = gRes.data as { pipeline_status?: string; pipeline_timing?: Timing } | null;
      return {
        status: g?.pipeline_status ?? "idle",
        timing: g?.pipeline_timing ?? null,
        features: (fRes.data as Feature[]) ?? [],
        faces: (fdRes.data as FaceDet[]) ?? [],
        faceClusters: (fcRes.data as FaceCluster[]) ?? [],
        images: (imgRes.data as ImageRow[]) ?? [],
      };
    },
  });

  const process = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("process-pipeline", { body: { galleryId, options: opts } });
      if (res.error) {
        // Surface the function's real error body, not the generic wrapper text.
        let msg = res.error.message;
        const ctx = (res.error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try { const b = await ctx.json(); msg = b?.message || b?.error || msg; } catch { /* keep msg */ }
        }
        throw new Error(msg);
      }
      return res.data;
    },
    onSuccess: () => { toast.success("עיבוד הגלריה התחיל"); results.refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const imById = useMemo(() => {
    const m = new Map<string, ImageRow>();
    for (const im of results.data?.images ?? []) m.set(im.id, im);
    return m;
  }, [results.data]);

  // Tag assignment with per-tag mean-centering: CLIP gives each tag a baseline
  // bias, so one "sticky" tag can win on every photo. We subtract each tag's
  // gallery-wide average so each image surfaces what's DISTINCTIVE about it.
  // Guarantee ≥1 tag from the USER list per image, plus a few more distinctive
  // ones (user or general). Each label carries its source for coloring.
  const labelsByImg = useMemo(() => {
    const feats = results.data?.features ?? [];
    const sum = new Map<string, number>(), cnt = new Map<string, number>();
    for (const f of feats) for (const t of (f.tags ?? [])) {
      sum.set(t.tag, (sum.get(t.tag) ?? 0) + t.score);
      cnt.set(t.tag, (cnt.get(t.tag) ?? 0) + 1);
    }
    const mean = new Map<string, number>();
    for (const [k, v] of sum) mean.set(k, v / (cnt.get(k) || 1));
    const m = new Map<string, Label[]>();
    for (const f of feats) {
      const cal = (f.tags ?? [])
        .map((t) => ({ tag: t.tag, src: (t.src ?? "user") as "user" | "general", c: t.score - (mean.get(t.tag) ?? 0) }))
        .sort((a, b) => b.c - a.c);
      const userCal = cal.filter((x) => x.src === "user");
      const genCal = cal.filter((x) => x.src === "general");
      const chosen: Label[] = [];
      if (userCal.length) chosen.push({ tag: userCal[0].tag, src: "user" });         // guaranteed user tag
      for (const x of userCal.slice(1)) if (x.c > 0.012 && chosen.length < 3) chosen.push({ tag: x.tag, src: "user" });
      for (const x of genCal) if (x.c > 0.02 && chosen.length < 4) chosen.push({ tag: x.tag, src: "general" });
      m.set(f.image_id, chosen);
    }
    return m;
  }, [results.data]);

  const labelsFor = (f: Feature | undefined) => (f ? labelsByImg.get(f.image_id) ?? [] : []);

  // Tag filter bar: every assigned tag with a count + its source (for coloring).
  const tagCounts = useMemo(() => {
    const m = new Map<string, { count: number; src: "user" | "general" }>();
    for (const labels of labelsByImg.values())
      for (const t of labels) {
        const e = m.get(t.tag) ?? { count: 0, src: t.src };
        e.count++; e.src = t.src; m.set(t.tag, e);
      }
    return [...m.entries()].map(([tag, v]) => ({ tag, ...v })).sort((a, b) => b.count - a.count);
  }, [labelsByImg]);

  const matchesTag = (f: Feature) => !tagFilter || (labelsByImg.get(f.image_id) ?? []).some((l) => l.tag === tagFilter);

  // Visual clusters: group by visual_cluster, best-aesthetic first within each.
  const clusters = useMemo(() => {
    const map = new Map<number, Feature[]>();
    for (const f of results.data?.features ?? []) {
      if (f.visual_cluster == null) continue;
      const arr = map.get(f.visual_cluster) ?? [];
      arr.push(f);
      map.set(f.visual_cluster, arr);
    }
    return [...map.entries()]
      .map(([id, fs]) => ({ id, items: fs.sort((a, b) => (b.aesthetic ?? 0) - (a.aesthetic ?? 0)) }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [results.data]);

  const top = useMemo(
    () => [...(results.data?.features ?? [])]
      .filter(matchesTag)
      .sort((a, b) => (b.aesthetic ?? 0) - (a.aesthetic ?? 0)).slice(0, 40),
    [results.data, tagFilter],
  );

  const people = useMemo(() => {
    const byCluster = new Map<string, string[]>();
    for (const fd of results.data?.faces ?? []) {
      if (!fd.cluster_id) continue;
      const arr = byCluster.get(fd.cluster_id) ?? [];
      if (!arr.includes(fd.image_id)) arr.push(fd.image_id);
      byCluster.set(fd.cluster_id, arr);
    }
    return (results.data?.faceClusters ?? []).map((c) => ({
      id: c.id,
      rep: c.representative_image_id,
      repBbox: c.representative_bbox,
      images: byCluster.get(c.id) ?? [],
    })).filter((p) => p.images.length > 0);
  }, [results.data]);

  // Re-cluster images at a chosen similarity threshold (loose/medium/strict).
  const recluster = useMutation({
    mutationFn: async (threshold: number) => {
      const { error } = await db.rpc("cluster_gallery_images", { p_gallery_id: galleryId, p_threshold: threshold });
      if (error) throw error;
    },
    onSuccess: () => results.refetch(),
    onError: (e: Error) => toast.error(e.message),
  });

  const status = results.data?.status;
  const thumb = (id: string) => { const im = imById.get(id); return im ? getThumbnailUrl(im.original_url) : ""; };
  const preview = (id: string) => { const im = imById.get(id); return im ? getPreviewUrl(im.original_url) : ""; };
  // The LAION aesthetic score is only meaningful as a *relative* ranking — its
  // absolute values cluster around 5–6/10 even for great professional photos, so
  // showing them raw (÷2) looks insultingly low to a photographer. Calibrate to
  // stars *within this gallery*: the best shots reach ~5★ and even the weakest
  // stay respectable. Anchored on the 5th–95th percentiles so one outlier (a
  // blurry test frame, a screenshot) can't drag the whole scale.
  const score = useMemo(() => {
    const FLOOR = 3.6, TOP = 5.0;
    const vals = (results.data?.features ?? [])
      .map((f) => f.aesthetic)
      .filter((a): a is number => a != null)
      .sort((a, b) => a - b);
    if (vals.length < 5) return (a: number | null) => (a == null ? "—" : "4.5");
    const pct = (p: number) => vals[Math.max(0, Math.min(vals.length - 1, Math.round((p / 100) * (vals.length - 1))))];
    const lo = pct(5), hi = pct(95), span = hi - lo || 1;
    return (a: number | null) => {
      if (a == null) return "—";
      const t = Math.min(1, Math.max(0, (a - lo) / span));
      return (FLOOR + t * (TOP - FLOOR)).toFixed(1);
    };
  }, [results.data]);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <h1 className="text-xl font-semibold">תוצאות הצינור — קיבוץ, אנשים, דירוג</h1>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={galleryId}
            onChange={(e) => setGalleryId(e.target.value)}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
          >
            <option value="">בחר גלריה…</option>
            {(galleries.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          {galleryId && (
            <button
              onClick={() => process.mutate()}
              disabled={process.isPending || status === "processing"}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {(process.isPending || status === "processing") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              עבד גלריה
            </button>
          )}
          {status && (
            <span className="text-xs text-muted-foreground">
              סטטוס: <b className="text-foreground">{status}</b>
              {status === "processing" && (() => {
                const done = results.data?.features.length ?? 0;
                const total = results.data?.images.length ?? 0;
                const pct = total ? Math.round((done / total) * 100) : 0;
                return <b className="text-primary"> — מעבד {done}/{total} ({pct}%)…</b>;
              })()}
            </span>
          )}
        </div>

        {galleryId && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>שלבים לעיבוד:</span>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked readOnly className="accent-primary" />
              דירוג <span className="opacity-60">(תמיד, זול)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={opts.tags}
                onChange={(e) => setOpts((o) => ({ ...o, tags: e.target.checked }))}
                className="accent-primary" />
              תיוג <span className="opacity-60">(זול)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={opts.cluster}
                onChange={(e) => setOpts((o) => ({ ...o, cluster: e.target.checked }))}
                className="accent-primary" />
              קיבוץ תמונות
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={opts.faces}
                onChange={(e) => setOpts((o) => ({ ...o, faces: e.target.checked }))}
                className="accent-primary" />
              זיהוי אנשים <span className="rounded bg-amber-500/20 px-1 text-amber-600">פרימיום</span>
              <span className="opacity-60">(השלב היקר — ~40שׁ)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={opts.source === "thumbnail"}
                onChange={(e) => setOpts((o) => ({ ...o, source: e.target.checked ? "thumbnail" : "preview" }))}
                className="accent-primary" />
              תמונות מוקטנות <span className="opacity-60">(thumbnail — הכי זול/מהיר, בלי פנים)</span>
            </label>
          </div>
        )}

        {galleryId && (
          <>
            <div className="mt-4 flex gap-2">
              {([["clusters", "קבוצות", LayoutGrid], ["people", "אנשים", Users], ["top", "הכי טובות", Star]] as const).map(
                ([key, label, Icon]) => (
                  <button
                    key={key}
                    onClick={() => setView(key)}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${
                      view === key ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ),
              )}
            </div>

            {/* Per-stage timing */}
            {results.data?.timing && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                <span>⏱ זמני עיבוד ({results.data.timing.images ?? 0} תמונות):</span>
                <span>הורדה <b className="text-foreground">{((results.data.timing.download_ms ?? 0) / 1000).toFixed(1)}ש׳</b></span>
                <span>CLIP+ציון <b className="text-foreground">{((results.data.timing.clip_ms ?? 0) / 1000).toFixed(1)}ש׳</b></span>
                <span>פרצופים <b className="text-foreground">{((results.data.timing.faces_ms ?? 0) / 1000).toFixed(1)}ש׳</b>
                  {results.data.timing.faces_provider && (
                    <b className={results.data.timing.faces_provider === "GPU" ? "text-green-500" : "text-red-500"}> ({results.data.timing.faces_provider})</b>
                  )}
                </span>
                <span>סה״כ <b className="text-foreground">{((results.data.timing.wall_ms ?? 0) / 1000).toFixed(1)}ש׳</b></span>
              </div>
            )}

            {/* Tag panel — all tags in the gallery, color-coded by source, clickable to filter */}
            {tagCounts.length > 0 && (
              <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-medium text-foreground">תגיות בגלריה</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" /> הרשימה שלך</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> הצעות המערכת</span>
                  {tagFilter && (
                    <button onClick={() => setTagFilter(null)}
                      className="rounded-full border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground">✕ נקה סינון</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tagCounts.map(({ tag, count, src }) => {
                    const active = tag === tagFilter;
                    const base = src === "user" ? "bg-blue-600" : "bg-amber-500";
                    return (
                      <button key={tag}
                        onClick={() => { setTagFilter(active ? null : tag); setView("top"); }}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium text-white transition ${base} ${active ? "ring-2 ring-white/70" : "opacity-85 hover:opacity-100"}`}>
                        {tag} <span className="opacity-75">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clustering level (re-cluster on demand) */}
            {view === "clusters" && (results.data?.features.length ?? 0) > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                דרגת קיבוץ:
                <div className="flex overflow-hidden rounded-md border border-border">
                  {([["רופף", 0.80], ["בינוני", 0.88], ["מהודק", 0.93]] as const).map(([label, t], i) => (
                    <button
                      key={label}
                      onClick={() => recluster.mutate(t)}
                      disabled={recluster.isPending}
                      className={`bg-surface-2 px-2.5 py-1 font-medium text-muted-foreground hover:text-foreground ${i > 0 ? "border-r border-border" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {recluster.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </div>
            )}

            {results.isLoading && <div className="mt-6 text-sm text-muted-foreground">טוען…</div>}

            {!results.isLoading && (results.data?.features.length ?? 0) === 0 && (
              <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                אין עדיין תוצאות. לחץ "עבד גלריה" כדי להריץ את המנוע (דורש שה-Modal יהיה פרוס).
              </div>
            )}

            {/* Visual clusters */}
            {view === "clusters" && clusters.map((c) => (
              <div key={c.id} className="mt-5">
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">קבוצה {c.id} · {c.items.length} תמונות</div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
                  {c.items.map((f) => <Thumb key={f.image_id} url={thumb(f.image_id)} score={score(f.aesthetic)} tags={labelsFor(f)} onOpen={() => setLightbox(preview(f.image_id))} />)}
                </div>
              </div>
            ))}

            {/* People */}
            {view === "people" && (
              <div className="mt-5 space-y-4">
                {people.map((p, i) => (
                  <div key={p.id} className="rounded-lg border border-border bg-surface-2 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      {p.rep && <FaceCrop url={imById.get(p.rep)?.original_url || ""} bbox={p.repBbox} size={44} />}
                      אדם {i + 1} <span className="text-muted-foreground">· {p.images.length} תמונות</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                      {p.images.map((id) => <Thumb key={id} url={thumb(id)} onOpen={() => setLightbox(preview(id))} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Best of gallery */}
            {view === "top" && (
              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
                {top.map((f) => <Thumb key={f.image_id} url={thumb(f.image_id)} score={score(f.aesthetic)} tags={labelsFor(f)} onOpen={() => setLightbox(preview(f.image_id))} />)}
              </div>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button className="absolute right-4 top-4 text-white/80 hover:text-white"><X className="h-7 w-7" /></button>
          <img src={lightbox} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// Crops the representative face out of the full image (bbox is in original-image
// pixels) onto a small canvas — so the avatar shows the face, not the whole photo.
function FaceCrop({ url, bbox, size = 44 }: { url: string; bbox: Bbox | null; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !url || !bbox) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const pad = 0.4;
      const x = Math.max(0, bbox.x - bbox.width * pad);
      const y = Math.max(0, bbox.y - bbox.height * pad);
      const w = Math.min(img.naturalWidth - x, bbox.width * (1 + 2 * pad));
      const h = Math.min(img.naturalHeight - y, bbox.height * (1 + 2 * pad));
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, x, y, w, h, 0, 0, size, size);
    };
    img.src = url;
  }, [url, bbox, size]);
  if (!bbox) return <div className="rounded-full bg-surface-2" style={{ width: size, height: size }} />;
  return <canvas ref={ref} width={size} height={size} className="rounded-full object-cover" />;
}

function Thumb({ url, score, tags, onOpen }: { url: string; score?: string; tags?: Label[]; onOpen: () => void }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded bg-surface-2">
      {url && <img src={url} alt="" loading="lazy" onClick={onOpen} className="h-full w-full cursor-zoom-in object-cover" />}
      {score && <span className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[10px] font-bold text-white">{score}</span>}
      {tags && tags.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-gradient-to-t from-black/85 to-transparent p-1.5 pt-5">
          {tags.map((t) => (
            <span key={t.tag}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white ${
                t.src === "user" ? "bg-blue-600/90" : "bg-amber-500/90"
              }`}>{t.tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
