import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Upload, Loader2, LayoutGrid, Layers, Wand2 } from "lucide-react";
import { analyzeImages, CLUSTER_LEVELS, type ScoredImage } from "@/lib/aesthetic/clipScorer";
import { scoreImagePro, fetchVisionModels, VISION_MODELS, type VisionModelOption, type ProScore } from "@/lib/aesthetic/visionScorer";

/**
 * AI image-scoring demo.
 *
 * Two scoring paths, side by side:
 *  1. Fast pass (CLIP, in-browser, free): aesthetic score + similarity clusters
 *     for every image, instantly. Great for clustering and a first ranking.
 *  2. Professional pass (vision LLM via OpenRouter, server-side): context-aware
 *     scoring against a professional rubric — understands intent (closed eyes
 *     while praying = a moment, not a flaw), recognizes deliberate styles, and
 *     explains itself. Run only on the top candidates to keep cost tiny.
 *
 * This is the planned hybrid pipeline (cheap pass everywhere → smart pass on
 * candidates), shrunk to a demo so it's viewable in the Vercel preview.
 */

const CLUSTER_COLORS = [
  "#7fd1c1", "#d18f7f", "#7f9fd1", "#c9d17f", "#b67fd1",
  "#d17fae", "#7fd189", "#d1b67f", "#7fc4d1", "#9b9b9b",
];

// Typical wedding/event gallery size, used to extrapolate measured cost.
const GALLERY_SIZE = 3000;
const HYBRID_FRACTION = 0.1; // hybrid pipeline sends only ~10% (candidates) to the LLM

