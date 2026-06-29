/**
 * In-browser aesthetic scoring + clustering — proof of concept.
 *
 * Runs entirely client-side: CLIP (via transformers.js, loaded at runtime from
 * a CDN so it never touches our Vite bundle / size budget). One CLIP embedding
 * per image drives BOTH the aesthetic score and the similarity clustering —
 * the same idea planned for the Cloudflare production pipeline, shrunk to the
 * browser so it can be tried with zero infrastructure and zero cost.
 *
 * NOTE: the score here is a CLIP-prompt *proxy* (image-vs-"good/bad photo"
 * text), not a head fine-tuned on the user's own ratings. It is meant to prove
 * the direction works; production swaps in a trained head for higher accuracy.
 */

// Loaded from CDN at runtime — keeps the ~1MB library out of our bundle.
const TF_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3";
const CLIP_MODEL = "Xenova/clip-vit-base-patch32";

// Prompts whose average defines the "good" and "bad" poles in CLIP space.
const GOOD_PROMPTS = [
  "a stunning professional photograph, sharp focus, beautiful lighting, great composition",
  "an award-winning high quality photo, crisp and well exposed",
];
const BAD_PROMPTS = [
  "a blurry, out of focus, badly composed amateur snapshot",
  "a dark, noisy, poorly lit low quality photo",
];

/**
 * Multiple similarity-grouping levels, like the legacy similarity_group_1/2/3.
 * Higher threshold → stricter (only near-duplicates group); lower → looser
 * (whole scenes group). Tuned for CLIP ViT-B/32 image-image cosine.
 */
export const CLUSTER_LEVELS = [
  { key: "loose", label: "רופף", threshold: 0.80 },
  { key: "medium", label: "בינוני", threshold: 0.87 },
  { key: "strict", label: "מהודק", threshold: 0.93 },
] as const;

export interface ScoredImage {
  url: string;        // object URL for display
  name: string;
  score01: number;    // 0..1 (min-max normalized across this batch)
  clusters: number[]; // similarity group id per CLUSTER_LEVELS entry (same order)
}

type Vec = Float32Array;

interface Models {
  tokenizer: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  textModel: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  processor: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  visionModel: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  RawImage: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  goodProto: Vec;
  badProto: Vec;
}

let modelsPromise: Promise<Models> | null = null;

function normalize(v: Float32Array): Vec {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function mean(vecs: Vec[]): Vec {
  const out = new Float32Array(vecs[0].length);
  for (const v of vecs) for (let i = 0; i < v.length; i++) out[i] += v[i];
  for (let i = 0; i < out.length; i++) out[i] /= vecs.length;
  return out;
}

/** Loads CLIP once and precomputes the good/bad text prototypes. */
async function loadModels(onStatus?: (s: string) => void): Promise<Models> {
  if (modelsPromise) return modelsPromise;
  modelsPromise = (async () => {
    onStatus?.("טוען מודל (פעם ראשונה — כמה עשרות שניות)…");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lib: any = await import(/* @vite-ignore */ TF_CDN);
    lib.env.allowLocalModels = false; // always fetch from the HF hub

    const [tokenizer, textModel, processor, visionModel] = await Promise.all([
      lib.AutoTokenizer.from_pretrained(CLIP_MODEL),
      lib.CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL),
      lib.AutoProcessor.from_pretrained(CLIP_MODEL),
      lib.CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL),
    ]);

    // Embed all prompts in one pass, then split into good/bad prototypes.
    const prompts = [...GOOD_PROMPTS, ...BAD_PROMPTS];
    const textInputs = tokenizer(prompts, { padding: true, truncation: true });
    const { text_embeds } = await textModel(textInputs);
    const dim = text_embeds.dims[1];
    const flat = text_embeds.data as Float32Array;
    const rows: Vec[] = prompts.map((_, i) =>
      normalize(flat.slice(i * dim, (i + 1) * dim)),
    );
    const goodProto = normalize(mean(rows.slice(0, GOOD_PROMPTS.length)));
    const badProto = normalize(mean(rows.slice(GOOD_PROMPTS.length)));

    return { tokenizer, textModel, processor, visionModel, RawImage: lib.RawImage, goodProto, badProto };
  })();
  return modelsPromise;
}

async function embedImage(m: Models, url: string): Promise<Vec> {
  const image = await m.RawImage.read(url);
  const inputs = await m.processor(image);
  const { image_embeds } = await m.visionModel(inputs);
  return normalize(image_embeds.data as Float32Array);
}

/** Greedy single-pass clustering on cosine similarity (unit vectors → dot). */
function cluster(vecs: Vec[], threshold: number): number[] {
  const reps: Vec[] = [];
  const labels: number[] = [];
  for (const v of vecs) {
    let best = -1, bestSim = threshold;
    for (let c = 0; c < reps.length; c++) {
      const sim = dot(v, reps[c]);
      if (sim >= bestSim) { bestSim = sim; best = c; }
    }
    if (best === -1) { reps.push(v); labels.push(reps.length - 1); }
    else labels.push(best);
  }
  return labels;
}

export interface AnalyzeOptions {
  onStatus?: (s: string) => void;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Scores + clusters a set of images entirely in the browser.
 * Clusters at every CLUSTER_LEVELS threshold (cheap — embeddings computed once),
 * so the UI can switch grouping levels instantly. Returns sorted best → worst.
 */
export async function analyzeImages(
  files: { url: string; name: string }[],
  opts: AnalyzeOptions = {},
): Promise<ScoredImage[]> {
  const { onStatus, onProgress } = opts;
  const m = await loadModels(onStatus);

  onStatus?.("מנתח תמונות…");
  const vecs: Vec[] = [];
  const raw: number[] = [];
  for (let i = 0; i < files.length; i++) {
    const v = await embedImage(m, files[i].url);
    vecs.push(v);
    raw.push(dot(v, m.goodProto) - dot(v, m.badProto)); // aesthetic axis
    onProgress?.(i + 1, files.length);
  }

  // Min-max normalize the raw aesthetic axis across this batch for a clean spread.
  const lo = Math.min(...raw), hi = Math.max(...raw);
  const span = hi - lo || 1;

  // Cluster once per level — embeddings are reused, so this is essentially free.
  const labelsByLevel = CLUSTER_LEVELS.map((lvl) => cluster(vecs, lvl.threshold));

  return files
    .map((f, i) => ({
      url: f.url,
      name: f.name,
      score01: (raw[i] - lo) / span,
      clusters: labelsByLevel.map((labels) => labels[i]),
    }))
    .sort((a, b) => b.score01 - a.score01);
}
