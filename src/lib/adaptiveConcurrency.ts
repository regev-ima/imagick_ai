// Adaptive upload concurrency — an AIMD ("warm-up") controller for the style
// training uploads. Big RAW batches on slow/unstable uplinks were saturating
// the connection and the B2 proxy (surfacing as "Load failed"), so instead of
// a fixed parallelism we START GENTLY and let the network tell us how much it
// can take:
//
//   • Start low (≈ one upload per side).
//   • Every few clean, first-try successes → raise the ceiling by one.
//   • The moment failures start ("crashes") → cut the ceiling back (halve it),
//     so we calm down fast and let things recover, then warm up again.
//
// One controller is shared across both sides (before + after) so it reacts to
// the health of the whole shared connection, not each side in isolation.

export interface AdaptiveUploadController {
  /** Wait for a concurrency slot. Resolves once admitted (slot is held). */
  acquire(): Promise<void>;
  /** Release a previously-acquired slot. */
  release(): void;
  /** Report an upload attempt. firstTry = succeeded on the very first attempt. */
  reportSuccess(firstTry: boolean): void;
  /** Report a failed attempt (a congestion signal) → back the ceiling off. */
  reportCongestion(): void;
  /** Current target concurrency (for UI / logging). */
  current(): number;
}

export interface AdaptiveOptions {
  /** Starting ceiling. Default 2 (≈ one per side). */
  start?: number;
  /** Floor — never go below this. Default 1. */
  min?: number;
  /** Ceiling cap — never ramp above this. Default 6. */
  max?: number;
  /** Clean first-try successes needed to raise the ceiling by one. Default 4. */
  increaseAfter?: number;
  /** Min gap between two back-offs, so a burst of failures = one step. Default 4s. */
  decreaseCooldownMs?: number;
  /** Notified whenever the target changes (for a UI "N parallel" hint). */
  onChange?: (target: number) => void;
}

export function createAdaptiveUploadController(opts: AdaptiveOptions = {}): AdaptiveUploadController {
  const min = Math.max(1, opts.min ?? 1);
  const max = Math.max(min, opts.max ?? 6);
  const increaseAfter = Math.max(1, opts.increaseAfter ?? 4);
  const decreaseCooldownMs = opts.decreaseCooldownMs ?? 4000;
  const onChange = opts.onChange;

  let target = Math.min(max, Math.max(min, opts.start ?? 2));
  let active = 0;
  let cleanStreak = 0;
  let lastDecreaseAt = 0;
  const waiters: Array<() => void> = [];

  const setTarget = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped !== target) {
      target = clamped;
      onChange?.(target);
    }
  };

  // Admit as many queued waiters as the current ceiling allows.
  const pump = () => {
    while (active < target && waiters.length > 0) {
      active++;
      const next = waiters.shift()!;
      next();
    }
  };

  return {
    acquire: () =>
      new Promise<void>((resolve) => {
        waiters.push(resolve);
        pump();
      }),
    release: () => {
      active = Math.max(0, active - 1);
      pump();
    },
    reportSuccess: (firstTry: boolean) => {
      // Only a clean first-try win is evidence we can push harder; a success
      // that needed retries already logged its failures as congestion.
      if (!firstTry) return;
      cleanStreak += 1;
      if (cleanStreak >= increaseAfter && target < max) {
        cleanStreak = 0;
        setTarget(target + 1);
        pump();
      }
    },
    reportCongestion: () => {
      cleanStreak = 0;
      const now = Date.now();
      // Collapse a burst of near-simultaneous failures into a single step down.
      if (now - lastDecreaseAt < decreaseCooldownMs) return;
      lastDecreaseAt = now;
      setTarget(Math.floor(target / 2));
    },
    current: () => target,
  };
}
