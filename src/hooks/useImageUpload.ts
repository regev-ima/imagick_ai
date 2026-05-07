import { useCallback, useEffect, useRef, useState } from "react";
import Uppy, { type UppyFile } from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Image upload hook backed by Uppy (transloadit/uppy).
 *
 * The previous hand-rolled XHR uploader was crashing browsers on
 * 1000+ photo galleries. The Uppy core handles the things that were
 * fragile: throttled progress events, parallelism caps, retries with
 * backoff, and stream-from-disk uploads (no FileReader / no in-memory
 * buffering of the whole file).
 *
 * The external API of this hook is unchanged on purpose so existing
 * consumers (CreateGalleryPage, AddImagesModal, useImageProcessing)
 * keep working without any further refactor.
 *
 * Flow per call to uploadImages():
 *   1. Generate UUID-based B2 filenames for each File
 *   2. Batch-fetch signed B2 URLs from our `image-upload` edge fn
 *   3. Add files to Uppy with those URLs cached in metadata
 *   4. Uppy uploads with concurrency cap, streaming, retries, etc.
 *   5. On each upload-success: enqueue a gallery_images insert
 *   6. A timer flushes the insert queue in batches of 100
 *   7. Resolve with the list of inserted gallery_images IDs
 */

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
  bytesUploaded: number;
  totalBytes: number;
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

interface FileMeta {
  /** Original filename as the user sees it (for display + DB filename column). */
  originalName: string;
  /** UUID-based filename used as the B2 object key. */
  b2Name: string;
  /** Public URL on B2 once the upload completes. */
  publicUrl: string;
  /** Pre-signed URL for the PUT. */
  signedUrl: string;
  /** Index in the files[] array passed to uploadImages. */
  index: number;
  /** Gallery to insert into. */
  galleryId: string;
  /** Owner. */
  userId: string;
}

// PUTs go through a Cloudflare Worker that forwards to B2 with the
// signed URL provided in a custom header. Same target as the previous
// implementation.
const B2_PROXY_URL = "https://cloudflare-b2-proxy.rx8rq49b5c.workers.dev";

// Concurrency for B2 uploads. The Cloudflare Worker proxy chokes well
// above 4 because each upload pins a connection against per-Worker
// CPU/memory limits.
const CONCURRENT_UPLOADS = 4;

// Throttle aggregate React state updates. Uppy fires progress events
// per file at high frequency; we coalesce to ~10 Hz to stop the main
// thread from drowning in re-renders.
const STATE_UPDATE_THROTTLE_MS = 100;

// Throttle per-file callbacks (consumers typically do an O(n) array
// map inside them; firing 30×/sec × n=3000 files was causing the freeze).
const PER_FILE_CALLBACK_THROTTLE_MS = 200;

