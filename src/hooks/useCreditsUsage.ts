import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "./useSubscription";
import { useEffectiveUser } from "./useImpersonation";

export interface EditsByGallery {
  gallery_id: string;
  gallery_name: string;
  edits: number;
}

export interface DailyUsage {
  date: string;
  edits: number;
}

export function useCreditsUsage() {
  const { effectiveUserId } = useEffectiveUser();
  const { editsUsed, editsTotal, editsRemaining, isUnlimited, subscription } = useSubscription();

  const periodStart = subscription?.current_period_start;
  const periodEnd = subscription?.current_period_end;

  const { data, isLoading } = useQuery({
    queryKey: ["edits-usage", effectiveUserId, periodStart],
    queryFn: async () => {
      if (!effectiveUserId) return null;

      let query = (supabase as any)
        .from("credit_usage_logs")
        .select("*")
        .eq("user_id", effectiveUserId)
        .eq("action_type", "ai_edit")
        .order("created_at", { ascending: true });

      if (periodStart) {
        query = query.gte("created_at", periodStart);
      }
      if (periodEnd) {
        query = query.lte("created_at", periodEnd);
      }

      const { data: logs, error } = await query;

      if (error) {
        console.error("Error fetching edit logs:", error);
        return { editsByGallery: [], dailyUsage: [], totalUsed: 0, hasMockData: false };
      }

      if (!logs || logs.length === 0) {
        return { editsByGallery: [], dailyUsage: [], totalUsed: 0, hasMockData: false };
      }

      const totalUsed = logs.reduce((s: number, l: any) => s + (l.credits_spent || 0), 0);

      // Aggregate by gallery
      const galleryMap: Record<string, { gallery_id: string; edits: number }> = {};
      for (const log of logs) {
        const gid = (log as any).gallery_id || "no-gallery";
        if (!galleryMap[gid]) {
          galleryMap[gid] = { gallery_id: gid, edits: 0 };
        }
        galleryMap[gid].edits += (log as any).credits_spent || 0;
      }

      // Fetch gallery names
      const galleryIds = Object.keys(galleryMap).filter((id) => id !== "no-gallery");
      const galleryNames: Record<string, string> = {};
      if (galleryIds.length > 0) {
        const { data: galleries } = await supabase
          .from("galleries")
          .select("id, name")
          .in("id", galleryIds);
        galleries?.forEach((g) => {
          galleryNames[g.id] = g.name;
        });
      }

      const editsByGallery: EditsByGallery[] = Object.values(galleryMap)
        .map((g) => ({
          ...g,
          gallery_name: g.gallery_id === "no-gallery" ? "Other" : galleryNames[g.gallery_id] || "Unknown",
        }))
        .sort((a, b) => b.edits - a.edits);

      // Daily usage
      const dailyMap: Record<string, number> = {};
      logs.forEach((log) => {
        const day = (log as any).created_at.substring(0, 10);
        dailyMap[day] = (dailyMap[day] || 0) + ((log as any).credits_spent || 0);
      });
      const dailyUsage: DailyUsage[] = Object.entries(dailyMap)
        .map(([date, edits]) => ({ date, edits }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        editsByGallery,
        dailyUsage,
        totalUsed,
        hasMockData: false,
      };
    },
    enabled: !!effectiveUserId,
  });

  return {
    data,
    isLoading,
    editsUsed,
    editsTotal,
    editsRemaining,
    isUnlimited,
    periodStart,
    periodEnd,
  };
}
