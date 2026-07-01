/**
 * Returns the FULL list of OpenRouter models that can analyze images
 * (input modality includes "image"), sorted cheapest → most expensive.
 *
 * The dropdown in the test dashboard reads this so the user picks from every
 * available vision model — we don't curate the list. Pricing is whatever
 * OpenRouter reports; the list stays up to date on its own.
 *
 * Public endpoint (no secret needed); we pass OPENROUTER_API_KEY if present.
 */
export const config = { maxDuration: 15 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  try {
    const key = process.env.OPENROUTER_API_KEY;
    const r = await fetch("https://openrouter.ai/api/v1/models", {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
    });
    if (!r.ok) {
      res.status(502).json({ error: "openrouter", status: r.status, body: (await r.text()).slice(0, 200) });
      return;
    }
    const data = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = Array.isArray(data?.data) ? data.data : [];
    const num = (x: unknown) => { const n = parseFloat(String(x ?? "")); return Number.isFinite(n) ? n : 0; };

    const models = list
      .filter((m) => Array.isArray(m?.architecture?.input_modalities) && m.architecture.input_modalities.includes("image"))
      .map((m) => ({
        id: m.id as string,
        name: (m.name ?? m.id) as string,
        prompt: num(m.pricing?.prompt),         // USD per input token
        completion: num(m.pricing?.completion), // USD per output token
        image: num(m.pricing?.image),           // USD per image (if metered that way)
      }))
      // cheapest first. OpenRouter uses -1 for variable/unknown pricing (Auto
      // Router, some previews) — push those to the END instead of the top.
      .sort((a, b) => {
        const c = (x: number) => (x < 0 ? Number.POSITIVE_INFINITY : x);
        return (c(a.prompt) - c(b.prompt)) || (c(a.image) - c(b.image)) ||
          (c(a.completion) - c(b.completion)) || a.id.localeCompare(b.id);
      });

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ models });
  } catch (err: unknown) {
    res.status(500).json({ error: "server_error", message: err instanceof Error ? err.message : "unknown" });
  }
}
