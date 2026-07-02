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

// Shared "create a collection" engine. Powers the production CreateGalleryPage
// (the live-plan create flow) and the internal design-concept prototypes.
// It runs the real local-upload path (gallery
// insert → upload via Uppy → hero → status → upload-complete email → AI
// processing → navigate to the gallery), and also the Google Drive
// server-transfer path (gallery → transferring → gd-transfer). The import
// source is a small discriminated union so new providers (Dropbox, OneDrive…)
// can be added later without touching the three concept UIs.

// Where the photos come from. "local" = the browser holds the File[] and
// uploads via Uppy. "drive" = the backend pulls them from Google Drive
// folders (no bytes through the browser). Future: add { kind: "dropbox" }, etc.
export type ImportSpec =
  | { kind: "local"; files: File[] }
  | { kind: "drive"; links: string[]; totalImageCount: number; totalSizeMB: number };

export interface CreateGalleryParams {
  name: string;
  galleryType: string;
  description?: string;
  styleIds: string[];
  categories?: string[];
  aiCulling: boolean;
  cullingLanguage?: LanguageCode;
  source: ImportSpec;
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
  const [cullingLanguage, setCullingLang] = useState<LanguageCode>("en");
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_subscriptions")
      .select("preferred_language")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.preferred_language) setCullingLang(data.preferred_language as LanguageCode);
      });
  }, [user]);

  // Change the preferred language and persist it, so the choice sticks for the
  // next collection (mirrors the production wizard's language selector).
  const setCullingLanguage = (lang: LanguageCode) => {
    setCullingLang(lang);
    if (user) {
      supabase
        .from("user_subscriptions")
        .update({ preferred_language: lang })
        .eq("user_id", user.id)
        .then(({ error }) => { if (error) console.error("Failed to save language preference:", error); });
    }
  };

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
    const { source } = params;
    if (source.kind === "local" && source.files.length === 0) {
      toast.error("Add at least one photo first");
      return false;
    }
    if (source.kind === "drive" && source.links.length === 0) {
      toast.error("Add a Google Drive folder first");
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
      // ── Google Drive: server-side transfer (no bytes through the browser) ──
      if (source.kind === "drive") {
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
            // The create flow has ONE culling switch — when it's on, the run
            // includes grouping AND people (faces), so the gallery arrives with
            // the full experience. The backend transfer webhook reads these to
            // auto-start culling when the Drive import lands.
            ai_grouping_enabled: true,
            ai_faces_enabled: params.aiCulling,
            total_images: source.totalImageCount,
            status: "transferring",
          })
          .select()
          .single();
        if (galleryError) throw galleryError;

        const updatePayload: Record<string, unknown> = { source_drive_links: source.links };
        if (params.styleIds.length > 0) updatePayload.selected_style_ids = params.styleIds;
        await supabase.from("galleries").update(updatePayload).eq("id", gallery.id);

        const response = await supabase.functions.invoke("gd-import", {
          body: {
            driveLinks: source.links,
            galleryId: gallery.id,
            styleIds: params.styleIds,
            metadataOnly: false,
            totalImageCount: source.totalImageCount,
            totalSizeMB: source.totalSizeMB,
          },
        });
        if (response.error) throw new Error(response.error.message || "Failed to start transfer");
        if (response.data?.error === "storage_limit_exceeded") {
          throw new Error(response.data.message || "Storage limit exceeded. Upgrade your plan or add storage.");
        }

        toast.success("Import started! Pulling your photos from Google Drive…");
        navigate(`/dashboard/galleries/${gallery.id}`);
        return true;
      }

      // ── Local upload (Uppy) ──
      const files = source.files;
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
          // One culling switch = the full experience (grouping + people).
          ai_grouping_enabled: true,
          ai_faces_enabled: params.aiCulling,
          total_images: files.length,
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
      const imageIds = await uploadImages(gallery.id, user.id, files, {
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

      // 8. Auto-start AI Culling when opted in. Culling reads the ORIGINAL
      // photos (independent of the style editor) so it runs in parallel the
      // moment uploads land — the photographer shouldn't have to open the
      // gallery and press "AI Culling" by hand. Covers local uploads with or
      // without styles (the style-edit webhook only fires for styled
      // galleries; Drive galleries are auto-started by the transfer webhook).
      // We flag the gallery optimistically so the overlay/clock are already up
      // when they navigate in, then dispatch fire-and-forget — process-pipeline
      // self-chains server-side and falls back to originals while thumbnails
      // are still being generated.
      if (params.aiCulling && imageIds.length > 0) {
        try {
          // Admin-configured model + EXIF time gate (platform_settings.culling_config).
          let adminModel: string | undefined;
          let adminTime = 600;
          try {
            const { data: cfgRow } = await supabase
              .from("platform_settings").select("value").eq("key", "culling_config").single();
            if (cfgRow?.value) {
              const cfg = JSON.parse(cfgRow.value);
              if (typeof cfg.model === "string") adminModel = cfg.model;
              if (typeof cfg.timeThreshold === "number") adminTime = cfg.timeThreshold;
            }
          } catch { /* fall back to defaults */ }

          await supabase
            .from("galleries")
            .update({ culling_status: "processing", culling_started_at: new Date().toISOString() } as any)
            .eq("id", gallery.id);

          void supabase.functions.invoke("process-pipeline", {
            body: {
              galleryId: gallery.id,
              options: {
                culling: true,
                tags: true,
                cluster: true,
                faces: true,
                labels: effectiveCullingLabels,
                thresholds: [0.5, 0.7, 0.9],
                timeThreshold: adminTime,
                ...(adminModel ? { model: adminModel } : {}),
                scoreVisionUrl: `${window.location.origin}/api/score-vision`,
              },
            },
          });
        } catch (err) {
          // Non-fatal: the photographer can still start culling from the editor.
          console.error("Auto-culling dispatch failed:", err);
        }
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
    setCullingLanguage,
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
