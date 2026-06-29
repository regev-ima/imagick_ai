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
  model: string;
  usage?: {
    prompt_tokens: number | null;
    completion_tokens: number | null;
    cost: number | null; // real USD for this single call, from OpenRouter
  };
}

// OpenRouter model ids the demo can switch between. Edit freely — any
// vision-capable OpenRouter model id works.
export const VISION_MODELS = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o-mini (יציב, זול)" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash (הכי זול)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku (הקשר עדין)" },
];

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

export async function scoreImagePro(imageUrl: string, model: string): Promise<ProScore> {
  const dataUrl = await downscale(imageUrl);
  const res = await fetch("/api/score-vision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl, model }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `שגיאה (${res.status})`);
  }
  return json as ProScore;
}
