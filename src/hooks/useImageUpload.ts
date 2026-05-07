import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FileUploadProgress {
  fileName: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  status: "pending" | "uploading" | "complete" | "error" | "retrying";
  retryCount: number;
  error?: string;
}

interface UploadProgress {
  uploaded: number;
  total: number;
  currentFile: string;
  /** Aggregate bytes uploaded across all files. O(1) read — prefer this. */
  bytesUploaded: number;
  /** Sum of all file sizes. */
  totalBytes: number;
  /**
   * Per-file progress. Updated at most ~10 Hz via the throttled state
   * setter, so it's safe to render. Iterating still costs O(n) — for
   * aggregate UI prefer `bytesUploaded` / `totalBytes`.
   */
  fileProgress: Map<string, FileUploadProgress>;
}

interface UploadCallbacks {
  onFileStart?: (index: number, filename: string) => void;
  onFileProgress?: (index: number, filename: string, progress: FileUploadProgress) => void;
  onFileComplete?: (index: number, filename: string) => void;
  onFileError?: (index: number, filename: string, error: string) => void;
  onFileRetry?: (index: number, filename: string, retryCount: number) => void;
}

interface SignedUrlInfo {
  name: string;
  signedUrl: string;
  publicUrl: string;
}

const B2_PROXY_URL = "https://cloudflare-b2-proxy.rx8rq49b5c.workers.dev";
const MAX_RETRIES = 5;
const TIMEOUT_PER_MB_MS = 20 * 1000;
const MIN_TIMEOUT_MS = 30 * 1000;
const STALL_TIMEOUT_MS = 20 * 1000;
const STALL_CHECK_INTERVAL_MS = 5 * 1000;
// Concurrent uploads — Cloudflare Worker chokes well above this when
// hit with 100+ photos because each upload holds an open connection
// against per-Worker CPU/memory limits. 4 is a stable balance between
// throughput and tail latency.
const CONCURRENT_UPLOADS = 4;
// Aggregate UI state updates are throttled to ~10 Hz. Without this,
// 4 concurrent XHRs each emitting ~30 progress events/sec churned out
// 120 setState calls/sec, each cloning a 1000-entry Map — the actual
// cause of the browser crash on large galleries. 100ms cadence is
// imperceptible to humans but eliminates the thrashing.
const STATE_UPDATE_THROTTLE_MS = 100;
// Per-file onFileProgress callbacks are throttled to ~5 Hz per file
// because consumers typically do `setUploadedFiles(prev => prev.map(...))`
// inside them, an O(n) array map that becomes the bottleneck at n=3000.
const PER_FILE_CALLBACK_THROTTLE_MS = 200;
// Database inserts are buffered into batches of this size or flushed
// after a brief idle window. 1000 individual INSERTs hit the browser's
// per-host connection cap and queue for minutes; a few batched writes
// finish in seconds.
const INSERT_BATCH_SIZE = 100;
const INSERT_FLUSH_INTERVAL_MS = 50;

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Live per-file progress in a ref — mutated on every XHR progress
  // event without forcing a re-render. The throttled tick below
  // snapshots this into `uploadProgress` ~10× per second.
  const fileProgressMapRef = useRef<Map<string, FileUploadProgress>>(new Map());
  const bytesUploadedRef = useRef(0);
  const totalBytesRef = useRef(0);
  const completedCountRef = useRef(0);
  const totalCountRef = useRef(0);
  const currentFileRef = useRef("");
  const lastStateUpdateRef = useRef(0);
  const stateFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPerFileCallbackRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    return () => {
      if (stateFlushTimerRef.current) clearTimeout(stateFlushTimerRef.current);
    };
  }, []);

  /**
   * Snapshot the live refs into uploadProgress state. Throttled so we
   * call setState at most once per STATE_UPDATE_THROTTLE_MS.
   */
  const flushStateNow = () => {
    lastStateUpdateRef.current = Date.now();
    if (stateFlushTimerRef.current) {
      clearTimeout(stateFlushTimerRef.current);
      stateFlushTimerRef.current = null;
    }
    setUploadProgress({
      uploaded: completedCountRef.current,
      total: totalCountRef.current,
      currentFile: currentFileRef.current,
      bytesUploaded: bytesUploadedRef.current,
      totalBytes: totalBytesRef.current,
      // We DO clone the Map here, but only at the throttled cadence
      // (~10×/sec instead of 120×/sec) so the cost is bounded.
      fileProgress: new Map(fileProgressMapRef.current),
    });
  };

  const requestStateUpdate = () => {
    const now = Date.now();
    const elapsed = now - lastStateUpdateRef.current;
    if (elapsed >= STATE_UPDATE_THROTTLE_MS) {
      flushStateNow();
      return;
    }
    if (stateFlushTimerRef.current) return;
    stateFlushTimerRef.current = setTimeout(
      flushStateNow,
      STATE_UPDATE_THROTTLE_MS - elapsed,
    );
  };

  const calculateTimeout = (fileSize: number): number => {
    const fileSizeMB = fileSize / (1024 * 1024);
    return Math.max(MIN_TIMEOUT_MS, fileSizeMB * TIMEOUT_PER_MB_MS);
  };

  const getSignedUrls = async (
    bucket: string,
    prefix: string,
    fileNames: string[],
  ): Promise<SignedUrlInfo[] | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("image-upload", {
        body: { bucket, prefix, names: fileNames },
      });

      if (error) {
        console.error("Error getting signed URLs:", error);
        return null;
      }

      if (data?.error === "storage_limit_exceeded") {
        toast.error(
          data.message ||
            "Storage limit exceeded. Please upgrade your plan or purchase additional storage.",
        );
        return null;
      }

      const urls = data.urls?.signedUrls || data.urls;
      if (!Array.isArray(urls)) {
        console.error("Invalid signed URLs format:", data);
        return null;
      }

      return urls.map((signedUrl: string, index: number) => {
        const publicUrl = signedUrl.split("?")[0];
        return { name: fileNames[index], signedUrl, publicUrl };
      });
    } catch (error) {
      console.error("Error getting signed URLs:", error);
      return null;
    }
  };

  const uploadToB2WithProgress = (
    file: File,
    signedUrl: string,
    onProgress: (loaded: number, total: number) => void,
    timeoutMs: number,
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const abortController = new AbortController();

      abortControllersRef.current.set(file.name, abortController);

      let lastProgressTime = Date.now();

      const stallCheckInterval = setInterval(() => {
        if (Date.now() - lastProgressTime > STALL_TIMEOUT_MS) {
          console.log(`Upload stalled for ${file.name} - no progress for ${STALL_TIMEOUT_MS / 1000}s`);
          clearInterval(stallCheckInterval);
          xhr.abort();
        }
      }, STALL_CHECK_INTERVAL_MS);

      const timeoutId = setTimeout(() => {
        console.log(`Upload timeout for ${file.name} after ${timeoutMs}ms`);
        clearInterval(stallCheckInterval);
        xhr.abort();
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeoutId);
        clearInterval(stallCheckInterval);
        abortControllersRef.current.delete(file.name);
      };

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          lastProgressTime = Date.now();
          onProgress(event.loaded, event.total);
        }
      });

      xhr.addEventListener("load", () => {
        cleanup();
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true);
        } else {
          console.error("B2 upload failed:", xhr.status, xhr.responseText);
          resolve(false);
        }
      });

      xhr.addEventListener("error", () => {
        cleanup();
        console.error("B2 upload error for:", file.name);
        resolve(false);
      });

      xhr.addEventListener("abort", () => {
        cleanup();
        resolve(false);
      });

      // Pass the File blob directly — XHR streams it from disk, so
      // 100×30 MB photos cost ~30 MB of RAM (the active chunk), not
      // 3 GB. Browsers forbid setting Connection so we don't.
      xhr.open("PUT", B2_PROXY_URL, true);
      xhr.setRequestHeader("signedurl", signedUrl);
      xhr.setRequestHeader("Content-Type", file.type || "image/jpeg");
      xhr.send(file);
    });
  };

  const uploadFileWithRetry = async (
    file: File,
    signedUrl: string,
    fileIndex: number,
    onProgress: (loaded: number, total: number) => void,
    callbacks?: UploadCallbacks,
  ): Promise<boolean> => {
    const timeout = calculateTimeout(file.size);
    let retryCount = 0;

    while (retryCount <= MAX_RETRIES) {
      if (retryCount > 0) {
        callbacks?.onFileRetry?.(fileIndex, file.name, retryCount);
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }

      const success = await uploadToB2WithProgress(file, signedUrl, onProgress, timeout);
      if (success) return true;
      retryCount++;
    }

    return false;
  };

  const uploadImages = async (
    galleryId: string,
    userId: string,
    files: File[],
    callbacks?: UploadCallbacks,
  ): Promise<string[]> => {
    setIsUploading(true);

    // Reset all live refs for this run.
    fileProgressMapRef.current = new Map();
    bytesUploadedRef.current = 0;
    completedCountRef.current = 0;
    currentFileRef.current = "Getting upload URLs...";
    totalCountRef.current = files.length;
    totalBytesRef.current = files.reduce((acc, f) => acc + f.size, 0);
    lastPerFileCallbackRef.current = new Map();
    lastStateUpdateRef.current = 0;

    const imageIds: string[] = [];

    try {
      files.forEach((file) => {
        fileProgressMapRef.current.set(file.name, {
          fileName: file.name,
          bytesUploaded: 0,
          totalBytes: file.size,
          percentage: 0,
          status: "pending",
          retryCount: 0,
        });
      });

      const fileInfos = files.map((file, index) => {
        const fileExt = file.name.split(".").pop() || "jpg";
        const fileId = crypto.randomUUID();
        return {
          file,
          fileId,
          fileName: `${fileId}.${fileExt}`,
          index,
        };
      });

      const prefix = `galleries/${userId}/${galleryId}/`;
      const fileNames = fileInfos.map((f) => f.fileName);

      flushStateNow();

      await supabase
        .from("galleries")
        .update({ upload_started_at: new Date().toISOString() })
        .eq("id", galleryId);

      const signedUrls = await getSignedUrls("imagick", prefix, fileNames);

      if (!signedUrls || signedUrls.length === 0) {
        toast.error("Failed to get upload URLs");
        return [];
      }

      const urlMap = new Map<string, SignedUrlInfo>();
      signedUrls.forEach((urlInfo) => {
        urlMap.set(urlInfo.name, urlInfo);
      });

      // ── Batched gallery_images insert pipeline ─────────────────────────
      // Each successful upload pushes a record into a queue; a flusher
      // writes them in batches of INSERT_BATCH_SIZE so we make 10 HTTP
      // requests instead of 1000 for a 1000-photo gallery.
      type PendingInsert = {
        record: Record<string, unknown>;
        filename: string;
        index: number;
        resolve: (id: string | null) => void;
      };
      const insertQueue: PendingInsert[] = [];
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      let flushing = false;

      const flushInserts = async () => {
        if (flushing) return;
        flushing = true;
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        try {
          while (insertQueue.length > 0) {
            const batch = insertQueue.splice(0, INSERT_BATCH_SIZE);
            const records = batch.map((b) => b.record);
            const { data, error } = await supabase
              .from("gallery_images")
              .insert(records as any)
              .select("id, filename");

            if (error) {
              console.error("Batch insert error:", error);
              batch.forEach((b) => b.resolve(null));
              continue;
            }

            // Map results back by filename — Supabase preserves order,
            // but matching by filename is robust to that ever changing.
            const idByFilename = new Map<string, string>();
            (data || []).forEach((row: any) => {
              if (row?.filename && row?.id) idByFilename.set(row.filename, row.id);
            });
            batch.forEach((b) => b.resolve(idByFilename.get(b.filename) ?? null));
          }
        } finally {
          flushing = false;
        }
      };

      const scheduleInsertFlush = () => {
        if (flushTimer || flushing) return;
        flushTimer = setTimeout(() => {
          flushTimer = null;
          flushInserts();
        }, INSERT_FLUSH_INTERVAL_MS);
      };

      const queueInsert = (record: Record<string, unknown>, filename: string, index: number) =>
        new Promise<string | null>((resolve) => {
          insertQueue.push({ record, filename, index, resolve });
          if (insertQueue.length >= INSERT_BATCH_SIZE) {
            flushInserts();
          } else {
            scheduleInsertFlush();
          }
        });

      const uploadSingleFile = async (
        fileInfo: typeof fileInfos[0],
      ): Promise<string | null> => {
        const { file, fileName, index: i } = fileInfo;
        const urlInfo = urlMap.get(fileName);

        if (!urlInfo) {
          callbacks?.onFileError?.(i, file.name, "No signed URL");
          return null;
        }

        const existing = fileProgressMapRef.current.get(file.name);
        if (existing) existing.status = "uploading";
        currentFileRef.current = file.name;
        callbacks?.onFileStart?.(i, file.name);
        requestStateUpdate();

        let lastReportedBytes = 0;

        const onFileProgress = (loaded: number, total: number) => {
          const entry = fileProgressMapRef.current.get(file.name);
          if (!entry) return;
          // Mutate in place — no allocation per event.
          entry.bytesUploaded = loaded;
          entry.totalBytes = total;
          entry.percentage = Math.round((loaded / total) * 100);
          entry.status = "uploading";

          // Update the global byte aggregate by the delta since the last report.
          bytesUploadedRef.current += loaded - lastReportedBytes;
          lastReportedBytes = loaded;

          requestStateUpdate();

          // Throttle per-file callbacks per file. 30 Hz × 4 files × an
          // O(n=3000) consumer reducer was the second source of UI jank.
          const now = Date.now();
          const lastCalled = lastPerFileCallbackRef.current.get(file.name) ?? 0;
          if (now - lastCalled >= PER_FILE_CALLBACK_THROTTLE_MS) {
            lastPerFileCallbackRef.current.set(file.name, now);
            callbacks?.onFileProgress?.(i, file.name, { ...entry });
          }
        };

        const uploadSuccess = await uploadFileWithRetry(
          file,
          urlInfo.signedUrl,
          i,
          onFileProgress,
          callbacks,
        );

        if (uploadSuccess) {
          // Reconcile the byte aggregate to file.size (covers any final
          // delta the progress event may not have emitted).
          const entry = fileProgressMapRef.current.get(file.name);
          if (entry) {
            const remaining = file.size - entry.bytesUploaded;
            if (remaining > 0) bytesUploadedRef.current += remaining;
            entry.bytesUploaded = file.size;
            entry.percentage = 100;
            entry.status = "complete";
          }

          const id = await queueInsert(
            {
              gallery_id: galleryId,
              user_id: userId,
              original_url: urlInfo.publicUrl,
              filename: file.name,
              status: "uploading",
              sort_order: i,
              file_size_bytes: file.size,
            },
            file.name,
            i,
          );

          if (!id) {
            const errEntry = fileProgressMapRef.current.get(file.name);
            if (errEntry) {
              errEntry.status = "error";
              errEntry.error = "Database insert failed";
            }
            callbacks?.onFileError?.(i, file.name, "Database insert failed");
            requestStateUpdate();
            return null;
          }

          completedCountRef.current += 1;
          callbacks?.onFileComplete?.(i, file.name);
          // Always force a tick on completion so the UI never lags
          // visibly behind the actual count.
          flushStateNow();
          return id;
        }

        const errEntry = fileProgressMapRef.current.get(file.name);
        if (errEntry) {
          errEntry.status = "error";
          errEntry.error = "Upload failed after retries";
        }
        toast.error(`Failed to upload ${file.name} after ${MAX_RETRIES} retries`);
        callbacks?.onFileError?.(i, file.name, "Upload failed after retries");
        requestStateUpdate();
        return null;
      };

      const uploadQueue = [...fileInfos];

      const startNextUpload = async (): Promise<void> => {
        const fileInfo = uploadQueue.shift();
        if (!fileInfo) return;

        const id = await uploadSingleFile(fileInfo);
        if (id) imageIds.push(id);

        await startNextUpload();
      };

      const initialBatch = Math.min(CONCURRENT_UPLOADS, fileInfos.length);
      const activeUploads: Promise<void>[] = [];
      for (let i = 0; i < initialBatch; i++) {
        activeUploads.push(startNextUpload());
      }
      await Promise.all(activeUploads);

      // Drain any inserts still buffered.
      await flushInserts();

      currentFileRef.current = "";
      flushStateNow();

      // Update gallery total_images count.
      const { data: countData } = await supabase
        .from("gallery_images")
        .select("id", { count: "exact" })
        .eq("gallery_id", galleryId)
        .neq("status", "deleted");

      if (countData) {
        await supabase
          .from("galleries")
          .update({
            total_images: countData.length,
            upload_completed_at: new Date().toISOString(),
          })
          .eq("id", galleryId);
      }

      return imageIds;
    } finally {
      setIsUploading(false);
      abortControllersRef.current.clear();
    }
  };

  const cancelUploads = useCallback(() => {
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();
    setIsUploading(false);
    setUploadProgress(null);
  }, []);

  return {
    isUploading,
    uploadProgress,
    uploadImages,
    cancelUploads,
  };
}
