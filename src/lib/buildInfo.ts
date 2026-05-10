/**
 * Build-time identifiers injected by Vite (see `define` in vite.config.ts).
 *
 * These let the dashboard footer show "v abc1234 · May 10, 2026 09:12 UTC"
 * so the user can confirm at a glance which deploy is currently live —
 * useful when verifying that a fresh fix actually shipped.
 */

export const BUILD_SHA: string =
  typeof __APP_BUILD_SHA__ !== "undefined" ? __APP_BUILD_SHA__ : "dev";

export const BUILD_TIME_ISO: string =
  typeof __APP_BUILD_TIME__ !== "undefined"
    ? __APP_BUILD_TIME__
    : new Date().toISOString();

/**
 * Format the build timestamp in the user's locale, but keep it compact:
 * "May 10, 2026, 09:12" — no seconds, no timezone (we render UTC suffix
 * separately). Falls back to the raw ISO string if Date parsing fails.
 */
export function formatBuildTime(iso: string = BUILD_TIME_ISO): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const datePart = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart}, ${timePart}`;
}

/**
 * Compact form for the collapsed sidebar — just the time of day
 * ("09:12"). The full date is still revealed on hover via the badge's
 * tooltip, so the visible label can stay tiny.
 */
export function formatBuildTimeShort(iso: string = BUILD_TIME_ISO): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
