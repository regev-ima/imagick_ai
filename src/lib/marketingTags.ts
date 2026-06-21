import { supabase } from "@/integrations/supabase/client";

/**
 * Admin-managed marketing / tracking tag configuration.
 * Stored as a single JSON row in public.public_site_settings (key =
 * "marketing_tags"), which is public-readable so the marketing site can
 * load the configured tags. Edited only by admins via the Tracking & Tags
 * admin page.
 */
export type MarketingTags = {
  /** Master switch — when false, no analytics/pixels are injected. */
  enabled: boolean;
  // Analytics & tag management
  gtmId?: string; // GTM-XXXXXXX
  ga4Id?: string; // G-XXXXXXXXXX
  clarityId?: string; // Microsoft Clarity project id
  // Advertising pixels (prep for paid campaigns)
  metaPixelId?: string; // Facebook / Meta Pixel
  googleAdsId?: string; // AW-XXXXXXXXX
  tiktokPixelId?: string;
  linkedinPartnerId?: string;
  pinterestTagId?: string;
  // Search-engine ownership verification (always applied when set)
  googleSiteVerification?: string;
  bingSiteVerification?: string;
  // Escape hatch for anything else (trusted, admin-authored)
  customHeadHtml?: string;
  customBodyHtml?: string;
};

export const MARKETING_TAGS_KEY = "marketing_tags";
export const MARKETING_TAGS_QUERY_KEY = ["public-site-settings", MARKETING_TAGS_KEY] as const;

export const defaultMarketingTags: MarketingTags = { enabled: false };

/**
 * Public read of the marketing tags. Resilient by design: if the table
 * doesn't exist yet (migration not deployed), RLS blocks, or the network
 * is down, it resolves to the safe disabled default instead of throwing.
 */
export async function fetchMarketingTags(): Promise<MarketingTags> {
  try {
    const { data, error } = await supabase
      .from("public_site_settings")
      .select("value")
      .eq("key", MARKETING_TAGS_KEY)
      .maybeSingle();
    if (error) return defaultMarketingTags;
    const value = (data?.value ?? {}) as Partial<MarketingTags>;
    return { ...defaultMarketingTags, ...value };
  } catch {
    return defaultMarketingTags;
  }
}

/** Tag fields that count as "active" for status display. */
export function activeTagLabels(t: MarketingTags): string[] {
  const labels: string[] = [];
  if (t.gtmId) labels.push("Google Tag Manager");
  if (t.ga4Id) labels.push("GA4");
  if (t.clarityId) labels.push("Clarity");
  if (t.metaPixelId) labels.push("Meta Pixel");
  if (t.googleAdsId) labels.push("Google Ads");
  if (t.tiktokPixelId) labels.push("TikTok Pixel");
  if (t.linkedinPartnerId) labels.push("LinkedIn");
  if (t.pinterestTagId) labels.push("Pinterest");
  return labels;
}