function scoreColor(s: number): string {
  const hue = Math.round(s * 130); // 0=red → 130=green
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

  // Professional (vision-LLM) pass state.
  const [models, setModels] = useState<VisionModelOption[]>(VISION_MODELS);
  const [proModel, setProModel] = useState(VISION_MODELS[0].id);
  const [proCount, setProCount] = useState(10);

  // Load the live, image-capable model list from OpenRouter (ids stay current).
  useEffect(() => {
    fetchVisionModels()
      .then((ms) => {
        if (ms.length) {
          setModels(ms);
          setProModel(ms[0].id);
        }
      })
      .catch(() => { /* keep static fallback */ });
  }, []);
  const [proBusy, setProBusy] = useState(false);
  const [proProgress, setProProgress] = useState<{ done: number; total: number } | null>(null);
  const [proError, setProError] = useState("");
  const [proResults, setProResults] = useState<Map<string, ProScore>>(new Map());

  const run = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    setImages([]);
    setProgress(null);
    setProResults(new Map());
    setProError("");
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
      setStatus("שגיאה בטעינת המודל. ודא חיבור אינטרנט (המודל נטען מ-huggingface). פרטים ב-console.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Professional pass over the top-N ranked images, sequentially (gentle on rate limits).
  const runPro = useCallback(async () => {
    const top = images.slice(0, proCount);
    if (top.length === 0) return;
    setProBusy(true);
    setProError("");
    setProProgress({ done: 0, total: top.length });
    const next = new Map(proResults);
    try {
      for (let i = 0; i < top.length; i++) {
        try {
          const score = await scoreImagePro(top[i].url, proModel);
          next.set(top[i].url, score);
          setProResults(new Map(next));
        } catch (err) {
          setProError(err instanceof Error ? err.message : "שגיאה בניקוד המקצועי");
          break;
        }
        setProProgress({ done: i + 1, total: top.length });
      }
    } finally {
      setProBusy(false);
    }
  }, [images, proModel, proCount, proResults]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    run(Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/")));
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    run(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")));
  };

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

  // Real measured cost from OpenRouter, summed across this run.
  const cost = useMemo(() => {
    const scored = [...proResults.values()];
    const priced = scored.filter((r) => typeof r.usage?.cost === "number");
    const total = priced.reduce((s, r) => s + (r.usage!.cost as number), 0);
    const promptTok = scored.reduce((s, r) => s + (r.usage?.prompt_tokens ?? 0), 0);
    const n = priced.length;
    const avg = n ? total / n : 0;
    return {
      n,
      total,
      avg,
      promptTok,
      fullGallery: avg * GALLERY_SIZE,
      hybridGallery: avg * GALLERY_SIZE * HYBRID_FRACTION,
    };
  }, [proResults]);

  // Per-model pricing (USD / 1M tokens), keyed by model id, for per-image breakdown.
  const priceByModel = useMemo(() => {
    const m = new Map<string, VisionModelOption>();
    for (const opt of models) m.set(opt.id, opt);
    return m;
  }, [models]);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <h1 className="text-xl font-semibold">ניקוד תמונות AI — ניסוי</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            שלב מהיר (CLIP, בדפדפן, חינם): ציון וקיבוץ לכל התמונות. שלב מקצועי (Vision LLM):
            ניקוד מודע-הקשר עם הסבר — מבין שעיניים עצומות בתפילה זה רגע, לא פגם — שרץ רק על
            המועמדות המובילות כדי לשמור על עלות נמוכה.
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
                      level === i ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground hover:text-foreground"
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

        {/* Professional pass */}
        {images.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <Wand2 className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium">ניקוד מקצועי (Vision LLM):</span>
            <select
              value={proModel}
              onChange={(e) => setProModel(e.target.value)}
              disabled={proBusy}
              className="max-w-[260px] rounded-md border border-border bg-surface-2 px-2 py-1 text-xs"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <select
              value={proCount}
              onChange={(e) => setProCount(Number(e.target.value))}
              disabled={proBusy}
              className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs"
            >
              {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n} מובילות</option>)}
            </select>
            <button
              onClick={runPro}
              disabled={proBusy}
              className="flex items-center gap-1.5 rounded-md bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-500 disabled:opacity-50"
            >
              {proBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              נקד מקצועית
            </button>
            {proProgress && proBusy && (
              <span className="tabular-nums text-xs text-muted-foreground">{proProgress.done}/{proProgress.total}</span>
            )}
            {proError && <span className="w-full rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">{proError}</span>}

            {/* Real measured cost */}
            {cost.n > 0 && (
              <div className="w-full border-t border-amber-500/20 pt-2 text-xs">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>נוקדו <b>{cost.n}</b> תמונות</span>
                  <span>עלות בפועל: <b className="text-amber-600 dark:text-amber-400">${cost.total.toFixed(5)}</b></span>
                  <span>ממוצע לתמונה: <b>${cost.avg.toFixed(6)}</b></span>
                  <span className="text-muted-foreground">({cost.promptTok.toLocaleString()} טוקני קלט)</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 text-muted-foreground">
                  <span>→ גלריה של {GALLERY_SIZE.toLocaleString()} (הכול ב-LLM): <b className="text-foreground">${cost.fullGallery.toFixed(2)}</b></span>
                  <span>→ היברידי (~{Math.round(HYBRID_FRACTION * 100)}% מועמדות): <b className="text-foreground">${cost.hybridGallery.toFixed(2)}</b></span>
                </div>
              </div>
            )}
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

        {/* Results — sorted */}
        {!groupView && images.length > 0 && (
          <>
            <div className="mt-6 text-xs text-muted-foreground">{images.length} תמונות · ממוינות מהטוב לפחות</div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {images.map((img) => (
                <Card key={img.url} img={img} cluster={img.clusters[level]} pro={proResults.get(img.url)} prices={priceByModel} />
              ))}
            </div>
          </>
        )}

        {/* Results — grouped */}
        {groupView && images.length > 0 && (
          <div className="mt-6 space-y-6">
            {groups.map(([id, items]) => (
              <div key={id}>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: CLUSTER_COLORS[id % CLUSTER_COLORS.length] }} />
                  קבוצה {id} · {items.length} תמונות
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {items.map((img) => <Card key={img.url} img={img} cluster={id} pro={proResults.get(img.url)} prices={priceByModel} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ img, cluster, pro, prices }: { img: ScoredImage; cluster: number; pro?: ProScore; prices?: Map<string, VisionModelOption> }) {
  const five = img.score01 * 5;
  // Per-image token + cost breakdown (input/output split via the model's 1M rates).
  const price = pro ? prices?.get(pro.model) : undefined;
  const inTok = pro?.usage?.prompt_tokens ?? null;
  const outTok = pro?.usage?.completion_tokens ?? null;
  const inCost = inTok != null && price?.promptPerM != null ? (inTok * price.promptPerM) / 1e6 : null;
  const outCost = outTok != null && price?.completionPerM != null ? (outTok * price.completionPerM) / 1e6 : null;
  return (
    <figure className="overflow-hidden rounded-lg bg-surface-2">
      <div className="relative aspect-[4/3]">
        <img src={img.url} alt={img.name} loading="lazy" className="h-full w-full object-cover" />
        {/* CLIP fast score (top-right) */}
        <span
          className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-xs font-bold text-white shadow"
          style={{ background: scoreColor(img.score01) }}
        >
          {five.toFixed(1)}
        </span>
        {/* Professional score (top-left, gold) when available */}
        {pro && (
          <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-black shadow">
            <Wand2 className="h-3 w-3" />{Number(pro.overall).toFixed(1)}
          </span>
        )}
      </div>
      <figcaption className="px-2 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="truncate">{img.name}</span>
          <span className="ml-1 shrink-0 rounded-full px-1.5" style={{ background: CLUSTER_COLORS[cluster % CLUSTER_COLORS.length] + "33" }}>
            ק{cluster}
          </span>
        </div>
        {pro && (
          <div className="mt-1 space-y-0.5 border-t border-border pt-1 text-[10.5px] leading-snug text-foreground/80">
            <div className="flex flex-wrap gap-x-2 text-muted-foreground">
              <span>טכני {Number(pro.technical).toFixed(1)}</span>
              <span>קומפ׳ {Number(pro.composition).toFixed(1)}</span>
              <span>רגע {Number(pro.moment).toFixed(1)}</span>
              <span>השפעה {Number(pro.impact).toFixed(1)}</span>
            </div>
            {pro.style_note && <div className="text-amber-600 dark:text-amber-400">{pro.style_note}</div>}
            {pro.explanation && <div>{pro.explanation}</div>}
            {/* Token + cost breakdown */}
            {pro.usage && (
              <div className="mt-1 border-t border-border pt-1 text-[10px] text-muted-foreground">
                <div>קלט: {inTok ?? "—"} טוק׳{inCost != null && <> · ${inCost.toFixed(6)}</>}</div>
                <div>פלט: {outTok ?? "—"} טוק׳{outCost != null && <> · ${outCost.toFixed(6)}</>}</div>
                {typeof pro.usage.cost === "number" && (
                  <div className="text-foreground/80">סה״כ: ${pro.usage.cost.toFixed(6)}</div>
                )}
                {price && (price.promptPerM != null) && (
                  <div className="text-[9.5px]">מחיר מודל: ${price.promptPerM.toFixed(2)}/${price.completionPerM?.toFixed(2)} ל-1M</div>
                )}
              </div>
            )}
          </div>
        )}
      </figcaption>
    </figure>
  );
}
