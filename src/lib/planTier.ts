/**
 * Plan-version slugs append "-vN" to the tier ("pro-v1" is a legacy version
 * of the "pro" tier). Anywhere the code asks "which TIER is this user on"
 * (feature gates, add-on pricing, dashboards) must compare tiers, not raw
 * slugs — otherwise grandfathered subscribers fall through every check.
 */
export function tierOf(slug: string | null | undefined): string {
  return String(slug ?? "").replace(/-v\d+$/, "");
}
