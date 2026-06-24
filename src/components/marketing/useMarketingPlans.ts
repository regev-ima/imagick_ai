import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, PLAN_META, type Plan } from "./data";

/**
 * Live pricing, pulled from the platform's subscription_plans table (the single
 * source of truth — managed in Admin → Plans). Price & features come from the
 * DB; the marketing-only copy (blurb, CTA, "Most popular" badge) is merged in
 * from PLAN_META by slug.
 *
 * Falls back to the bundled PLANS when the data isn't available yet (SSR /
 * prerender, network error, or an empty table), so the site never shows empty
 * pricing and the prerendered HTML stays correct for SEO.
 */
export function useMarketingPlans(): Plan[] {
  const { data } = useQuery({
    queryKey: ["marketing-plans"],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Plan[] | null> => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("slug, name, price_monthly, price_yearly, features, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error || !data || data.length === 0) return null;

      return data.map((row): Plan => {
        const meta = PLAN_META[row.slug] as
          | Pick<Plan, "blurb" | "cta" | "highlight" | "badge" | "features">
          | undefined;
        const dbFeatures = Array.isArray(row.features)
          ? (row.features as unknown[]).filter((f): f is string => typeof f === "string")
          : [];
        return {
          slug: row.slug,
          name: row.name,
          blurb: meta?.blurb ?? "",
          monthly: Number(row.price_monthly) || 0,
          yearly: Number(row.price_yearly) || 0,
          highlight: meta?.highlight,
          badge: meta?.badge,
          cta: meta?.cta ?? "Get started",
          features: dbFeatures.length ? dbFeatures : meta?.features ?? [],
        };
      });
    },
  });

  return data ?? PLANS;
}
