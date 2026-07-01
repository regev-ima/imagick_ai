import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Rows3,
  Grid3X3,
  Download,
  Trash2,
  Star,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Loader2,
  Images,
  ImageIcon,
  RotateCcw,
  Info,
  Eye,
  ArrowUpDown,
  CheckSquare,
  MoreHorizontal,
  AlertTriangle,
  Settings2,
  Tag,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cullingScoreToStars } from "@/lib/cullingScore";
import { useCullingScoreMode } from "@/hooks/useCullingScoreMode";
import { CullingScoreModeToggle } from "@/components/gallery/CullingScoreModeToggle";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ReEditModal } from "@/components/gallery/ReEditModal";
import { AddImagesModal } from "@/components/gallery/AddImagesModal";
import { ImageDetailsPanel } from "@/components/gallery/ImageDetailsPanel";
import { AICullingModal } from "@/components/gallery/AICullingModal";
import { GallerySettingsModal } from "@/components/gallery/GallerySettingsModal";
import { FilterOptions, defaultFilters } from "@/components/gallery/filter-types";
import { ShareGalleryModal } from "@/components/gallery/ShareGalleryModal";
import { DeliveryModal } from "@/components/gallery/DeliveryModal";
import { StyleComparison } from "@/components/gallery/StyleSelector";
import { ImageCard } from "@/components/gallery/ImageCard";
import { FailedImagesProvider } from "@/components/gallery/FailedImagesContext";
import { ProblemImagesSection } from "@/components/gallery/ProblemImagesSection";
import { VirtualizedImageGrid } from "@/components/gallery/VirtualizedImageGrid";
import { CullingStatusBanner } from "@/components/gallery/CullingStatusBanner";
import { CullingProgressOverlay } from "@/components/gallery/CullingProgressOverlay";
import { type CatalogMode } from "@/components/gallery/CatalogModeSelector";
import { FaceGallery } from "@/components/gallery/FaceGallery";
import { FaceClusterImages } from "@/components/gallery/FaceClusterImages";
import { useFaceSearch } from "@/hooks/useFaceSearch";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { GalleryRightSidebar } from "@/components/gallery/GalleryRightSidebar";
import { DownloadGalleryModal } from "@/components/gallery/DownloadGalleryModal";
import { DockFilmstrip } from "@/components/gallery/DockFilmstrip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffectiveUser } from "@/hooks/useImpersonation";
import { useImageProcessing } from "@/hooks/useImageProcessing";
import { getThumbnailUrl, getPreviewUrl, getEditedThumbnailUrl, getEditedPreviewUrl } from "@/lib/imageUrls";
import { stuckThresholdMs } from "@/lib/cullingEta";
import { useJustifiedLayout } from "@/hooks/useJustifiedLayout";
import { useImageDimensions } from "@/hooks/useImageDimensions";
import { useUserRole } from "@/hooks/useUserRole";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Orb } from "@/components/aura/Orb";

