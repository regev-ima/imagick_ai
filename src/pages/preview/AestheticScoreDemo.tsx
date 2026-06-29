import { useCallback, useMemo, useRef, useState } from "react";
import { Sparkles, Upload, Loader2, LayoutGrid, Layers } from "lucide-react";
import { analyzeImages, type ScoredImage } from "@/lib/aesthetic/clipScorer";

/**
 * In-browser AI image-scoring demo. Everything runs client-side via CLIP
 * (transformers.js loaded from CDN) — no server, no upload, no cost. Drag in
 * photos and see them ranked by an aesthetic score, grouped by similarity.
 *
 * This is a proof-of-concept page for the planned scoring/tagging/clustering
 * feature; it deliberately touches no backend so it can ship to the preview.
 */

const CLUSTER_COLORS = [
  "#7fd1c1", "#d18f7f", "#7f9fd1", "#c9d17f", "#b67fd1",
  "#d17fae", "#7fd189", "#d1b67f", "#7fc4d1", "#9b9b9b",
];

function scoreColor(s: number): string {
  // red (low) → amber → green (high)
  const hue = Math.round(s * 130); // 0=red, 130=green
  return `hsl(${hue} 70% 45%)`;
}

export default function AestheticScoreDemo() {
  const [images, setImages] = useState<ScoredImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [threshold, setThreshold] = useState(0.9);
  const [groupView, setGroupView] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    setImages([]);
    setProgress(null);
    try {
      const items = files.map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
      const scored = await analyzeImages(items, {
        clusterThreshold: threshold,
        onStatus: setStatus,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setImages(scored);
      setStatus("");
    } catch (err) {
      console.error(err);
      setStatus(
        "שגיאה בטעינת המודל. ודא חיבור אינטרנט (המודל נטען מ-huggingface). פרטים ב-console.",
      );
    } finally {
      setBusy(false);
    }
  }, [threshold]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    run(files);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    run(files);
  };

  // Group view: bucket by cluster, each bucket sorted by score (already sorted globally).
  const groups = useMemo(() => {
    const map = new Map<number, ScoredImage[]>();
    for (const img of images) {
      const arr = map.get(img.cluster) ?? [];
      arr.push(img);
      map.set(img.cluster, arr);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [images]);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <h1 className="text-xl font-semibold">ניקוד תמונות AI — ניסוי</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            גורר תמונות → כל אחת מקבלת ציון אסתטי (0–5) ומשויכת לקבוצת דמיון. הכול
            רץ <b className="text-foreground">בדפדפן שלך בלבד</b> — בלי שרת, בלי העלאה, בלי עלות.
            זו הוכחת היתכנות; בפרודקשן המודל ירוץ ב-Cloudflare ויכוון על הדירוגים שלך.
          </p>
        </header>

        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-6 py-10 text-center transition-colors hover:border-primary/50"
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <div className="text-sm font-medium">גרור לכאן תמונות, או לחץ לבחירה</div>
          <div className="text-xs text-muted-foreground">מומלץ 50–200 תמונות. ככל שיותר — איטי יותר בדפדפן.</div>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            סף קיבוץ
            <input
              type="range" min={0.8} max={0.97} step={0.01} value={threshold}
              disabled={busy}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
            />
            <span className="tabular-nums text-foreground">{threshold.toFixed(2)}</span>
          </label>
          {images.length > 0 && (
            <button
              onClick={() => setGroupView((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium hover:text-primary"
            >
              {groupView ? <LayoutGrid className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
              {groupView ? "תצוגה ממוינת לפי ציון" : "תצוגה לפי קבוצות"}
            </button>
          )}
        </div>

        {/* Status */}
        {busy && (
          <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>{status || "מעבד…"}</span>
            {progress && <span className="tabular-nums">{progress.done}/{progress.total}</span>}
          </div>
        )}
        {!busy && status && <div className="mt-6 text-sm text-destructive">{status}</div>}

        {/* Results */}
        {!groupView && images.length > 0 && (
          <>
            <div className="mt-6 text-xs text-muted-foreground">
              {images.length} תמונות · ממוינות מהטוב לפחות
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {images.map((img) => (
                <Card key={img.url} img={img} />
              ))}
            </div>
          </>
        )}

        {groupView && images.length > 0 && (
          <div className="mt-6 space-y-6">
            {groups.map(([id, items]) => (
              <div key={id}>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: CLUSTER_COLORS[id % CLUSTER_COLORS.length] }} />
                  קבוצה {id} · {items.length} תמונות
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {items.map((img) => <Card key={img.url} img={img} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ img }: { img: ScoredImage }) {
  const five = img.score01 * 5;
  return (
    <figure className="overflow-hidden rounded-lg bg-surface-2">
      <div className="relative aspect-[4/3]">
        <img src={img.url} alt={img.name} loading="lazy" className="h-full w-full object-cover" />
        <span
          className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-xs font-bold text-white shadow"
          style={{ background: scoreColor(img.score01) }}
        >
          {five.toFixed(1)}
        </span>
      </div>
      <figcaption className="flex items-center justify-between px-2 py-1.5 text-[11px] text-muted-foreground">
        <span className="truncate">{img.name}</span>
        <span
          className="ml-1 shrink-0 rounded-full px-1.5"
          style={{ background: CLUSTER_COLORS[img.cluster % CLUSTER_COLORS.length] + "33" }}
        >
          ק{img.cluster}
        </span>
      </figcaption>
    </figure>
  );
}
