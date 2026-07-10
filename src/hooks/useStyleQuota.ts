import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "./useSubscription";
import { useEffectiveUser } from "./useImpersonation";

/**
 * Custom AI Model quota — the client-side mirror of the DB trigger
 * `enforce_style_quota`. A "slot" is a top-level custom model the user owns
 * (is_preset = false, no father_style_id, active, not deleted). Retrains are
 * versions of an existing model and never consume a slot.
 *
 * `limit` already folds in extra_model add-ons (useSubscription.maxStyles).
 * A negative limit, or the admin sentinel (999999), means unlimited.
 */
export function useStyleQuota() {
  const { maxStyles, isLoading: subLoading } = useSubscription();
  const { effectiveUserId } = useEffectiveUser();

  const {
    data: used = 0,
    isLoading: countLoading,
    refetch,
  } = useQuery({
    queryKey: ["custom-model-count", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return 0;
      const { count, error } = await supabase
        .from("styles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", effectiveUserId)
        .eq("is_preset", false)
        .is("father_style_id", null)
        .eq("is_active", true)
        .neq("status", "deleted");
      if (error) {
        console.error("Error counting custom models:", error);
        return 0;
      }
      return count ?? 0;
    },
    enabled: !!effectiveUserId,
  });

  const limit = maxStyles;
  const isUnlimited = limit < 0 || limit >= 999999;
  const canCreate = isUnlimited || used < limit;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
    isUnlimited,
    canCreate,
    isLoading: subLoading || countLoading,
    refetch,
  };
}
