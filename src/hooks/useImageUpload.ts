import { useState, useCallback, useRef } from "react";
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
const MAX_RETRIES = 5; // Increased from 3 for better recovery from transient Cloudflare issues
// Timeout: 20 seconds per MB (as requested)
const TIMEOUT_PER_MB_MS = 20 * 1000;
const MIN_TIMEOUT_MS = 30 * 1000; // Minimum 30 seconds
// Stall detection - if no progress for this duration, consider upload stuck
const STALL_TIMEOUT_MS = 20 * 1000; // 20 seconds with no progress
const STALL_CHECK_INTERVAL_MS = 5 * 1000; // Check every 5 seconds
// Number of concurrent uploads to run in parallel
const CONCURRENT_UPLOADS = 6;

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  /**
   * Calculate timeout based on file size (20 seconds per MB, minimum 30 seconds)
   */
  const calculateTimeout = (fileSize: number): number => {
    const fileSizeMB = fileSize / (1024 * 1024);
    const timeout = Math.max(MIN_TIMEOUT_MS, fileSizeMB * TIMEOUT_PER_MB_MS);
    return timeout;
  };

  /**
   * Get signed URLs from the backend for direct B2 upload
   */
  const getSignedUrls = async (
    bucket: string,
    prefix: string,
    fileNames: string[]
  ): Promise<SignedUrlInfo[] | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("image-upload", {
        body: { bucket, prefix, names: fileNames },
      });

      if (error) {
        console.error("Error getting signed URLs:", error);
        return null;
      }

      // Check for storage limit error
      if (data?.error === "storage_limit_exceeded") {
        toast.error(data.message || "Storage limit exceeded. Please upgrade your plan or purchase additional storage.");
        return null;
      }

      console.log("Signed URLs response:", data);

      const urls = data.urls?.signedUrls || data.urls;
      
      if (!Array.isArray(urls)) {
        console.error("Invalid signed URLs format:", data);
        return null;
      }
      
      return urls.map((signedUrl: string, index: number) => {
        const publicUrl = signedUrl.split("?")[0];
        return {
          name: fileNames[index],
          signedUrl,
          publicUrl,
        };
      });
    } catch (error) {
      console.error("Error getting signed URLs:", error);
      return null;
    }
  };

  /**
   * Upload a single file to B2 using XMLHttpRequest for progress tracking
   */
  const uploadToB2WithProgress = (
    file: File,
    signedUrl: string,
    onProgress: (loaded: number, total: number) => void,
    timeoutMs: number
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const abortController = new AbortController();
      
      // Store abort controller for potential cancellation
      abortControllersRef.current.set(file.name, abortController);
      
      // Stall detection - track last time we received progress
      let lastProgressTime = Date.now();
      
      const stallCheckInterval = setInterval(() => {
        if (Date.now() - lastProgressTime > STALL_TIMEOUT_MS) {
          console.log(`Upload stalled for ${file.name} - no progress for ${STALL_TIMEOUT_MS / 1000}s`);
          clearInterval(stallCheckInterval);
          xhr.abort();
        }
      }, STALL_CHECK_INTERVAL_MS);
      
      // Overall timeout as backup
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
          lastProgressTime = Date.now(); // Reset stall timer on progress
          onProgress(event.loaded, event.total);
        }
      });

      xhr.addEventListener("load", () => {
        cleanup();
        
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log("B2 upload successful for:", file.name);
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
        console.log("B2 upload aborted for:", file.name);
        resolve(false);
      });

      // Open and send request
      xhr.open("PUT", B2_PROXY_URL, true);
      xhr.setRequestHeader("signedurl", signedUrl);
      xhr.setRequestHeader("Content-Type", file.type || "image/jpeg");
      xhr.setRequestHeader("Connection", "keep-alive"); // Help maintain connection through proxy
      
      // Read file and send
      const reader = new FileReader();
      reader.onload = () => {
        xhr.send(reader.result as ArrayBuffer);
      };
      reader.onerror = () => {
        cleanup();
        console.error("Error reading file:", file.name);
        resolve(false);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  /**
   * Upload a single file with retry logic
   */
  const uploadFileWithRetry = async (
    file: File,
    signedUrl: string,
    fileIndex: number,
    onProgress: (loaded: number, total: number) => void,
    callbacks?: UploadCallbacks
  ): Promise<boolean> => {
    const timeout = calculateTimeout(file.size);
    let retryCount = 0;
    
    while (retryCount <= MAX_RETRIES) {
      if (retryCount > 0) {
        console.log(`Retry ${retryCount}/${MAX_RETRIES} for ${file.name}`);
        callbacks?.onFileRetry?.(fileIndex, file.name, retryCount);
        
        // Exponential backoff: 2s, 4s, 8s, 16s, 32s (longer for Cloudflare transient issues)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }

      const success = await uploadToB2WithProgress(file, signedUrl, onProgress, timeout);
      
      if (success) {
        return true;
      }

      retryCount++;
    }

    return false;
  };

  /**
   * Upload images directly to B2 storage with per-file progress and retry logic
   */
  const uploadImages = async (
    galleryId: string,
    userId: string,
    files: File[],
    callbacks?: UploadCallbacks
  ): Promise<string[]> => {
    setIsUploading(true);
    const imageIds: string[] = [];
    const fileProgressMap = new Map<string, FileUploadProgress>();

    try {
      // Initialize file progress for all files
      files.forEach((file, index) => {
        fileProgressMap.set(file.name, {
          fileName: file.name,
          bytesUploaded: 0,
          totalBytes: file.size,
          percentage: 0,
          status: "pending",
          retryCount: 0,
        });
      });

      // Generate unique filenames for all files
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

      // Get signed URLs for all files at once
      const prefix = `galleries/${userId}/${galleryId}/`;
      const fileNames = fileInfos.map((f) => f.fileName);
      
      setUploadProgress({
        uploaded: 0,
        total: files.length,
        currentFile: "Getting upload URLs...",
        fileProgress: fileProgressMap,
      });

      // Record upload start timestamp
      await supabase
        .from("galleries")
        .update({ upload_started_at: new Date().toISOString() })
        .eq("id", galleryId);

      const signedUrls = await getSignedUrls("imagick", prefix, fileNames);

      if (!signedUrls || signedUrls.length === 0) {
        toast.error("Failed to get upload URLs");
        return [];
      }

      // Create a map of filename to signed URL info
      const urlMap = new Map<string, SignedUrlInfo>();
      signedUrls.forEach((urlInfo) => {
        urlMap.set(urlInfo.name, urlInfo);
      });

      // Track completed uploads count
      let completedCount = 0;

      // Upload a single file and handle all its logic
      const uploadSingleFile = async (fileInfo: typeof fileInfos[0]): Promise<string | null> => {
        const { file, fileName, index: i } = fileInfo;
        const urlInfo = urlMap.get(fileName);

        if (!urlInfo) {
          console.error("No signed URL for file:", fileName);
          toast.error(`Failed to upload ${file.name}`);
          callbacks?.onFileError?.(i, file.name, "No signed URL");
          return null;
        }

        // Update status to uploading
        fileProgressMap.set(file.name, {
          ...fileProgressMap.get(file.name)!,
          status: "uploading",
        });

        callbacks?.onFileStart?.(i, file.name);
        
        setUploadProgress(prev => prev ? {
          ...prev,
          currentFile: file.name,
          fileProgress: new Map(fileProgressMap),
        } : null);

        // Progress callback for this file
        const onFileProgress = (loaded: number, total: number) => {
          const percentage = Math.round((loaded / total) * 100);
          const progress: FileUploadProgress = {
            fileName: file.name,
            bytesUploaded: loaded,
            totalBytes: total,
            percentage,
            status: "uploading",
            retryCount: 0,
          };
          
          fileProgressMap.set(file.name, progress);
          
          setUploadProgress(prev => prev ? {
            ...prev,
            fileProgress: new Map(fileProgressMap),
          } : null);

          callbacks?.onFileProgress?.(i, file.name, progress);
        };

        // Upload with retry
        const uploadSuccess = await uploadFileWithRetry(
          file,
          urlInfo.signedUrl,
          i,
          onFileProgress,
          callbacks
        );

        if (uploadSuccess) {
          // Update progress to complete
          fileProgressMap.set(file.name, {
            ...fileProgressMap.get(file.name)!,
            status: "complete",
            percentage: 100,
            bytesUploaded: file.size,
          });

          // Create gallery_images record with B2 public URL
          const { data: imageRecord, error: insertError } = await supabase
            .from("gallery_images")
            .insert({
              gallery_id: galleryId,
              user_id: userId,
              original_url: urlInfo.publicUrl,
              filename: file.name,
              status: "uploading",
              sort_order: i,
              file_size_bytes: file.size,
            } as any)
            .select("id")
            .single();

          if (insertError) {
            console.error("Insert error:", insertError);
            callbacks?.onFileError?.(i, file.name, "Database insert failed");
            fileProgressMap.set(file.name, {
              ...fileProgressMap.get(file.name)!,
              status: "error",
              error: "Database insert failed",
            });
            return null;
          }

          completedCount++;
          callbacks?.onFileComplete?.(i, file.name);
          
          setUploadProgress(prev => prev ? {
            ...prev,
            uploaded: completedCount,
            fileProgress: new Map(fileProgressMap),
          } : null);

          return imageRecord?.id ?? null;
        } else {
          // Mark as error after all retries exhausted
          fileProgressMap.set(file.name, {
            ...fileProgressMap.get(file.name)!,
            status: "error",
            error: "Upload failed after retries",
          });
          
          toast.error(`Failed to upload ${file.name} after ${MAX_RETRIES} retries`);
          callbacks?.onFileError?.(i, file.name, "Upload failed after retries");
          return null;
        }
      };

      // Sliding window concurrency - start next upload as soon as one finishes
      const uploadQueue = [...fileInfos];
      const activeUploads: Promise<void>[] = [];
      
      const startNextUpload = async (): Promise<void> => {
        const fileInfo = uploadQueue.shift();
        if (!fileInfo) return;
        
        const id = await uploadSingleFile(fileInfo);
        if (id) imageIds.push(id);
        
        // Start next upload immediately when this one finishes
        await startNextUpload();
      };

      // Start initial batch of concurrent uploads
      const initialBatch = Math.min(CONCURRENT_UPLOADS, fileInfos.length);
      for (let i = 0; i < initialBatch; i++) {
        activeUploads.push(startNextUpload());
      }

      // Wait for all uploads to complete
      await Promise.all(activeUploads);

      setUploadProgress({
        uploaded: imageIds.length,
        total: files.length,
        currentFile: "",
        fileProgress: new Map(fileProgressMap),
      });

      // Update gallery total_images count
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
      // Clear all abort controllers
      abortControllersRef.current.clear();
    }
  };

  /**
   * Cancel all ongoing uploads
   */
  const cancelUploads = useCallback(() => {
    abortControllersRef.current.forEach((controller) => {
      controller.abort();
    });
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
