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

const DEFAULT_MODEL = "openai/gpt-4o-mini";

// OpenRouter retired some ids; remap so old/cached clients keep working.
const DEPRECATED_MODELS: Record<string, string> = {
  "google/gemini-flash-1.5": DEFAULT_MODEL,
  "google/gemini-flash-1.5-8b": DEFAULT_MODEL,
};

// ── OLD RunPod-compatible culling (ported prompt + schema) ──────────────────
// The VLM returns a JSON LIST in this exact order; label is chosen from the
// caller's labels. Parse failure → one retry → then zeroed defaults / last label.
const CULLING_KEYS = [
  "subject_sharpness", "background_sharpness", "thirds_rule",
  "intended_facial_expression", "overall_score", "label",
] as const;
const CULLING_DEFAULT_LABELS = [
  "Preparations", "Outdoor photography", "Couple moments",
  "Family & Reception", "Ceremony", "Dance/Party", "Other",
];

// Extra per-photo signals (opt-in) the VLM returns as a final OBJECT element.
// Near-zero extra cost — the image (input tokens) is what's expensive, not a few
// more output fields.
const EXTRAS_SPEC = '{"eyes":"open|closed|mixed|none","expression":"one short word","looking":true|false,"keeper":true|false,"hero":true|false,"blur":true|false,"exposure":true|false,"people":number}';

function cullingPrompt(labels: string[], tags: string[], extras: boolean): string {
  const ls = labels.length ? labels : CULLING_DEFAULT_LABELS;
  const example = CULLING_KEYS.map((k) => `${k}_val`).join(", ");
  const parts = [example];
  if (tags.length) parts.push("[tags_array]");
  if (extras) parts.push("{signals}");
  const lines = [
    "Rate the image from 0 to 1 as a professional photographer.",
    "Be as accurate and as critic as you can.",
    "RETURN A JSON PARSABLE LIST ONLY! NO MARKDOWN! NO FREE TEXT! just like this:",
    `[${parts.join(", ")}]`,
    `In label please choose one of: ${ls.join(", ")}`,
  ];
  if (tags.length) {
    lines.push(
      `As the tags element, return an array with every tag from this list that truly applies (0 or more, verbatim, do NOT invent): ${tags.join(", ")}`,
    );
  }
  if (extras) {
    lines.push(
      `As the FINAL list element, return this signals OBJECT for the photo: ${EXTRAS_SPEC}. ` +
      `"eyes": overall eye state of the people; "expression": a one-word mood (smile/laugh/serious/emotional/none); ` +
      `"looking": is anyone looking at the camera; "keeper": would a pro keep this in the final selection; ` +
      `"hero": is it cover/hero-worthy; "blur": UNINTENDED blur/soft focus; "exposure": over/under-exposed; "people": how many people.`,
    );
  }
  return lines.join("\n");
}

function parseCulling(content: string, labels: string[], tags: string[], extras: boolean) {
  const cleaned = content.replace(/```json|```/g, "").trim();
  const v: unknown = JSON.parse(cleaned);
  let arr: unknown[];
  if (Array.isArray(v)) arr = v;
  else if (v && typeof v === "object") {
    arr = CULLING_KEYS.map((k) => (v as Record<string, unknown>)[k]);
    if (tags.length) arr.push((v as Record<string, unknown>).tags);
  } else throw new Error("culling: not a list/dict");
  if (arr.length < CULLING_KEYS.length) throw new Error("culling: wrong length");
  const num = (x: unknown) => { const n = typeof x === "number" ? x : parseFloat(String(x)); return Number.isFinite(n) ? n : 0; };
  const isObj = (e: unknown): e is Record<string, unknown> => !!e && typeof e === "object" && !Array.isArray(e);
  // Applicable tags = the first array element after the 6 scores.
  let outTags: string[] = [];
  const tagsEl = arr.slice(CULLING_KEYS.length).find((e) => Array.isArray(e));
  if (tags.length && Array.isArray(tagsEl)) {
    const allow = new Set(tags.map((t) => t.trim()));
    outTags = (tagsEl as unknown[])
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => allow.has(s));
  }
  // Extra signals = the trailing OBJECT element (or the whole object if the model
  // returned one big object instead of a list).
  let sig: Record<string, unknown> = {};
  if (extras) sig = (isObj(v) ? v : arr.slice(CULLING_KEYS.length).find(isObj)) as Record<string, unknown> ?? {};
  const bool = (x: unknown) => x === true || x === "true" || x === 1;
  const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  const extraOut = extras ? {
    eyes_status: (["open", "closed", "mixed", "none"].includes(str(sig.eyes)) ? str(sig.eyes) : "none"),
    expression: str(sig.expression) || null,
    looking_at_camera: bool(sig.looking),
    is_keeper: bool(sig.keeper),
    is_hero: bool(sig.hero),
    has_blur_issue: bool(sig.blur),
    has_exposure_issue: bool(sig.exposure),
    people_count: Math.max(0, Math.round(num(sig.people))),
  } : {};
  return {
    subject_sharpness: num(arr[0]),
    background_sharpness: num(arr[1]),
    thirds_rule: num(arr[2]),
    intended_facial_expression: num(arr[3]),
    overall_score: num(arr[4]),
    label: (typeof arr[5] === "string" && arr[5]) ? arr[5] : (labels[labels.length - 1] ?? "Other"),
    tags: outTags,
    ...extraOut,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCulling(res: any, key: string, image: string, body: any) {
  const labels: string[] = Array.isArray(body?.labels)
    ? body.labels.filter((t: unknown) => typeof t === "string")
    : CULLING_DEFAULT_LABELS;
  const tags: string[] = Array.isArray(body?.tags)
    ? body.tags.filter((t: unknown) => typeof t === "string").slice(0, 40)
    : [];
  const extras: boolean = body?.extras === true;
  const requested = typeof body?.model === "string" && body.model ? body.model : DEFAULT_MODEL;
  const chosenModel = DEPRECATED_MODELS[requested] || requested;
  const prompt = cullingPrompt(labels, tags, extras);

  const callOnce = async () => {
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Imagick culling" },
      body: JSON.stringify({
        model: chosenModel,
        messages: [{ role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image } },
        ] }],
        // Generous headroom: busy group shots with many tags + the signals
        // object were TRUNCATING at 320 → unparseable JSON → zero-fallback,
        // which silently left photos "unscored" (score 0) in the gallery.
        max_tokens: extras ? 640 : 320,
        temperature: 0.2,
        usage: { include: true },
      }),
    });
    if (!orRes.ok) throw new Error(`openrouter ${orRes.status}: ${(await orRes.text()).slice(0, 150)}`);
    const data = await orRes.json();
    return { content: data?.choices?.[0]?.message?.content ?? "", usage: data?.usage ?? {} };
  };

  for (let attempt = 0; attempt < 2; attempt++) { // one call + one retry
    try {
      const { content, usage } = await callOnce();
      const parsed = parseCulling(content, labels, tags, extras);
      const cost = typeof usage?.cost === "number" ? usage.cost : null;
      res.status(200).json({ ...parsed, model: chosenModel, usage: { cost } });
      return;
    } catch {
      if (attempt === 1) {
        // Faithful fallback: zeros + last label + no tags.
        res.status(200).json({
          subject_sharpness: 0, background_sharpness: 0, thirds_rule: 0,
          intended_facial_expression: 0, overall_score: 0,
          label: labels[labels.length - 1] ?? "Other", tags: [],
          model: chosenModel, fallback: true,
        });
        return;
      }
    }
  }
}

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

