import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Upload, Loader2, LayoutGrid, Layers, Wand2, X, Users } from "lucide-react";
import { analyzeImages, CLUSTER_LEVELS, type ScoredImage } from "@/lib/aesthetic/clipScorer";
import { scoreImagePro, fetchVisionModels, VISION_MODELS, type VisionModelOption, type ProScore } from "@/lib/aesthetic/visionScorer";
import { groupFaces, type Person } from "@/lib/aesthetic/faceGrouping";
import { CullingTags, defaultCullingTags } from "./CullingTags";

/**
 * AI image-scoring demo with a model-comparison table.
 *
 *  - Fast pass (CLIP, in-browser, free): aesthetic score + similarity clusters.
 *  - Compare pass: run up to 5 vision LLMs (via OpenRouter) on the same top-N
 *    images, side by side in a table — context-aware score, Hebrew tags, cost —
 *    so you can judge which model matches your eye. Click any image to enlarge.
 */

const CLUSTER_COLORS = [
  "#7fd1c1", "#d18f7f", "#7f9fd1", "#c9d17f", "#b67fd1",
  "#d17fae", "#7fd189", "#d1b67f", "#7fc4d1", "#9b9b9b",
];

const PRO_CONCURRENCY = 6;     // vision-LLM calls running at once
const MAX_COMPARE_MODELS = 5;  // how many models can be compared together
const GALLERY_SIZE = 3000;
const HYBRID_FRACTION = 0.1;

type CellResult = ProScore | { error: string };
function isError(c: CellResult | undefined): c is { error: string } {
  return !!c && "error" in c;
}

function scoreColor(s: number): string {
  const hue = Math.round(s * 130);
  return `hsl(${hue} 70% 45%)`;
}

