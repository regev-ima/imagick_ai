import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deriveEditCounters } from "@/lib/subscriptionMath";
import { useUserRole } from "./useUserRole";
import { useEffectiveUser } from "./useImpersonation";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  edits_included: number;
  price_per_extra_edit: number;
  max_styles: number;
  max_storage_gb: number;
  has_ai_culling: boolean;
  has_team_access: boolean;
  has_api_access: boolean;
  has_priority_support: boolean;
  has_full_style_library: boolean;
  /** @deprecated pre-rename alias for edits_included */
  credits_per_month?: number;
  /** @deprecated pre-rename alias for price_per_extra_edit */
  price_per_extra_credit?: number;
  features: string[];
  sort_order: number;
  is_active: boolean;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  paypal_subscription_id: string | null;
  paypal_plan_id: string | null;
  edits_used: number;
  edits_remaining: number;
  /** @deprecated pre-rename alias for edits_used */
  credits_used?: number;
  /** @deprecated pre-rename alias for edits_remaining */
  credits_remaining?: number;
  edits_reserved: number;
  storage_used_mb: number;
  cancel_at_period_end: boolean;
  plan?: SubscriptionPlan;
}

export function useSubscription() {
  const { effectiveUserId, isAuthLoading: authLoading, isImpersonating } = useEffectiveUser();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading: subscriptionLoading, refetch } = useQuery({
    queryKey: ["user-subscription", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;

      // Disambiguate the foreign key — user_subscriptions has TWO FKs to
      // subscription_plans (plan_id and scheduled_plan_id) so PostgREST
      // refuses the implicit embed with PGRST201.
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select(`
          *,
          plan:subscription_plans!plan_id(*)
        `)
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching subscription:", error);
        return null;
      }
      const sub = data as unknown as UserSubscription | null;
      if (sub?.plan) {
        const p = sub.plan as any;
        // DB column was renamed credits_per_month → edits_included.
        // Expose both names so legacy readers keep working.
        if (p.edits_included === undefined) p.edits_included = p.credits_per_month;
        if (p.credits_per_month === undefined) p.credits_per_month = p.edits_included;
      }
      return sub;
    },
    enabled: !!effectiveUserId && !authLoading,
  });

  // Realtime listener for live plan updates
  useEffect(() => {
    if (!effectiveUserId) return;
    const channel = supabase
      .channel(`sub-realtime-${effectiveUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_subscriptions", filter: `user_id=eq.${effectiveUserId}` },
        () => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["user-addons", effectiveUserId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_addons", filter: `user_id=eq.${effectiveUserId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-addons", effectiveUserId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [effectiveUserId, refetch, queryClient]);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      // Only PUBLISHED plan versions are offered to new subscribers; a user's
      // own (possibly unpublished legacy) plan still resolves via plan_id on
      // their subscription row, never through this list.
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .eq("is_published" as never, true as never)
        .order("sort_order");

      if (error) {
        console.error("Error fetching plans:", error);
        return [];
      }

      return (data as unknown as any[]).map((p: any) => ({
        ...p,
        edits_included: p.edits_included ?? p.credits_per_month,
        credits_per_month: p.credits_per_month ?? p.edits_included,
      })) as SubscriptionPlan[];
    },
  });

  // Fetch active addons
  const { data: activeAddons = [] } = useQuery({
    queryKey: ["user-addons", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("user_addons")
        .select("id, addon_type, quantity, status, created_at")
        .eq("user_id", effectiveUserId)
        .eq("status", "active");
      if (error) {
        console.error("Error fetching addons:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!effectiveUserId && !authLoading,
  });

  const extraModels = activeAddons
    .filter((a: any) => a.addon_type === "extra_model")
    .reduce((sum: number, a: any) => sum + (a.quantity || 1), 0);
  const extraStorageGb = activeAddons
    .filter((a: any) => a.addon_type === "extra_storage")
    .reduce((sum: number, a: any) => sum + (a.quantity || 1) * 500, 0);

  const { data: creditGrants = [] } = useQuery({
    queryKey: ["user-credit-grants", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("credit_grants")
        .select("id, grant_type, credits_initial, credits_remaining, status, reason, expires_at, created_at")
        .eq("user_id", effectiveUserId)
        .order("expires_at", { ascending: true });
      if (error) {
        console.error("Error fetching credit grants:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!effectiveUserId && !authLoading,
  });

  const currentPlan = subscription?.plan || plans?.find(p => p.slug === "free");
  const isLoading = authLoading || subscriptionLoading || plansLoading;

  // Admins get unlimited everything
  if (isAdmin && !isImpersonating) {
    return {
      subscription,
      currentPlan,
      plans: plans || [],
      isLoading,
      refetch,
      editsUsed: 0,
      editsRemaining: -1,
      editsTotal: -1,
      editsReserved: 0,
      availableEdits: -1,
      creditGrants: [],
      giftCreditsTotal: 0,
      planCreditsRemaining: -1,
      isUnlimited: true,
      hasAiCulling: true,
      hasTeamAccess: true,
      hasApiAccess: true,
      hasPrioritySupport: true,
      hasFullStyleLibrary: true,
      customModelsLimit: 999999,
      maxStyles: 999999,
      maxStorageGb: 999999,
      extraModels: 0,
      extraStorageGb: 0,
      activeAddons: [],
      storageUsedMb: subscription?.storage_used_mb || 0,
      isFreePlan: false,
      isPaidPlan: true,
      isPro: true,
      canUpload: true,
      canEdit: true,
      isCancelling: false,
      isSuspended: false,
      isExpired: false,
    };
  }

  // Derive every edit counter from the raw rows. The helper accepts both
  // pre and post-rename column names so a stale Supabase types regen
  // (or a legacy DB) won't make the UI fall back to plan max again.
  const {
    editsUsed,
    editsRemaining,
    editsTotal,
    editsReserved,
    isUnlimited,
    availableEdits,
    giftCreditsTotal,
    planCreditsRemaining,
  } = deriveEditCounters(subscription as any, currentPlan as any, creditGrants as any);
  // Free = zero-price plan (covers legacy unpublished versions like
  // free-v1, whose slug is no longer exactly "free").
  const isFreePlan = currentPlan ? Number(currentPlan.price_monthly) === 0 : false;
  const isPaidPlan = !isFreePlan;
  const isCancelling = subscription?.cancel_at_period_end === true;
  const isSuspended = subscription?.status === "suspended";
  const isExpired = subscription?.status === "expired";
  const canUpload = isUnlimited || availableEdits > 0;
  const canEdit = canUpload && !isSuspended && !isExpired;

  return {
    subscription,
    currentPlan,
    plans: plans || [],
    isLoading,
    refetch,
    editsUsed,
    editsRemaining,
    editsTotal,
    editsReserved,
    availableEdits,
    creditGrants,
    // Extra-style-slot gifts (admin "grant models") — surfaced so the gift
    // celebration can congratulate on them too.
    modelGrants: activeAddons.filter((a: any) => a.addon_type === "extra_model"),
    giftCreditsTotal,
    planCreditsRemaining,
    isUnlimited,
    hasAiCulling: currentPlan?.has_ai_culling || false,
    hasTeamAccess: currentPlan?.has_team_access || false,
    hasApiAccess: currentPlan?.has_api_access || false,
    hasPrioritySupport: currentPlan?.has_priority_support || false,
    hasFullStyleLibrary: (currentPlan as any)?.has_full_style_library || false,
    customModelsLimit: (currentPlan?.max_styles || 0) + extraModels,
    maxStyles: (currentPlan?.max_styles || 0) + extraModels,
    maxStorageGb: (currentPlan?.max_storage_gb || 5) + extraStorageGb,
    extraModels,
    extraStorageGb,
    activeAddons,
    storageUsedMb: subscription?.storage_used_mb || 0,
    isFreePlan,
    isPaidPlan,
    isPro: currentPlan?.slug === "pro" || currentPlan?.slug === "studio",
    canUpload,
    canEdit,
    isCancelling,
    isSuspended,
    isExpired,
  };
}
