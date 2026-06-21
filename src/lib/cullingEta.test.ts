import { describe, it, expect } from "vitest";
import {
  estimateCullingMs,
  stuckThresholdMs,
  formatDuration,
  formatCountdown,
} from "./cullingEta";

const MIN = 60 * 1000;

describe("cullingEta", () => {
  describe("estimateCullingMs", () => {
    // The model is "5 minute floor + 10 seconds per image". A premature
    // "looks stuck" prompt was the production bug (it invited a
    // duplicate run that wiped ratings), so the estimate must never dip
    // below the floor and must scale linearly with the gallery.
    it("returns the 5 minute floor for an empty gallery", () => {
      expect(estimateCullingMs(0)).toBe(5 * MIN);
    });

    it("never dips below the floor for invalid / negative counts", () => {
      expect(estimateCullingMs(-10)).toBe(5 * MIN);
      expect(estimateCullingMs(Number.NaN)).toBe(5 * MIN);
    });

    it("adds 10 seconds per image on top of the floor", () => {
      // 25 photos → 5:00 + 25 × 10s = 5:00 + 4:10 = 9:10
      expect(estimateCullingMs(25)).toBe(5 * MIN + 25 * 10_000);
      // 200 photos → 5:00 + 2000s
      expect(estimateCullingMs(200)).toBe(5 * MIN + 200 * 10_000);
    });

    it("scales linearly with the image count", () => {
      const base = estimateCullingMs(0);
      expect(estimateCullingMs(100) - base).toBe(estimateCullingMs(50) - base + 50 * 10_000);
    });
  });

  describe("stuckThresholdMs", () => {
    // "Only after this time has passed can we say it's stuck" — so the
    // threshold is the full estimate, not a fraction of it.
    it("equals the estimate (the whole expected window must elapse)", () => {
      [0, 25, 200, 1000].forEach((n) => {
        expect(stuckThresholdMs(n)).toBe(estimateCullingMs(n));
      });
    });

    it("is always at least five minutes", () => {
      expect(stuckThresholdMs(0)).toBeGreaterThanOrEqual(5 * MIN);
      expect(stuckThresholdMs(1)).toBeGreaterThanOrEqual(5 * MIN);
    });
  });

  describe("formatDuration", () => {
    it("uses seconds under a minute", () => {
      expect(formatDuration(45_000)).toBe("45 s");
      expect(formatDuration(0)).toBe("1 s"); // clamps to 1, never "0 s"
    });

    it("uses minutes under an hour", () => {
      expect(formatDuration(9 * MIN)).toBe("9 min");
      expect(formatDuration(38 * MIN)).toBe("38 min");
    });

    it("uses hours past sixty minutes", () => {
      expect(formatDuration(60 * MIN)).toBe("1h");
      expect(formatDuration(171 * MIN)).toBe("2h 51m");
    });
  });

  describe("formatCountdown", () => {
    it("clamps negatives to 0:00 (run past its estimate)", () => {
      expect(formatCountdown(-5000)).toBe("0:00");
    });

    it("formats M:SS under an hour", () => {
      expect(formatCountdown(154_000)).toBe("2:34");
      expect(formatCountdown(5_000)).toBe("0:05");
    });

    it("formats H:MM:SS past an hour", () => {
      expect(formatCountdown(3_905_000)).toBe("1:05:05");
    });
  });
});
