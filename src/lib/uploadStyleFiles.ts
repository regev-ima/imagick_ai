import { supabase } from "@/integrations/supabase/client";

export interface LocalFileLike {
  id: string;
  file: File;
}

export type UploadStyleFileEvent =
  | { type: "active"; fileId: string }
  | { type: "done"; fileId: string }
  | { type: "failed"; fileId: string };

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
): Promise<string[]> {
  const files = localFiles.map((f) => f.file);
  const fileIds = localFiles.map((f) => f.id);
  const prefix = `styles/${userId}/${styleId}/${subDir}/`;
  const fileNames = files.map((f) => f.name.replace(/[/\\]/g, "_").replace(/\s+/g, "_"));

  const { data, error } = await supabase.functions.invoke("image-upload", {
    body: { bucket: "imagick", prefix, names: fileNames },
  });

  if (error || !data?.urls) {
    throw new Error("Failed to get upload URLs");
  }

  const urls = data.urls?.signedUrls || data.urls;
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error("Invalid signed URLs");
  }

  const B2_PROXY_URL = "https://cloudflare-b2-proxy.rx8rq49b5c.workers.dev";
  // Lower concurrency (was 6) — huge RAW batches on slow uplinks were saturating
  // the connection and the B2 proxy, surfacing as "Load failed". Fewer parallel
  // PUTs each get more bandwidth and are far likelier to complete.
  const CONCURRENCY = 3;
  // More attempts with exponential backoff so a transient proxy/network blip on
  // one file doesn't fail the whole (thousands-of-files) training upload.
  const MAX_RETRIES = 5;
  // Per-PUT ceiling — a 50 MB RAW forwarded through the Worker to B2 can take
  // minutes on a slow line, but a stuck socket must eventually abort + retry
  // instead of hanging a worker slot forever.
  const PER_FILE_TIMEOUT_MS = 5 * 60 * 1000;

  const backoff = (attempt: number) => Math.min(30_000, 1000 * 2 ** attempt);

  // Returns the uploaded url, or null if the file failed every attempt. A few
  // failures out of thousands must NOT nuke the whole training upload, so we
  // skip the stragglers rather than throwing (training pairs by filename stem
  // downstream, so partial before/after sets still line up).
  const uploadOne = async (file: File, signedUrl: string, fileId: string): Promise<string | null> => {
    onProgress?.({ type: "active", fileId });

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_FILE_TIMEOUT_MS);
      try {
        // Stream the File directly (Blob body) rather than reading the whole
        // file into an ArrayBuffer first — with many concurrent uploads of
        // large RAW/JPEGs, buffering every file into JS memory was a big source
        // of memory pressure, and it delayed the first PUT. fetch sets
        // Content-Length from the Blob and a File is re-readable across retries.
        const response = await fetch(B2_PROXY_URL, {
          method: "PUT",
          headers: {
            signedurl: signedUrl,
            "Content-Type": file.type || "image/jpeg",
          },
          body: file,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (response.ok) {
          onProgress?.({ type: "done", fileId });
          return signedUrl.split("?")[0];
        }
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, backoff(attempt)));
          continue;
        }
        onProgress?.({ type: "failed", fileId });
        return null;
      } catch (err) {
        clearTimeout(timer);
        if (attempt >= MAX_RETRIES - 1) {
          console.error(`uploadStyleFiles: giving up on ${file.name}`, err);
          onProgress?.({ type: "failed", fileId });
          return null;
        }
        await new Promise((r) => setTimeout(r, backoff(attempt)));
      }
    }
    onProgress?.({ type: "failed", fileId });
    return null;
  };

  const results: (string | null)[] = new Array(files.length).fill(null);
  let idx = 0;

  const worker = async () => {
    while (idx < files.length) {
      const i = idx++;
      results[i] = await uploadOne(files[i], urls[i], fileIds[i]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()));

  const uploaded = results.filter((u): u is string => !!u);
  // Only hard-fail when NOTHING made it — otherwise proceed with whatever
  // uploaded so a handful of stragglers don't cost the user the whole run.
  if (files.length > 0 && uploaded.length === 0) {
    throw new Error("All uploads failed — check your connection and try again.");
  }
  if (uploaded.length < files.length) {
    console.warn(`uploadStyleFiles: ${files.length - uploaded.length}/${files.length} file(s) failed to upload for style ${styleId}/${subDir}`);
  }
  return uploaded;
}
