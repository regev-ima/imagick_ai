import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useImageProcessing } from "@/hooks/useImageProcessing";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useSubscription } from "@/hooks/useSubscription";
import { getCullingLabels, type LanguageCode } from "@/lib/cullingLabels";

// Shared "create a collection" engine for the design-concept prototypes.
// It mirrors the real CreateGalleryPage local-upload path exactly (gallery
// insert → upload via Uppy → hero → status → upload-complete email → AI
// processing → navigate to the gallery), but takes a plain File[] and the
// form values as params so each concept UI can drive the identical backend.
// Local-upload only (no Google Drive) — that's the core end-to-end flow.

export interface CreateGalleryParams {
  name: string;
  galleryType: string;
  description?: string;
  styleIds: string[];
  categories?: string[];
  aiCulling: boolean;
  cullingLanguage?: LanguageCode;
  files: File[];
}

export function useCreateGalleryFlow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { processImages } = useImageProcessing();
  const { uploadImages, uploadProgress, isUploading } = useImageUpload();
  const { availableEdits, editsReserved, isUnlimited, isFreePlan } = useSubscription();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The user's preferred culling-label language, so curated tags match what
  // they'd see in the real wizard. Defaults to English until loaded.
  const [cullingLanguage, setCullingLanguage] = useState<LanguageCode>("en");
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_subscriptions")
      .select("preferred_language")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.preferred_language) setCullingLanguage(data.preferred_language as LanguageCode);
      });
  }, [user]);

  // Same source + cache key as the real wizard, so styles are shared.
  const { data: styles = [], isLoading: stylesLoading } = useQuery({
    queryKey: ["styles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("styles")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const submit = async (params: CreateGalleryParams): Promise<boolean> => {
    if (!user) {
      toast.error("Please sign in to create a gallery");
      return false;
    }
    if (params.files.length === 0) {
      toast.error("Add at least one photo first");
      return false;
    }

    // When culling is on, the labels that drive the first automatic cull live
    // in culling_labels; fall back to the curated set for the shoot type so
    // toggling culling on still tags sensibly (matches the real wizard).
    const effectiveCullingLabels = params.aiCulling
      ? (params.categories && params.categories.length > 0
          ? params.categories
          : getCullingLabels(params.galleryType || "wedding", params.cullingLanguage ?? "en"))
      : [];

    setIsSubmitting(true);
    try {
      // 1. Create the gallery.
      const { data: gallery, error: galleryError } = await supabase
        .from("galleries")
        .insert({
          user_id: user.id,
          name: params.name,
          gallery_type: params.galleryType,
          description: params.description || null,
          categories: params.categories ?? [],
          culling_labels: effectiveCullingLabels,
          ai_culling_enabled: params.aiCulling,
          total_images: params.files.length,
          status: "uploading",
        })
        .select()
        .single();
      if (galleryError) throw galleryError;

      // 2. Attach selected styles.
      if (params.styleIds.length > 0) {
        await supabase
          .from("galleries")
          .update({ selected_style_ids: params.styleIds })
          .eq("id", gallery.id);
      }

      // 3. Upload images, streaming completed batches into AI processing.
      const streamed = new Set<string>();
      const imageIds = await uploadImages(gallery.id, user.id, params.files, {
        onBatchInserted: (newIds) => {
          if (params.styleIds.length === 0 || newIds.length === 0) return;
          const fresh = newIds.filter((id) => !streamed.has(id));
          if (fresh.length === 0) return;
          fresh.forEach((id) => streamed.add(id));
          (async () => {
            try {
              await supabase
                .from("gallery_images")
                .update({ status: "processing" })
                .in("id", fresh)
                .eq("status", "uploading");
              processImages(gallery.id, fresh, params.styleIds);
            } catch (err) {
              console.error("Streaming processImages batch failed:", err);
            }
          })();
        },
      });

      // 4. Hero image.
      let heroImageUrl: string | null = null;
      if (imageIds.length > 0) {
        const { data: firstImage } = await supabase
          .from("gallery_images")
          .select("original_url")
          .eq("id", imageIds[0])
          .single();
        if (firstImage) {
          heroImageUrl = firstImage.original_url;
          await supabase.from("gallery_images").update({ is_hero: true }).eq("id", imageIds[0]);
        }
      }

      // 5. Gallery hero + status.
      await supabase
        .from("galleries")
        .update({
          hero_image_url: heroImageUrl,
          status: params.styleIds.length > 0 ? "processing" : "ready",
          processed_images: 0,
          total_images: imageIds.length,
        })
        .eq("id", gallery.id);

      // 6. Upload-complete email.
      if (imageIds.length > 0) {
        supabase.functions
          .invoke("send-email", {
            body: {
              type: "gallery_upload_complete",
              galleryName: params.name,
              imageCount: imageIds.length,
              galleryId: gallery.id,
            },
          })
          .catch((err) => console.error("Failed to send upload complete email:", err));
      }

      // 7. Process any IDs not already streamed.
      if (params.styleIds.length > 0 && imageIds.length > 0) {
        const remaining = imageIds.filter((id) => !streamed.has(id));
        if (remaining.length > 0) {
          await supabase
            .from("gallery_images")
            .update({ status: "processing" })
            .in("id", remaining)
            .eq("status", "uploading");
          processImages(gallery.id, remaining, params.styleIds);
        }
        toast.success("Gallery created! Aura is on it...");
      } else {
        await supabase.from("gallery_images").update({ status: "ready" }).in("id", imageIds);
        toast.success("Gallery created successfully!");
      }

      navigate(`/dashboard/galleries/${gallery.id}`);
      return true;
    } catch (error) {
      console.error("Error creating gallery:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create gallery");
      setIsSubmitting(false);
      return false;
    }
  };

  return {
    user,
    styles,
    stylesLoading,
    cullingLanguage,
    uploadProgress,
    isUploading,
    isSubmitting,
    busy: isUploading || isSubmitting,
    availableEdits,
    editsReserved,
    isUnlimited,
    isFreePlan,
    submit,
  };
}
