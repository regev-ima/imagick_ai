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

// image_features (CLIP) isn't in the generated Supabase types — cast for that read.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// OLD photo-shoot label set the VLM culling picks from (same list as the backend).
const DEFAULT_LABELS = [
  "Preparations", "Outdoor photography", "Couple moments",
  "Family & Reception", "Ceremony", "Dance/Party", "Other",
];

// Photo-style tags the VLM (OpenRouter) chooses from — tagging is NOT via CLIP.
const DEFAULT_TAGS = [
  "תקריב פנים", "גוף מלא", "קלוז-אפ", "פרופיל", "סביבתי", "סטודיו",
  "אור טבעי", "שחור-לבן", "הבעה", "מונחה", "ספונטני", "יצירתי",
];

// Vision models to A/B for cost↔quality — chosen per test from the top dropdown.
const VLM_MODELS = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini · זול" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash · זול" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku · זול" },
  { id: "openai/gpt-4o", label: "GPT-4o · איכות" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet · איכות" },
  { id: "google/gemini-1.5-pro", label: "Gemini 1.5 Pro · איכות" },
];

interface GalleryRow { id: string; name: string }
interface CullingMetrics {
  culling_score: number | null;
  culling_label: string | null;
  subject_sharpness: number | null;
  background_sharpness: number | null;
  thirds_rule: number | null;
  intended_facial_expression: number | null;
}
interface ImageRow extends CullingMetrics {
  id: string; original_url: string; filename: string;
  ai_tags: string[] | null;
  similarity_group_1: number | null;
  similarity_group_2: number | null;
  similarity_group_3: number | null;
}
// CLIP tags from a PRIOR run (no longer produced — tagging is via the VLM now).
// Kept for display so existing data isn't hidden.
interface Feature { image_id: string; tags: { tag: string; score: number; src?: "user" | "general" }[] | null }
interface FaceDet { image_id: string; cluster_id: string | null }
type Bbox = { x: number; y: number; width: number; height: number };
interface FaceCluster { id: string; face_count: number; representative_image_id: string | null; representative_bbox: Bbox | null }
interface Timing {
  download_ms?: number; clip_ms?: number; faces_ms?: number; cull_ms?: number;
  wall_ms?: number; images?: number; faces_provider?: string | null;
  cull_cost_usd?: number; modal_cost_usd?: number; model?: string | null;
}

