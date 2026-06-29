import { useCallback, useMemo, useRef, useState } from "react";
import { Sparkles, Upload, Loader2, LayoutGrid, Layers } from "lucide-react";
import { analyzeImages, CLUSTER_LEVELS, type ScoredImage } from "@/lib/aesthetic/clipScorer";

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
  const [level, setLevel] = useState(1); // index into CLUSTER_LEVELS (default: medium)
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
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    run(files);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    run(files);
  };

  // Group view: bucket by the selected level's cluster id; images stay score-sorted.
  const groups = useMemo(() => {
    const map = new Map<number, ScoredImage[]>();
    for (const img of images) {
      const c = img.clusters[level];
      const arr = map.get(c) ?? [];
      arr.push(img);
      map.set(c, arr);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [images, level]);

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
        {images.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              onClick={() => setGroupView((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium hover:text-primary"
            >
              {groupView ? <LayoutGrid className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
              {groupView ? "תצוגה ממוינת לפי ציון" : "תצוגה לפי קבוצות"}
            </button>

            {/* Clustering level — like the legacy loose/medium/strict similarity groups. */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              דרגת קיבוץ:
              <div className="flex overflow-hidden rounded-md border border-border">
                {CLUSTER_LEVELS.map((lvl, i) => (
                  <button
                    key={lvl.key}
                    onClick={() => setLevel(i)}
                    className={`px-2.5 py-1 font-medium transition-colors ${
                      level === i
                        ? "bg-primary/15 text-primary"
                        : "bg-surface-2 text-muted-foreground hover:text-foreground"
                    } ${i > 0 ? "border-r border-border" : ""}`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
              <span className="tabular-nums">{groups.length} קבוצות</span>
            </div>
          </div>
        )}

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
                <Card key={img.url} img={img} cluster={img.clusters[level]} />
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
                  {items.map((img) => <Card key={img.url} img={img} cluster={id} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ img, cluster }: { img: ScoredImage; cluster: number }) {
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
          style={{ background: CLUSTER_COLORS[cluster % CLUSTER_COLORS.length] + "33" }}
        >
          ק{cluster}
        </span>
      </figcaption>
    </figure>
  );
}
