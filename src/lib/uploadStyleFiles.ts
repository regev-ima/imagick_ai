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
  const CONCURRENCY = 6;
  const MAX_RETRIES = 3;

  const uploadOne = async (file: File, signedUrl: string, fileId: string): Promise<string> => {
    onProgress?.({ type: "active", fileId });

    const buffer = await file.arrayBuffer();
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(B2_PROXY_URL, {
          method: "PUT",
          headers: {
            signedurl: signedUrl,
            "Content-Type": file.type || "image/jpeg",
          },
          body: buffer,
        });
        if (response.ok) {
          onProgress?.({ type: "done", fileId });
          return signedUrl.split("?")[0];
        }
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw new Error(`Failed to upload ${file.name}`);
      } catch (err) {
        if (attempt >= MAX_RETRIES - 1) {
          onProgress?.({ type: "failed", fileId });
          throw err;
        }
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw new Error(`Failed to upload ${file.name}`);
  };

  const results: string[] = new Array(files.length);
  let idx = 0;

  const worker = async () => {
    while (idx < files.length) {
      const i = idx++;
      results[i] = await uploadOne(files[i], urls[i], fileIds[i]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()));
  return results;
}
