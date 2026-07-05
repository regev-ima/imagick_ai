import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FaceCluster {
  id: string;
  gallery_id: string;
  face_count: number;
  label: string | null;
  representative_bbox: { top: number; left: number; width: number; height: number } | null;
  representative_image: {
    id: string;
    original_url: string;
  } | null;
  created_at: string;
}

interface FaceDetectionWithImage {
  id: string;
  bounding_box: { top: number; left: number; width: number; height: number };
  image: {
    id: string;
    original_url: string;
    filename: string;
  } | null;
}

/**
 * Read-only face data. Faces are produced by the AI Culling pipeline (ArcFace);
 * this hook only reads the resulting clusters + a progress count. Detecting /
 * re-detecting faces is done by running AI Culling with "Recognize people".
 */
export function useFaceSearch(galleryId: string | undefined, isDetectionRunning = false) {
  // Poll detection count during processing for progress indication.
  const faceSearchProgress = useQuery({
    queryKey: ["face-search-progress", galleryId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("face_detections" as any)
        .select("id", { count: "exact", head: true })
        .eq("gallery_id", galleryId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!galleryId,
    refetchInterval: isDetectionRunning ? 4000 : false,
  });

  // Fetch face clusters for the gallery.
  const faceClusters = useQuery({
    queryKey: ["face-clusters", galleryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_clusters" as any)
        .select(`
          id, gallery_id, face_count, label, representative_bbox, created_at,
          representative_image:gallery_images!representative_image_id (
            id, original_url
          )
        `)
        .eq("gallery_id", galleryId!)
        .order("face_count", { ascending: false });
      if (error) throw error;
      return (data as unknown as FaceCluster[]) || [];
    },
    enabled: !!galleryId,
    // While a run is processing, poll so clusters appear the moment detection
    // lands at the end of the run — no manual page refresh needed.
    refetchInterval: isDetectionRunning ? 4000 : false,
  });

  return { faceClusters, faceSearchProgress };
}

// Name a detected person (set/clear a face cluster's label). Optimistic-ish:
// invalidates the cluster list on success so the new name shows everywhere.
export function useNameFaceCluster(galleryId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clusterId, label }: { clusterId: string; label: string | null }) => {
      const { error } = await supabase
        .from("face_clusters" as any)
        .update({ label: label && label.trim() ? label.trim() : null })
        .eq("id", clusterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["face-clusters", galleryId] });
    },
  });
}

export interface ImageFace {
  id: string;
  bounding_box: { top: number; left: number; width: number; height: number; source_width?: number | null; source_height?: number | null };
  cluster_id: string | null;
  /** The person's name, if their face cluster has been labelled. */
  label: string | null;
}

/**
 * The faces detected on ONE image (for the image details panel), each resolved
 * to its person's name via the face cluster. Two plain queries (detections, then
 * their clusters' labels) rather than an FK-embed, so it can't break if the
 * embed relationship isn't declared. Empty when the image has no detected faces.
 */
export function useImageFaces(imageId: string | undefined) {
  return useQuery({
    queryKey: ["image-faces", imageId],
    queryFn: async (): Promise<ImageFace[]> => {
      const { data: dets, error } = await supabase
        .from("face_detections" as any)
        .select("id, bounding_box, cluster_id")
        .eq("image_id", imageId!);
      if (error) throw error;
      const rows = (dets as unknown as { id: string; bounding_box: ImageFace["bounding_box"]; cluster_id: string | null }[]) || [];
      const clusterIds = [...new Set(rows.map((r) => r.cluster_id).filter((v): v is string => !!v))];
      let labels: Record<string, string | null> = {};
      if (clusterIds.length > 0) {
        const { data: clusters } = await supabase
          .from("face_clusters" as any)
          .select("id, label")
          .in("id", clusterIds);
        labels = Object.fromEntries(((clusters as unknown as { id: string; label: string | null }[]) || []).map((c) => [c.id, c.label]));
      }
      return rows.map((r) => ({
        id: r.id,
        bounding_box: r.bounding_box,
        cluster_id: r.cluster_id,
        label: r.cluster_id ? labels[r.cluster_id] ?? null : null,
      }));
    },
    enabled: !!imageId,
    staleTime: 30_000,
  });
}

// Separate hook for fetching images of a specific cluster.
export function useFaceClusterImages(clusterId: string | null) {
  return useQuery({
    queryKey: ["face-cluster-images", clusterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_detections" as any)
        .select(`
          id, bounding_box,
          image:gallery_images!image_id (
            id, original_url, filename
          )
        `)
        .eq("cluster_id", clusterId!);
      if (error) throw error;
      return (data as unknown as FaceDetectionWithImage[]) || [];
    },
    enabled: !!clusterId,
  });
}
