/**
 * In-browser face detection + grouping — proof of concept.
 *
 * Detects faces, computes a 128-d identity descriptor (face-api.js from a CDN,
 * kept out of our bundle), and clusters faces by identity. Runs on locally
 * uploaded images — no CORS, no Azure (the two things that broke the old
 * pipeline).
 *
 * Accuracy work, since a browser model is weaker than ArcFace:
 *  - drop junk faces (too small / low confidence) so they don't pollute clusters
 *  - score each face's quality (confidence × size × sharpness) and seed clusters
 *    with the best faces first
 *  - cluster against a running CENTROID (not the first face) → fewer splits
 *  - a merge pass joins clusters of the same person that drifted apart
 *  - the representative thumbnail is the SHARPEST/best face, never a soft one
 *
 * Production swaps the browser model for InsightFace/ArcFace on Replicate.
 */

const FACEAPI_CDN = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.esm.js";
const MODELS_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

const MIN_FACE_PX = 44;      // ignore faces smaller than this (unreliable descriptors)
const MIN_CONFIDENCE = 0.45; // ignore low-confidence detections
const DEFAULT_THRESHOLD = 0.55;

export interface DetectedFace {
  imageUrl: string;
  imageName: string;
  crop: string;
  descriptor: number[];
  quality: number; // higher = sharper / bigger / more confident
  person: number;
}

export interface Person {
  id: number;
  faces: DetectedFace[]; // sorted best-quality first
  images: string[];      // unique image URLs, best first
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceapiPromise: Promise<any> | null = null;

async function loadFaceApi(onStatus?: (s: string) => void) {
  if (faceapiPromise) return faceapiPromise;
  faceapiPromise = (async () => {
    onStatus?.("טוען מודלי פרצופים (פעם ראשונה)…");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const faceapi: any = await import(/* @vite-ignore */ FACEAPI_CDN);
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);
    return faceapi;
  })();
  return faceapiPromise;
}

function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Variance of the Laplacian over a grayscale crop — a standard sharpness/blur metric. */
function sharpness(gray: Float32Array, size: number): number {
  let mean = 0;
  let count = 0;
  const lap: number[] = [];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const v = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - size] + gray[i + size];
      lap.push(v); mean += v; count++;
    }
  }
  mean /= count || 1;
  let varr = 0;
  for (const v of lap) varr += (v - mean) * (v - mean);
  return varr / (count || 1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cropAndQuality(img: HTMLImageElement, box: any, score: number): { crop: string; quality: number } {
  const pad = 0.3;
  const x = Math.max(0, box.x - box.width * pad);
  const y = Math.max(0, box.y - box.height * pad);
  const w = Math.min(img.naturalWidth - x, box.width * (1 + 2 * pad));
  const h = Math.min(img.naturalHeight - y, box.height * (1 + 2 * pad));
  const size = 112;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { crop: "", quality: 0 };
  ctx.drawImage(img, x, y, w, h, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const gray = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  const sharp = sharpness(gray, size);
  // Combine: bigger + sharper + more confident = better representative.
  const quality = score * Math.sqrt(box.width * box.height) * Math.pow(sharp + 1, 0.25);
  return { crop: canvas.toDataURL("image/jpeg", 0.85), quality };
}

function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/** L2-normalize so distance thresholds are consistent across descriptors. */
function l2norm(v: number[]): number[] {
  let s = 0;
  for (const x of v) s += x * x;
  s = Math.sqrt(s) || 1;
  return v.map((x) => x / s);
}

export interface GroupFacesOptions {
  threshold?: number;
  onStatus?: (s: string) => void;
  onProgress?: (doneImages: number, totalImages: number, faces: number) => void;
}

export async function groupFaces(
  items: { url: string; name: string }[],
  opts: GroupFacesOptions = {},
): Promise<{ people: Person[]; faces: DetectedFace[]; imagesWithFaces: number }> {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const faceapi = await loadFaceApi(opts.onStatus);
  const detOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE });

  const faces: DetectedFace[] = [];
  let imagesWithFaces = 0;
  opts.onStatus?.("מזהה פרצופים…");
  for (let i = 0; i < items.length; i++) {
    try {
      const img = await loadImageEl(items[i].url);
      const dets = await faceapi.detectAllFaces(img, detOptions).withFaceLandmarks().withFaceDescriptors();
      let kept = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const det of dets as any[]) {
        const box = det.detection.box;
        const score = det.detection.score ?? 1;
        if (box.width < MIN_FACE_PX || box.height < MIN_FACE_PX) continue; // skip tiny faces
        const { crop, quality } = cropAndQuality(img, box, score);
        faces.push({
          imageUrl: items[i].url,
          imageName: items[i].name,
          crop,
          descriptor: l2norm(Array.from(det.descriptor as Float32Array)),
          quality,
          person: -1,
        });
        kept++;
      }
      if (kept) imagesWithFaces++;
    } catch (e) {
      console.warn("face detect failed for", items[i].name, e);
    }
    opts.onProgress?.(i + 1, items.length, faces.length);
  }

  // Exemplar clustering: best faces first become fixed "anchors"; every other
  // face joins the nearest anchor only if it's strictly close. Matching against
  // a real sharp face (not a drifting mean) stops garbage/occluded descriptors
  // from snowballing into the biggest cluster — the cause of the contamination.
  const ordered = [...faces].sort((a, b) => b.quality - a.quality);
  const anchors: { desc: number[]; faces: DetectedFace[] }[] = [];
  for (const face of ordered) {
    let best = -1;
    let bestD = threshold;
    for (let c = 0; c < anchors.length; c++) {
      const d = euclidean(face.descriptor, anchors[c].desc);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best === -1) anchors.push({ desc: face.descriptor, faces: [face] });
    else anchors[best].faces.push(face);
  }

  // Conservative merge: only join anchors that are clearly the same identity.
  let merged = true;
  while (merged) {
    merged = false;
    for (let a = 0; a < anchors.length && !merged; a++) {
      for (let b = a + 1; b < anchors.length; b++) {
        if (euclidean(anchors[a].desc, anchors[b].desc) < threshold * 0.85) {
          anchors[a].faces.push(...anchors[b].faces);
          anchors.splice(b, 1);
          merged = true;
          break;
        }
      }
    }
  }

  const people: Person[] = anchors
    .map((c) => {
      const sorted = c.faces.sort((x, y) => y.quality - x.quality);
      const images: string[] = [];
      for (const f of sorted) if (!images.includes(f.imageUrl)) images.push(f.imageUrl);
      return { id: 0, faces: sorted, images };
    })
    .sort((a, b) => b.images.length - a.images.length)
    .map((p, i) => ({ ...p, id: i }));

  for (const p of people) for (const f of p.faces) f.person = p.id;
  return { people, faces, imagesWithFaces };
}