export default function AestheticScoreDemo() {
  const [images, setImages] = useState<ScoredImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [level, setLevel] = useState(1);
  const [groupView, setGroupView] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compare pass.
  const [models, setModels] = useState<VisionModelOption[]>(VISION_MODELS);
  const [selected, setSelected] = useState<string[]>([VISION_MODELS[0].id]);
  const [proCount, setProCount] = useState(10);
  const [proBusy, setProBusy] = useState(false);
  const [proProgress, setProProgress] = useState<{ done: number; total: number } | null>(null);
  const [proError, setProError] = useState("");
  // results[imageUrl][modelId] = ProScore | {error}
  const [results, setResults] = useState<Map<string, Map<string, CellResult>>>(new Map());
  const [tags, setTags] = useState<string[]>(() => defaultCullingTags("wedding", "he"));
  const [showTags, setShowTags] = useState(false);
  const [verbose, setVerbose] = useState(false); // off = cheapest (no prose output)

  // Face grouping.
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceStatus, setFaceStatus] = useState("");
  const [faceProgress, setFaceProgress] = useState<{ done: number; total: number; faces: number } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [faceError, setFaceError] = useState("");

  useEffect(() => {
    fetchVisionModels()
      .then((ms) => {
        if (ms.length) {
          setModels(ms);
          setSelected([ms[0].id]);
        }
      })
      .catch(() => { /* keep static fallback */ });
  }, []);

  const run = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    setImages([]);
    setProgress(null);
    setResults(new Map());
    setProError("");
    setPeople([]);
    setFaceError("");
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

  const toggleModel = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX_COMPARE_MODELS ? [...prev, id] : prev,
    );

  // Run every (image × selected-model) pair through a worker pool.
  const runCompare = useCallback(async () => {
    const top = images.slice(0, proCount);
    if (top.length === 0 || selected.length === 0) return;
    setProBusy(true);
    setProError("");
    const jobs: { url: string; model: string }[] = [];
    for (const img of top) for (const m of selected) jobs.push({ url: img.url, model: m });
    setProProgress({ done: 0, total: jobs.length });

    const next = new Map(results);
    const setCell = (url: string, model: string, cell: CellResult) => {
      const row = next.get(url) ?? new Map<string, CellResult>();
      row.set(model, cell);
      next.set(url, row);
      setResults(new Map(next));
    };

    let done = 0;
    let cursor = 0;
    const worker = async () => {
      while (cursor < jobs.length) {
        const j = jobs[cursor++];
        try {
          const score = await scoreImagePro(j.url, j.model, tags, verbose);
          setCell(j.url, j.model, score);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "שגיאה";
          setCell(j.url, j.model, { error: msg });
          setProError(msg);
        }
        done++;
        setProProgress({ done, total: jobs.length });
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(PRO_CONCURRENCY, jobs.length) }, worker));
    } finally {
      setProBusy(false);
    }
  }, [images, proCount, selected, results, tags, verbose]);

  const runFaces = useCallback(async () => {
    if (images.length === 0) return;
    setFaceBusy(true);
    setFaceError("");
    setPeople([]);
    try {
      const { people: ppl } = await groupFaces(
        images.map((img) => ({ url: img.url, name: img.name })),
        {
          onStatus: setFaceStatus,
          onProgress: (done, total, faces) => setFaceProgress({ done, total, faces }),
        },
      );
      setPeople(ppl);
      setFaceStatus("");
    } catch (err) {
      console.error(err);
      setFaceError(err instanceof Error ? err.message : "שגיאה בזיהוי פרצופים");
    } finally {
      setFaceBusy(false);
    }
  }, [images]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) =>
    run(Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/")));
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    run(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")));
  };

  const groups = useMemo(() => {
    const map = new Map<number, ScoredImage[]>();
    for (const img of images) {
      const c = img.clusters[level];
      (map.get(c) ?? map.set(c, []).get(c)!).push(img);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [images, level]);

  const priceByModel = useMemo(() => {
    const m = new Map<string, VisionModelOption>();
    for (const opt of models) m.set(opt.id, opt);
    return m;
  }, [models]);

  const cost = useMemo(() => {
    let total = 0, n = 0, promptTok = 0;
    for (const row of results.values())
      for (const cell of row.values())
        if (!isError(cell) && typeof cell.usage?.cost === "number") {
          total += cell.usage.cost; n++; promptTok += cell.usage.prompt_tokens ?? 0;
        }
    const avg = n ? total / n : 0;
    return { n, total, avg, promptTok, fullGallery: avg * GALLERY_SIZE, hybridGallery: avg * GALLERY_SIZE * HYBRID_FRACTION };
  }, [results]);

  const topImages = images.slice(0, proCount);
  const modelShort = (id: string) => (priceByModel.get(id)?.label ?? id).split(" · ")[0];

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <h1 className="text-xl font-semibold">ניקוד תמונות AI — השוואת מודלים</h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            שלב מהיר (CLIP, בדפדפן): ציון וקיבוץ לכל התמונות. השוואה: בחר עד {MAX_COMPARE_MODELS} מודלים
            והרץ אותם במקביל על אותן תמונות — ציון מודע-הקשר, תגיות בעברית ועלות, זה לצד זה.
            לחיצה על תמונה מגדילה אותה לבדיקה.
          </p>
        </header>

        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-6 py-8 text-center transition-colors hover:border-primary/50"
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <div className="text-sm font-medium">גרור לכאן תמונות, או לחץ לבחירה</div>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
        </div>

        {/* Compare controls */}
        {images.length > 0 && (
          <div className="mt-4 space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Wand2 className="h-4 w-4 text-amber-500" />
              בחר מודלים להשוואה ({selected.length}/{MAX_COMPARE_MODELS}):
            </div>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {models.map((m) => {
                const on = selected.includes(m.id);
                const locked = !on && selected.length >= MAX_COMPARE_MODELS;
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleModel(m.id)}
                    disabled={locked || proBusy}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      on ? "border-amber-500/60 bg-amber-500/15 text-foreground" : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                    } ${locked ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={proCount}
                onChange={(e) => setProCount(Number(e.target.value))}
                disabled={proBusy}
                className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs"
              >
                {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n} מובילות</option>)}
              </select>
              <button
                onClick={runCompare}
                disabled={proBusy || selected.length === 0}
                className="flex items-center gap-1.5 rounded-md bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-500 disabled:opacity-50"
              >
                {proBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                השווה {selected.length} מודלים
              </button>
              {proProgress && proBusy && (
                <span className="tabular-nums text-xs text-muted-foreground">{proProgress.done}/{proProgress.total}</span>
              )}
              <button onClick={() => setShowTags((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground">
                תגיות: <b className="text-foreground">{tags.length}</b> {showTags ? "▲" : "▼"}
              </button>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={verbose} onChange={(e) => setVerbose(e.target.checked)} disabled={proBusy} />
                הסברים מילוליים <span className="text-[10px]">(יקר יותר)</span>
              </label>
            </div>

            {showTags && <CullingTags galleryType="wedding" language="he" value={tags} onChange={setTags} />}
            {proError && <div className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">{proError}</div>}

            {cost.n > 0 && (
              <div className="border-t border-amber-500/20 pt-2 text-xs">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>נוקדו <b>{cost.n}</b> (תמונה×מודל)</span>
                  <span>עלות בפועל: <b className="text-amber-600 dark:text-amber-400">${cost.total.toFixed(5)}</b></span>
                  <span>ממוצע: <b>${cost.avg.toFixed(6)}</b></span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 text-muted-foreground">
                  <span>→ גלריה {GALLERY_SIZE.toLocaleString()} (הכול): <b className="text-foreground">${cost.fullGallery.toFixed(2)}</b></span>
                  <span>→ היברידי (~{Math.round(HYBRID_FRACTION * 100)}%): <b className="text-foreground">${cost.hybridGallery.toFixed(2)}</b></span>
                </div>
              </div>
            )}
          </div>
        )}

        {busy && (
          <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>{status || "מעבד…"}</span>
            {progress && <span className="tabular-nums">{progress.done}/{progress.total}</span>}
          </div>
        )}
        {!busy && status && <div className="mt-6 text-sm text-destructive">{status}</div>}

        {/* Comparison table */}
        {results.size > 0 && selected.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-surface-2">
                  <th className="sticky right-0 z-10 bg-surface-2 p-2 text-right font-medium">תמונה</th>
                  {selected.map((id) => (
                    <th key={id} className="min-w-[180px] border-r border-border p-2 text-right font-medium">
                      {modelShort(id)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topImages.map((img) => (
                  <tr key={img.url} className="border-t border-border align-top">
                    <td className="sticky right-0 z-10 bg-background p-2">
                      <img
                        src={img.url}
                        alt={img.name}
                        onClick={() => setLightbox(img.url)}
                        className="h-20 w-28 cursor-zoom-in rounded object-cover"
                      />
                      <div className="mt-1 max-w-[112px] truncate text-[10px] text-muted-foreground">{img.name}</div>
                      <div className="text-[10px] text-muted-foreground">CLIP {(img.score01 * 5).toFixed(1)}</div>
                    </td>
                    {selected.map((id) => (
                      <td key={id} className="border-r border-border p-2">
                        <Cell cell={results.get(img.url)?.get(id)} price={priceByModel.get(id)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Face grouping */}
        {images.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Users className="h-4 w-4 text-primary" /> קיבוץ פרצופים
              </h2>
              <button
                onClick={runFaces}
                disabled={faceBusy}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {faceBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                זהה וקבץ פרצופים
              </button>
              {faceBusy && (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {faceStatus}
                  {faceProgress && <span className="tabular-nums">{faceProgress.done}/{faceProgress.total} · {faceProgress.faces} פרצופים</span>}
                </span>
              )}
              {people.length > 0 && <span className="text-xs text-muted-foreground">{people.length} אנשים זוהו</span>}
            </div>
            {faceError && <div className="mb-3 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">{faceError}</div>}

            <div className="space-y-4">
              {people.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <img src={p.faces[0].crop} alt="" className="h-12 w-12 rounded-full object-cover" />
                    <div className="text-sm font-medium">אדם {p.id + 1} <span className="text-muted-foreground">· {p.images.length} תמונות</span></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                    {p.images.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        loading="lazy"
                        onClick={() => setLightbox(url)}
                        className="aspect-square w-full cursor-zoom-in rounded object-cover"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CLIP clustering grid */}
        {images.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center gap-4">
              <h2 className="text-sm font-semibold">קיבוץ (CLIP)</h2>
              <button
                onClick={() => setGroupView((v) => !v)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium hover:text-primary"
              >
                {groupView ? <LayoutGrid className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
                {groupView ? "ממוין לפי ציון" : "לפי קבוצות"}
              </button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                דרגה:
                <div className="flex overflow-hidden rounded-md border border-border">
                  {CLUSTER_LEVELS.map((lvl, i) => (
                    <button
                      key={lvl.key}
                      onClick={() => setLevel(i)}
                      className={`px-2.5 py-1 font-medium ${level === i ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground hover:text-foreground"} ${i > 0 ? "border-r border-border" : ""}`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
                <span className="tabular-nums">{groups.length} קבוצות</span>
              </div>
            </div>

            {!groupView ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {images.map((img) => <Thumb key={img.url} img={img} cluster={img.clusters[level]} onOpen={setLightbox} />)}
              </div>
            ) : (
              <div className="space-y-5">
                {groups.map(([id, items]) => (
                  <div key={id}>
                    <div className="mb-1.5 flex items-center gap-2 text-xs font-medium">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: CLUSTER_COLORS[id % CLUSTER_COLORS.length] }} />
                      קבוצה {id} · {items.length}
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                      {items.map((img) => <Thumb key={img.url} img={img} cluster={id} onOpen={setLightbox} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <button className="absolute right-4 top-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="h-7 w-7" />
          </button>
          <img src={lightbox} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function Thumb({ img, cluster, onOpen }: { img: ScoredImage; cluster: number; onOpen: (url: string) => void }) {
  return (
    <figure className="overflow-hidden rounded-lg bg-surface-2">
      <div className="relative aspect-[4/3]">
        <img src={img.url} alt={img.name} loading="lazy" onClick={() => onOpen(img.url)} className="h-full w-full cursor-zoom-in object-cover" />
        <span className="absolute right-1 top-1 rounded px-1 py-0.5 text-[10px] font-bold text-white" style={{ background: scoreColor(img.score01) }}>
          {(img.score01 * 5).toFixed(1)}
        </span>
        <span className="absolute bottom-1 right-1 rounded-full px-1.5 text-[9px]" style={{ background: CLUSTER_COLORS[cluster % CLUSTER_COLORS.length] + "cc" }}>
          ק{cluster}
        </span>
      </div>
    </figure>
  );
}

function Cell({ cell, price }: { cell?: CellResult; price?: VisionModelOption }) {
  if (!cell) return <div className="text-muted-foreground">—</div>;
  if (isError(cell)) return <div className="text-[10px] text-destructive">{cell.error}</div>;

  const inTok = cell.usage?.prompt_tokens ?? null;
  const outTok = cell.usage?.completion_tokens ?? null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <span className="rounded px-1.5 py-0.5 text-sm font-bold text-white" style={{ background: scoreColor(Number(cell.overall) / 5) }}>
          {Number(cell.overall).toFixed(1)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          ט {Number(cell.technical).toFixed(1)} · ק {Number(cell.composition).toFixed(1)} · ר {Number(cell.moment).toFixed(1)} · ה {Number(cell.impact).toFixed(1)}
        </span>
      </div>
      {cell.tags && cell.tags.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {cell.tags.map((t) => <span key={t} className="rounded bg-primary/10 px-1 text-[9.5px] text-primary">{t}</span>)}
        </div>
      )}
      {cell.style_note && <div className="text-[10px] text-amber-600 dark:text-amber-400">{cell.style_note}</div>}
      {cell.explanation && <div className="text-[10px] text-foreground/80">{cell.explanation}</div>}
      <div className="text-[9.5px] text-muted-foreground">
        {typeof cell.usage?.cost === "number" && <span>${cell.usage.cost.toFixed(6)} · </span>}
        קלט {inTok ?? "—"} · פלט {outTok ?? "—"}
        {price?.promptPerM != null && <span> · ${price.promptPerM.toFixed(2)}/${price.completionPerM?.toFixed(2)} ל-1M</span>}
      </div>
    </div>
  );
}