/** The AI mark — 4-point sparkle (logo star). Inherits currentColor. */
function Sparkle({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function GalleryEditorPage() {
  const { id } = useParams();
  const { effectiveUserId } = useEffectiveUser();
  const isMobile = useIsMobile();
  const { canViewAnalytics } = useUserRole();
  const queryClient = useQueryClient();
  const { mode: cullingScoreMode } = useCullingScoreMode();
   const {
     isUploading,
     isProcessing,
     uploadProgress,
     uploadAndProcessImages,
     reEditImages,
     processImages
   } = useImageProcessing();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "masonry">(
    () => (localStorage.getItem("imagick-gallery-view-mode") as "grid" | "masonry") || "grid"
  );
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<"slider" | "edited" | "side-by-side">(
    () => (localStorage.getItem("imagick-gallery-compare-mode") as "slider" | "edited" | "side-by-side") || "slider"
  );
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showReEditModal, setShowReEditModal] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [holdingOriginal, setHoldingOriginal] = useState(false);
  const [detailsImageId, setDetailsImageId] = useState<string | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showAICullingModal, setShowAICullingModal] = useState(false);
  const [cullingRequiredNote, setCullingRequiredNote] = useState(false);
  // When true the user has tucked the "AI is working" overlay away to
  // keep editing; the run continues and the banner offers to reopen it.
  const [cullingProgressMinimized, setCullingProgressMinimized] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddImagesModal, setShowAddImagesModal] = useState(false);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
  const [selectedViewStyle, setSelectedViewStyle] = useState<string>("original");
  const [catalogMode, setCatalogMode] = useState<CatalogMode>("default");
  const [transferProgress, setTransferProgress] = useState<{ current: number; total: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const LOAD_MORE_THRESHOLD = 400; // pixels from bottom - increased for faster pre-fetch
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [processingStalled, setProcessingStalled] = useState(false);
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const stallCheckRef = useRef<{ lastReady: number; unchangedCount: number }>({ lastReady: -1, unchangedCount: 0 });
  const autoRetryCountRef = useRef(0);
  // activeCullingFilter removed - now using multi-select ratings in filters.selectedRatings
  const [sidebarSimilarityLevel, setSidebarSimilarityLevel] = useState<"loose" | "medium" | "strict">("medium");
  const [detailsSimilarityLevel, setDetailsSimilarityLevel] = useState<"loose" | "medium" | "strict">("medium");
  const [duplicateLimit, setDuplicateLimit] = useState(0);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedFaceCluster, setSelectedFaceCluster] = useState<string | null>(null);
  const [pendingReEdit, setPendingReEdit] = useState<{ imageIds: string[]; styleIds: string[] } | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState<string | null>(null);

  // Reset the bulk-delete confirm whenever the selection changes so a
  // stale "Trash N?" prompt can never fire against a different set.
  useEffect(() => { setConfirmBulkDelete(false); }, [selectedImages]);

  // Persist view preferences to localStorage
  useEffect(() => { localStorage.setItem("imagick-gallery-view-mode", viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem("imagick-gallery-compare-mode", compareMode); }, [compareMode]);

  // Measure container width for justified layout
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    // Set initial width immediately so justified layout computes on first render
    setContainerWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch gallery data with ownership verification
  // Refetch every 5 seconds when processing, culling, or transferring
  const { data: gallery, isLoading: galleryLoading } = useQuery({
    queryKey: ["gallery", id, effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;
      
      const { data, error } = await supabase
        .from("galleries")
        .select("*")
        .eq("id", id)
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!effectiveUserId,
    refetchInterval: (query) => {
      // Poll every 5 seconds while processing, culling, or transferring
      const data = query.state.data;
      return data?.status === "processing" || data?.status === "transferring" || data?.culling_status === "processing" || (data as any)?.face_search_status === "processing" ? 5000 : false;
    }
  });

  // Face search hooks
  const { startDetection, isRunning: isFaceDetectionRunning, progress: faceDetectionProgress, abort: abortFaceDetection } = useFaceDetection(id);
  const { faceClusters, resetFaceSearch } = useFaceSearch(id, isFaceDetectionRunning);
  const faceSearchStatus = (gallery as any)?.face_search_status || "idle";
  const faceSearchError = (gallery as any)?.face_search_error || null;
  const faceSearchStartedAt = (gallery as any)?.face_search_started_at || null;

  // Refresh clusters when client-side detection completes
  useEffect(() => {
    if (faceDetectionProgress?.phase === "done") {
      queryClient.invalidateQueries({ queryKey: ["face-clusters", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery", id] });
    }
  }, [faceDetectionProgress?.phase]);

  // Poll for transfer progress when gallery is in transferring status
  useEffect(() => {
    if (!gallery || gallery.status !== "transferring" || !effectiveUserId) {
      setTransferProgress(null);
      return;
    }

    const folder = `galleries/${effectiveUserId}/${gallery.id}/`;
    const expectedTotal = gallery.total_images || 0;

    const pollProgress = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("count-files", {
          body: { folder },
        });

        if (!error && data?.success) {
          setTransferProgress({
            current: data.fileCount,
            total: expectedTotal,
          });
        }
      } catch (err) {
        console.error("Error polling transfer progress:", err);
      }
    };

    // Initial poll
    pollProgress();

    // Poll every 10 seconds to reduce load on external API
    const interval = setInterval(pollProgress, 10000);

    return () => clearInterval(interval);
  }, [gallery?.id, gallery?.status, gallery?.total_images, effectiveUserId]);

  // Fetch gallery images (excluding soft-deleted) - paginated to support >1000 images
  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ["gallery-images", id],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;

      // Trim the SELECT to columns the editor actually renders. The
      // gallery_images table has 30+ cols (full EXIF, sharpness scores,
      // ai_tags etc.) — most aren't needed for the grid. Cutting the
      // row size by ~3x roughly cuts time-to-first-paint by ~3x for
      // 3000-photo galleries.
      //
      // IMPORTANT: every name in this list must EXIST on the table.
      // PR #60 included `processing_completed_at` here by mistake
      // (that column lives on `galleries`, not `gallery_images`),
      // which caused the entire SELECT to fail and the gallery to
      // render as "No images yet" even with 1700+ rows present.
      const GALLERY_COLS = [
        "id",
        "filename",
        "original_url",
        "edited_url",
        "thumbnail_url",
        "status",
        "is_hero",
        "is_liked",
        "ai_rating",
        "culling_score",
        "culling_label",
        "subject_sharpness",
        "background_sharpness",
        "thirds_rule",
        "intended_facial_expression",
        "width",
        "height",
        "sort_order",
        "file_size_bytes",
        "last_processing_attempt_at",
        "processing_attempts",
        "last_processing_error",
        "deleted_at",
        "similarity_group_1",
        "similarity_group_2",
        "similarity_group_3",
      ].join(", ");

      while (true) {
        const { data, error } = await supabase
          .from("gallery_images")
          .select(GALLERY_COLS)
          .eq("gallery_id", id)
          .neq("status", "deleted")
          .order("sort_order", { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
          .limit(PAGE_SIZE);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      
      return allData;
    },
    enabled: !!id,
    refetchInterval: gallery?.status === "processing" || gallery?.culling_status === "processing" ? 5000 : false
  });

  // Fetch trashed images
  const { data: trashedImages = [] } = useQuery({
    queryKey: ["gallery-trash", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("id, filename, original_url, deleted_at, file_size_bytes")
        .eq("gallery_id", id)
        .eq("status", "deleted")
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Calculate processing progress - use gallery.total_images as source of truth
  const processingStats = useMemo(() => {
    const total = Math.max(images.length, gallery?.total_images || 0);
    const ready = images.filter(img => img.status === "ready").length;
    const processing = images.filter(img => img.status === "processing" || img.status === "uploading").length;
    const error = images.filter(img => img.status === "error").length;
    const percentage = total > 0 ? Math.round((ready / total) * 100) : 0;

    return { total, ready, processing, error, percentage };
  }, [images, gallery?.total_images]);

  // Clear skeleton placeholders once new images appear in the query
  const prevImageCountRef = useRef(images.length);
  useEffect(() => {
    if (pendingUploadCount > 0 && images.length > prevImageCountRef.current) {
      setPendingUploadCount(0);
    }
    prevImageCountRef.current = images.length;
  }, [images.length, pendingUploadCount]);

  // Detect stalled processing - if ready count doesn't change for 240 consecutive checks (20 min at 5s interval)
  // Auto-retry up to 2 times, then fall back to manual retry button
  useEffect(() => {
    if (gallery?.status !== "processing") {
      setProcessingStalled(false);
      setIsAutoRetrying(false);
      stallCheckRef.current = { lastReady: -1, unchangedCount: 0 };
      autoRetryCountRef.current = 0;
      return;
    }
    const ref = stallCheckRef.current;
    if (ref.lastReady === -1) {
      ref.lastReady = processingStats.ready;
      return;
    }
    if (processingStats.ready === ref.lastReady) {
      ref.unchangedCount++;
      if (ref.unchangedCount >= 240) {
        if (autoRetryCountRef.current < 2) {
          // Auto-retry
          setIsAutoRetrying(true);
          autoRetryCountRef.current++;
          stallCheckRef.current = { lastReady: -1, unchangedCount: 0 };
          const stuckImages = images.filter(img => img.status === "uploading" || img.status === "processing");
          if (stuckImages.length > 0) {
            const stuckIds = stuckImages.map((img: any) => img.id);
            toast.info(`Auto-retrying ${stuckIds.length} stuck image${stuckIds.length > 1 ? "s" : ""}... (attempt ${autoRetryCountRef.current}/2)`);
            supabase
              .from("gallery_images")
              .update({ status: "processing", processing_attempts: 0, last_processing_error: null })
              .in("id", stuckIds)
              .then(() => {
                if (id && gallery?.selected_style_ids?.length) {
                  processImages(id, stuckIds, gallery.selected_style_ids);
                  queryClient.invalidateQueries({ queryKey: ["gallery-images", id] });
                }
                setIsAutoRetrying(false);
              });
          } else {
            setIsAutoRetrying(false);
          }
        } else {
          // Exhausted auto-retries — show manual button
          setProcessingStalled(true);
        }
      }
    } else {
      ref.unchangedCount = 0;
      ref.lastReady = processingStats.ready;
      setProcessingStalled(false);
      setIsAutoRetrying(false);
    }
  }, [gallery?.status, processingStats.ready, images, id, gallery?.selected_style_ids, processImages, queryClient]);

  const retryStuckImages = useCallback(async () => {
    if (!id || !gallery?.selected_style_ids?.length) return;
    const stuckImages = images.filter(img => img.status === "uploading" || img.status === "processing");
    if (stuckImages.length === 0) {
      toast.info("No stuck images found");
      return;
    }
    const stuckIds = stuckImages.map(img => img.id);
    // Reset stuck images to "processing" with cleared attempts
    await supabase
      .from("gallery_images")
      .update({ status: "processing", processing_attempts: 0, last_processing_error: null })
      .in("id", stuckIds);
    toast.info(`Retrying ${stuckIds.length} stuck images...`);
    setProcessingStalled(false);
    stallCheckRef.current = { lastReady: -1, unchangedCount: 0 };
    processImages(id, stuckIds, gallery.selected_style_ids);
    queryClient.invalidateQueries({ queryKey: ["gallery-images", id] });
  }, [id, gallery?.selected_style_ids, images, processImages, queryClient]);

  const { data: styles = [] } = useQuery({
    queryKey: ["styles-for-edit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("styles")
        .select("id, name, thumbnail_url, category")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch gallery styles (styles already applied to this gallery) with their names
  const { data: galleryStylesData = [] } = useQuery({
    queryKey: ["gallery-styles-full", id, gallery?.selected_style_ids],
    queryFn: async () => {
      if (!gallery?.selected_style_ids || gallery.selected_style_ids.length === 0) return [];
      
      const { data, error } = await supabase
        .from("styles")
        .select("id, name, style_id_external, after_image_urls")
        .in("id", gallery.selected_style_ids);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!gallery && (gallery.selected_style_ids?.length ?? 0) > 0
  });

  // Fetch image_edits for this gallery to know which images have edits for which styles
  // Paginated to support >1000 edits (Supabase default limit)
  const { data: galleryImageEdits = [] } = useQuery({
    queryKey: ["gallery-image-edits", id],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      
      while (true) {
        const { data, error } = await supabase
          .from("image_edits")
          .select("image_id, style_id, created_at")
          .eq("gallery_id", id!)
          .range(from, from + PAGE_SIZE - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      
      return allData;
    },
    enabled: !!id,
    refetchInterval: gallery?.status === "processing" ? 5000 : false
  });

  // Build a set of image IDs that have edits for each style
  const imageIdsByStyle = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    galleryImageEdits.forEach((edit) => {
      if (edit.style_id) {
        if (!map[edit.style_id]) map[edit.style_id] = new Set();
        map[edit.style_id].add(edit.image_id);
      }
    });
    return map;
  }, [galleryImageEdits]);

  // Auto-clear pendingReEdit when all expected edits have arrived
  useEffect(() => {
    if (!pendingReEdit) return;
    const allDone = pendingReEdit.imageIds.every(imgId =>
      pendingReEdit.styleIds.every(styleId =>
        imageIdsByStyle[styleId]?.has(imgId)
      )
    );
    if (allDone) setPendingReEdit(null);
  }, [pendingReEdit, imageIdsByStyle]);

  const styleApiIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    galleryStylesData.forEach((style) => {
      // Use style_id_external if available, otherwise use "1" as fallback
      map[style.id] = style.style_id_external || "1";
    });
    return map;
  }, [galleryStylesData]);

  // Keep the old galleryStyles array for backwards compatibility
  const galleryStyles = useMemo(() => {
    return galleryStylesData.map((s) => s.id);
  }, [galleryStylesData]);

  // Extract all available tags from images
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    images.forEach(img => {
      if (img.ai_tags) {
        img.ai_tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [images]);

  // Extract available labels from images (for AI Insights panel)
  const availableLabels = useMemo(() => {
    const labelMap = new Map<string, number>();
    images.forEach(img => {
      const raw = (img as any).culling_label;
      if (!raw || raw === "N/A" || raw === "none") return;
      const label = raw.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      labelMap.set(label, (labelMap.get(label) || 0) + 1);
    });
    return Array.from(labelMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [images]);

  // Gallery timing data for info panel
  const galleryTimingData = useMemo(() => {
    if (!gallery) return undefined;
    return {
      createdAt: gallery.created_at,
      uploadStartedAt: gallery.upload_started_at,
      uploadCompletedAt: gallery.upload_completed_at,
      processingStartedAt: gallery.processing_started_at,
      processingCompletedAt: gallery.processing_completed_at,
      cullingStartedAt: gallery.culling_started_at,
      cullingCompletedAt: gallery.culling_completed_at,
      sourceType: (gallery.source_drive_links && gallery.source_drive_links.length > 0 ? "google" : "upload") as "google" | "upload",
      totalImages: gallery.total_images || 0,
    };
  }, [gallery]);

  // Apply filters and sorting to images
  const filteredImages = useMemo(() => {
    let result = [...images];

    // Apply star rating filters (multi-select)
    if (filters.selectedRatings.length > 0) {
      result = result.filter(img => {
        const sr = cullingScoreToStars((img as any).culling_score, cullingScoreMode) || (img.ai_rating || 0);
        return filters.selectedRatings.includes(sr);
      });
    } else if (filters.minRating > 0) {
      result = result.filter(img => {
        const sr = cullingScoreToStars((img as any).culling_score, cullingScoreMode) || (img.ai_rating || 0);
        return sr >= filters.minRating;
      });
    }

    // Apply label filter
    if (filters.selectedLabels && filters.selectedLabels.length > 0) {
      result = result.filter(img => {
        const raw = (img as any).culling_label;
        if (!raw || raw === "N/A" || raw === "none") return false;
        const label = raw.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        return filters.selectedLabels.includes(label);
      });
    }

    if (filters.showLikedOnly) {
      result = result.filter(img => img.is_liked);
    }

    if (filters.showHeroOnly) {
      result = result.filter(img => img.is_hero);
    }

    if (filters.selectedTags.length > 0) {
      result = result.filter(img => {
        if (!img.ai_tags) return false;
        return filters.selectedTags.some(tag => img.ai_tags?.includes(tag));
      });
    }

    // Apply grouping filter
    if (filters.groupingLevel !== "none" && filters.selectedGroup !== null) {
      result = result.filter(img => {
        const imgAny = img as any;
        switch (filters.groupingLevel) {
          case "loose": return imgAny.similarity_group_1 === filters.selectedGroup;
          case "medium": return imgAny.similarity_group_2 === filters.selectedGroup;
          case "strict": return imgAny.similarity_group_3 === filters.selectedGroup;
          default: return true;
        }
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case "date":
        case "date_taken": {
          const aDate = (a as any).taken_at ? new Date((a as any).taken_at).getTime() : new Date(a.created_at).getTime();
          const bDate = (b as any).taken_at ? new Date((b as any).taken_at).getTime() : new Date(b.created_at).getTime();
          comparison = aDate - bDate;
          break;
        }
        case "date_added": {
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        }
        case "name":
          comparison = a.filename.localeCompare(b.filename);
          break;
        case "rating": {
          const aScore = cullingScoreToStars((a as any).culling_score, cullingScoreMode) || (a.ai_rating || 0);
          const bScore = cullingScoreToStars((b as any).culling_score, cullingScoreMode) || (b.ai_rating || 0);
          comparison = aScore - bScore;
          break;
        }
        case "size": {
          const aSize = (a as any).file_size_bytes || 0;
          const bSize = (b as any).file_size_bytes || 0;
          comparison = aSize - bSize;
          break;
        }
      }

      return filters.sortOrder === "asc" ? comparison : -comparison;
    });

    // Apply duplicate limiting
    if (duplicateLimit > 0) {
      const groupField = sidebarSimilarityLevel === "loose" ? "similarity_group_1"
                       : sidebarSimilarityLevel === "strict" ? "similarity_group_3"
                       : "similarity_group_2";

      const groups = new Map<number, typeof result>();
      const ungrouped: typeof result = [];

      for (const img of result) {
        const groupId = (img as any)[groupField];
        if (groupId == null) {
          ungrouped.push(img);
        } else {
          if (!groups.has(groupId)) groups.set(groupId, []);
          groups.get(groupId)!.push(img);
        }
      }

      const limited: typeof result = [...ungrouped];
      for (const members of groups.values()) {
        members.sort((a, b) => ((b as any).culling_score || 0) - ((a as any).culling_score || 0));
        limited.push(...members.slice(0, duplicateLimit));
      }

      result = limited;

      // Re-apply sort after limiting
      result.sort((a, b) => {
        let comparison = 0;
        switch (filters.sortBy) {
          case "date":
          case "date_taken": {
            const aD = (a as any).taken_at ? new Date((a as any).taken_at).getTime() : new Date(a.created_at).getTime();
            const bD = (b as any).taken_at ? new Date((b as any).taken_at).getTime() : new Date(b.created_at).getTime();
            comparison = aD - bD;
            break;
          }
          case "date_added": {
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
          }
          case "name":
            comparison = a.filename.localeCompare(b.filename);
            break;
          case "rating": {
            const aS = cullingScoreToStars((a as any).culling_score, cullingScoreMode) || (a.ai_rating || 0);
            const bS = cullingScoreToStars((b as any).culling_score, cullingScoreMode) || (b.ai_rating || 0);
            comparison = aS - bS;
            break;
          }
          case "size": {
            const aSize = (a as any).file_size_bytes || 0;
            const bSize = (b as any).file_size_bytes || 0;
            comparison = aSize - bSize;
            break;
          }
        }
        return filters.sortOrder === "asc" ? comparison : -comparison;
      });
    }

    // When viewing a specific style, only show images that have an edit for that style
    // Also include pending re-edit images that don't have edits yet
    if (selectedViewStyle !== "original") {
      const editedImageIds = imageIdsByStyle[selectedViewStyle];
      const isPendingStyle = pendingReEdit?.styleIds.includes(selectedViewStyle);
      const pendingImageIds = isPendingStyle ? new Set(pendingReEdit!.imageIds) : new Set<string>();
      
      if (editedImageIds || pendingImageIds.size > 0) {
        result = result.filter(img => editedImageIds?.has(img.id) || pendingImageIds.has(img.id));
      } else {
        result = []; // No edits for this style yet
      }
    }

    return result;
  }, [images, filters, duplicateLimit, sidebarSimilarityLevel, selectedViewStyle, imageIdsByStyle, pendingReEdit]);

  // Infinite scroll - load more images when scrolling near bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < LOAD_MORE_THRESHOLD) {
        setVisibleCount(prev => Math.min(prev + 50, filteredImages.length));
      }
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [filteredImages.length]);

  // Auto-load more when content doesn't fill scroll container (e.g. masonry with short rows)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Wait a frame for layout to settle
    const raf = requestAnimationFrame(() => {
      if (
        container.scrollHeight <= container.clientHeight &&
        visibleCount < filteredImages.length
      ) {
        setVisibleCount(prev => Math.min(prev + 50, filteredImages.length));
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [visibleCount, filteredImages.length]);

  // Reset visible count when filters or catalog mode changes
  useEffect(() => {
    setVisibleCount(50);
  }, [filters, catalogMode]);

  // Get visible images for rendering (infinite scroll)
  const visibleImages = useMemo(() => {
    return filteredImages.slice(0, visibleCount);
  }, [filteredImages, visibleCount]);

  // Detect real image dimensions from thumbnails (for images missing width/height)
  const getUrlForDimensions = useCallback((originalUrl: string) => {
    return getThumbnailUrl(originalUrl);
  }, []);
  const detectedDimensions = useImageDimensions(visibleImages, getUrlForDimensions);

  // Enrich images with detected dimensions for justified layout
  const enrichedImages = useMemo(() => {
    return visibleImages.map((img) => {
      if (img.width && img.height) return img;
      const detected = detectedDimensions.get(img.id);
      if (detected) return { ...img, width: detected.width, height: detected.height };
      return img;
    });
  }, [visibleImages, detectedDimensions]);

  // Justified layout for visible images (default/flat view)
  const justifiedSizes = useJustifiedLayout(
    viewMode === "masonry" ? enrichedImages : [],
    containerWidth,
    160,
    2
  );

  // Check if any filters are active (excludes sorting - sorting is not a filter)
  const hasActiveFilters = useMemo(() => {
    return (
      filters.minRating > 0 ||
      filters.selectedRatings.length > 0 ||
      filters.selectedTags.length > 0 ||
      (filters.selectedLabels?.length || 0) > 0 ||
      filters.showLikedOnly ||
      filters.showHeroOnly ||
      filters.groupingLevel !== "none" ||
      filters.selectedGroup !== null
    );
  }, [filters]);

  // Extract available groups from images
  const availableGroups = useMemo(() => {
    const looseGroups = new Set<number>();
    const mediumGroups = new Set<number>();
    const strictGroups = new Set<number>();
    
    images.forEach(img => {
      const imgAny = img as any;
      if (imgAny.similarity_group_1 !== null && imgAny.similarity_group_1 !== undefined) {
        looseGroups.add(imgAny.similarity_group_1);
      }
      if (imgAny.similarity_group_2 !== null && imgAny.similarity_group_2 !== undefined) {
        mediumGroups.add(imgAny.similarity_group_2);
      }
      if (imgAny.similarity_group_3 !== null && imgAny.similarity_group_3 !== undefined) {
        strictGroups.add(imgAny.similarity_group_3);
      }
    });
    
    return {
      loose: Array.from(looseGroups).sort((a, b) => a - b),
      medium: Array.from(mediumGroups).sort((a, b) => a - b),
      strict: Array.from(strictGroups).sort((a, b) => a - b),
    };
  }, [images]);

  // Check if we have culling data
  const hasCullingData = useMemo(() => {
    return images.some(img => (img as any).culling_score !== null && (img as any).culling_score !== undefined);
  }, [images]);

  // A small representative strip of original thumbnails for the AI
  // Culling progress overlay to "scan". We only need a handful; sampling
  // evenly across the gallery keeps the preview varied for big shoots.
  const cullingPreviewThumbnails = useMemo(() => {
    const ready = images.filter(img => img.status === "ready" || img.original_url);
    const source = ready.length > 0 ? ready : images;
    if (source.length === 0) return [];
    const want = 7;
    const step = Math.max(1, Math.floor(source.length / want));
    const picked: string[] = [];
    for (let i = 0; i < source.length && picked.length < want; i += step) {
      picked.push(getThumbnailUrl(source[i].original_url));
    }
    return picked;
  }, [images]);

  // Count images per star rating for sidebar
  const cullingCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    images.forEach(img => {
      const rating = cullingScoreToStars((img as any).culling_score, cullingScoreMode);
      counts[rating || 1]++;
    });
    return counts;
  }, [images]);

  // Group counts for sidebar
  const sidebarGroupCounts = useMemo(() => {
    const loose = new Set<number>();
    const medium = new Set<number>();
    const strict = new Set<number>();
    images.forEach(img => {
      const a = img as any;
      if (a.similarity_group_1 != null) loose.add(a.similarity_group_1);
      if (a.similarity_group_2 != null) medium.add(a.similarity_group_2);
      if (a.similarity_group_3 != null) strict.add(a.similarity_group_3);
    });
    return { loose: loose.size, medium: medium.size, strict: strict.size };
  }, [images]);

  const getSimilarImages = useCallback((imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (!image) return [];
    
    const groupField = detailsSimilarityLevel === "loose" ? "similarity_group_1"
                     : detailsSimilarityLevel === "strict" ? "similarity_group_3"
                     : "similarity_group_2";
    
    const groupId = (image as any)[groupField];
    if (groupId === null || groupId === undefined) return [];
    
    return images
      .filter(img => (img as any)[groupField] === groupId)
      .map(img => ({
        id: img.id,
        original_url: img.original_url,
        culling_score: (img as any).culling_score ?? null
      }))
      .sort((a, b) => (b.culling_score ?? 0) - (a.culling_score ?? 0));
  }, [images, detailsSimilarityLevel]);

  /**
   * Get the correct thumbnail URL for an image based on selected style
   */
  const getImageThumbnail = useCallback((image: typeof images[0]) => {
    if (selectedViewStyle === "original") {
      return getThumbnailUrl(image.original_url);
    }
    // Get the API ID for the selected style
    const apiId = styleApiIdMap[selectedViewStyle] || "1";
    return getEditedThumbnailUrl(image.original_url, apiId);
  }, [selectedViewStyle, styleApiIdMap]);

  /**
   * Get the correct preview URL for an image based on selected style
   */
  const getImagePreview = useCallback((image: typeof images[0]) => {
    if (selectedViewStyle === "original") {
      return getPreviewUrl(image.original_url);
    }
    // Get the API ID for the selected style
    const apiId = styleApiIdMap[selectedViewStyle] || "1";
    return getEditedPreviewUrl(image.original_url, apiId);
  }, [selectedViewStyle, styleApiIdMap]);

  // Soft delete images mutation (set status to "deleted")
  const softDeleteImages = useMutation({
    mutationFn: async (imageIds: string[]) => {
      const { error } = await supabase
        .from("gallery_images")
        .update({ status: "deleted", deleted_at: new Date().toISOString() })
        .in("id", imageIds);

      if (error) throw error;
    },
    onSuccess: (_, imageIds) => {
      queryClient.invalidateQueries({ queryKey: ["gallery-images", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery-trash", id] });
      setSelectedImages([]);
      setShowTrash(true);
      toast.success(`${imageIds.length === 1 ? "Image" : "Images"} moved to trash`, {
        description: "Will be permanently deleted after 30 days",
      });
    },
    onError: () => {
      toast.error("Failed to delete images. Please try again.");
    }
  });

  // Restore images from trash
  const restoreImages = useMutation({
    mutationFn: async (imageIds: string[]) => {
      const { error } = await supabase
        .from("gallery_images")
        .update({ status: "ready", deleted_at: null })
        .in("id", imageIds);

      if (error) throw error;
    },
    onSuccess: (_, imageIds) => {
      queryClient.invalidateQueries({ queryKey: ["gallery-images", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery-trash", id] });
      setSelectedImages([]);
      toast.success(`${imageIds.length === 1 ? "Image" : "Images"} restored`);
    },
    onError: () => {
      toast.error("Failed to restore images.");
    }
  });

  // Permanently delete images (hard delete)
  const permanentlyDeleteImages = useMutation({
    mutationFn: async (imageIds: string[]) => {
      const { error } = await supabase
        .from("gallery_images")
        .delete()
        .in("id", imageIds);

      if (error) throw error;
    },
    onSuccess: (_, imageIds) => {
      queryClient.invalidateQueries({ queryKey: ["gallery-images", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery-trash", id] });
      setSelectedImages([]);
      toast.success(`${imageIds.length === 1 ? "Image" : "Images"} permanently deleted`);
    },
    onError: () => {
      toast.error("Failed to permanently delete images.");
    }
  });

  // Delete a specific style edit for an image
  const deleteImageEdit = useMutation({
    mutationFn: async ({ imageId, styleId }: { imageId: string; styleId: string }) => {
      if (styleId === "__all__") {
        // Delete ALL edits for this image
        const { error } = await supabase
          .from("image_edits")
          .delete()
          .eq("image_id", imageId);
        if (error) throw error;
        // Clear edited_url
        const { error: updateErr } = await supabase
          .from("gallery_images")
          .update({ edited_url: null })
          .eq("id", imageId);
        if (updateErr) throw updateErr;
      } else {
        // Delete single style edit
        const { error } = await supabase
          .from("image_edits")
          .delete()
          .eq("image_id", imageId)
          .eq("style_id", styleId);
        if (error) throw error;

        // Check if this image has any remaining edits
        const { data: remaining, error: countErr } = await supabase
          .from("image_edits")
          .select("id")
          .eq("image_id", imageId)
          .limit(1);
        if (countErr) throw countErr;

        // If no edits remain, clear edited_url on gallery_images
        if (!remaining || remaining.length === 0) {
          const { error: updateErr } = await supabase
            .from("gallery_images")
            .update({ edited_url: null })
            .eq("id", imageId);
          if (updateErr) throw updateErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-images", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery-image-edits", id] });
      setSelectedViewStyle("original");
      toast.success("Edit deleted");
    },
    onError: () => {
      toast.error("Failed to delete edit");
    }
  });

  // Update category (culling_label) mutation
  const updateImageCategory = useMutation({
    mutationFn: async ({ imageIds, label }: { imageIds: string[]; label: string }) => {
      const { error } = await supabase
        .from("gallery_images")
        .update({ culling_label: label })
        .in("id", imageIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-images", id] });
      setSelectedImages([]);
      toast.success("Category updated");
    },
    onError: () => {
      toast.error("Failed to update category");
    }
  });

  // Set hero image mutation
  const setHeroImage = useMutation({
    mutationFn: async (imageId: string) => {
      const image = images.find(img => img.id === imageId);
      if (!image) return;

      await supabase
        .from("gallery_images")
        .update({ is_hero: false })
        .eq("gallery_id", id);

      await supabase
        .from("gallery_images")
        .update({ is_hero: true })
        .eq("id", imageId);

      await supabase
        .from("galleries")
        .update({ hero_image_url: image.original_url })
        .eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-images", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery", id] });
      setSelectedImages([]);
      toast.success("Hero image updated");
    },
    onError: () => {
      toast.error("Failed to update hero image. Please try again.");
    }
  });

  // Toggle like mutation
  const toggleLike = useMutation({
    mutationFn: async (imageId: string) => {
      const image = images.find(img => img.id === imageId);
      if (!image) return;

      await supabase
        .from("gallery_images")
        .update({ is_liked: !image.is_liked })
        .eq("id", imageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-images", id] });
    },
    onError: () => {
      toast.error("Failed to update. Please try again.");
    }
  });

  // Once a run is no longer processing, clear the "minimized" flag so the
  // next run (this tab, another tab, or after a stuck retry) surfaces its
  // overlay automatically instead of staying hidden.
  useEffect(() => {
    if (gallery?.culling_status !== "processing") setCullingProgressMinimized(false);
  }, [gallery?.culling_status]);

  // Heartbeat while culling is running so the "stuck" check and the
  // overlay countdown stay live. React Query's structural sharing keeps
  // the gallery row reference stable across the 5s polls, so without our
  // own clock the time-based memo below would never re-evaluate and a
  // run could neither cross into "stuck" nor count down.
  const [cullingNow, setCullingNow] = useState(() => Date.now());
  useEffect(() => {
    if (gallery?.culling_status !== "processing") return;
    const t = setInterval(() => setCullingNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, [gallery?.culling_status]);

  // Detect stuck culling — the threshold is the full expected window
  // (5 min + 10s/photo, see lib/cullingEta.ts), so a large gallery is
  // never called "stuck" before its realistic completion window closes.
  //
  // Two states we explicitly DON'T treat as stuck:
  //   • hasCullingData → the run actually finished (ratings + labels are
  //     on the rows); only the culling_status flag is stale. The
  //     self-healer below repairs it.
  //   • no culling_started_at yet → we have no reference clock, so we
  //     can't claim it's overdue. We back-fill the timestamp (below)
  //     rather than flashing an instant, false "stuck — 0s elapsed".
  const isCullingStuck = useMemo(() => {
    if (gallery?.culling_status !== "processing") return false;
    if (hasCullingData) return false;
    const startedAt = gallery?.culling_started_at;
    if (!startedAt) return false;
    const elapsed = cullingNow - new Date(startedAt).getTime();
    return elapsed > stuckThresholdMs(images.length);
  }, [gallery?.culling_status, gallery?.culling_started_at, images.length, hasCullingData, cullingNow]);

  // Self-healing for inconsistent culling rows:
  //   1. data present but status still 'processing' → flip to 'ready' so
  //      the banner clears for everyone who opens the gallery.
  //   2. status 'processing' but no culling_started_at (legacy / a run
  //      that pre-dates the timestamp column) → back-fill it to now so
  //      the run gets a proper countdown and a correct, delayed "stuck"
  //      window instead of being flagged stuck immediately.
  // Runs once per render when the inconsistency is detected.
  useEffect(() => {
    if (!gallery?.id) return;
    if (gallery.culling_status === "processing" && hasCullingData) {
      supabase
        .from("galleries")
        .update({ culling_status: "ready" } as any)
        .eq("id", gallery.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["gallery", id] });
        });
      return;
    }
    if (gallery.culling_status === "processing" && !hasCullingData && !gallery.culling_started_at) {
      supabase
        .from("galleries")
        .update({ culling_started_at: new Date().toISOString() } as any)
        .eq("id", gallery.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["gallery", id] });
        });
    }
  }, [gallery?.id, gallery?.culling_status, gallery?.culling_started_at, hasCullingData, id, queryClient]);

  // AI Culling mutation - calls the start-grouping function
  const runAICulling = useMutation({
    mutationFn: async (tags: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // If culling is stuck, reset status before re-invoking
      if (isCullingStuck) {
        await supabase
          .from("galleries")
          .update({ culling_status: "idle" } as any)
          .eq("id", id!);
      }

      // Reset existing culling output before kicking off a new run.
      // The user explicitly opted-in via the re-run-acknowledge
      // checkbox, so wiping ratings/labels is intended. Clearing
      // these makes hasCullingData=false, which:
      //   - hides the post-culling Star Rating + Categories panels
      //   - lets the in-progress banner show normally
      //   - prevents the user from filtering against stale numbers
      // Fields below match exactly what grouping-webhook writes back.
      if (hasCullingData) {
        await supabase
          .from("gallery_images")
          .update({
            culling_score: null,
            culling_label: null,
            similarity_group_1: null,
            similarity_group_2: null,
            similarity_group_3: null,
            background_sharpness: null,
            subject_sharpness: null,
            thirds_rule: null,
            intended_facial_expression: null,
          })
          .eq("gallery_id", id!);
        // Reset filter selections that referenced the now-cleared data.
        setFilters((prev) => ({
          ...prev,
          selectedRatings: [],
          minRating: 0,
          selectedLabels: [],
        }));
      }

      const { data, error } = await supabase.functions.invoke('start-grouping', {
        body: { 
          galleryId: id,
          labels: tags,
          thresholds: [0.5, 0.7, 0.9],
          timeThreshold: 60
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery", id] });
    },
    onError: async (error) => {
      console.error("AI Culling error:", error);
      // A 409 means the backend already has a run in flight (e.g. a
      // second tab raced us). That's not a failure — re-sync so the live
      // overlay shows, and reassure rather than alarm.
      const err = error as { context?: { status?: number }; status?: number };
      const status = err?.context?.status ?? err?.status;
      if (status === 409) {
        queryClient.invalidateQueries({ queryKey: ["gallery", id] });
        setCullingProgressMinimized(false);
        toast.info("AI Culling is already running for this gallery.");
        return;
      }
      toast.error("Failed to start AI culling. Please try again.");
    }
  });

  // Stable callback for ImageCard memoization — passing the inline
  // `(id) => toggleLike.mutate(id)` allocates a new function each
  // render and defeats React.memo on the card.
  const handleToggleLike = useCallback((imageId: string) => {
    toggleLike.mutate(imageId);
  }, [toggleLike]);

  // Open lightbox directly (details panel closed by default)
  const openLightbox = useCallback((imageId: string) => {
    setLightboxImage(imageId);
    setDetailsImageId(imageId);
    setShowDetailsPanel(!isMobile);
    setHoldingOriginal(false);
    // Default to edited mode on mobile to avoid slider/swipe conflict
    if (isMobile) {
      setCompareMode("edited");
    }
    // Show swipe hint on first lightbox open (mobile only)
    if (isMobile && !localStorage.getItem("lightbox-hint-seen")) {
      setShowSwipeHint(true);
      localStorage.setItem("lightbox-hint-seen", "1");
      setTimeout(() => setShowSwipeHint(false), 3000);
    }
  }, [isMobile]);

  // Image click behavior: if images are selected, click selects; otherwise opens lightbox
  const handleImageClick = useCallback((imageId: string, index: number) => {
    if (selectedImages.length > 0) {
      // Selection mode: toggle selection
      setSelectedImages(prev =>
        prev.includes(imageId)
          ? prev.filter(id => id !== imageId)
          : [...prev, imageId]
      );
      setLastSelectedIndex(index);
    } else {
      // No selection: open lightbox
      openLightbox(imageId);
    }
  }, [selectedImages.length, openLightbox]);

  // Checkbox click for selection with Shift support
  const handleSelectionToggle = useCallback((imageId: string, index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift+Click: select range
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = filteredImages.slice(start, end + 1).map(img => img.id);
      setSelectedImages(prev => {
        const newSet = new Set([...prev, ...rangeIds]);
        return Array.from(newSet);
      });
    } else {
      // Toggle single selection
      setSelectedImages(prev =>
        prev.includes(imageId)
          ? prev.filter(id => id !== imageId)
          : [...prev, imageId]
      );
      setLastSelectedIndex(index);
    }
  }, [filteredImages, lastSelectedIndex]);

  const selectAll = () => {
    setSelectedImages(images.map(img => img.id));
  };

  const clearSelection = () => {
    setSelectedImages([]);
    setLastSelectedIndex(null);
  };

  // Escape from a non-default catalog mode (e.g. Faces) back to the
  // default gallery view, so a user is never stuck. The lightbox's own
  // Escape handler takes priority when the loupe is open, so this only
  // runs while the loupe is closed.
  useEffect(() => {
    if (catalogMode === "default" || lightboxImage) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      setSelectedFaceCluster(null);
      setCatalogMode("default");
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [catalogMode, lightboxImage]);

  const copyClientLink = () => {
    if (gallery?.client_link) {
      const url = `${window.location.origin}/gallery/${gallery.client_link}`;
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  const handleDownload = () => {
    setShowDownloadModal(true);
  };

  const currentLightboxIndex = lightboxImage 
    ? filteredImages.findIndex(img => img.id === lightboxImage)
    : -1;

  const currentDetailsImage = detailsImageId 
    ? filteredImages.find(img => img.id === detailsImageId) ?? images.find(img => img.id === detailsImageId)
    : null;

  // Lightbox navigation functions
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);

  const navigatePrev = useCallback(() => {
    if (filteredImages.length === 0) return;
    setSwipeDirection(-1);
    const prevIndex = currentLightboxIndex > 0 ? currentLightboxIndex - 1 : filteredImages.length - 1;
    setLightboxImage(filteredImages[prevIndex].id);
    setDetailsImageId(filteredImages[prevIndex].id);
  }, [currentLightboxIndex, filteredImages]);

  const navigateNext = useCallback(() => {
    if (filteredImages.length === 0) return;
    setSwipeDirection(1);
    const nextIndex = currentLightboxIndex < filteredImages.length - 1 ? currentLightboxIndex + 1 : 0;
    setLightboxImage(filteredImages[nextIndex].id);
    setDetailsImageId(filteredImages[nextIndex].id);
  }, [currentLightboxIndex, filteredImages]);

  const goToImage = useCallback((index: number) => {
    if (filteredImages[index]) {
      setLightboxImage(filteredImages[index].id);
      setDetailsImageId(filteredImages[index].id);
    }
  }, [filteredImages]);

  const closeLightbox = useCallback(() => {
    setLightboxImage(null);
    setShowDetailsPanel(false);
  }, []);

  // Preload adjacent images in lightbox for instant navigation
  // Always preload BOTH original and edited versions for current + prev/next
  useEffect(() => {
    if (currentLightboxIndex < 0 || filteredImages.length === 0) return;
    const toPreload: string[] = [];
    
    // Collect active style API IDs
    const activeApiIds = Object.values(styleApiIdMap);
    
    // Current image: preload the version NOT currently displayed
    const currentImg = filteredImages[currentLightboxIndex];
    if (currentImg) {
      if (selectedViewStyle === "original") {
        // Currently showing original → preload edited versions
        for (const apiId of activeApiIds) {
          toPreload.push(getEditedPreviewUrl(currentImg.original_url, apiId));
        }
      } else {
        // Currently showing edited → preload original
        toPreload.push(getPreviewUrl(currentImg.original_url));
      }
    }
    
    // Previous & next images: preload BOTH original AND edited
    const prevIdx = currentLightboxIndex > 0 ? currentLightboxIndex - 1 : filteredImages.length - 1;
    const nextIdx = currentLightboxIndex < filteredImages.length - 1 ? currentLightboxIndex + 1 : 0;
    
    for (const idx of [prevIdx, nextIdx]) {
      if (idx === currentLightboxIndex) continue;
      const img = filteredImages[idx];
      if (!img) continue;
      // Always preload original
      toPreload.push(getPreviewUrl(img.original_url));
      // Always preload all active edited versions
      for (const apiId of activeApiIds) {
        toPreload.push(getEditedPreviewUrl(img.original_url, apiId));
      }
    }
    
    toPreload.forEach(url => {
      const i = new Image();
      i.src = url;
    });
  }, [currentLightboxIndex, filteredImages, selectedViewStyle, styleApiIdMap]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const allStyleOptions = ["original", ...galleryStylesData.map((s) => s.id)];
      const currentStyleIndex = allStyleOptions.indexOf(selectedViewStyle);

      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          navigatePrev();
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          navigateNext();
          break;
        case "ArrowDown":
          e.preventDefault();
          if (allStyleOptions.length > 1 && currentStyleIndex < allStyleOptions.length - 1) {
            setSelectedViewStyle(allStyleOptions[currentStyleIndex + 1]);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (allStyleOptions.length > 1 && currentStyleIndex > 0) {
            setSelectedViewStyle(allStyleOptions[currentStyleIndex - 1]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeLightbox();
          break;
        case "i":
        case "I":
          e.preventDefault();
          setShowDetailsPanel(prev => !prev);
          break;
        case "l":
        case "L":
          e.preventDefault();
          if (currentDetailsImage) toggleLike.mutate(currentDetailsImage.id);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "Home":
          e.preventDefault();
          goToImage(0);
          break;
        case "End":
          e.preventDefault();
          goToImage(filteredImages.length - 1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage, currentDetailsImage, navigatePrev, navigateNext, closeLightbox, toggleFullscreen, goToImage, filteredImages.length, toggleLike, galleryStylesData, selectedViewStyle, setSelectedViewStyle]);

  // Handle vertical swipe for lightbox navigation (mobile only)
  const handleSwipeEnd = useCallback((_: any, info: { offset: { y: number }; velocity: { y: number } }) => {
    if (!isMobile) return;
    const swipeThreshold = 50;
    const velocityThreshold = 500;

    if (info.offset.y > swipeThreshold || info.velocity.y > velocityThreshold) {
      navigatePrev();
    } else if (info.offset.y < -swipeThreshold || info.velocity.y < -velocityThreshold) {
      navigateNext();
    }
  }, [isMobile, navigatePrev, navigateNext]);

  // Delete current image in lightbox
  const handleDeleteCurrentImage = useCallback(() => {
    if (!currentDetailsImage) return;
    softDeleteImages.mutate([currentDetailsImage.id]);
    // Navigate to next image or close if last
    if (filteredImages.length <= 1) {
      closeLightbox();
    } else {
      navigateNext();
    }
  }, [currentDetailsImage, softDeleteImages, filteredImages.length, closeLightbox, navigateNext]);

  // Delete a specific style edit for the current image
  const handleDeleteCurrentEdit = useCallback((styleId: string) => {
    if (!currentDetailsImage) return;
    deleteImageEdit.mutate({ imageId: currentDetailsImage.id, styleId });
  }, [currentDetailsImage, deleteImageEdit]);

  // Set current image as hero
  const handleSetAsHero = useCallback(() => {
    if (!currentDetailsImage) return;
    setHeroImage.mutate(currentDetailsImage.id);
  }, [currentDetailsImage, setHeroImage]);

  if (galleryLoading || imagesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Images className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Gallery not found</h2>
        <Button asChild>
          <Link to="/dashboard/galleries">Back to Collections</Link>
        </Button>
      </div>
    );
  }

  return (
   <FailedImagesProvider>
    <div className="h-full flex flex-col overflow-hidden">
      {/* Compact Single-Row Header — module bar */}
      <div className="border-b border-border glass-card sticky top-0 z-20">
        <div className="px-3 py-2 flex items-center gap-2">
          {/* Left: Back + Name + Count */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            {catalogMode !== "default" ? (
              // In a non-default catalog mode (e.g. Faces): the back arrow
              // returns to the default gallery view rather than leaving the
              // page, so the user is never stuck inside the mode.
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                aria-label="Back to gallery"
                onClick={(e) => { e.stopPropagation(); setSelectedFaceCluster(null); setCatalogMode("default"); }}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="w-8 h-8" asChild>
                <Link to="/dashboard/galleries">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
            )}
            <Sparkle size={13} className="text-primary shrink-0" />
            {/* Title doubles as a scroll-to-top affordance — the gesture is
                scoped here instead of the whole bar so the inner buttons
                behave predictably. */}
            <h1
              className="font-display text-sm font-semibold truncate max-w-[200px] cursor-pointer"
              onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              title="Scroll to top"
            >
              {gallery.name}
            </h1>
          </div>

          {/* Right: Sort, View Mode, Count */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <CullingScoreModeToggle />
            <TooltipProvider delayDuration={300}>
            {/* Sort Dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
                      <ArrowUpDown className="w-3 h-3" />
                      <span className="hidden md:inline">
                        {filters.sortBy === "date" || filters.sortBy === "date_taken" ? "Date Taken" : filters.sortBy === "date_added" ? "Date Added" : filters.sortBy === "name" ? "Name" : filters.sortBy === "size" ? "Size" : "Rating"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Sort</p></TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, sortBy: "date" }))}>
                  {filters.sortBy === "date" && <Check className="w-3 h-3 mr-2" />}
                  Date Taken
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, sortBy: "date_added" }))}>
                  {filters.sortBy === "date_added" && <Check className="w-3 h-3 mr-2" />}
                  Date Added
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, sortBy: "name" }))}>
                  {filters.sortBy === "name" && <Check className="w-3 h-3 mr-2" />}
                  Image Name
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, sortBy: "rating" }))}>
                  {filters.sortBy === "rating" && <Check className="w-3 h-3 mr-2" />}
                  AI Rating
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, sortBy: "size" }))}>
                  {filters.sortBy === "size" && <Check className="w-3 h-3 mr-2" />}
                  File Size
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, sortOrder: prev.sortOrder === "asc" ? "desc" : "asc" }))}>
                  {filters.sortOrder === "asc" ? "↑ Ascending" : "↓ Descending"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-7 h-7 text-primary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFilters(defaultFilters);
                    }}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Reset Filters</p></TooltipContent>
              </Tooltip>
            )}

            {/* View Mode — density toggle */}
            <div className="flex items-center rounded-sm border border-border bg-surface-2 p-0.5 ml-0.5 gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "w-7 h-7 rounded-sm flex items-center justify-center transition-colors duration-150",
                      viewMode === "masonry"
                        ? "bg-primary/20 text-primary ring-1 ring-primary/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    onClick={() => setViewMode("masonry")}
                  >
                    <Rows3 className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Masonry</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "w-7 h-7 rounded-sm flex items-center justify-center transition-colors duration-150",
                      viewMode === "grid"
                        ? "bg-primary/20 text-primary ring-1 ring-primary/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Grid</p></TooltipContent>
              </Tooltip>
            </div>
            </TooltipProvider>

            {/* Image count — mono readout */}
            <span className="font-mono text-[11px] text-muted-foreground hidden sm:inline ml-1 tabular-nums">
              {hasActiveFilters ? (
                <><span className="text-foreground folio">{filteredImages.length.toLocaleString()}</span>/{(gallery?.total_images || images.length).toLocaleString()}</>
              ) : (
                <span className="text-foreground folio">{(gallery?.total_images || images.length).toLocaleString()}</span>
              )}
            </span>

            {/* Trash toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-all ml-1 relative",
                    showTrash
                      ? "bg-destructive/20 text-destructive ring-1 ring-destructive/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  onClick={() => setShowTrash(prev => !prev)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {trashedImages.length > 0 && !showTrash && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-[8px] text-white flex items-center justify-center font-bold">
                      {trashedImages.length > 9 ? "9+" : trashedImages.length}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>{showTrash ? "Back to gallery" : "Recycle Bin"}</p></TooltipContent>
            </Tooltip>
          </div>

          {/* Mobile sidebar trigger */}
          {isMobile && (
            <Button
              variant="outline"
              size="icon"
              className="w-7 h-7 shrink-0"
              onClick={() => setShowMobileSidebar(true)}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Floating Processing/Transfer Bar */}
      <AnimatePresence>
        {(gallery.status === "transferring" || gallery.status === "processing") && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-20 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none"
          >
            <div className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-[--radius] glass-card border border-primary/25 shadow-[0_0_20px_-5px_hsl(var(--primary)/0.3)] text-sm max-w-lg w-full">
              {gallery.status === "transferring" && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  <span className="text-muted-foreground font-medium">Importing...</span>
                  <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-gradient-x transition-all duration-500"
                      style={{ width: `${transferProgress && transferProgress.total > 0 ? (transferProgress.current / transferProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground shrink-0 font-medium">
                    {transferProgress && transferProgress.total > 0
                      ? `${Math.round((transferProgress.current / transferProgress.total) * 100)}%`
                      : transferProgress ? `${transferProgress.current} images` : "0%"
                    }
                  </span>
                </>
              )}
              {gallery.status === "processing" && (() => {
                // Detect re-edit scenario: all images already ready but gallery is processing
                const isReEditScenario = pendingReEdit && processingStats.ready === processingStats.total;
                if (isReEditScenario) {
                  const expectedCount = pendingReEdit.imageIds.length * pendingReEdit.styleIds.length;
                  let completedCount = 0;
                  for (const imgId of pendingReEdit.imageIds) {
                    for (const styleId of pendingReEdit.styleIds) {
                      if (imageIdsByStyle[styleId]?.has(imgId)) completedCount++;
                    }
                  }
                  const pct = expectedCount > 0 ? Math.round((completedCount / expectedCount) * 100) : 0;
                  return (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                      <span className="text-muted-foreground font-medium">Re-editing...</span>
                      <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-gradient-x transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground shrink-0 font-medium">
                        {completedCount}/{expectedCount} ({pct}%)
                      </span>
                    </>
                  );
                }
                return (
                  <>
                    {processingStalled ? (
                      <AlertTriangle className="w-4 h-4 text-rating shrink-0" />
                    ) : isAutoRetrying ? (
                      <RotateCcw className="w-4 h-4 animate-spin text-rating shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    )}
                    <span className="text-muted-foreground font-medium">
                      {processingStalled
                        ? `Still stuck — ${processingStats.processing + processingStats.error} images failed`
                        : isAutoRetrying
                        ? "Auto-retrying..."
                        : "Processing..."}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-gradient-x transition-all duration-500"
                        style={{ width: `${processingStats.percentage}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground shrink-0 font-medium">
                      {processingStats.ready}/{processingStats.total} ({processingStats.percentage}%)
                    </span>
                    {processingStalled && (
                      <Button variant="outline" size="sm" className="ml-2 h-7 text-xs gap-1"
                        onClick={retryStuckImages} disabled={isProcessing}>
                        <RotateCcw className="w-3 h-3" /> Retry
                      </Button>
                    )}
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Actions Bar - Centered */}
      <AnimatePresence>
        {selectedImages.length > 0 && !showTrash && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-0 right-0 z-30 flex justify-center px-4"
          >
            <div className="flex items-center gap-2 px-4 py-3 rounded-[--radius] glass-card border border-border shadow-[var(--elevation-3)]">
              <span className="aura-chip">
                <span className="aura-led aura-led-pulse" />
                <span className="folio text-foreground">{selectedImages.length}</span> selected
              </span>

              {/* High-frequency actions — always visible */}
              <Button
                variant="glow"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowReEditModal(true)}
              >
                <Sparkle size={14} className="text-current" />
                Re-edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  const { error } = await supabase
                    .from("gallery_images")
                    .update({ is_liked: true })
                    .in("id", selectedImages);
                  if (!error) {
                    queryClient.invalidateQueries({ queryKey: ["gallery-images", id] });
                    toast.success(`Liked ${selectedImages.length} images`);
                  }
                }}
              >
                <Heart className="w-4 h-4" />
                Like
              </Button>

              {/* Lower-frequency actions — overflow menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <MoreHorizontal className="w-4 h-4" />
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem onClick={selectAll}>
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Select All
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={selectedImages.length !== 1}
                    onClick={() => setHeroImage.mutate(selectedImages[0])}
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Set Hero
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {availableLabels.map((item) => (
                    <DropdownMenuItem
                      key={item.label}
                      onClick={() => updateImageCategory.mutate({ imageIds: selectedImages, label: item.label })}
                    >
                      <Tag className="w-4 h-4 mr-2" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); setNewCategoryInput(""); }}
                  >
                    <Tag className="w-4 h-4 mr-2" />
                    + New Category
                  </DropdownMenuItem>
                  {newCategoryInput !== null && (
                    <div className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        placeholder="New category name..."
                        autoFocus
                        className="w-full px-2 py-1 text-xs rounded-md bg-white/[0.03] border border-white/[0.08] outline-none focus:border-primary/50 transition-colors"
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter" && newCategoryInput.trim()) {
                            updateImageCategory.mutate({ imageIds: selectedImages, label: newCategoryInput.trim() });
                            setNewCategoryInput(null);
                          }
                          if (e.key === "Escape") setNewCategoryInput(null);
                        }}
                      />
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Destructive zone — visually separated, labelled, two-step confirm */}
              <div className="h-6 w-px bg-border/60 mx-0.5" aria-hidden />
              {confirmBulkDelete ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive border-destructive/30"
                    onClick={() => { softDeleteImages.mutate(selectedImages); setConfirmBulkDelete(false); }}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Trash {selectedImages.length}?
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setConfirmBulkDelete(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setConfirmBulkDelete(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Trash
                </Button>
              )}

              <Button variant="ghost" size="icon" className="w-8 h-8" onClick={clearSelection}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
      {/* Image Grid — scrollbar-gutter:stable reserves the scrollbar space so
          its appearing/disappearing never changes content width, which would
          otherwise drive a ResizeObserver↔scrollbar feedback loop that
          re-justifies the grid ~60fps (the "whole screen flickers" bug). */}
      <div ref={scrollContainerRef} className="flex-1 min-w-0 overflow-y-auto [scrollbar-gutter:stable]">
        {/* Persistent culling-status banner — shown only while
            gallery.culling_status === 'processing'. Sticky so it stays
            in view when the user scrolls down through 3000 thumbnails. */}
        <div className="sticky top-0 z-20">
          <CullingStatusBanner
            status={gallery?.culling_status}
            startedAt={gallery?.culling_started_at as string | null | undefined}
            imageCount={images.length}
            isStuck={isCullingStuck}
            hasCullingData={hasCullingData}
            onReopenProgress={
              cullingProgressMinimized ? () => setCullingProgressMinimized(false) : undefined
            }
          />
        </div>
        <div className="p-4 lg:p-6">
        {/* Surfaces any thumbnails that exhausted their auto-retry
            budget so the user can see exactly which uploads need
            attention (by filename) and trigger a batched retry. */}
        <ProblemImagesSection />
        {/* Recycle Bin View */}
        {showTrash ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-sm bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold">Recycle Bin</h3>
                  <p className="text-xs text-muted-foreground">
                    <span className="folio">{trashedImages.length}</span> image{trashedImages.length !== 1 ? "s" : ""} — auto-deleted after 30 days
                  </p>
                </div>
              </div>
              {trashedImages.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => restoreImages.mutate(trashedImages.map((i: any) => i.id))}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore All
                  </Button>
                  {confirmEmptyTrash ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs text-destructive hover:text-destructive border-destructive/30"
                        onClick={() => {
                          permanentlyDeleteImages.mutate(trashedImages.map((i: any) => i.id));
                          setConfirmEmptyTrash(false);
                        }}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Are you sure?
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => setConfirmEmptyTrash(false)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs text-destructive hover:text-destructive"
                      onClick={() => setConfirmEmptyTrash(true)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Empty Trash
                    </Button>
                  )}
                </div>
              )}
            </div>

            {trashedImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Trash2 className="w-12 h-12 mb-3 opacity-30" />
                <p className="font-medium">Recycle bin is empty</p>
                <p className="text-sm mt-1">Deleted images will appear here for 30 days</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {trashedImages.map((img: any) => {
                  const daysLeft = img.deleted_at
                    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(img.deleted_at).getTime()) / (1000 * 60 * 60 * 24)))
                    : 30;
                  return (
                    <div key={img.id} className="relative group rounded-sm overflow-hidden border border-border/60 aspect-square plate-keyline">
                      <img
                        src={img.original_url}
                        alt={img.filename}
                        className="w-full h-full object-cover opacity-60 grayscale"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="absolute top-1 left-1 font-mono text-[9px] bg-black/60 text-white/70 px-1.5 py-0.5 rounded-sm tabular-nums">
                        {daysLeft}d
                      </span>
                      <div className="absolute bottom-0 inset-x-0 flex gap-0.5 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {confirmDeleteId === img.id ? (
                          <>
                            <button
                              className="flex-1 text-[10px] font-medium py-1 rounded bg-destructive/50 backdrop-blur-sm text-white hover:bg-destructive/70 transition-colors"
                              onClick={() => {
                                permanentlyDeleteImages.mutate([img.id]);
                                setConfirmDeleteId(null);
                              }}
                            >
                              Sure?
                            </button>
                            <button
                              className="flex-1 text-[10px] font-medium py-1 rounded bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="flex-1 text-[10px] font-medium py-1 rounded bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
                              onClick={() => restoreImages.mutate([img.id])}
                            >
                              Restore
                            </button>
                            <button
                              className="flex-1 text-[10px] font-medium py-1 rounded bg-destructive/30 backdrop-blur-sm text-white hover:bg-destructive/50 transition-colors"
                              onClick={() => setConfirmDeleteId(img.id)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rounded-sm bg-rating/10 border border-rating/20 px-3 py-2 text-xs text-rating flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>Images in the recycle bin still count toward your storage quota. Empty the trash to free up space.</span>
            </div>
          </div>
        ) : (
        <>
        {/* AI Processing Banner - shows when processing with no ready images */}
        <AnimatePresence>
          {gallery?.status === "processing" && processingStats.ready === 0 && images.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="mb-4 rounded-[--radius] border border-primary/25 bg-primary/[0.06] aura-ai-border p-4 flex items-center gap-4"
            >
              <Orb className="w-10 h-10 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkle size={14} className="text-primary" />
                  Aura is editing your images
                </h3>
                <p className="text-muted-foreground text-xs">
                  This usually takes a minute or two — your originals are shown below
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            {images.length === 0 && gallery.status === "transferring" ? (
              <>
                <div className="w-48 h-48">
                  <DotLottieReact
                    src="https://lottie.host/4db68bbd-31f6-4cd8-84eb-189de081159a/IGmMCqhzpt.lottie"
                    loop
                    autoplay
                    className="w-full h-full"
                  />
                </div>
                <h3 className="text-lg font-semibold">Importing Your Images</h3>
                <p className="text-muted-foreground text-center max-w-sm">
                  Your images are being imported from Google Drive. This may take a few minutes — please be patient.
                </p>
              </>
            ) : (
              <>
                <Images className="w-16 h-16 text-muted-foreground" />
                <h3 className="text-lg font-semibold">
                  {images.length === 0 ? "No images yet" : "No images match filters"}
                </h3>
                <p className="text-muted-foreground">
                  {images.length === 0 
                    ? "Upload images to this gallery to get started"
                    : "Try adjusting your filter criteria"}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={() => setFilters(defaultFilters)}>
                    Clear Filters
                  </Button>
                )}
              </>
            )}
          </div>
        ) : catalogMode === "faces" ? (
          // Face Search View
          selectedFaceCluster ? (
            <FaceClusterImages
              clusterId={selectedFaceCluster}
              onBack={() => setSelectedFaceCluster(null)}
              onBackToGallery={() => { setSelectedFaceCluster(null); setCatalogMode("default"); }}
              onImageClick={openLightbox}
            />
          ) : (
            <FaceGallery
              clusters={faceClusters.data || []}
              faceSearchStatus={isFaceDetectionRunning ? "processing" : faceSearchStatus}
              faceSearchError={faceSearchError}
              faceSearchStartedAt={faceSearchStartedAt}
              isLoading={faceClusters.isLoading}
              totalImages={gallery?.total_images}
              detectionProgress={faceDetectionProgress}
              onClusterSelect={setSelectedFaceCluster}
              onStartFaceSearch={() => startDetection()}
              onResetFaceSearch={() => resetFaceSearch.mutate()}
              onBackToGallery={() => setCatalogMode("default")}
              onCancel={abortFaceDetection}
              isStarting={isFaceDetectionRunning}
            />
          )
        ) : (
          // Default grid / masonry view
          (() => {
            const renderCard = (image: typeof filteredImages[number], index: number) => {
              const computed = justifiedSizes.get(image.id);
              return (
                <ImageCard
                  image={{
                    id: image.id,
                    filename: image.filename,
                    original_url: image.original_url,
                    is_hero: image.is_hero,
                    is_liked: image.is_liked,
                    ai_rating: image.ai_rating,
                    culling_score: (image as any).culling_score,
                    width: image.width,
                    height: image.height,
                  }}
                  index={index}
                  thumbnailUrl={getImageThumbnail(image)}
                  viewMode={viewMode}
                  isSelected={selectedImages.includes(image.id)}
                  computedWidth={computed?.width}
                  computedHeight={computed?.height}
                  status={
                    selectedViewStyle !== "original" &&
                    pendingReEdit?.styleIds.includes(selectedViewStyle) &&
                    pendingReEdit?.imageIds.includes(image.id) &&
                    !imageIdsByStyle[selectedViewStyle]?.has(image.id)
                      ? "processing"
                      : image.status
                  }
                  onImageClick={handleImageClick}
                  onSelectionToggle={handleSelectionToggle}
                  onOpenLightbox={openLightbox}
                  onToggleLike={handleToggleLike}
                  processingInfo={
                    canViewAnalytics
                      ? {
                          sentAt: image.last_processing_attempt_at || null,
                          completedAt: image.processing_completed_at || null,
                          attempts: image.processing_attempts || 0,
                          error:
                            image.status === "error" ? image.last_processing_error || null : null,
                        }
                      : undefined
                  }
                />
              );
            };

            const skeletons =
              pendingUploadCount > 0
                ? Array.from({ length: pendingUploadCount }).map((_, i) => (
                    <div
                      key={`skeleton-${i}`}
                      className="relative rounded-sm overflow-hidden animate-pulse bg-muted/60 aspect-square"
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-muted-foreground/20" />
                      </div>
                    </div>
                  ))
                : null;

            if (viewMode === "grid") {
              // Virtualized grid — DOM count stays bounded regardless
              // of gallery size. The previous infinite-scroll mounted
              // 3000 ImageCards by the time the user scrolled to the
              // bottom of a wedding gallery.
              return (
                <VirtualizedImageGrid
                  items={filteredImages}
                  scrollContainerRef={scrollContainerRef}
                  getKey={(image) => image.id}
                  renderItem={renderCard}
                  trailing={
                    skeletons ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-0.5 mt-0.5">
                        {skeletons}
                      </div>
                    ) : null
                  }
                />
              );
            }

            // Masonry — variable-height layout. Keeps the previous
            // visibleImages-slice + infinite-scroll behaviour because
            // virtualizing variable-height rows needs row-height
            // measurement that's a separate refactor. Grid is the
            // default + ~90% of usage.
            return (
              <>
                <div
                  ref={gridContainerRef}
                  className="w-full gap-0.5 flex flex-wrap"
                >
                  {visibleImages.map((image, index) => (
                    <div key={image.id} style={{ display: "contents" }}>
                      {renderCard(image, index)}
                    </div>
                  ))}
                  {skeletons}
                </div>
                {visibleCount < filteredImages.length && (
                  <div className="flex justify-center py-8">
                    <p className="text-sm text-muted-foreground">
                      Showing {visibleCount} of {filteredImages.length} images • Scroll for more
                    </p>
                  </div>
                )}
              </>
            );
          })()
        )}
        </>
        )}
        </div>
      </div>

      {/* Right Sidebar - Desktop */}
      {!isMobile && (
        <GalleryRightSidebar
          availableStyles={galleryStylesData.map((s) => ({
            id: s.id,
            name: s.name,
            apiId: s.style_id_external || "1",
            coverUrl: s.after_image_urls?.[0] || undefined,
          }))}
          selectedStyle={selectedViewStyle}
          onStyleChange={setSelectedViewStyle}
          hasCullingData={hasCullingData}
          cullingCounts={cullingCounts}
          similarityLevel={sidebarSimilarityLevel}
          onSimilarityLevelChange={setSidebarSimilarityLevel}
          duplicateLimit={duplicateLimit}
          onDuplicateLimitChange={setDuplicateLimit}
          groupCounts={sidebarGroupCounts}
          onAddImages={() => setShowAddImagesModal(true)}
          onRunCulling={() => { if (gallery?.culling_status === "processing" && !isCullingStuck) return; setCullingRequiredNote(!hasCullingData); setShowAICullingModal(true); }}
          isCullingRunning={runAICulling.isPending || (gallery?.culling_status === "processing" && !isCullingStuck)}
          isCullingStuck={isCullingStuck}
          cullingStartedAt={gallery?.culling_started_at as string | null | undefined}
          cullingImageCount={images.length}
          hasActiveFilters={hasActiveFilters}
          onOpenFaceSearch={() => setCatalogMode("faces")}
          faceSearchStatus={isFaceDetectionRunning ? "processing" : faceSearchStatus}
          onShare={() => setShowShareModal(true)}
          onChooseClientPhotos={() => setShowDeliveryModal(true)}
           onOpenSettings={() => setShowSettingsModal(true)}
           onDownload={() => setShowDownloadModal(true)}
          onToggleLikedFilter={() => setFilters(prev => ({ ...prev, showLikedOnly: !prev.showLikedOnly }))}
          isLikedFilterActive={filters.showLikedOnly}
          filters={filters}
          onFiltersChange={setFilters}
          availableTags={availableTags}
          availableLabels={availableLabels}
          canViewAnalytics={canViewAnalytics}
          galleryTimingData={galleryTimingData}
          processingStats={gallery?.status === "processing" || processingStats.processing > 0 || processingStats.error > 0 ? processingStats : undefined}
        />
      )}

      {/* Mobile Sidebar Sheet */}
      <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
        <SheetContent side="right" className="p-0 w-[300px]">
          <GalleryRightSidebar
            availableStyles={galleryStylesData.map((s) => ({
              id: s.id,
              name: s.name,
              apiId: s.style_id_external || "1",
            }))}
            selectedStyle={selectedViewStyle}
            onStyleChange={(id) => { setSelectedViewStyle(id); setShowMobileSidebar(false); }}
            hasCullingData={hasCullingData}
            cullingCounts={cullingCounts}
            similarityLevel={sidebarSimilarityLevel}
            onSimilarityLevelChange={setSidebarSimilarityLevel}
            duplicateLimit={duplicateLimit}
            onDuplicateLimitChange={setDuplicateLimit}
            groupCounts={sidebarGroupCounts}
            onAddImages={() => { setShowAddImagesModal(true); setShowMobileSidebar(false); }}
            onRunCulling={() => { if (gallery?.culling_status === "processing" && !isCullingStuck) return; setCullingRequiredNote(!hasCullingData); setShowAICullingModal(true); setShowMobileSidebar(false); }}
            isCullingRunning={runAICulling.isPending || (gallery?.culling_status === "processing" && !isCullingStuck)}
            isCullingStuck={isCullingStuck}
            hasActiveFilters={hasActiveFilters}
            onOpenFaceSearch={() => { setCatalogMode("faces"); setShowMobileSidebar(false); }}
            faceSearchStatus={isFaceDetectionRunning ? "processing" : faceSearchStatus}
            onShare={() => { setShowShareModal(true); setShowMobileSidebar(false); }}
            onChooseClientPhotos={() => { setShowDeliveryModal(true); setShowMobileSidebar(false); }}
             onOpenSettings={() => { setShowSettingsModal(true); setShowMobileSidebar(false); }}
             onDownload={() => { setShowDownloadModal(true); setShowMobileSidebar(false); }}
            onToggleLikedFilter={() => { setFilters(prev => ({ ...prev, showLikedOnly: !prev.showLikedOnly })); }}
            isLikedFilterActive={filters.showLikedOnly}
            filters={filters}
            onFiltersChange={setFilters}
            availableTags={availableTags}
            availableLabels={availableLabels}
            canViewAnalytics={canViewAnalytics}
            galleryTimingData={galleryTimingData}
            processingStats={gallery?.status === "processing" || processingStats.processing > 0 || processingStats.error > 0 ? processingStats : undefined}
            className="border-l-0 h-full"
            isMobileSheet
          />
        </SheetContent>
      </Sheet>
      </div>

      {/* Lightbox with Details Panel */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex overflow-hidden overscroll-none"
          >
            {/* Main Image Area */}
            <div className="flex-1 flex flex-col relative min-w-0">
              {/* Top Bar - static, above image */}
              <div
                className="relative z-20 flex items-center gap-2 px-3 sm:px-4 h-14 shrink-0 bg-background/60 backdrop-blur-sm border-b border-border/30"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Left zone: Close + filename (truncates; can't collide with the centered toggle) */}
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeLightbox}
                    className="shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                  {currentDetailsImage && (
                    <span dir="ltr" className="caption truncate min-w-0 text-left" title={currentDetailsImage.filename}>
                      {currentDetailsImage.filename}
                    </span>
                  )}
                </div>

                {/* Center zone: Compare Mode Toggle (shrink-0; the two flex-1 side zones keep it centered) */}
                {galleryStylesData.length > 0 && (
                  <div className="shrink-0 flex items-center surface-2 border border-border rounded-sm p-0.5 gap-0.5">
                    <TooltipProvider>
                      {!isMobile && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setCompareMode("slider")}
                            className={cn(
                              "p-1.5 rounded-sm transition-colors text-xs font-medium",
                              compareMode === "slider" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <ArrowUpDown className="w-4 h-4 rotate-90" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Slider</p></TooltipContent>
                      </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setCompareMode("edited")}
                            className={cn(
                              "p-1.5 rounded-sm transition-colors text-xs font-medium",
                              compareMode === "edited" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Edited Only</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setCompareMode("side-by-side")}
                            className={cn(
                              "p-1.5 rounded-sm transition-colors text-xs font-medium",
                              compareMode === "side-by-side" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Rows3 className="w-4 h-4 rotate-90" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Side by Side</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}

                {/* Right zone: position · rating · info */}
                <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
                  {currentDetailsImage && (() => {
                    const stars = cullingScoreToStars((currentDetailsImage as any).culling_score, cullingScoreMode) || currentDetailsImage.ai_rating || 0;
                    const total = filteredImages.length;
                    const position = currentLightboxIndex >= 0 ? currentLightboxIndex + 1 : 1;
                    return (
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <span className="aura-chip tabular-nums">
                          <span className="folio text-foreground">{position}</span>/{total}
                        </span>
                        {stars > 0 && (
                          <span className="aura-chip tabular-nums">
                            <Star className="w-3 h-3 text-rating fill-rating" />
                            {stars}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                    className="shrink-0"
                  >
                    <Info className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Navigation Buttons */}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous image"
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 flex w-8 h-8 md:w-10 md:h-10 bg-background/30 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none"
                onClick={(e) => {
                  e.stopPropagation();
                  navigatePrev();
                }}
              >
                <ChevronLeft className="w-5 h-5 md:w-8 md:h-8" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Next image"
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 flex w-8 h-8 md:w-10 md:h-10 bg-background/30 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateNext();
                }}
              >
                <ChevronRight className="w-5 h-5 md:w-8 md:h-8" />
              </Button>

              {/* Mobile Tap Zones for navigation */}
              <div
                className="absolute left-0 top-14 bottom-0 w-1/4 z-10 md:hidden"
                onClick={(e) => { e.stopPropagation(); navigatePrev(); }}
              />
              <div
                className="absolute right-0 top-14 bottom-0 w-1/4 z-10 md:hidden"
                onClick={(e) => { e.stopPropagation(); navigateNext(); }}
              />

              {/* Swipe Tutorial Hint - shown once on first mobile lightbox open */}
              <AnimatePresence>
                {showSwipeHint && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm md:hidden"
                    onClick={() => setShowSwipeHint(false)}
                  >
                    <div className="flex flex-col items-center gap-3 text-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <ChevronLeft className="w-8 h-8 animate-pulse rotate-90" />
                        <span className="text-lg font-medium">Swipe to navigate</span>
                        <ChevronRight className="w-8 h-8 animate-pulse rotate-90" />
                      </div>
                      <p className="text-sm text-muted-foreground">Tap sides or swipe up/down</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                className="flex-1 flex items-center justify-center min-h-0 min-w-0 overflow-hidden p-3"
                drag={isMobile ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.3}
                onDragEnd={handleSwipeEnd}
                style={{ touchAction: isMobile ? "pan-x" : "auto" }}
              >
              <AnimatePresence initial={false} mode="popLayout">
              {(() => {
                const currentImage = images.find(img => img.id === lightboxImage);
                if (!currentImage) return null;

                // Show processing icon for non-ready images
                if (currentImage.status !== "ready") {
                  return (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    </div>
                  );
                }
                
                // If gallery has styles - show based on compare mode
                if (galleryStylesData.length > 0) {
                  const compareStyleId = selectedViewStyle !== "original" 
                    ? selectedViewStyle 
                    : galleryStylesData[0]?.id;
                  const selectedStyleData = galleryStylesData.find(s => s.id === compareStyleId);
                  const apiId = selectedStyleData?.style_id_external || "1";
                  const editedUrl = getEditedPreviewUrl(currentImage.original_url, apiId);
                  const originalUrl = getPreviewUrl(currentImage.original_url);
                  
                  if (compareMode === "edited") {
                    // Edited only
                    const displayUrl = (isMobile && holdingOriginal) ? originalUrl : editedUrl;
                    return (
                      <motion.div
                        key={lightboxImage}
                        initial={isMobile ? { y: swipeDirection * 300, opacity: 0 } : { scale: 0.95, opacity: 0 }}
                        animate={{ y: 0, scale: 1, opacity: 1 }}
                        exit={isMobile ? { y: swipeDirection * -300, opacity: 0 } : { scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        onClick={(e) => e.stopPropagation()} className="relative flex flex-col items-center justify-center"
                      >
                        <img
                          src={displayUrl}
                          alt={holdingOriginal ? "Original" : `Edited with ${selectedStyleData?.name || "AI"}`}
                          className="max-h-full max-w-full object-contain rounded-lg pointer-events-none"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (target.src !== currentImage.original_url) target.src = currentImage.original_url;
                          }}
                        />
                        {/* Style chips below image */}
                        {galleryStylesData.length > 1 && currentImage.edited_url && (
                          <div className="flex gap-2 mt-3 overflow-x-auto max-w-full px-2 pb-1 scrollbar-hide">
                            {galleryStylesData.map((style) => {
                              const isActive = compareStyleId === style.id;
                              return (
                                <button
                                  key={style.id}
                                  className={cn(
                                    "flex-shrink-0 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors pointer-events-auto border",
                                    isActive
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "surface-2 backdrop-blur-sm text-muted-foreground border-border/60 hover:text-foreground"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedViewStyle(style.id);
                                  }}
                                >
                                  {style.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {isMobile && (
                          <button
                            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-background/50 backdrop-blur-md flex items-center justify-center text-foreground/70 select-none touch-none pointer-events-auto z-10"
                            onTouchStart={(e) => { e.stopPropagation(); setHoldingOriginal(true); }}
                            onTouchEnd={() => setHoldingOriginal(false)}
                            onTouchCancel={() => setHoldingOriginal(false)}
                            onMouseDown={(e) => { e.stopPropagation(); setHoldingOriginal(true); }}
                            onMouseUp={() => setHoldingOriginal(false)}
                            onMouseLeave={() => setHoldingOriginal(false)}
                          >
                            <Eye className={cn("w-5 h-5 transition-opacity", holdingOriginal ? "opacity-100" : "opacity-70")} />
                          </button>
                        )}
                      </motion.div>
                    );
                  }
                  
                  if (compareMode === "side-by-side") {
                    // Side by side
                    return (
                      <motion.div
                        key={lightboxImage}
                        initial={isMobile ? { y: swipeDirection * 300, opacity: 0 } : { scale: 0.95, opacity: 0 }}
                        animate={{ y: 0, scale: 1, opacity: 1 }}
                        exit={isMobile ? { y: swipeDirection * -300, opacity: 0 } : { scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        onClick={(e) => e.stopPropagation()} className="flex items-center justify-center gap-2 px-4 w-full"
                      >
                        <div className="relative flex-1 flex items-center justify-end min-w-0 overflow-hidden">
                          <img
                            src={originalUrl}
                            alt="Original"
                            className="max-h-full max-w-full object-contain rounded-lg pointer-events-none"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (target.src !== currentImage.original_url) target.src = currentImage.original_url;
                            }}
                          />
                          <span className="aura-chip absolute top-3 left-3 z-10 bg-background/85 backdrop-blur-sm">
                            Original
                          </span>
                        </div>
                        <div className="relative flex-1 flex items-center justify-start min-w-0 overflow-hidden">
                          <img
                            src={editedUrl}
                            alt={selectedStyleData?.name || "Edited"}
                            className="max-h-full max-w-full object-contain rounded-lg pointer-events-none"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (target.src !== currentImage.original_url) target.src = currentImage.original_url;
                            }}
                          />
                          <span className="aura-chip absolute top-3 right-3 z-10 bg-background/85 backdrop-blur-sm text-primary">
                            <Sparkle size={10} className="text-primary" />
                            {selectedStyleData?.name || "Edited"}
                          </span>
                        </div>
                      </motion.div>
                    );
                  }
                  
                  // Default: slider mode
                  return (
                    <motion.div
                      key={lightboxImage}
                      initial={isMobile ? { y: swipeDirection * 300, opacity: 0 } : { scale: 0.95, opacity: 0 }}
                      animate={{ y: 0, scale: 1, opacity: 1 }}
                      exit={isMobile ? { y: swipeDirection * -300, opacity: 0 } : { scale: 0.95, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      onClick={(e) => e.stopPropagation()}
                      className="max-w-full overflow-hidden"
                    >
                      <StyleComparison
                        originalUrl={originalUrl}
                        editedUrl={editedUrl}
                        originalFallbackUrl={currentImage.original_url}
                        editedFallbackUrl={currentImage.original_url}
                        styleName={selectedStyleData?.name || "Edited"}
                      />
                    </motion.div>
                  );
                }
                
                // No styles - show original image
                return (
                  <motion.div
                    key={lightboxImage}
                    initial={isMobile ? { y: swipeDirection * 300, opacity: 0 } : { scale: 0.95, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    exit={isMobile ? { y: swipeDirection * -300, opacity: 0 } : { scale: 0.95, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={getPreviewUrl(currentImage.original_url)}
                      alt={currentImage.original_url.split('/').pop() || "Gallery image"}
                      className="max-h-full max-w-full object-contain rounded-lg pointer-events-none"
                      onError={(e) => {
                        // Fallback to original URL if preview doesn't exist yet
                        const target = e.target as HTMLImageElement;
                        if (target.src !== currentImage.original_url) {
                          target.src = currentImage.original_url;
                        }
                      }}
                    />
                  </motion.div>
                );
              })()}
              </AnimatePresence>
              </motion.div>

              {/* Bottom Filmstrip with Dock Magnification */}
              <DockFilmstrip
                images={filteredImages}
                currentIndex={currentLightboxIndex}
                onGoToImage={goToImage}
                getThumbnailUrl={(url) => getThumbnailUrl(url)}
              />

            </div>

            {/* Details Panel */}
            {isMobile ? (
              <Drawer open={showDetailsPanel && !!currentDetailsImage} onOpenChange={(open) => { if (!open) setShowDetailsPanel(false); }}>
                <DrawerContent className="h-[80vh]" overlayClassName="bg-transparent">
                  <div className="flex items-center justify-between px-4 pt-2 pb-1 shrink-0">
                    <DrawerTitle className="text-sm font-medium">Image Details</DrawerTitle>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowDetailsPanel(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="overflow-y-auto flex-1 px-4 pb-4">
                    {currentDetailsImage && (
                      <ImageDetailsPanel
                        variant="lightbox"
                        hideHeader
                        image={currentDetailsImage}
                        onClose={() => setShowDetailsPanel(false)}
                        onToggleLike={() => toggleLike.mutate(currentDetailsImage.id)}
                        onSetAsHero={handleSetAsHero}
                        onDelete={handleDeleteCurrentImage}
                        onDeleteEdit={handleDeleteCurrentEdit}
                        onFullscreen={toggleFullscreen}
                        similarImages={getSimilarImages(currentDetailsImage.id)}
                        similarityLevel={detailsSimilarityLevel}
                        onSimilarityLevelChange={setDetailsSimilarityLevel}
                        onSimilarImageClick={(imgId) => {
                          setLightboxImage(imgId);
                          setDetailsImageId(imgId);
                        }}
                        galleryStyles={galleryStylesData}
                        activeStyleId={selectedViewStyle}
                        onSelectEditVersion={(styleId) => {
                          setSelectedViewStyle(styleId);
                        }}
                        onUpdateCategory={(imageId, label) => updateImageCategory.mutate({ imageIds: [imageId], label })}
                        availableLabels={availableLabels.map(l => l.label)}
                      />
                    )}
                  </div>
                </DrawerContent>
              </Drawer>
            ) : (
              <AnimatePresence>
                {showDetailsPanel && currentDetailsImage && (
                  <ImageDetailsPanel
                    variant="lightbox"
                    image={currentDetailsImage}
                    onClose={() => setShowDetailsPanel(false)}
                    onToggleLike={() => toggleLike.mutate(currentDetailsImage.id)}
                    onSetAsHero={handleSetAsHero}
                    onDelete={handleDeleteCurrentImage}
                    onDeleteEdit={handleDeleteCurrentEdit}
                    onFullscreen={toggleFullscreen}
                    similarImages={getSimilarImages(currentDetailsImage.id)}
                    similarityLevel={detailsSimilarityLevel}
                    onSimilarityLevelChange={setDetailsSimilarityLevel}
                    onSimilarImageClick={(imgId) => {
                      setLightboxImage(imgId);
                      setDetailsImageId(imgId);
                    }}
                    galleryStyles={galleryStylesData}
                    activeStyleId={selectedViewStyle}
                    onSelectEditVersion={(styleId) => {
                      setSelectedViewStyle(styleId);
                    }}
                    onUpdateCategory={(imageId, label) => updateImageCategory.mutate({ imageIds: [imageId], label })}
                    availableLabels={availableLabels.map(l => l.label)}
                  />
                )}
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <ShareGalleryModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        gallery={gallery}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ["gallery", id] })}
      />

      {/* Choose client photos (delivery selection) */}
      {gallery && id && (
        <DeliveryModal
          open={showDeliveryModal}
          onOpenChange={setShowDeliveryModal}
          galleryId={id}
          galleryName={gallery.name}
          clientLink={gallery.client_link}
        />
      )}

      {/* Re-Edit Modal */}
      <AnimatePresence>
        {showReEditModal && (
          <ReEditModalWithEdits
            showReEditModal={showReEditModal}
            setShowReEditModal={setShowReEditModal}
            selectedImages={selectedImages}
            setSelectedImages={setSelectedImages}
            styles={styles}
            isProcessing={isProcessing}
            gallery={gallery}
            reEditImages={reEditImages}
            queryClient={queryClient}
            galleryId={id}
            setPendingReEdit={setPendingReEdit}
          />
        )}
      </AnimatePresence>

      {/* Add Images Modal */}
      <AnimatePresence>
        {showAddImagesModal && gallery && (
          <AddImagesModal
            isOpen={showAddImagesModal}
            onClose={() => {
              setShowAddImagesModal(false);
              queryClient.invalidateQueries({ queryKey: ["gallery-images", id] });
              queryClient.invalidateQueries({ queryKey: ["gallery", id] });
            }}
            onUploadComplete={(count) => {
              setPendingUploadCount(count);
            }}
            galleryId={gallery.id}
            galleryName={gallery.name}
          />
        )}
      </AnimatePresence>

      {/* AI Culling Modal */}
      <AnimatePresence>
        {showAICullingModal && (
          <AICullingModal
            isOpen={showAICullingModal}
            onClose={() => { setShowAICullingModal(false); setCullingRequiredNote(false); }}
            onConfirm={(tags) => {
              setShowAICullingModal(false);
              setCullingRequiredNote(false);
              // Surface the live "AI is working" overlay for this run even
              // if a previous run had been minimized away.
              setCullingProgressMinimized(false);
              toast.success("Starting AI Culling... We'll update you when it's done in a few minutes.");
              runAICulling.mutate(tags);
            }}
            isProcessing={false}
            imageCount={images.length}
            showCullingRequiredNote={cullingRequiredNote}
            cullingStatus={gallery?.culling_status || "idle"}
            isCullingStuck={isCullingStuck}
            galleryType={gallery?.gallery_type}
            cullingStartedAt={gallery?.culling_started_at as string | null | undefined}
            cullingCompletedAt={gallery?.culling_completed_at as string | null | undefined}
            uploadCompletedAt={gallery?.upload_completed_at as string | null | undefined}
            hasCompletedCulling={hasCullingData}
          />
        )}
      </AnimatePresence>

      {/* AI Culling — "engine is working" overlay. Shown automatically
          while a run is genuinely in flight (processing, not stuck, no
          data yet) and not minimized. It's purely a live view: real
          completion / stuck transitions are driven by gallery state, so
          this closes itself the moment the run lands or the window
          elapses. Blocks a second run by occupying the screen, and the
          sidebar/banner trigger is guarded while processing. */}
      <AnimatePresence>
        {gallery?.culling_status === "processing" &&
          !isCullingStuck &&
          !hasCullingData &&
          !cullingProgressMinimized && (
            <CullingProgressOverlay
              isOpen
              imageCount={images.length}
              thumbnails={cullingPreviewThumbnails}
              startedAt={gallery?.culling_started_at as string | null | undefined}
              onMinimize={() => setCullingProgressMinimized(true)}
            />
          )}
      </AnimatePresence>

      {/* Gallery Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && gallery && (
          <GallerySettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            gallery={gallery}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ["gallery", id] })}
          />
        )}
      </AnimatePresence>

{/* Download Modal */}
      <DownloadGalleryModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        galleryName={gallery.name}
        images={images}
        selectedImageIds={selectedImages}
        galleryStyles={galleryStylesData.map((s) => ({ id: s.id, name: s.name }))}
        styleApiIdMap={styleApiIdMap}
        hasCullingData={hasCullingData}
      />
    </div>
   </FailedImagesProvider>
  );
}

// Wrapper that computes per-image usedStyleIds before rendering ReEditModal
function ReEditModalWithEdits({
  showReEditModal, setShowReEditModal, selectedImages, setSelectedImages,
  styles, isProcessing, gallery, reEditImages, queryClient, galleryId,
  setPendingReEdit,
}: {
  showReEditModal: boolean;
  setShowReEditModal: (v: boolean) => void;
  selectedImages: string[];
  setSelectedImages: (v: string[]) => void;
  styles: any[];
  isProcessing: boolean;
  gallery: any;
  reEditImages: (galleryId: string, imageIds: string[], styleIds: string[]) => Promise<boolean>;
  queryClient: any;
  galleryId: string | undefined;
  setPendingReEdit: (v: { imageIds: string[]; styleIds: string[] } | null) => void;
}) {
  // Query image_edits for selected images to find styles applied to ALL of them
  const { data: usedStyleIds = [] } = useQuery({
    queryKey: ["image-edits-styles", selectedImages],
    queryFn: async () => {
      if (selectedImages.length === 0) return [];
      const { data, error } = await supabase
        .from("image_edits")
        .select("image_id, style_id")
        .in("image_id", selectedImages);
      if (error) throw error;
      
      // Count how many selected images each style has been applied to
      const styleCounts = new Map<string, number>();
      for (const row of data || []) {
        if (!row.style_id) continue;
        styleCounts.set(row.style_id, (styleCounts.get(row.style_id) || 0) + 1);
      }
      
      // Only block styles applied to ALL selected images
      const totalSelected = selectedImages.length;
      return Array.from(styleCounts.entries())
        .filter(([_, count]) => count >= totalSelected)
        .map(([styleId]) => styleId);
    },
    enabled: showReEditModal && selectedImages.length > 0,
  });

  return (
    <ReEditModal
      isOpen={showReEditModal}
      onClose={() => setShowReEditModal(false)}
      selectedImageCount={selectedImages.length}
      styles={styles}
      usedStyleIds={usedStyleIds}
      isProcessing={isProcessing}
      onConfirm={(styleIds) => {
        if (gallery) {
          // Track pending re-edit before sending
          setPendingReEdit({ imageIds: [...selectedImages], styleIds: [...styleIds] });
          reEditImages(gallery.id, selectedImages, styleIds).then((success) => {
            if (success) {
              queryClient.invalidateQueries({ queryKey: ["gallery-images", galleryId] });
              queryClient.invalidateQueries({ queryKey: ["gallery", galleryId] });
              queryClient.invalidateQueries({ queryKey: ["gallery-styles-full"] });
              setSelectedImages([]);
            } else {
              // Clear pending if failed
              setPendingReEdit(null);
            }
            setShowReEditModal(false);
          });
        }
      }}
    />
  );
}
