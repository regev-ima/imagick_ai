import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CreditPricing {
  /** Credits per photo × style AI edit. */
  ai_edit: number;
  /** Credits per photo for AI culling (rating + tags + grouping). */
  ai_culling: number;
  /** Credits per photo for face recognition. */
  face_recognition: number;
  /** Credits per custom-model training run. */
  style_training: number;
}

export const DEFAULT_CREDIT_PRICING: CreditPricing = {
  ai_edit: 1,
  ai_culling: 0.2,
  face_recognition: 0.1,
  style_training: 1000,
};

/**
 * The platform "menu prices" — how many credits each AI action costs.
 * Admin-tunable via platform_settings.credit_pricing; these are global
 * (unlike plan prices, which are frozen per plan version). Falls back to
 * the shipped defaults while loading or if the key is missing, so cost
 * estimates never render as zero.
 */
export function useCreditPricing(): CreditPricing {
  const { data } = useQuery({
    queryKey: ["credit-pricing"],
    queryFn: async (): Promise<CreditPricing> => {
      const { data: row } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "credit_pricing")
        .single();
      if (!row?.value) return DEFAULT_CREDIT_PRICING;
      try {
        const parsed = JSON.parse(row.value);
        return {
          ai_edit: Number.isFinite(parsed.ai_edit) ? parsed.ai_edit : DEFAULT_CREDIT_PRICING.ai_edit,
          ai_culling: Number.isFinite(parsed.ai_culling) ? parsed.ai_culling : DEFAULT_CREDIT_PRICING.ai_culling,
          face_recognition: Number.isFinite(parsed.face_recognition)
            ? parsed.face_recognition
            : DEFAULT_CREDIT_PRICING.face_recognition,
          style_training: Number.isFinite(parsed.style_training)
            ? parsed.style_training
            : DEFAULT_CREDIT_PRICING.style_training,
        };
      } catch {
        return DEFAULT_CREDIT_PRICING;
      }
    },
    staleTime: 5 * 60_000,
  });
  return data ?? DEFAULT_CREDIT_PRICING;
}

/** Total credit cost of a gallery run under the given pricing. */
export function estimateGalleryCredits(
  pricing: CreditPricing,
  photos: number,
  looks: number,
  culling: boolean,
  faces: boolean,
): number {
  if (photos <= 0) return 0;
  let cost = photos * looks * pricing.ai_edit;
  if (culling) cost += photos * pricing.ai_culling;
  if (faces) cost += photos * pricing.face_recognition;
  return Math.ceil(cost);
}
