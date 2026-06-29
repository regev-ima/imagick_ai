/**
 * In-browser face detection + grouping — proof of concept.
 *
 * Detects every face, computes a 128-d face descriptor, and clusters faces by
 * identity (same person → same group). Runs fully client-side via face-api.js
 * loaded from a CDN (kept out of our bundle). Works on locally-uploaded images,
 * so there's no CORS and no Azure dependency — the two things that broke the
 * old pipeline.
 *
 * Same embedding→cluster idea as the image/aesthetic pipeline, but the vector
 * describes a face's identity instead of the whole image. Production swaps the
 * browser model for a stronger one (InsightFace/ArcFace on Replicate).
 */

const FACEAPI_CDN = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.esm.js";
const MODELS_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
// Euclidean distance below which two face descriptors are the same person.
const MATCH_THRESHOLD = 0.55;

export interface DetectedFace {
  imageUrl: string;
  imageName: string;
  crop: string;          // data URL of the cropped face thumbnail
  descriptor: number[];  // 128-d identity vector
  person: number;        // cluster id (assigned after grouping)
}

export interface Person {
  id: number;
  faces: DetectedFace[];
  images: string[];      // unique image URLs this person appears in
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cropFace(img: HTMLImageElement, box: any): string {
  const pad = 0.3;
  const x = Math.max(0, box.x - box.width * pad);
  const y = Math.max(0, box.y - box.height * pad);
  const w = Math.min(img.naturalWidth - x, box.width * (1 + 2 * pad));
  const h = Math.min(img.naturalHeight - y, box.height * (1 + 2 * pad));
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, x, y, w, h, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

export interface GroupFacesOptions {
  onStatus?: (s: string) => void;
  onProgress?: (doneImages: number, totalImages: number, faces: number) => void;
}

export async function groupFaces(
  items: { url: string; name: string }[],
  opts: GroupFacesOptions = {},
): Promise<{ people: Person[]; faces: DetectedFace[]; imagesWithFaces: number }> {
  const faceapi = await loadFaceApi(opts.onStatus);
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

  const faces: DetectedFace[] = [];
  let imagesWithFaces = 0;
  opts.onStatus?.("מזהה פרצופים…");
  for (let i = 0; i < items.length; i++) {
    try {
      const img = await loadImageEl(items[i].url);
      const dets = await faceapi
        .detectAllFaces(img, options)
        .withFaceLandmarks()
        .withFaceDescriptors();
      if (dets.length) imagesWithFaces++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const det of dets as any[]) {
        faces.push({
          imageUrl: items[i].url,
          imageName: items[i].name,
          crop: cropFace(img, det.detection.box),
          descriptor: Array.from(det.descriptor as Float32Array),
          person: -1,
        });
      }
    } catch (e) {
      console.warn("face detect failed for", items[i].name, e);
    }
    opts.onProgress?.(i + 1, items.length, faces.length);
  }

  // Greedy clustering by identity (nearest representative under the threshold).
  const reps: DetectedFace[] = [];
  for (const face of faces) {
    let best = -1;
    let bestD = MATCH_THRESHOLD;
    for (let c = 0; c < reps.length; c++) {
      const d = euclidean(face.descriptor, reps[c].descriptor);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best === -1) { reps.push(face); face.person = reps.length - 1; }
    else face.person = best;
  }

  // Build people, each with the unique images they appear in.
  const byPerson = new Map<number, DetectedFace[]>();
  for (const f of faces) {
    const arr = byPerson.get(f.person) ?? [];
    arr.push(f);
    byPerson.set(f.person, arr);
  }
  const people: Person[] = [...byPerson.entries()]
    .map(([id, fs]) => ({ id, faces: fs, images: [...new Set(fs.map((f) => f.imageUrl))] }))
    .sort((a, b) => b.images.length - a.images.length)
    .map((p, i) => ({ ...p, id: i })); // renumber by size (person 0 = most photos)

  return { people, faces, imagesWithFaces };
}
