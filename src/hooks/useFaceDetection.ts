import { useState, useRef, useCallback } from "react";
import * as faceapi from "face-api.js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPreviewUrl } from "@/lib/imageUrls";

const MODELS_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

interface FaceDetectionProgress {
  phase: "loading-models" | "detecting" | "clustering" | "done" | "error";
  processedImages: number;
  totalImages: number;
  facesFound: number;
  error?: string;
}

export function useFaceDetection(galleryId: string | undefined) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<FaceDetectionProgress | null>(null);
  const modelsLoadedRef = useRef(false);
  const abortRef = useRef(false);

  const loadModels = useCallback(async () => {
    if (modelsLoadedRef.current) return;
    setProgress((p) => ({ ...p!, phase: "loading-models", processedImages: 0, totalImages: 0, facesFound: 0 }));
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);
    modelsLoadedRef.current = true;
  }, []);

  const loadImage = useCallback(async (url: string): Promise<HTMLImageElement> => {
    // Strategy 1: Fetch as blob (bypasses CORS canvas tainting)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const imgTimeout = setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error("Image decode timeout"));
        }, 10000);

        const img = new Image();
        img.onload = () => {
          clearTimeout(imgTimeout);
          URL.revokeObjectURL(blobUrl);
          resolve(img);
        };
        img.onerror = () => {
          clearTimeout(imgTimeout);
          URL.revokeObjectURL(blobUrl);
          reject(new Error("Failed to decode image"));
        };
        img.src = blobUrl;
      });
    } catch {
      // Strategy 2: Direct load with crossOrigin (needs CORS headers from server)
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Image load timeout (15s)")), 15000);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { clearTimeout(timeout); resolve(img); };
        img.onerror = () => { clearTimeout(timeout); reject(new Error("Failed to load image")); };
        img.src = url;
      });
    }
  }, []);

  const startDetection = useCallback(async () => {
    if (!galleryId || isRunning) return;

    setIsRunning(true);
    abortRef.current = false;

    try {
      // 1. Set gallery status to processing
      await supabase
        .from("galleries")
        .update({
          face_search_status: "processing",
          face_search_started_at: new Date().toISOString(),
          face_search_completed_at: null,
          face_search_error: null,
        } as any)
        .eq("id", galleryId);

      // Clear previous data
      await supabase.from("face_detections" as any).delete().eq("gallery_id", galleryId);
      await supabase.from("face_clusters" as any).delete().eq("gallery_id", galleryId);

      // 2. Load face-api.js models
      await loadModels();

      // 3. Fetch all gallery images
      const { data: images, error: imgError } = await supabase
        .from("gallery_images")
        .select("id, original_url")
        .eq("gallery_id", galleryId)
        .eq("status", "ready")
        .order("created_at", { ascending: true });

      if (imgError || !images) throw new Error("Failed to fetch images");

      setProgress({
        phase: "detecting",
        processedImages: 0,
        totalImages: images.length,
        facesFound: 0,
      });

      let totalFaces = 0;

      // 4. Process each image
      for (let i = 0; i < images.length; i++) {
        if (abortRef.current) break;

        const image = images[i];
        try {
          // Use preview URL (compressed, smaller) for faster processing
          const previewUrl = getPreviewUrl(image.original_url);
          // face-api.js needs JPEG/PNG — preview is webp, try original if webp fails
          let img: HTMLImageElement;
          try {
            img = await loadImage(previewUrl);
          } catch {
            // Fallback to original URL
            img = await loadImage(image.original_url);
          }

          // Detect faces + extract 128-dim descriptors
          const detections = await faceapi
            .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (detections.length > 0) {
            const MIN_FACE_SIZE = 50; // Skip tiny faces — unreliable descriptors
            const rows = detections
              .filter((det) => {
                if (!det.descriptor || det.descriptor.length !== 128) return false;
                const { width, height } = det.detection.box;
                if (width < MIN_FACE_SIZE || height < MIN_FACE_SIZE) return false;
                return true;
              })
              .map((det) => ({
                image_id: image.id,
                gallery_id: galleryId,
                bounding_box: {
                  top: Math.round(det.detection.box.top),
                  left: Math.round(det.detection.box.left),
                  width: Math.round(det.detection.box.width),
                  height: Math.round(det.detection.box.height),
                },
                // pgvector expects array format: [0.1, 0.2, ...]
                face_vector: `[${Array.from(det.descriptor).join(",")}]`,
              }));

            if (detections.length !== rows.length) {
              console.warn(`Image ${image.id}: skipped ${detections.length - rows.length} faces with invalid descriptors`);
            }

            if (rows.length > 0) {
              const { error: insertError } = await supabase
                .from("face_detections" as any)
                .insert(rows);

              if (insertError) {
                console.error(`Insert error for image ${image.id}:`, insertError.message);
              } else {
                console.log(`Inserted ${rows.length} face(s) for image ${image.id}, vector sample: ${rows[0].face_vector.substring(0, 50)}...`);
              }
            }

            totalFaces += rows.length;
          }
        } catch (err) {
          console.error(`Failed to process image ${image.id}:`, err);
          // Continue to next image
        }

        setProgress({
          phase: "detecting",
          processedImages: i + 1,
          totalImages: images.length,
          facesFound: totalFaces,
        });
      }

      if (abortRef.current) {
        await supabase
          .from("galleries")
          .update({ face_search_status: "idle" } as any)
          .eq("id", galleryId);
        setProgress(null);
        setIsRunning(false);
        return;
      }

      // 5. Cluster faces using pgvector
      setProgress((p) => ({ ...p!, phase: "clustering" }));

      // Debug: verify vectors were stored
      const { count: vectorCount } = await supabase
        .from("face_detections" as any)
        .select("id", { count: "exact", head: true })
        .eq("gallery_id", galleryId)
        .not("face_vector", "is", null);
      console.log(`Vectors stored: ${vectorCount} out of ${totalFaces} faces`);

      const { data: clusterResult, error: clusterError } = await supabase
        .rpc("cluster_gallery_faces" as any, {
          p_gallery_id: galleryId,
          p_distance_threshold: 0.45,
        });

      if (clusterError) {
        throw new Error(`Clustering failed: ${clusterError.message}`);
      }

      setProgress((p) => ({ ...p!, phase: "done" }));
      toast.success(`Face detection complete! Found ${totalFaces} faces.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Face detection failed";
      console.error("Face detection error:", msg);

      await supabase
        .from("galleries")
        .update({
          face_search_status: "error",
          face_search_error: msg,
        } as any)
        .eq("id", galleryId);

      setProgress((p) => ({ ...p!, phase: "error", error: msg }));
      toast.error(msg);
    } finally {
      setIsRunning(false);
    }
  }, [galleryId, isRunning, loadModels, loadImage]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return {
    startDetection,
    isRunning,
    progress,
    abort,
  };
}
