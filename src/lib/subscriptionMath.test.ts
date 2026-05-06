import { describe, it, expect } from "vitest";
import {
  deriveEditCounters,
  resolveEditsTotal,
  sumGiftCredits,
} from "./subscriptionMath";

describe("subscriptionMath", () => {
  describe("deriveEditCounters", () => {
    // Regression guard for the production bug fixed in PR #40: after the
    // Mar 2026 credits→edits rename, useSubscription was reading the old
    // column names which had been dropped, so editsRemaining always fell
    // back to the plan ceiling and the UI showed 3,000 / 3,000 forever.
    it("reads the post-rename column names (edits_used / edits_remaining)", () => {
      const counters = deriveEditCounters(
        { edits_used: 250, edits_remaining: 750, edits_reserved: 0 },
        { edits_included: 1000 },
        [],
      );
      expect(counters.editsUsed).toBe(250);
      expect(counters.editsRemaining).toBe(750);
      expect(counters.editsTotal).toBe(1000);
    });

    it("falls back to legacy column names when new ones are missing", () => {
      const counters = deriveEditCounters(
        { credits_used: 250, credits_remaining: 750 } as any,
        { credits_per_month: 1000 } as any,
        [],
      );
      expect(counters.editsUsed).toBe(250);
      expect(counters.editsRemaining).toBe(750);
      expect(counters.editsTotal).toBe(1000);
    });

    it("falls back to the plan total when subscription has no remaining value", () => {
      const counters = deriveEditCounters(
        { edits_used: 0 } as any,
        { edits_included: 500 },
        [],
      );
      expect(counters.editsRemaining).toBe(500);
      expect(counters.editsTotal).toBe(500);
    });

    it("falls back to the default when nothing is set", () => {
      const counters = deriveEditCounters(null, null, []);
      expect(counters.editsRemaining).toBe(3000);
      expect(counters.editsTotal).toBe(3000);
      expect(counters.editsUsed).toBe(0);
    });

    it("treats edits_remaining = -1 as unlimited", () => {
      const counters = deriveEditCounters(
        { edits_used: 1234, edits_remaining: -1 },
        { edits_included: -1 },
        [],
      );
      expect(counters.isUnlimited).toBe(true);
      expect(counters.availableEdits).toBe(-1);
      expect(counters.planCreditsRemaining).toBe(-1);
    });

    it("subtracts reserved edits from availableEdits without going negative", () => {
      const counters = deriveEditCounters(
        { edits_remaining: 100, edits_reserved: 30 },
        { edits_included: 1000 },
        [],
      );
      expect(counters.availableEdits).toBe(70);
    });

    it("clamps availableEdits at 0 when reservations exceed remaining", () => {
      const counters = deriveEditCounters(
        { edits_remaining: 10, edits_reserved: 50 },
        { edits_included: 1000 },
        [],
      );
      expect(counters.availableEdits).toBe(0);
    });

    it("uses a custom fallback when provided", () => {
      const counters = deriveEditCounters(null, null, [], 999);
      expect(counters.editsRemaining).toBe(999);
      expect(counters.editsTotal).toBe(999);
    });
  });

  describe("sumGiftCredits", () => {
    it("returns 0 for null or empty input", () => {
      expect(sumGiftCredits(null)).toBe(0);
      expect(sumGiftCredits(undefined)).toBe(0);
      expect(sumGiftCredits([])).toBe(0);
    });

    it("sums credits_remaining for active grants", () => {
      expect(
        sumGiftCredits([
          { status: "active", credits_remaining: 100 },
          { status: "active", credits_remaining: 50 },
        ]),
      ).toBe(150);
    });

    it("ignores non-active grants", () => {
      expect(
        sumGiftCredits([
          { status: "active", credits_remaining: 100 },
          { status: "depleted", credits_remaining: 0 },
          { status: "expired", credits_remaining: 200 },
        ]),
      ).toBe(100);
    });

    // Regression guard: an "active" grant whose credits_remaining have
    // already drained to 0 used to inflate the gift-credits total.
    it("ignores active grants that have drained to zero", () => {
      expect(
        sumGiftCredits([
          { status: "active", credits_remaining: 0 },
          { status: "active", credits_remaining: 10 },
        ]),
      ).toBe(10);
    });
  });

  describe("resolveEditsTotal", () => {
    it("prefers edits_included when both names are present", () => {
      expect(
        resolveEditsTotal({ edits_included: 999, credits_per_month: 1 } as any),
      ).toBe(999);
    });

    it("falls back to credits_per_month when edits_included is missing", () => {
      expect(resolveEditsTotal({ credits_per_month: 1500 } as any)).toBe(1500);
    });

    it("returns the fallback when neither column is present", () => {
      expect(resolveEditsTotal(null)).toBe(3000);
      expect(resolveEditsTotal({} as any, 7777)).toBe(7777);
    });
  });
});
