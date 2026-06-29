/**
 * Client helper for the professional vision-LLM scoring path.
 * Downscales each image before sending (smaller payload + far cheaper vision
 * tokens) and calls our /api/score-vision serverless function (which holds the
 * OpenRouter key server-side).
 */

export interface ProScore {
  overall: number;
  technical: number;
  composition: number;
  moment: number;
  impact: number;
  style_note: string;
  explanation: string;
  tags?: string[];
  model: string;
  usage?: {
    prompt_tokens: number | null;
    completion_tokens: number | null;
    cost: number | null; // real USD for this single call, from OpenRouter
  };
}

export interface VisionModelOption {
  id: string;
  label: string;
  promptPerM?: number;     // USD per 1M input tokens
  completionPerM?: number; // USD per 1M output tokens
}

// Static fallback used only if the live OpenRouter list can't be fetched.
// IDs go stale over time — the live list (fetchVisionModels) is preferred.
export const VISION_MODELS: VisionModelOption[] = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o-mini · $0.15/$0.60 ל-1M", promptPerM: 0.15, completionPerM: 0.6 },
];

/** Fetches the live, image-capable model list from OpenRouter (via our function). */
export async function fetchVisionModels(): Promise<VisionModelOption[]> {
  const res = await fetch("/api/list-models");
  const json = await res.json();
  if (!res.ok || !Array.isArray(json.models)) {
    throw new Error(json?.message || json?.error || `שגיאה (${res.status})`);
  }
  return json.models as VisionModelOption[];
}

/** Draws the image to a canvas at <=maxPx on the long edge and returns a JPEG data URL. */
async function downscale(url: string, maxPx = 512): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export async function scoreImagePro(imageUrl: string, model: string, tags?: string[]): Promise<ProScore> {
  const dataUrl = await downscale(imageUrl);
  const res = await fetch("/api/score-vision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl, model, tags }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `שגיאה (${res.status})`);
  }
  return json as ProScore;
}
