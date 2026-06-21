// ════════════════════════════════════════════════════════════════════
// Two-domain separation:
//   imagick.ai      → the public marketing site
//   app.imagick.ai  → the application (dashboard, auth, galleries…)
//
// One codebase / one deployment, separated by host. Cross-domain links use
// `appHref`; the <DomainGuard> redirects mis-hosted paths. On any other host
// (localhost, *.vercel.app previews) we stay in "combined" mode so everything
// is reachable for development and preview.
// ════════════════════════════════════════════════════════════════════

export const APP_ORIGIN = "https://app.imagick.ai";
export const MARKETING_ORIGIN = "https://imagick.ai";

export const APP_HOSTS = ["app.imagick.ai"];
export const MARKETING_HOSTS = ["imagick.ai", "www.imagick.ai"];

export type SiteMode = "app" | "marketing" | "combined";

export function getSiteMode(): SiteMode {
  if (typeof window === "undefined") return "combined"; // SSR / prerender
  const host = window.location.hostname;
  if (APP_HOSTS.includes(host)) return "app";
  if (MARKETING_HOSTS.includes(host)) return "marketing";
  return "combined";
}

export const isAppHost = () => getSiteMode() === "app";
export const isMarketingHost = () => getSiteMode() === "marketing";

/** A path that belongs to the application (rendered on app.imagick.ai). */
export function isAppPath(pathname: string): boolean {
  return (
    pathname === "/auth" ||
    pathname.startsWith("/dashboard") ||
    pathname === "/reset-password" ||
    pathname === "/unsubscribe" ||
    pathname.startsWith("/gallery") ||
    pathname.startsWith("/g/")
  );
}

/** A path that belongs to the marketing site (rendered on imagick.ai). */
export function isMarketingPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/for/")
  );
}

/**
 * Resolve a link to the application. On the marketing host this returns an
 * absolute URL on app.imagick.ai (a real cross-origin navigation); everywhere
 * else it stays relative so dev/preview work as a single app.
 */
export function appHref(path: string): string {
  return isMarketingHost() ? `${APP_ORIGIN}${path}` : path;
}

/** Resolve a link to the marketing site (mirror of appHref). */
export function marketingHref(path: string): string {
  return isAppHost() ? `${MARKETING_ORIGIN}${path}` : path;
}
