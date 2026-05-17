import { useEffect, useMemo, useRef } from "react";
import type Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";

import "@uppy/core/css/style.css";
import "@uppy/dashboard/css/style.css";

import { useTheme } from "@/components/theme/ThemeProvider";

interface UppyUploadAreaProps {
  uppy: Uppy<any, any>;
  /** Maximum number of files allowed (plan limit). 0 / undefined = no cap. */
  maxFiles?: number;
  /** Disable the area while uploads are in flight. */
  disabled?: boolean;
}

// Dashboard height is responsive: small on phones, larger on desktop.
// Uppy renders the file grid inside a scroll container of this size.
// Kept compact so that when the area is embedded in a modal (Add Images
// flow) the surrounding chrome — selected-styles summary, source
// selector, edit-cost row, footer — still fits within an 85vh modal
// without forcing the user to scroll to reach the Upload button.
const DASHBOARD_HEIGHT_PX = "min(38vh, 320px)";

/**
 * Mount Uppy's Dashboard plugin into a div via the standalone
 * `@uppy/dashboard` package (since `@uppy/react` v5 dropped the
 * `<Dashboard>` React component).
 *
 * The Dashboard renders all of:
 *   - drag-and-drop zone
 *   - "browse files" picker
 *   - per-file thumbnails (lazy-loaded as the user scrolls — critical
 *     at 3000+ photos where ad-hoc URL.createObjectURL crashed the tab)
 *   - per-file progress bars
 *   - pause / resume / retry / cancel buttons
 *
 * We hide its built-in upload button — uploads are kicked off by the
 * outer page's "Create Gallery" / "Confirm" CTA.
 */
export function UppyUploadArea({
  uppy,
  maxFiles,
  disabled = false,
}: UppyUploadAreaProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Resolve "system" to a concrete light/dark for Uppy. The Dashboard
  // plugin accepts "light" | "dark" | "auto" — "auto" reads
  // prefers-color-scheme, which is wrong when the user manually picked
  // a non-system theme in our ThemeProvider.
  const resolvedTheme = useMemo<"light" | "dark">(() => {
    if (theme === "light") return "light";
    if (theme === "dark") return "dark";
    return typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }, [theme]);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    // Defensive: if a previous mount didn't tear the plugin down (the
    // user re-opened the modal in the same Uppy instance, React
    // StrictMode double-mounted us, etc.) `uppy.use()` would throw
    // "Already used a plugin named Dashboard" and the modal would
    // crash to the ErrorBoundary's "Something went wrong" screen.
    // Removing first makes the re-mount idempotent.
    const existing = uppy.getPlugin("Dashboard");
    if (existing) {
      try {
        uppy.removePlugin(existing);
      } catch {
        /* ignore — best effort cleanup */
      }
    }

    try {
      uppy.use(Dashboard, {
        id: "Dashboard",
        target,
        inline: true,
        // The Dashboard plugin accepts numeric or string heights. We use
        // a CSS string so it tracks the parent's responsive width via
        // its own internal layout.
        height: DASHBOARD_HEIGHT_PX,
        width: "100%",
        // Track the app's current theme so Dashboard text contrasts
        // correctly. Light mode renders Uppy's near-white text on a
        // light panel otherwise (file names and "Drop files here"
        // become unreadable).
        theme: resolvedTheme,
        proudlyDisplayPoweredByUppy: false,
        hideUploadButton: true,
        showProgressDetails: true,
        showRemoveButtonAfterComplete: false,
        thumbnailWidth: 160,
        note: "JPG, PNG, RAW (CR2, ARW, NEF, DNG…)",
      });
    } catch (err) {
      // Surface the failure but DON'T let it bubble to React's
      // ErrorBoundary — the surrounding modal is more useful broken
      // than gone.
      console.error("Uppy Dashboard mount failed:", err);
    }

    return () => {
      const plugin = uppy.getPlugin("Dashboard");
      if (plugin) {
        try {
          uppy.removePlugin(plugin);
        } catch {
          /* ignore — plugin may already be torn down */
        }
      }
    };
  }, [uppy, resolvedTheme]);

  // Update plan-based file limit when it changes (e.g. user picks more
  // styles, which lowers maxImages on a free plan).
  useEffect(() => {
    if (!maxFiles || maxFiles <= 0) return;
    try {
      uppy.setOptions({
        restrictions: {
          ...uppy.opts.restrictions,
          maxNumberOfFiles: maxFiles,
        },
      });
    } catch (err) {
      console.error("Failed to update Uppy maxNumberOfFiles:", err);
    }
  }, [uppy, maxFiles]);

  return (
    <div
      // CSS overrides to align Dashboard's dark theme with our pink
      // brand accent (--primary in tailwind config). These cascade into
      // the Dashboard's shadow DOM via Uppy's CSS variables.
      // Note: we deliberately do NOT dim the area while uploading.
      // Uppy disables its own controls during upload internally;
      // dimming the wrapper used to put a dark veil over the file
      // grid that blocked clicks (the user could not retry / remove
      // a failed file).
      className="imagick-uppy-dashboard w-full max-w-none"
      style={
        {
          "--uppy-c-primary": "#e85c9b",
          "--uppy-c-primary-light": "#ff7bbd",
          width: "100%",
        } as React.CSSProperties
      }
      ref={targetRef}
      aria-disabled={disabled || undefined}
    />
  );
}
