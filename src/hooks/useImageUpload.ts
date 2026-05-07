import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Uppy, { type UppyFile } from "@uppy/core";
import XHRUpload from "@uppy/xhr-upload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Image upload hook backed by Uppy (transloadit/uppy).
 *
 * Two ways to use it:
 *
 *   1. Render `<Dashboard uppy={uppy} />` (recommended for new code).
 *      The user picks/drops files into Uppy directly. Then call
 *      `uploadImages(galleryId, userId)` with no files arg — we
 *      upload whatever is currently in Uppy.
 *
 *   2. Pass `File[]` to `uploadImages(galleryId, userId, files)`
 *      (legacy path used by useImageProcessing for the Drive flow).
 *      Files are added to Uppy then uploaded immediately.
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
  /** Index in the upload batch (used for sort_order). */
  index: number;
  /** Gallery to insert into. */
  galleryId: string;
  /** Owner. */
  userId: string;
}

const B2_PROXY_URL = "https://cloudflare-b2-proxy.rx8rq49b5c.workers.dev";
const CONCURRENT_UPLOADS = 4;
const STATE_UPDATE_THROTTLE_MS = 100;
const PER_FILE_CALLBACK_THROTTLE_MS = 200;
const INSERT_BATCH_SIZE = 100;
const INSERT_FLUSH_INTERVAL_MS = 50;

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const uppyRef = useRef<Uppy<FileMeta, Record<string, never>> | null>(null);

  const fileProgressRef = useRef(new Map<string, FileUploadProgress>());
  const bytesUploadedRef = useRef(0);
  const totalBytesRef = useRef(0);
  const completedCountRef = useRef(0);
  const totalCountRef = useRef(0);
  const currentFileRef = useRef("");
  const lastStateUpdateRef = useRef(0);
  const stateFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPerFileCallbackRef = useRef(new Map<string, number>());

  // Single Uppy instance per hook lifetime — files added by the user
  // (via Dashboard or programmatically) accumulate here until
  // uploadImages() is called. We need a stable reference for the
  // <Dashboard> component to subscribe to.
  const uppy = useMemo<Uppy<FileMeta, Record<string, never>>>(() => {
    if (uppyRef.current) return uppyRef.current;
    const instance = new Uppy<FileMeta, Record<string, never>>({
      autoProceed: false,
      allowMultipleUploadBatches: true,
      restrictions: {
        allowedFileTypes: [
          "image/*",
          ".cr2", ".cr3", ".arw", ".nef", ".dng", ".raf", ".rw2", ".orf",
        ],
      },
    }).use(XHRUpload, {
      // We use the generic XHR uploader, NOT @uppy/aws-s3, because the
      // Cloudflare Worker proxy returns a plain 200 (not an S3 XML
      // response). The aws-s3 plugin parses the response for AWS-style
      // metadata and hangs on 200-with-empty-body responses, which
      // caused the previous "stalls at 51 MB" symptom (4 concurrent
      // PUTs, ~13 MB each, sent fully but never marked as completed).
      endpoint: B2_PROXY_URL,
      method: "PUT",
      formData: false, // raw body = the file, not multipart/form-data
      limit: CONCURRENT_UPLOADS,
      retryDelays: [1000, 2000, 4000, 8000, 16000],
      // Per-file headers — the actual B2 signed URL goes here so the
      // Cloudflare Worker can forward to the right object.
      headers: (file) => {
        const meta = file.meta as FileMeta;
        return {
          signedurl: meta.signedUrl,
          "Content-Type": file.type || "image/jpeg",
        };
      },
    });
    uppyRef.current = instance;
    return instance;
  }, []);

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
    files?: File[],
    callbacks?: UploadCallbacks,
  ): Promise<string[]> => {
    // Legacy path: caller passed File[]. Add them to Uppy first.
    if (files && files.length > 0) {
      uppy.cancelAll();
      files.forEach((file, idx) => {
        try {
          uppy.addFile({
            name: file.name,
            type: file.type || "image/jpeg",
            data: file,
            meta: {
              originalName: file.name,
              b2Name: "",
              publicUrl: "",
              signedUrl: "",
              index: idx,
              galleryId,
              userId,
            },
          });
        } catch (err) {
          console.error("Failed to add file to Uppy:", file.name, err);
        }
      });
    }

    const uppyFiles = uppy.getFiles();
    if (uppyFiles.length === 0) return [];

    setIsUploading(true);
    fileProgressRef.current = new Map();
    bytesUploadedRef.current = 0;
    completedCountRef.current = 0;
    currentFileRef.current = "Getting upload URLs...";
    totalCountRef.current = uppyFiles.length;
    totalBytesRef.current = uppyFiles.reduce((acc, f) => acc + (f.size ?? 0), 0);
    lastPerFileCallbackRef.current = new Map();
    lastStateUpdateRef.current = 0;
    flushStateNow();

    uppyFiles.forEach((file) => {
      fileProgressRef.current.set(file.name ?? file.id, {
        fileName: file.name ?? file.id,
        bytesUploaded: 0,
        totalBytes: file.size ?? 0,
        percentage: 0,
        status: "pending",
        retryCount: 0,
      });
    });

    // Generate UUID-based B2 filenames per file currently in Uppy and
    // batch-fetch signed URLs.
    const b2NameByUppyId = new Map<string, string>();
    uppyFiles.forEach((file, idx) => {
      const ext = (file.name ?? "jpg").split(".").pop() || "jpg";
      const b2Name = `${crypto.randomUUID()}.${ext}`;
      b2NameByUppyId.set(file.id, b2Name);
      uppy.setFileMeta(file.id, { index: idx, galleryId, userId, b2Name });
    });

    await supabase
      .from("galleries")
      .update({ upload_started_at: new Date().toISOString() })
      .eq("id", galleryId);

    const signedUrls = await getSignedUrls(
      "imagick",
      `galleries/${userId}/${galleryId}/`,
      Array.from(b2NameByUppyId.values()),
    );
    if (!signedUrls) {
      toast.error("Failed to get upload URLs");
      setIsUploading(false);
      return [];
    }

    const urlByB2Name = new Map<string, SignedUrlInfo>();
    signedUrls.forEach((u) => urlByB2Name.set(u.name, u));

    // Stamp each file with its signed URL meta.
    uppyFiles.forEach((file) => {
      const b2Name = b2NameByUppyId.get(file.id);
      if (!b2Name) return;
      const urlInfo = urlByB2Name.get(b2Name);
      if (!urlInfo) return;
      uppy.setFileMeta(file.id, {
        originalName: file.name ?? "",
        b2Name,
        publicUrl: urlInfo.publicUrl,
        signedUrl: urlInfo.signedUrl,
      });
    });

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
    const indexById = new Map<string, number>();
    const filenameById = new Map<string, string>();
    uppyFiles.forEach((file, idx) => {
      indexById.set(file.id, idx);
      filenameById.set(file.id, file.name ?? file.id);
    });
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

    currentFileRef.current = "";
    flushStateNow();

    try {
      await uppy.upload();
      await flushInserts();

      const resolved = await Promise.all(insertPromises);
      const imageIds = resolved.filter((id): id is string => !!id);

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
    /** The shared Uppy instance — pass to <Dashboard uppy={uppy} />. */
    uppy,
    isUploading,
    uploadProgress,
    uploadImages,
    cancelUploads,
  };
}
