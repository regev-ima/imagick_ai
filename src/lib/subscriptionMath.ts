/**
 * Pure helpers that derive billing/edit counters from subscription, plan,
 * and credit-grant rows. Extracted from useSubscription so it can be unit
 * tested without mocking supabase + react-query.
 *
 * The DB went through a rename: credits_used → edits_used,
 * credits_remaining → edits_remaining, credits_per_month → edits_included.
 * Old name aliases are accepted as fallbacks so legacy data and the
 * (currently stale) generated Supabase types both keep working.
 */

export const EDITS_FALLBACK_DEFAULT = 3000;

/** Loose subscription row — both pre and post-rename column names accepted. */
export interface SubscriptionRow {
  edits_used?: number | null;
  edits_remaining?: number | null;
  /** @deprecated pre-rename alias */
  credits_used?: number | null;
  /** @deprecated pre-rename alias */
  credits_remaining?: number | null;
  edits_reserved?: number | null;
  storage_used_mb?: number | null;
  status?: string | null;
  cancel_at_period_end?: boolean | null;
}

/** Loose plan row — both pre and post-rename column names accepted. */
export interface PlanRow {
  edits_included?: number | null;
  /** @deprecated pre-rename alias */
  credits_per_month?: number | null;
  slug?: string | null;
}

export interface CreditGrantRow {
  status?: string | null;
  credits_remaining?: number | null;
}

export interface DerivedEditCounters {
  editsUsed: number;
  editsRemaining: number;
  editsTotal: number;
  editsReserved: number;
  isUnlimited: boolean;
  availableEdits: number;
  giftCreditsTotal: number;
  planCreditsRemaining: number;
}

/**
 * Total bonus credits across active grants. We only count grants whose
 * status is "active" *and* still have credits_remaining > 0; an "active"
 * grant that has drained to zero shouldn't inflate the total.
 */
export function sumGiftCredits(grants: CreditGrantRow[] | null | undefined): number {
  if (!grants) return 0;
  return grants
    .filter(g => g?.status === "active" && (g?.credits_remaining ?? 0) > 0)
    .reduce((sum, g) => sum + (g?.credits_remaining ?? 0), 0);
}

/**
 * Resolve the plan's edit allotment, accepting both new (edits_included)
 * and legacy (credits_per_month) column names. Returns the fallback value
 * (default 3000) only when neither is set.
 */
export function resolveEditsTotal(plan: PlanRow | null | undefined, fallback = EDITS_FALLBACK_DEFAULT): number {
  return plan?.edits_included ?? plan?.credits_per_month ?? fallback;
}

/**
 * Derive every edit-related counter the UI shows on the dashboard,
 * billing page and sidebar from the raw rows we get from supabase.
 *
 * Unlimited plans (edits_remaining === -1) short-circuit to availableEdits
 * = -1; the UI uses that as a sentinel ("∞").
 */
export function deriveEditCounters(
  subscription: SubscriptionRow | null | undefined,
  plan: PlanRow | null | undefined,
  grants: CreditGrantRow[] | null | undefined,
  fallback = EDITS_FALLBACK_DEFAULT,
): DerivedEditCounters {
  const editsUsed = subscription?.edits_used ?? subscription?.credits_used ?? 0;
  const editsRemaining =
    subscription?.edits_remaining ??
    subscription?.credits_remaining ??
    plan?.edits_included ??
    plan?.credits_per_month ??
    fallback;
  const editsTotal = resolveEditsTotal(plan, fallback);
  const editsReserved = subscription?.edits_reserved ?? 0;
  const isUnlimited = editsRemaining === -1;
  const availableEdits = isUnlimited ? -1 : Math.max(0, editsRemaining - editsReserved);
  const giftCreditsTotal = sumGiftCredits(grants);
  const planCreditsRemaining = isUnlimited
    ? -1
    : Math.max(0, editsRemaining - giftCreditsTotal);

  return {
    editsUsed,
    editsRemaining,
    editsTotal,
    editsReserved,
    isUnlimited,
    availableEdits,
    giftCreditsTotal,
    planCreditsRemaining,
  };
}
