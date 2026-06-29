/**
 * Professional, context-aware photo scoring via a vision LLM through OpenRouter.
 *
 * Why a vision LLM (not the cheap CLIP head): it actually *understands* the
 * scene, so it scores against a professional rubric AND respects context —
 * e.g. closed eyes while praying is an intentional, emotional moment, not a
 * defect; an intentional motion blur / silhouette / high-key shot is a style
 * choice, not a flaw. The CLIP proxy can't tell those apart; a vision model can.
 *
 * The OpenRouter API key lives only here (server side). OpenRouter lets us
 * swap models freely (Gemini Flash / GPT-4o-mini / Claude Haiku …) per request.
 *
 * Set OPENROUTER_API_KEY in the Vercel project env for this to work.
 */

export const config = { maxDuration: 60 };

const DEFAULT_MODEL = "google/gemini-flash-1.5";

// The professional rubric. Encodes what photographers actually judge, and —
// crucially — tells the model to read intent/context before penalizing.
const SYSTEM_RUBRIC = `You are a professional photography judge scoring a single photo for a photographer's gallery culling.

Score 0–5 (one decimal allowed) on each dimension:
- technical: focus/sharpness on the subject, exposure, white balance, noise, motion blur.
- composition: framing, balance, leading lines, distracting background, horizon.
- moment: expression and emotion IN CONTEXT, timing, interaction, authenticity.
- impact: storytelling, does it capture a meaningful or compelling moment.

CRITICAL — judge intent, not surface features:
- Closed eyes can be INTENTIONAL and powerful (praying, meditation, emotion, a kiss). Do NOT penalize closed eyes when the context shows intent — score the emotion.
- Recognize deliberate techniques as choices, not flaws: motion blur, panning, silhouette, lens flare, high-key/low-key, shallow depth of field/bokeh, intentional grain, candid imperfection.
- Reward authentic moments over stiff, technically-perfect-but-lifeless shots.

Compute overall as a holistic 0–5 (not a strict average — a stunning moment can outweigh a minor technical flaw).

Respond with ONLY a JSON object, no prose:
{"overall":number,"technical":number,"composition":number,"moment":number,"impact":number,"style_note":string,"explanation":string}
"style_note": short — any intentional technique or context you detected (or "" if none).
"explanation": one short sentence in HEBREW explaining the overall score.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    res.status(400).json({
      error: "missing_key",
      message: "חסר OPENROUTER_API_KEY. הוסף אותו ב-Vercel → Project Settings → Environment Variables.",
    });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { image, model } = body || {};
    if (!image || typeof image !== "string") {
      res.status(400).json({ error: "bad_request", message: "missing image (data URL or https URL)" });
      return;
    }
    const chosenModel = typeof model === "string" && model ? model : DEFAULT_MODEL;

    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "Imagick aesthetic scoring",
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: "system", content: SYSTEM_RUBRIC },
          {
            role: "user",
            content: [
              { type: "text", text: "Score this photograph per the rubric. JSON only." },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 400,
        temperature: 0.2,
        usage: { include: true }, // ask OpenRouter for real token counts + cost
      }),
    });

    if (!orRes.ok) {
      const text = await orRes.text();
      res.status(502).json({ error: "openrouter_error", status: orRes.status, detail: text.slice(0, 500) });
      return;
    }

    const data = await orRes.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown>;
    try {
      // Models sometimes wrap JSON in ```json fences — strip them.
      const cleaned = content.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(502).json({ error: "parse_error", raw: content.slice(0, 500) });
      return;
    }

    // Real usage/cost as reported by OpenRouter (usage.include above).
    const u = data?.usage ?? {};
    const usage = {
      prompt_tokens: u.prompt_tokens ?? null,
      completion_tokens: u.completion_tokens ?? null,
      cost: typeof u.cost === "number" ? u.cost : null, // USD for this single call
    };

    res.status(200).json({ ...parsed, model: chosenModel, usage });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    res.status(500).json({ error: "server_error", message });
  }
}
