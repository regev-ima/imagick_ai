import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { useEffectiveUser } from "./useImpersonation";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  credits_per_month: number;
  max_styles: number;
  max_storage_gb: number;
  has_ai_culling: boolean;
  has_team_access: boolean;
  has_api_access: boolean;
  has_priority_support: boolean;
  has_full_style_library: boolean;
  price_per_extra_credit: number;
  /** @deprecated alias for credits_per_month */
  edits_included: number;
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
  credits_used: number;
  credits_remaining: number;
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

      const { data, error } = await supabase
        .from("user_subscriptions")
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching subscription:", error);
        return null;
      }
      const sub = data as unknown as UserSubscription | null;
      if (sub?.plan) {
        (sub.plan as any).edits_included = (sub.plan as any).credits_per_month;
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
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (error) {
        console.error("Error fetching plans:", error);
        return [];
      }

      return (data as unknown as any[]).map((p: any) => ({
        ...p,
        edits_included: p.credits_per_month,
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

  const editsUsed = subscription?.credits_used || 0;
  const editsRemaining = subscription?.credits_remaining ?? currentPlan?.credits_per_month ?? 3000;
  const editsTotal = currentPlan?.credits_per_month ?? 3000;
  const editsReserved = subscription?.edits_reserved || 0;
  const isUnlimited = editsRemaining === -1;
  const availableEdits = isUnlimited ? -1 : Math.max(0, editsRemaining - editsReserved);
  const giftCreditsTotal = creditGrants
    .filter((g: any) => g.status === "active")
    .reduce((sum: number, g: any) => sum + (g.credits_remaining || 0), 0);
  const planCreditsRemaining = isUnlimited ? -1 : Math.max(0, editsRemaining - giftCreditsTotal);
  const isFreePlan = currentPlan?.slug === "free";
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
