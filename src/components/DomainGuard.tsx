import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  getSiteMode,
  isAppPath,
  isMarketingPath,
  APP_ORIGIN,
  MARKETING_ORIGIN,
} from "@/lib/domains";

/**
 * Keeps each domain to its own content:
 *   - app.imagick.ai never serves marketing pages
 *   - imagick.ai never serves the application
 *
 * Vercel host redirects (vercel.json) handle this at the edge with no flash;
 * this is the client-side safety net (and covers in-SPA navigations). On any
 * other host (localhost, previews) it does nothing, so dev/preview stay whole.
 */
export function DomainGuard() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    const mode = getSiteMode();
    if (mode === "combined") return;

    if (mode === "app" && isMarketingPath(pathname)) {
      if (pathname === "/") window.location.replace("/dashboard");
      else window.location.replace(`${MARKETING_ORIGIN}${pathname}${search}${hash}`);
    } else if (mode === "marketing" && isAppPath(pathname)) {
      window.location.replace(`${APP_ORIGIN}${pathname}${search}${hash}`);
    }
  }, [pathname, search, hash]);

  return null;
}
