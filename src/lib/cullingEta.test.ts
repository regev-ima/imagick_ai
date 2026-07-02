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
    // The model is "20 second floor + 1 second per image" — the current
    // engine (Modal CLIP + batched VLM) lands around ~1s/photo end to end,
    // and the old 5min+10s/image estimate read as "~40 min" for a 200-photo
    // gallery, which users rightly called wrong. The estimate must never dip
    // below the floor and must scale linearly with the gallery.
    it("returns the 20 second floor for an empty gallery", () => {
      expect(estimateCullingMs(0)).toBe(20_000);
    });

    it("never dips below the floor for invalid / negative counts", () => {
      expect(estimateCullingMs(-10)).toBe(20_000);
      expect(estimateCullingMs(Number.NaN)).toBe(20_000);
    });

    it("adds 1 second per image on top of the floor", () => {
      // 25 photos → 0:20 + 25s = 0:45
      expect(estimateCullingMs(25)).toBe(20_000 + 25 * 1_000);
      // 200 photos → 0:20 + 200s = 3:40
      expect(estimateCullingMs(200)).toBe(20_000 + 200 * 1_000);
    });

    it("scales linearly with the image count", () => {
      const base = estimateCullingMs(0);
      expect(estimateCullingMs(100) - base).toBe(estimateCullingMs(50) - base + 50 * 1_000);
    });
  });

  describe("stuckThresholdMs", () => {
    // The stuck window is deliberately DECOUPLED from (and much larger than)
    // the displayed ETA: a premature "looks stuck" prompt was the production
    // bug (it invited a duplicate run), so we only call a run stuck well past
    // any realistic completion — 3 minute floor + 3 seconds per image.
    it("is far more generous than the displayed estimate", () => {
      [0, 25, 200, 1000].forEach((n) => {
        expect(stuckThresholdMs(n)).toBeGreaterThan(estimateCullingMs(n));
      });
    });

    it("is 3 minutes + 3 seconds per image", () => {
      expect(stuckThresholdMs(0)).toBe(3 * MIN);
      expect(stuckThresholdMs(200)).toBe(3 * MIN + 200 * 3_000);
    });

    it("is always at least three minutes", () => {
      expect(stuckThresholdMs(0)).toBeGreaterThanOrEqual(3 * MIN);
      expect(stuckThresholdMs(1)).toBeGreaterThanOrEqual(3 * MIN);
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
