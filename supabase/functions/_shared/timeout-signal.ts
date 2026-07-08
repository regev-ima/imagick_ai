/**
 * AbortSignal.timeout with a defensive fallback.
 *
 * The pipeline's outbound fetches (Modal / VLM / self-chain) rely on
 * per-request timeouts; if the edge runtime ever lacks AbortSignal.timeout
 * (or a future runtime regresses it), calling it would THROW inside every
 * worker and turn each culling call into an instant failure — a silent,
 * total pipeline outage. This helper never throws: it uses the native
 * static when present and otherwise falls back to AbortController +
 * setTimeout (the dangling timer is harmless — the invocation ends anyway).
 */
export function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(ms);
    }
    if (typeof AbortController !== "undefined") {
      const c = new AbortController();
      setTimeout(() => c.abort(new DOMException("Signal timed out.", "TimeoutError")), ms);
      return c.signal;
    }
  } catch { /* fall through — no signal is better than a thrown fetch */ }
  return undefined;
}
