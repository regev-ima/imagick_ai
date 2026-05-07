import { useEffect, useRef } from "react";
import type Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";

import "@uppy/core/css/style.css";
import "@uppy/dashboard/css/style.css";

interface UppyUploadAreaProps {
  uppy: Uppy<any, any>;
  /** Maximum number of files allowed (plan limit). 0 / undefined = no cap. */
  maxFiles?: number;
  /** Disable the area while uploads are in flight. */
  disabled?: boolean;
  /** Optional CSS height. Defaults to a reasonable size. */
  height?: number | string;
}

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
  height = 320,
}: UppyUploadAreaProps) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    uppy.use(Dashboard, {
      id: "Dashboard",
      target,
      inline: true,
      height,
      proudlyDisplayPoweredByUppy: false,
      hideUploadButton: true,
      showProgressDetails: true,
      showRemoveButtonAfterComplete: false,
      thumbnailWidth: 200,
      note: "JPG, PNG, RAW (CR2, ARW, NEF, DNG…)",
    });

    return () => {
      const plugin = uppy.getPlugin("Dashboard");
      if (plugin) uppy.removePlugin(plugin);
    };
  }, [uppy, height]);

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

  // The Dashboard exposes a `disabled` prop via setOptions, but we
  // mainly need to block interaction during upload. CSS pointer-events
  // is the simplest path that doesn't fight the plugin lifecycle.
  return (
    <div
      ref={targetRef}
      style={
        disabled
          ? { pointerEvents: "none", opacity: 0.6 }
          : undefined
      }
    />
  );
}
