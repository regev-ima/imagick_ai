// Shared application constants

/** Gallery used as image source for all AI Style Before/After previews */
export const SHOWCASE_GALLERY_ID = "0bdc4555-c5f1-4c93-bf4c-a66d8efd2eef";

/** Threshold below which we show the "running low on edits" warning to free users. */
export const EDIT_LOW_THRESHOLD = 500;

/**
 * ZIP download endpoint (streaming archive builder). Migrated off Fly
 * (downloadfiles.fly.dev) to the Cloudflare jobs Worker. The endpoint returns
 * a real streamed ReadableStream ZIP, so the browser must be handed the URL
 * directly (native form POST / download) — never buffered via blob()/
 * arrayBuffer(), which would defeat the streaming and hold the whole archive
 * in RAM. Overridable via VITE_ZIP_DOWNLOAD_URL.
 */
export const ZIP_DOWNLOAD_URL =
  (import.meta.env.VITE_ZIP_DOWNLOAD_URL as string | undefined) ||
  "https://imagick-jobs-api.rx8rq49b5c.workers.dev/download";
