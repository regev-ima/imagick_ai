// Adaptive upload concurrency — an AIMD ("warm-up") controller for the style
// training uploads. Big RAW batches on slow/unstable uplinks were saturating
// the connection and the B2 proxy (surfacing as "Load failed"), so instead of
// a fixed parallelism we START GENTLY and let the network tell us how much it
// can take:
//
//   • Start low (one upload per side).
//   • Every few clean, first-try successes → raise the ceiling by one.
//   • The moment failures start ("crashes") → cut the ceiling back (halve it),
//     so we calm down fast and let things recover, then warm up again.
//
// One controller is shared across both sides (before + after) so it reacts to
// the health of the whole shared connection, not each side in isolation.
//
// Fairness: each EXPECTED side is guaranteed at least one concurrent slot, so
// before/after upload in parallel from the very first file — one side can't
// grab the whole ceiling while the other waits (even during the seconds a
// single large RAW takes). When a side finishes, its reservation is released
// so the remaining side can use the full ceiling (no wasted capacity).

export interface AdaptiveUploadController {
  /**
   * Wait for a concurrency slot. Resolves once admitted (slot is held).
   * `group` (the before/after side) drives fair, per-side admission.
   */
  acquire(group?: string): Promise<void>;
  /** Release a previously-acquired slot for `group` (same value as acquire). */
  release(group?: string): void;
  /** Report an upload attempt. firstTry = succeeded on the very first attempt. */
  reportSuccess(firstTry: boolean): void;
  /** Report a failed attempt (a congestion signal) → back the ceiling off. */
  reportCongestion(): void;
  /** Record bytes that just finished uploading (feeds the throughput meter). */
  recordBytes(bytes: number): void;
  /** Rolling upload throughput in bytes/sec over the recent window (0 if idle). */
  throughputBps(): number;
  /** Current target concurrency (for UI / logging). */
  current(): number;
}

export interface AdaptiveOptions {
  /** Starting ceiling. Default 2 (one per side). */
  start?: number;
  /** Floor — never go below this. Default 1. */
  min?: number;
  /** Ceiling cap — never ramp above this. Default 6. */
  max?: number;
  /** Clean first-try successes needed to raise the ceiling by one. Default 4. */
  increaseAfter?: number;
  /** Min gap between two back-offs, so a burst of failures = one step. Default 4s. */
  decreaseCooldownMs?: number;
  /**
   * Sides expected to upload (e.g. ["before","after"]). Each gets a reserved
   * slot until it has finished, so both run in parallel from the first file.
   */
  groups?: string[];
  /** How long to hold a reservation for a group that never shows up. Default 15s. */
  reservationGraceMs?: number;
  /** Notified whenever the target changes (for a UI "N parallel" hint). */
  onChange?: (target: number) => void;
}

// Rolling throughput is measured over completed-file samples in this window.
// fetch() gives no byte-level upload progress, so a file's whole size is
// credited at completion; a several-second window smooths that into a stable
// MB/s reading even with large RAW files.
const THROUGHPUT_WINDOW_MS = 8000;

export function createAdaptiveUploadController(opts: AdaptiveOptions = {}): AdaptiveUploadController {
  const min = Math.max(1, opts.min ?? 1);
  const max = Math.max(min, opts.max ?? 6);
  const increaseAfter = Math.max(1, opts.increaseAfter ?? 4);
  const decreaseCooldownMs = opts.decreaseCooldownMs ?? 4000;
  const reservationGraceMs = opts.reservationGraceMs ?? 15000;
  const expected = new Set(opts.groups ?? []);
  const onChange = opts.onChange;
  const createdAt = Date.now();

  let target = Math.min(max, Math.max(min, opts.start ?? 2));
  let active = 0;
  let cleanStreak = 0;
  let lastDecreaseAt = 0;

  // Per-group waiter queues + a round-robin pointer for fair admission.
  const queues = new Map<string, Array<() => void>>();
  const inFlight = new Map<string, number>();
  const seen = new Set<string>();
  const groupOrder: string[] = [];
  let rr = 0;

  // Sliding window of [timestamp, bytes] completions for the throughput meter.
  const samples: Array<[number, number]> = [];
  const pruneSamples = (now: number) => {
    while (samples.length && now - samples[0][0] > THROUGHPUT_WINDOW_MS) samples.shift();
  };

  const setTarget = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped !== target) {
      target = clamped;
      onChange?.(target);
    }
  };

  // A group holds a reservation while it still has (or is expected to bring)
  // work: it has queued waiters, OR it's an expected side we haven't seen yet
  // (within the grace window). A seen side whose queue has drained releases its
  // reservation so the other side can use the full ceiling.
  const reserves = (g: string, now: number): boolean => {
    const waiting = (queues.get(g)?.length ?? 0) > 0;
    if (waiting) return true;
    if (expected.has(g) && !seen.has(g) && now - createdAt < reservationGraceMs) return true;
    return false;
  };

  // Admit waiters up to the ceiling. Each group is capped so that every OTHER
  // reserving group keeps at least one slot — guaranteeing 1 per side — while a
  // lone remaining group may use everything.
  const pump = () => {
    while (active < target) {
      const now = Date.now();
      const allGroups = new Set<string>([...expected, ...groupOrder]);
      const reservers: string[] = [];
      allGroups.forEach((g) => {
        if (reserves(g, now)) reservers.push(g);
      });

      let picked: string | null = null;
      for (let k = 0; k < groupOrder.length; k++) {
        const g = groupOrder[(rr + k) % groupOrder.length];
        const q = queues.get(g);
        if (!q || q.length === 0) continue;
        const othersReserving = reservers.filter((r) => r !== g).length;
        const cap = Math.max(1, target - othersReserving);
        if ((inFlight.get(g) ?? 0) < cap) {
          picked = g;
          rr = (rr + k + 1) % groupOrder.length;
          break;
        }
      }
      if (picked === null) break; // nothing admittable (all at their fair cap)
      active += 1;
      inFlight.set(picked, (inFlight.get(picked) ?? 0) + 1);
      queues.get(picked)!.shift()!();
    }
  };

  return {
    acquire: (group = "default") =>
      new Promise<void>((resolve) => {
        let q = queues.get(group);
        if (!q) {
          q = [];
          queues.set(group, q);
          groupOrder.push(group);
        }
        seen.add(group);
        q.push(resolve);
        pump();
      }),
    release: (group = "default") => {
      active = Math.max(0, active - 1);
      inFlight.set(group, Math.max(0, (inFlight.get(group) ?? 0) - 1));
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
    recordBytes: (bytes: number) => {
      if (bytes <= 0) return;
      const now = Date.now();
      samples.push([now, bytes]);
      pruneSamples(now);
    },
    throughputBps: () => {
      const now = Date.now();
      pruneSamples(now);
      if (samples.length === 0) return 0;
      const totalBytes = samples.reduce((sum, [, b]) => sum + b, 0);
      // Span from the oldest sample to now, floored at 1s so a single recent
      // completion doesn't report an absurd instantaneous rate.
      const spanSec = Math.max(1000, now - samples[0][0]) / 1000;
      return totalBytes / spanSec;
    },
    current: () => target,
  };
}