// Batch DB inserts so 1000 photos produce ~10 HTTP writes, not 1000.
const INSERT_BATCH_SIZE = 100;
const INSERT_FLUSH_INTERVAL_MS = 50;

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  // Single Uppy instance reused across uploadImages() calls. Cleared
  // before each call (uppy.cancelAll() removes any leftover files).
  const uppyRef = useRef<Uppy<FileMeta, Record<string, never>> | null>(null);

  // Live aggregate refs — mutated continuously, snapshotted into state
  // by the throttled flusher.
  const fileProgressRef = useRef(new Map<string, FileUploadProgress>());
  const bytesUploadedRef = useRef(0);
  const totalBytesRef = useRef(0);
  const completedCountRef = useRef(0);
  const totalCountRef = useRef(0);
  const currentFileRef = useRef("");
  const lastStateUpdateRef = useRef(0);
  const stateFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPerFileCallbackRef = useRef(new Map<string, number>());

  // Lazy init of Uppy.
  if (!uppyRef.current) {
    uppyRef.current = new Uppy<FileMeta, Record<string, never>>({
      autoProceed: false,
      allowMultipleUploadBatches: true,
    }).use(AwsS3, {
      shouldUseMultipart: false,
      limit: CONCURRENT_UPLOADS,
      retryDelays: [1000, 2000, 4000, 8000, 16000],
      getUploadParameters: async (file) => {
        const meta = file.meta as FileMeta;
        return {
          method: "PUT" as const,
          url: B2_PROXY_URL,
          headers: {
            signedurl: meta.signedUrl,
            "Content-Type": file.type || "image/jpeg",
          },
        };
      },
    });
  }

  useEffect(() => {
    return () => {
      if (stateFlushTimerRef.current) clearTimeout(stateFlushTimerRef.current);
      uppyRef.current?.destroy();
      uppyRef.current = null;
    };
  }, []);

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
      fileProgress: new Map(fileProgressRef.current),
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

  const uploadImages = async (
    galleryId: string,
    userId: string,
    files: File[],
    callbacks?: UploadCallbacks,
  ): Promise<string[]> => {
    if (files.length === 0) return [];
    const uppy = uppyRef.current!;

    // Reset live aggregates for this run.
    setIsUploading(true);
    fileProgressRef.current = new Map();
    bytesUploadedRef.current = 0;
    completedCountRef.current = 0;
    currentFileRef.current = "Getting upload URLs...";
    totalCountRef.current = files.length;
    totalBytesRef.current = files.reduce((acc, f) => acc + f.size, 0);
    lastPerFileCallbackRef.current = new Map();
    lastStateUpdateRef.current = 0;
    flushStateNow();

    // Drain anything left over from a previous run.
    uppy.cancelAll();

    files.forEach((file) => {
      fileProgressRef.current.set(file.name, {
        fileName: file.name,
        bytesUploaded: 0,
        totalBytes: file.size,
        percentage: 0,
        status: "pending",
        retryCount: 0,
      });
    });

    // Generate UUID-based B2 filenames (one per File) and batch-fetch
    // signed URLs from the edge function.
    const fileEntries = files.map((file, index) => {
      const ext = file.name.split(".").pop() || "jpg";
      return { file, index, b2Name: `${crypto.randomUUID()}.${ext}` };
    });

    await supabase
      .from("galleries")
      .update({ upload_started_at: new Date().toISOString() })
      .eq("id", galleryId);

    const signedUrls = await getSignedUrls(
      "imagick",
      `galleries/${userId}/${galleryId}/`,
      fileEntries.map((e) => e.b2Name),
    );
    if (!signedUrls) {
      toast.error("Failed to get upload URLs");
      setIsUploading(false);
      return [];
    }

    const urlByB2Name = new Map<string, SignedUrlInfo>();
    signedUrls.forEach((u) => urlByB2Name.set(u.name, u));

    // ── Batched gallery_images insert pipeline ─────────────────────────
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

    // ── Wire Uppy events for THIS run ──────────────────────────────────
    // We attach scoped listeners and remove them after this run finishes.
    const indexById = new Map<string, number>(); // uppy file id → index in files[]
    const filenameById = new Map<string, string>(); // uppy file id → original name
    const insertPromises: Promise<string | null>[] = [];

    const onUploadProgress = (
      file: UppyFile<FileMeta, Record<string, never>> | undefined,
      progress: { bytesUploaded: number; bytesTotal: number | null },
    ) => {
      if (!file) return;
      const idx = indexById.get(file.id);
      const filename = filenameById.get(file.id);
      if (idx === undefined || !filename) return;
      const total = progress.bytesTotal ?? file.size ?? 0;

      const entry = fileProgressRef.current.get(filename);
      if (!entry) return;

      const previous = entry.bytesUploaded;
      entry.bytesUploaded = progress.bytesUploaded;
      entry.totalBytes = total;
      entry.percentage = total > 0 ? Math.round((progress.bytesUploaded / total) * 100) : 0;
      entry.status = "uploading";

      bytesUploadedRef.current += progress.bytesUploaded - previous;
      currentFileRef.current = filename;
      requestStateUpdate();

      const now = Date.now();
      const lastCalled = lastPerFileCallbackRef.current.get(filename) ?? 0;
      if (now - lastCalled >= PER_FILE_CALLBACK_THROTTLE_MS) {
        lastPerFileCallbackRef.current.set(filename, now);
        callbacks?.onFileProgress?.(idx, filename, { ...entry });
      }
    };

    const onUploadStart = (
      _uploadId: string,
      uploadFiles: UppyFile<FileMeta, Record<string, never>>[],
    ) => {
      uploadFiles.forEach((file) => {
        const idx = indexById.get(file.id);
        const filename = filenameById.get(file.id);
        if (idx === undefined || !filename) return;
        const entry = fileProgressRef.current.get(filename);
        if (entry) entry.status = "uploading";
        callbacks?.onFileStart?.(idx, filename);
      });
      requestStateUpdate();
    };

    const onUploadRetry = (fileId: string) => {
      const idx = indexById.get(fileId);
      const filename = filenameById.get(fileId);
      if (idx === undefined || !filename) return;
      const entry = fileProgressRef.current.get(filename);
      if (entry) {
        entry.retryCount += 1;
        entry.status = "retrying";
      }
      callbacks?.onFileRetry?.(idx, filename, entry?.retryCount ?? 1);
      toast.info(`Retrying ${filename}...`);
      requestStateUpdate();
    };

    const onUploadSuccess = (
      file: UppyFile<FileMeta, Record<string, never>> | undefined,
    ) => {
      if (!file) return;
      const idx = indexById.get(file.id);
      const filename = filenameById.get(file.id);
      if (idx === undefined || !filename) return;
      const meta = file.meta as FileMeta;

      const entry = fileProgressRef.current.get(filename);
      if (entry) {
        const remaining = (file.size ?? entry.totalBytes) - entry.bytesUploaded;
        if (remaining > 0) bytesUploadedRef.current += remaining;
        entry.bytesUploaded = file.size ?? entry.totalBytes;
        entry.percentage = 100;
        entry.status = "complete";
      }
      completedCountRef.current += 1;
      callbacks?.onFileComplete?.(idx, filename);
      flushStateNow();

      const insertPromise = queueInsert(
        {
          gallery_id: meta.galleryId,
          user_id: meta.userId,
          original_url: meta.publicUrl,
          filename: filename,
          status: "uploading",
          sort_order: meta.index,
          file_size_bytes: file.size ?? null,
        },
        filename,
        meta.index,
      );
      insertPromises.push(insertPromise);
    };

    const onUploadError = (
      file: UppyFile<FileMeta, Record<string, never>> | undefined,
      error: Error,
    ) => {
      if (!file) return;
      const idx = indexById.get(file.id);
      const filename = filenameById.get(file.id);
      if (idx === undefined || !filename) return;
      const entry = fileProgressRef.current.get(filename);
      if (entry) {
        entry.status = "error";
        entry.error = error?.message || "Upload failed";
      }
      toast.error(`Failed to upload ${filename}`);
      callbacks?.onFileError?.(idx, filename, entry?.error || "Upload failed");
      requestStateUpdate();
    };

    uppy.on("upload-progress", onUploadProgress);
    uppy.on("upload", onUploadStart);
    uppy.on("upload-retry", onUploadRetry);
    uppy.on("upload-success", onUploadSuccess);
    uppy.on("upload-error", onUploadError);

    // Add files to Uppy with cached signed URL metadata.
    fileEntries.forEach(({ file, index, b2Name }) => {
      const urlInfo = urlByB2Name.get(b2Name);
      if (!urlInfo) return;
      try {
        const fileId = uppy.addFile<FileMeta, Record<string, never>>({
          name: file.name,
          type: file.type || "image/jpeg",
          data: file,
          meta: {
            originalName: file.name,
            b2Name,
            publicUrl: urlInfo.publicUrl,
            signedUrl: urlInfo.signedUrl,
            index,
            galleryId,
            userId,
          },
        });
        indexById.set(fileId, index);
        filenameById.set(fileId, file.name);
      } catch (err) {
        console.error("Failed to add file to Uppy:", file.name, err);
      }
    });

    currentFileRef.current = "";
    flushStateNow();

    try {
      await uppy.upload();
      // Drain any inserts still buffered.
      await flushInserts();

      // Resolve all queued insert promises so we know the final order.
      const resolved = await Promise.all(insertPromises);
      const imageIds = resolved.filter((id): id is string => !!id);

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

      flushStateNow();
      return imageIds;
    } finally {
      uppy.off("upload-progress", onUploadProgress);
      uppy.off("upload", onUploadStart);
      uppy.off("upload-retry", onUploadRetry);
      uppy.off("upload-success", onUploadSuccess);
      uppy.off("upload-error", onUploadError);
      uppy.cancelAll();
      setIsUploading(false);
    }
  };

  const cancelUploads = useCallback(() => {
    uppyRef.current?.cancelAll();
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