Compute overall as a holistic 0–5 (not a strict average — a stunning moment can outweigh a minor technical flaw).`;

// JSON output spec appended per request. Concise mode drops the prose fields
// (style_note/explanation) — those are output tokens, which cost ~4x input,
// so omitting them is a real saving at scale. Verbose mode adds them back.
const JSON_VERBOSE = `\n\nRespond with ONLY a JSON object, no prose around it:
{"overall":number,"technical":number,"composition":number,"moment":number,"impact":number,"style_note":string,"explanation":string}
"style_note": short — any intentional technique/context (or "").
"explanation": ONE short sentence in HEBREW.`;
const JSON_CONCISE = `\n\nRespond with ONLY this JSON object — numbers only, NO style_note, NO explanation, NO prose:
{"overall":number,"technical":number,"composition":number,"moment":number,"impact":number}`;

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

    // OLD RunPod-compatible culling path (list schema + labels + fallback).
    if (body?.mode === "culling") {
      await handleCulling(res, key, image, body);
      return;
    }

    // Optional tagging: caller supplies an exact tag list (e.g. Hebrew wedding
    // tags) and the model returns which of them genuinely apply — same call,
    // no extra cost.
    const tagList: string[] = Array.isArray(body?.tags)
      ? body.tags.filter((t: unknown) => typeof t === "string").slice(0, 40)
      : [];
    // Concise by default (cheap); verbose only when the client asks for prose.
    const verbose = body?.verbose === true;
    let system = SYSTEM_RUBRIC + (verbose ? JSON_VERBOSE : JSON_CONCISE);
    if (tagList.length) {
      system += `\n\nTAGGING: From EXACTLY this list (verbatim, do not invent new tags), add a "tags" array with every tag that genuinely applies to the photo (0 or more):\n${JSON.stringify(tagList)}`;
    }
    const requested = typeof model === "string" && model ? model : DEFAULT_MODEL;
    const chosenModel = DEPRECATED_MODELS[requested] || requested;

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
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Score this photograph per the rubric. JSON only." },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        max_tokens: verbose ? 400 : 150, // concise mode needs far fewer output tokens
        temperature: 0.2,
        usage: { include: true }, // ask OpenRouter for real token counts + cost
      }),
    });

    if (!orRes.ok) {
      const text = await orRes.text();
      const hints: Record<number, string> = {
        401: "המפתח (OPENROUTER_API_KEY) לא תקין.",
        402: "אין מספיק יתרת קרדיט ב-OpenRouter. טען יתרה ב-openrouter.ai/settings/credits ונסה שוב.",
        400: "ייתכן מזהה מודל לא תקין — בחר מודל אחר מהרשימה.",
        404: "המודל לא נמצא — בחר מודל אחר מהרשימה.",
        429: "חריגת קצב בקשות. המתן רגע ונסה שוב (או טען קרדיט).",
      };
      const hint = hints[orRes.status] || "";
      res.status(502).json({
        error: "openrouter_error",
        status: orRes.status,
        message: `OpenRouter החזיר ${orRes.status}. ${hint} ${text.slice(0, 200)}`.trim(),
      });
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
