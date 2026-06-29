/**
 * Returns the live list of image-capable models from OpenRouter, so the demo's
 * model picker is always current (no hardcoded ids that go stale and 404).
 * Cheapest paid models first; :free models are excluded (rate-limited and often
 * blocked by data-policy settings).
 */

export const config = { maxDuration: 30 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    res.status(400).json({ error: "missing_key", message: "חסר OPENROUTER_API_KEY ב-Vercel." });
    return;
  }
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      res.status(502).json({ error: "openrouter_error", status: r.status });
      return;
    }
    const data = await r.json();
    const models = (data?.data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m?.architecture?.input_modalities?.includes("image"))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => typeof m.id === "string" && !m.id.endsWith(":free"))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => {
        const prompt = Number(m?.pricing?.prompt) || 0; // USD per input token
        return { id: m.id, name: m.name || m.id, pricePerM: prompt * 1_000_000 };
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m.pricePerM > 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.pricePerM - b.pricePerM)
      .slice(0, 30)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({ id: m.id, label: `${m.name} · $${m.pricePerM.toFixed(2)}/1M` }));

    res.status(200).json({ models });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    res.status(500).json({ error: "server_error", message });
  }
}
