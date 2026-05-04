import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FaceCluster {
  id: string;
  gallery_id: string;
  face_count: number;
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

export function useFaceSearch(galleryId: string | undefined, isDetectionRunning = false) {
  const queryClient = useQueryClient();

  // Start face search mutation
  const startFaceSearch = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("process-gallery-faces", {
        body: { galleryId },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to start face search");
      }

      return response.data;
    },
    onSuccess: () => {
      toast.success("Face detection started");
      // Start polling gallery status
      queryClient.invalidateQueries({ queryKey: ["gallery", galleryId] });
    },
    onError: (error: Error) => {
      toast.error(`Face detection failed: ${error.message}`);
    },
  });

  // Poll detection count during processing for progress indication
  const faceSearchProgress = useQuery({
    queryKey: ["face-search-progress", galleryId],
    queryFn: async () => {
      // Count total face_detections rows — each image may have multiple faces,
      // but row count still shows progress is happening
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

  // Fetch face clusters for the gallery
  const faceClusters = useQuery({
    queryKey: ["face-clusters", galleryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_clusters" as any)
        .select(`
          id, gallery_id, face_count, representative_bbox, created_at,
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
  });

  // Reset face search — delete all face data and reset gallery status
  const resetFaceSearch = useMutation({
    mutationFn: async () => {
      const { error: delDetections } = await supabase
        .from("face_detections" as any)
        .delete()
        .eq("gallery_id", galleryId!);
      if (delDetections) throw delDetections;

      const { error: delClusters } = await supabase
        .from("face_clusters" as any)
        .delete()
        .eq("gallery_id", galleryId!);
      if (delClusters) throw delClusters;

      const { error: updateError } = await supabase
        .from("galleries")
        .update({
          face_search_status: "idle",
          face_search_started_at: null,
          face_search_completed_at: null,
          face_search_error: null,
        } as any)
        .eq("id", galleryId!);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Face search data cleared");
      queryClient.invalidateQueries({ queryKey: ["face-clusters", galleryId] });
      queryClient.invalidateQueries({ queryKey: ["gallery", galleryId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reset: ${error.message}`);
    },
  });

  return {
    startFaceSearch,
    faceClusters,
    resetFaceSearch,
    faceSearchProgress,
  };
}

// Separate hook for fetching images of a specific cluster
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
