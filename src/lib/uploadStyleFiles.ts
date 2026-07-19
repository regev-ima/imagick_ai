import { supabase } from "@/integrations/supabase/client";
import { Sentry } from "@/lib/sentry";
import {
  createAdaptiveUploadController,
  type AdaptiveUploadController,
} from "@/lib/adaptiveConcurrency";

export interface LocalFileLike {
  id: string;
  file: File;
}

export type UploadStyleFileEvent =
  | { type: "active"; fileId: string }
  | { type: "done"; fileId: string }
  | { type: "failed"; fileId: string };

export { createAdaptiveUploadController };
export type { AdaptiveUploadController };

/**
 * Upload local files to B2 for a style's before/after set. Training pairs
 * before/after by ORIGINAL filename (stem) — same as the Google Drive path
 * (use_uuid4:false for styles) — so filenames are NEVER UUID-renamed here,
 * only neutralized (path separators / whitespace), applied identically to
 * before and after so a RAW "IMG_1234.CR2" still pairs with the edited
 * "IMG_1234.jpg".
 *
 * Returns the base (unsigned) urls in the same order as `localFiles`.
 */
export async function uploadStyleFiles(
  localFiles: LocalFileLike[],
  userId: string,
  styleId: string,
  subDir: "before" | "after",
  onProgress?: (event: UploadStyleFileEvent) => void,
  /**
   * Optional shared adaptive controller. Pass ONE instance to both the before
   * and after calls so the warm-up/back-off reacts to the whole connection's
   * health, not each side in isolation. Omitted → a private controller is used.
   */
  controller?: AdaptiveUploadController,
): Promise<string[]> {
  const files = localFiles.map((f) => f.file);
  const fileIds = localFiles.map((f) => f.id);
  const prefix = `styles/${userId}/${styleId}/${subDir}/`;
  const fileNames = files.map((f) => f.name.replace(/[/\\]/g, "_").replace(/\s+/g, "_"));

  const backoff = (attempt: number) => Math.min(30_000, 1000 * 2 ** attempt);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // === Mint signed URLs — WITH RETRY ===
  // This is one call per side that signs ALL names at once, and it used to have
  // NO retry: a single timeout / cold start / blip failed the entire side (the
  // most likely "a whole side failed" cause). 3 attempts with backoff so a
  // transient hiccup no longer sinks the run.
  const SIGN_URL_RETRIES = 3;
  let urls: string[] | null = null;
  let lastSignError: unknown = null;
  for (let attempt = 0; attempt < SIGN_URL_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke("image-upload", {
        body: { bucket: "imagick", prefix, names: fileNames },
      });
      if (error || !data?.urls) {
        lastSignError = error || new Error("No urls in response");
      } else {
        const signed = data.urls?.signedUrls || data.urls;
        if (Array.isArray(signed) && signed.length > 0) {
          urls = signed;
          break;
        }
        lastSignError = new Error("Invalid signed URLs");
      }
    } catch (err) {
      lastSignError = err;
    }
    if (attempt < SIGN_URL_RETRIES - 1) await sleep(backoff(attempt));
  }
  if (!urls) {
    console.error(`uploadStyleFiles: sign-urls failed for ${styleId}/${subDir}`, lastSignError);
    // Telemetry — this is the "whole side failed before any upload" case. Keep
    // a trail so the next incident is diagnosable instead of a silent failure.
    Sentry.captureException(
      lastSignError instanceof Error ? lastSignError : new Error("style-upload sign-urls failed"),
      {
        tags: { area: "style-upload", stage: "sign-urls", side: subDir },
        extra: { styleId, side: subDir, fileCount: files.length, attempts: SIGN_URL_RETRIES },
      },
    );
    throw new Error("Failed to get upload URLs");
  }

  const B2_PROXY_URL = "https://cloudflare-b2-proxy.rx8rq49b5c.workers.dev";
  // Parallelism is now ADAPTIVE (see adaptiveConcurrency.ts) — it starts gentle
  // and warms up only while the connection stays clean, backing off the moment
  // failures appear. Falls back to a private controller when none is shared.
  const conc = controller ?? createAdaptiveUploadController();
  // More attempts with exponential backoff so a transient proxy/network blip on
  // one file doesn't fail the whole (thousands-of-files) training upload.
  const MAX_RETRIES = 5;
  // Per-PUT ceiling — a 50 MB RAW forwarded through the Worker to B2 can take
  // minutes on a slow line, but a stuck socket must eventually abort + retry
  // instead of hanging a slot forever.
  const PER_FILE_TIMEOUT_MS = 5 * 60 * 1000;

  // Telemetry counters — surfaced to Sentry once the side finishes so a bad
  // run leaves a diagnosable trail (how many attempts failed, what the errors
  // were, where the adaptive ceiling settled).
  let attemptFailures = 0;
  const sampleErrors: string[] = [];
  const noteError = (reason: string) => {
    attemptFailures += 1;
    if (sampleErrors.length < 5 && !sampleErrors.includes(reason)) sampleErrors.push(reason);
  };

  // Returns the uploaded url, or null if the file failed every attempt. A few
  // failures out of thousands must NOT nuke the whole training upload, so we
  // skip the stragglers rather than throwing (training pairs by filename stem
  // downstream, so partial before/after sets still line up).
  const uploadOne = async (file: File, signedUrl: string, fileId: string): Promise<string | null> => {
    // Wait for an adaptive slot BEFORE marking the file active, so "active"
    // reflects files that are truly in-flight, not queued. The side is the
    // round-robin group, so before/after upload in parallel (1 each) instead
    // of one side grabbing every slot.
    await conc.acquire(subDir);
    onProgress?.({ type: "active", fileId });
    try {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), PER_FILE_TIMEOUT_MS);
        try {
          // Stream the File directly (Blob body) rather than reading the whole
          // file into an ArrayBuffer first — with many concurrent uploads of
          // large RAW/JPEGs, buffering every file into JS memory was a big
          // source of memory pressure, and it delayed the first PUT. fetch sets
          // Content-Length from the Blob and a File is re-readable across retries.
          const response = await fetch(B2_PROXY_URL, {
            method: "PUT",
            headers: {
              signedurl: signedUrl,
              "Content-Type": file.type || "image/jpeg",
            },
            body: file,
            signal: ac.signal,
          });
          clearTimeout(timer);
          if (response.ok) {
            conc.reportSuccess(attempt === 0);
            conc.recordBytes(file.size);
            onProgress?.({ type: "done", fileId });
            return signedUrl.split("?")[0];
          }
          conc.reportCongestion();
          noteError(`http_${response.status}`);
          if (attempt < MAX_RETRIES - 1) {
            await sleep(backoff(attempt));
            continue;
          }
          onProgress?.({ type: "failed", fileId });
          return null;
        } catch (err) {
          clearTimeout(timer);
          conc.reportCongestion();
          noteError(err instanceof DOMException && err.name === "AbortError" ? "timeout" : (err instanceof Error ? err.name || err.message : "network"));
          if (attempt >= MAX_RETRIES - 1) {
            console.error(`uploadStyleFiles: giving up on ${file.name}`, err);
            onProgress?.({ type: "failed", fileId });
            return null;
          }
          await sleep(backoff(attempt));
        }
      }
      onProgress?.({ type: "failed", fileId });
      return null;
    } finally {
      conc.release(subDir);
    }
  };

  // Launch every file — each blocks on the adaptive controller's acquire(), so
  // only `target` run at once and the ceiling floats with the connection.
  const results = await Promise.all(
    files.map((file, i) => uploadOne(file, urls![i], fileIds[i])),
  );

  const uploaded = results.filter((u): u is string => !!u);
  const failedCount = files.length - uploaded.length;

  // === Telemetry ===
  // Shared context for whatever we report below.
  const stats = {
    styleId,
    side: subDir,
    total: files.length,
    uploaded: uploaded.length,
    failed: failedCount,
    attemptFailures,          // total failed PUT attempts (retries included)
    finalConcurrency: conc.current(),
    sampleErrors,             // e.g. ["http_502","timeout","network"]
  };

  // Only hard-fail when NOTHING made it — otherwise proceed with whatever
  // uploaded so a handful of stragglers don't cost the user the whole run.
  if (files.length > 0 && uploaded.length === 0) {
    Sentry.captureException(new Error("style-upload all-failed"), {
      tags: { area: "style-upload", stage: "all-failed", side: subDir },
      extra: stats,
    });
    throw new Error("All uploads failed — check your connection and try again.");
  }
  if (failedCount > 0) {
    console.warn(`uploadStyleFiles: ${failedCount}/${files.length} file(s) failed to upload for style ${styleId}/${subDir}`);
    // Partial loss — a warning, not an exception, so it doesn't page anyone but
    // is searchable if a style trains on fewer pairs than expected.
    Sentry.captureMessage(`style-upload partial: ${failedCount}/${files.length} failed (${subDir})`, {
      level: "warning",
      tags: { area: "style-upload", stage: "partial", side: subDir },
      extra: stats,
    });
  }
  return uploaded;
}
