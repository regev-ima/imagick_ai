import { useMemo, useState } from "react";
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

interface GalleryRow { id: string; name: string; pipeline_status: string | null }
interface ImageRow { id: string; original_url: string; filename: string }
interface Feature { image_id: string; aesthetic: number | null; visual_cluster: number | null }
interface FaceDet { image_id: string; cluster_id: string | null }
interface FaceCluster { id: string; face_count: number; representative_image_id: string | null }

export default function PipelineResults() {
  const [galleryId, setGalleryId] = useState<string>("");
  const [view, setView] = useState<"clusters" | "people" | "top">("clusters");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const galleries = useQuery({
    queryKey: ["pipeline-galleries"],
    queryFn: async (): Promise<GalleryRow[]> => {
      const { data, error } = await supabase
        .from("galleries").select("id, name, pipeline_status").order("created_at", { ascending: false });
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
        supabase.from("galleries").select("pipeline_status").eq("id", galleryId).single(),
        db.from("image_features").select("image_id, aesthetic, visual_cluster").eq("gallery_id", galleryId),
        supabase.from("face_detections").select("image_id, cluster_id").eq("gallery_id", galleryId).not("cluster_id", "is", null),
        supabase.from("face_clusters").select("id, face_count, representative_image_id").eq("gallery_id", galleryId).order("face_count", { ascending: false }),
        supabase.from("gallery_images").select("id, original_url, filename").eq("gallery_id", galleryId),
      ]);
      return {
        status: (gRes.data as { pipeline_status?: string } | null)?.pipeline_status ?? "idle",
        features: (fRes.data as Feature[]) ?? [],
        faces: (fdRes.data as FaceDet[]) ?? [],
        faceClusters: (fcRes.data as FaceCluster[]) ?? [],
        images: (imgRes.data as ImageRow[]) ?? [],
      };
    },
  });

  const process = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("process-pipeline", { body: { galleryId } });
      if (res.error) throw new Error(res.error.message);
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
    () => [...(results.data?.features ?? [])].sort((a, b) => (b.aesthetic ?? 0) - (a.aesthetic ?? 0)).slice(0, 40),
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
      images: byCluster.get(c.id) ?? [],
    })).filter((p) => p.images.length > 0);
  }, [results.data]);

  const status = results.data?.status;
  const thumb = (id: string) => { const im = imById.get(id); return im ? getThumbnailUrl(im.original_url) : ""; };
  const preview = (id: string) => { const im = imById.get(id); return im ? getPreviewUrl(im.original_url) : ""; };
  const score = (a: number | null) => (a == null ? "—" : a.toFixed(1));

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
              {status === "processing" && " (מתעדכן…)"}
            </span>
          )}
        </div>

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
                  {c.items.map((f) => <Thumb key={f.image_id} url={thumb(f.image_id)} score={score(f.aesthetic)} onOpen={() => setLightbox(preview(f.image_id))} />)}
                </div>
              </div>
            ))}

            {/* People */}
            {view === "people" && (
              <div className="mt-5 space-y-4">
                {people.map((p, i) => (
                  <div key={p.id} className="rounded-lg border border-border bg-surface-2 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      {p.rep && <img src={thumb(p.rep)} alt="" className="h-10 w-10 rounded-full object-cover" />}
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
                {top.map((f) => <Thumb key={f.image_id} url={thumb(f.image_id)} score={score(f.aesthetic)} onOpen={() => setLightbox(preview(f.image_id))} />)}
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

function Thumb({ url, score, onOpen }: { url: string; score?: string; onOpen: () => void }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded bg-surface-2">
      {url && <img src={url} alt="" loading="lazy" onClick={onOpen} className="h-full w-full cursor-zoom-in object-cover" />}
      {score && <span className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[10px] font-bold text-white">{score}</span>}
    </div>
  );
}