export default function PipelineResults() {
  const [galleryId, setGalleryId] = useState<string>("");
  const [view, setView] = useState<"clusters" | "people" | "top">("clusters");
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Which steps to run. Faces (people) is the heavy, premium-gated step; the rest
  // ride on the single cheap CLIP embedding.
  const [opts, setOpts] = useState<{
    cluster: boolean; faces: boolean; tags: boolean; culling: boolean;
    timeThreshold: number | null; model: string;
  }>(
    // timeThreshold = the hard EXIF grouping gate in SECONDS (null = no time gate).
    // The Modal image source is derived automatically (faces → preview; else the
    // cheaper thumbnail), so there's no manual source toggle.
    { cluster: true, faces: true, tags: true, culling: true, timeThreshold: 600, model: VLM_MODELS[0].id },
  );
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [groupLevel, setGroupLevel] = useState<1 | 2 | 3>(1); // which similarity_group_N to view

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

  // The FULL OpenRouter vision-model list (sorted cheap→expensive), fetched live.
  const orModels = useQuery({
    queryKey: ["or-vision-models"],
    staleTime: 3_600_000,
    queryFn: async (): Promise<{ id: string; name: string; prompt: number; completion: number; image: number }[]> => {
      const r = await fetch(`${window.location.origin}/api/or-models`);
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      return d?.models ?? [];
    },
  });
  // Options for the dropdown — live list if available, else the static fallback.
  // Show BOTH input (קלט) and output (פלט) price per 1M tokens. OpenRouter's -1
  // means variable/unknown → shown as "?".
  const modelOptions = useMemo(() => {
    const live = orModels.data ?? [];
    if (!live.length) return VLM_MODELS.map((m) => ({ id: m.id, label: m.label }));
    const money = (perToken: number) => (perToken < 0 ? "?" : `$${(perToken * 1e6).toFixed(2)}`);
    return live.map((m) => ({
      id: m.id,
      label: `${m.name} · קלט ${money(m.prompt)} · פלט ${money(m.completion)} (ל-1M טוקנים)`,
    }));
  }, [orModels.data]);

  const results = useQuery({
    enabled: !!galleryId,
    queryKey: ["pipeline-results", galleryId],
    refetchInterval: (q) => ((q.state.data as { status?: string } | undefined)?.status === "processing" ? 4000 : false),
    queryFn: async () => {
      const [gRes, fRes, fdRes, fcRes, imgRes] = await Promise.all([
        supabase.from("galleries").select("pipeline_status, pipeline_timing").eq("id", galleryId).single(),
        db.from("image_features").select("image_id, tags").eq("gallery_id", galleryId), // CLIP tags (display only)
        supabase.from("face_detections").select("image_id, cluster_id").eq("gallery_id", galleryId).not("cluster_id", "is", null),
        supabase.from("face_clusters").select("id, face_count, representative_image_id, representative_bbox").eq("gallery_id", galleryId).order("face_count", { ascending: false }),
        supabase.from("gallery_images").select([
          "id", "original_url", "filename",
          "culling_score", "culling_label",
          "subject_sharpness", "background_sharpness", "thirds_rule", "intended_facial_expression",
          "ai_tags", "similarity_group_1", "similarity_group_2", "similarity_group_3",
        ].join(", ")).eq("gallery_id", galleryId),
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
      // The OLD culling/grouping needs the score-vision (OpenRouter) endpoint URL,
      // the label set, and the grouping thresholds + EXIF time gate.
      const options = {
        ...opts,
        // Faces need the full-res preview; otherwise CLIP grouping rides on the
        // cheapest thumbnail. Derived automatically — no manual toggle.
        source: opts.faces ? "preview" : "thumbnail",
        scoreVisionUrl: `${window.location.origin}/api/score-vision`,
        labels: DEFAULT_LABELS,
        tagsList: DEFAULT_TAGS,          // VLM tagging candidates (not CLIP)
        thresholds: [0.5, 0.7, 0.9],
      };
      const res = await supabase.functions.invoke("process-pipeline", { body: { galleryId, options } });
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

  const groupOf = (im: ImageRow, level: 1 | 2 | 3) =>
    level === 1 ? im.similarity_group_1 : level === 2 ? im.similarity_group_2 : im.similarity_group_3;

  // Rank helper: culling score (VLM) descending — NOT CLIP.
  const byCulling = (a: ImageRow, b: ImageRow) => (b.culling_score ?? 0) - (a.culling_score ?? 0);
  const matchesTag = (im: ImageRow) => !tagFilter || (im.ai_tags ?? []).includes(tagFilter);

  // Tag panel: every VLM tag in the gallery with a count (for the filter bar).
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const im of results.data?.images ?? [])
      for (const t of (im.ai_tags ?? [])) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  }, [results.data]);

  // Existing CLIP tags (display only — not produced anymore). Mean-center per tag so
  // each image surfaces its most DISTINCTIVE CLIP tags, then keep the top few.
  const clipTagsByImg = useMemo(() => {
    const feats = results.data?.features ?? [];
    const sum = new Map<string, number>(), cnt = new Map<string, number>();
    for (const f of feats) for (const t of (f.tags ?? [])) {
      sum.set(t.tag, (sum.get(t.tag) ?? 0) + t.score);
      cnt.set(t.tag, (cnt.get(t.tag) ?? 0) + 1);
    }
    const mean = new Map<string, number>();
    for (const [k, v] of sum) mean.set(k, v / (cnt.get(k) || 1));
    const m = new Map<string, string[]>();
    for (const f of feats) {
      const cal = (f.tags ?? [])
        .map((t) => ({ tag: t.tag, c: t.score - (mean.get(t.tag) ?? 0) }))
        .sort((a, b) => b.c - a.c);
      m.set(f.image_id, cal.slice(0, 3).filter((x) => x.c > 0.008).map((x) => x.tag));
    }
    return m;
  }, [results.data]);

  const clipTagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const tags of clipTagsByImg.values()) for (const t of tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  }, [clipTagsByImg]);

  const hasClipTags = clipTagCounts.length > 0;

  // Groups from Modal community-detection (similarity_group_N), ranked within each
  // group by the VLM culling score, groups ordered by size.
  const clusters = useMemo(() => {
    const map = new Map<number, ImageRow[]>();
    for (const im of results.data?.images ?? []) {
      const g = groupOf(im, groupLevel);
      if (g == null) continue;
      const arr = map.get(g) ?? [];
      arr.push(im);
      map.set(g, arr);
    }
    return [...map.entries()]
      .map(([id, items]) => ({ id, items: [...items].sort(byCulling) }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [results.data, groupLevel]);

  const top = useMemo(
    () => (results.data?.images ?? []).filter(matchesTag).slice().sort(byCulling).slice(0, 60),
    [results.data, tagFilter],
  );

  const scoredCount = useMemo(
    () => (results.data?.images ?? []).filter((im) => im.culling_score != null).length,
    [results.data],
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

  const status = results.data?.status;
  const thumb = (id: string) => { const im = imById.get(id); return im ? getThumbnailUrl(im.original_url) : ""; };
  const preview = (id: string) => { const im = imById.get(id); return im ? getPreviewUrl(im.original_url) : ""; };

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
                const done = scoredCount;
                const total = results.data?.images.length ?? 0;
                const pct = total ? Math.round((done / total) * 100) : 0;
                return <b className="text-primary"> — מדרג {done}/{total} ({pct}%)…</b>;
              })()}
            </span>
          )}
        </div>

        {galleryId && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <label className="flex items-center gap-1.5 font-medium text-foreground" title="כל מודלי הראייה של OpenRouter — ממוין מהזול ליקר ($/1M טוקני קלט)">
              מודל AI{orModels.isLoading ? " (טוען…)" : ""}:
              <select value={opts.model}
                onChange={(e) => setOpts((o) => ({ ...o, model: e.target.value }))}
                className="max-w-[30rem] rounded-md border border-border bg-surface-2 px-2 py-1 text-xs">
                {modelOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <span>שלבים:</span>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={opts.culling}
                onChange={(e) => setOpts((o) => ({ ...o, culling: e.target.checked }))}
                className="accent-primary" />
              דירוג <span className="opacity-60">(VLM)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={opts.tags}
                onChange={(e) => setOpts((o) => ({ ...o, tags: e.target.checked }))}
                className="accent-primary" />
              תיוג <span className="opacity-60">(VLM)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={opts.cluster}
                onChange={(e) => setOpts((o) => ({ ...o, cluster: e.target.checked }))}
                className="accent-primary" />
              קיבוץ תמונות
            </label>
            {opts.cluster && (
              <label className="flex items-center gap-1.5" title="פער זמן EXIF מקסימלי בין תמונות באותה קבוצה (שניות)">
                מרווח זמן (שנ'):
                <input type="number" min={0} step={30}
                  value={opts.timeThreshold ?? ""}
                  placeholder="ללא"
                  onChange={(e) => setOpts((o) => ({
                    ...o, timeThreshold: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                  }))}
                  className="w-20 rounded border border-border bg-background px-1 py-0.5 text-foreground" />
              </label>
            )}
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={opts.faces}
                onChange={(e) => setOpts((o) => ({ ...o, faces: e.target.checked }))}
                className="accent-primary" />
              זיהוי אנשים <span className="rounded bg-amber-500/20 px-1 text-amber-600">פרימיום</span>
              <span className="opacity-60">(השלב היקר — ~40שׁ)</span>
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

            {/* Time + cost dashboard (both engines) */}
            {results.data?.timing && (() => {
              const t = results.data.timing;
              const s = (ms?: number) => ((ms ?? 0) / 1000).toFixed(1);
              const modalCost = t.modal_cost_usd ?? 0;
              const orCost = t.cull_cost_usd ?? 0;
              const n = t.images ?? 0;
              const per1000 = (usd: number) => (n ? (usd / n) * 1000 : 0);
              return (
                <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>⏱ זמן ({n} תמונות):</span>
                    <span>הורדה <b className="text-foreground">{s(t.download_ms)}ש׳</b></span>
                    <span>CLIP (קיבוץ) <b className="text-foreground">{s(t.clip_ms)}ש׳</b></span>
                    <span>פרצופים <b className="text-foreground">{s(t.faces_ms)}ש׳</b>
                      {t.faces_provider && (
                        <b className={t.faces_provider === "GPU" ? "text-green-500" : "text-red-500"}> ({t.faces_provider})</b>
                      )}
                    </span>
                    <span>דירוג/תיוג VLM <b className="text-foreground">{s(t.cull_ms)}ש׳</b></span>
                    <span>סה״כ <b className="text-foreground">{s(t.wall_ms)}ש׳</b></span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-1.5">
                    <span>💰 עלות:</span>
                    <span>Modal (GPU, אומדן) <b className="text-foreground">${modalCost.toFixed(4)}</b>
                      <span className="opacity-60"> (~${per1000(modalCost).toFixed(2)}/1000)</span>
                    </span>
                    <span>OpenRouter <b className="text-foreground">${orCost.toFixed(4)}</b>
                      <span className="opacity-60"> (~${per1000(orCost).toFixed(2)}/1000)</span>
                    </span>
                    <span>סה״כ <b className="text-foreground">${(modalCost + orCost).toFixed(4)}</b>
                      <span className="opacity-60"> (~${per1000(modalCost + orCost).toFixed(2)}/1000)</span>
                    </span>
                    {t.model && <span>מודל: <b className="text-foreground">{t.model}</b></span>}
                  </div>
                </div>
              );
            })()}

            {/* Provenance — who produces what, stated explicitly */}
            <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3 text-xs">
              <div className="mb-2 font-medium text-foreground">מי יוצר מה</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <b className="text-foreground">ציון + תת-ציונים</b> (חדות נושא/רקע, שליש, הבעה): OpenRouter (VLM){results.data?.timing?.model ? ` · ${results.data.timing.model}` : ""}</li>
                <li>• <b className="text-foreground">דירוג / קטגוריה</b> (התווית הסגולה): OpenRouter (VLM)</li>
                <li>• <b className="text-foreground">תגיות</b>: <span className="text-blue-500">🔵 OpenRouter (VLM)</span> — מהרשימה הקבועה שנשלחה · <span className="text-amber-500">🟠 CLIP</span> — קיים מריצות קודמות, <b>לא מיוצר יותר</b></li>
                <li>• <b className="text-foreground">קיבוץ תמונות</b>: CLIP (community-detection + זמן EXIF) · <b className="text-foreground">זיהוי פנים</b>: ArcFace</li>
              </ul>
              <div className="mt-2 border-t border-border pt-2">
                <span className="text-muted-foreground">תגיות שנשלחו ל-VLM (רשימה קבועה):</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {DEFAULT_TAGS.map((t) => (
                    <span key={t} className="rounded-full border border-blue-500/50 px-2 py-0.5 text-[11px] text-blue-400">{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Tag panel — which tags EXIST in the gallery, split by engine, clickable to filter */}
            {(tagCounts.length > 0 || hasClipTags) && (
              <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface-2 p-3">
                {tagFilter && (
                  <button onClick={() => setTagFilter(null)}
                    className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">✕ נקה סינון</button>
                )}
                {tagCounts.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs"><span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" /><span className="font-medium text-foreground">תגיות VLM (OpenRouter)</span></div>
                    <div className="flex flex-wrap gap-1.5">
                      {tagCounts.map(({ tag, count }) => {
                        const active = tag === tagFilter;
                        return (
                          <button key={tag}
                            onClick={() => { setTagFilter(active ? null : tag); setView("top"); }}
                            className={`rounded-full bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition ${active ? "ring-2 ring-white/70" : "opacity-85 hover:opacity-100"}`}>
                            {tag} <span className="opacity-75">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {hasClipTags && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /><span className="font-medium text-foreground">תגיות CLIP (ישן — לא מיוצר יותר)</span></div>
                    <div className="flex flex-wrap gap-1.5">
                      {clipTagCounts.map(({ tag, count }) => (
                        <span key={tag} className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-medium text-white opacity-85">
                          {tag} <span className="opacity-75">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Grouping level — which similarity_group_N (Modal community-detection) to view */}
            {view === "clusters" && clusters.length > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                דרגת קיבוץ:
                <div className="flex overflow-hidden rounded-md border border-border">
                  {([[1, "רופף"], [2, "בינוני"], [3, "מהודק"]] as const).map(([lvl, label], i) => (
                    <button key={lvl}
                      onClick={() => setGroupLevel(lvl)}
                      className={`px-2.5 py-1 font-medium ${i > 0 ? "border-r border-border" : ""} ${
                        groupLevel === lvl ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground hover:text-foreground"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.isLoading && <div className="mt-6 text-sm text-muted-foreground">טוען…</div>}

            {!results.isLoading && (results.data?.images.length ?? 0) === 0 && (
              <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                אין עדיין תוצאות. לחץ "עבד גלריה" כדי להריץ את המנוע.
              </div>
            )}

            {/* Visual groups */}
            {view === "clusters" && clusters.map((c) => (
              <div key={c.id} className="mt-6">
                <div className="mb-2 text-sm font-medium text-muted-foreground">קבוצה {c.id} · {c.items.length} תמונות</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {c.items.map((im) => <Thumb key={im.id} url={thumb(im.id)} culling={im} tags={im.ai_tags ?? []} clipTags={clipTagsByImg.get(im.id) ?? []} onOpen={() => setLightbox(preview(im.id))} />)}
                </div>
              </div>
            ))}

            {/* People */}
            {view === "people" && (
              <div className="mt-6 space-y-4">
                {people.map((p, i) => (
                  <div key={p.id} className="rounded-lg border border-border bg-surface-2 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      {p.rep && <FaceCrop url={imById.get(p.rep)?.original_url || ""} bbox={p.repBbox} size={44} />}
                      אדם {i + 1} <span className="text-muted-foreground">· {p.images.length} תמונות</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {p.images.map((id) => <Thumb key={id} url={thumb(id)} culling={imById.get(id)} tags={imById.get(id)?.ai_tags ?? []} clipTags={clipTagsByImg.get(id) ?? []} onOpen={() => setLightbox(preview(id))} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Best of gallery (by VLM culling score) */}
            {view === "top" && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {top.map((im) => <Thumb key={im.id} url={thumb(im.id)} culling={im} tags={im.ai_tags ?? []} clipTags={clipTagsByImg.get(im.id) ?? []} onOpen={() => setLightbox(preview(im.id))} />)}
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

function Thumb({ url, culling, tags, clipTags, onOpen }: { url: string; culling?: CullingMetrics; tags?: string[]; clipTags?: string[]; onOpen: () => void }) {
  const hasCull = !!(culling && hasCullingMetrics(culling));
  // Rating = the VLM culling score only (0..1 → 0..5 stars). No CLIP.
  const rating = culling?.culling_score != null ? (culling.culling_score * 5).toFixed(1) : null;
  const cat = hasCull ? cullingLabelHe(culling!.culling_label) : null;
  const overall = culling?.culling_score != null ? Math.round(culling.culling_score * 100) : null;
  return (
    <div className="overflow-hidden rounded border border-border bg-surface-2">
      {/* Square image — nothing overlaid on it */}
      <div className="relative aspect-square overflow-hidden">
        {url && <img src={url} alt="" loading="lazy" onClick={onOpen} className="h-full w-full cursor-zoom-in object-cover" />}
      </div>

      {/* All info BELOW the image */}
      <div className="space-y-1.5 p-2">
        {/* rating + category */}
        <div className="flex items-center justify-between gap-1">
          {rating && (
            <span className="flex items-center gap-0.5 text-xs font-bold text-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{rating}
            </span>
          )}
          {cat && <span className="rounded bg-fuchsia-600/90 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white">{cat}</span>}
        </div>

        {/* culling sub-scores — Hebrew labels + bars */}
        {hasCull && (
          <div className="space-y-1">
            {overall != null && (
              <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                <span>דירוג AI</span><span className="font-mono text-foreground">{overall}%</span>
              </div>
            )}
            {SUBSCORES.map(({ key, he }) => {
              const v = culling![key] as number | null;
              const pct = v != null ? Math.round(v * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="w-[4.5rem] shrink-0">{he}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-6 shrink-0 text-left font-mono">{v != null ? pct : "—"}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* VLM tags (blue) */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-semibold text-blue-500">VLM</span>
            {tags.map((t) => (
              <span key={t} className="rounded bg-blue-600/90 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white">{t}</span>
            ))}
          </div>
        )}
        {/* CLIP tags (amber) — existing data, not produced anymore */}
        {clipTags && clipTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-semibold text-amber-500">CLIP</span>
            {clipTags.map((t) => (
              <span key={t} className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function hasCullingMetrics(metrics: CullingMetrics) {
  return [
    metrics.culling_score,
    metrics.subject_sharpness,
    metrics.background_sharpness,
    metrics.thirds_rule,
    metrics.intended_facial_expression,
  ].some((v) => v !== null && v !== undefined) || !!metrics.culling_label;
}

// English culling labels → short Hebrew. Falls back to a tidied version of the raw
// label so an unmapped/custom label still reads cleanly (never a truncated stub).
const CULLING_LABEL_HE: Record<string, string> = {
  "Preparations": "הכנות",
  "Outdoor photography": "צילום חוץ",
  "Couple moments": "רגעי זוג",
  "Family & Reception": "משפחה וקבלת פנים",
  "Ceremony": "טקס",
  "Dance/Party": "ריקודים",
  "Other": "אחר",
};
function cullingLabelHe(label: string | null | undefined) {
  if (!label || label === "N/A" || label === "none") return null;
  return CULLING_LABEL_HE[label] ??
    label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// The four sub-scores with clear Hebrew names (instead of cryptic S/B/T/E).
const SUBSCORES: { key: keyof CullingMetrics; he: string }[] = [
  { key: "subject_sharpness", he: "חדות נושא" },
  { key: "background_sharpness", he: "חדות רקע" },
  { key: "thirds_rule", he: "כלל השליש" },
  { key: "intended_facial_expression", he: "הבעה" },
];

