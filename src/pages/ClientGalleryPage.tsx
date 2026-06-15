import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Heart,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
  Send,
  Download,
  Eye,
  Check,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeLabel } from "@/lib/categoryUtils";
import { getPreviewUrl } from "@/lib/imageUrls";
import { ElegantTemplate } from "@/components/gallery/templates/ElegantTemplate";
import { ModernTemplate } from "@/components/gallery/templates/ModernTemplate";
import { EditorialTemplate } from "@/components/gallery/templates/EditorialTemplate";
import { ClassicTemplate } from "@/components/gallery/templates/ClassicTemplate";
import { FilmstripTemplate } from "@/components/gallery/templates/FilmstripTemplate";
import { StoryTemplate } from "@/components/gallery/templates/StoryTemplate";
import { LightboxFeedbackProvider } from "@/components/gallery/templates/GalleryLightbox";
import { ScanFace } from "lucide-react";
import { FaceThumbnail } from "@/components/gallery/FaceThumbnail";
import { Badge } from "@/components/ui/badge";

const PRISM_EASE = [0.2, 0, 0, 1] as const;

/** The 4-point AI sparkle — marks AI moments in the brand royal blue (#2B50F0). */
function Sparkle({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface GalleryImage {
  id: string;
  original_url: string;
  thumbnail_url: string | null;
  is_liked: boolean;
  filename: string;
  ai_rating: number | null;
  culling_label: string | null;
}

interface Gallery {
  id: string;
  name: string;
  description: string | null;
  requires_password: boolean;
  total_images: number;
  template?: string;
  client_dark_mode?: boolean;
  download_enabled?: boolean;
  hero_image_url?: string | null;
}

export default function ClientGalleryPage() {
  const { galleryId } = useParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [password, setPassword] = useState("");
  const [clientName, setClientName] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeFaceCluster, setActiveFaceCluster] = useState<string | null>(null);

  const [passwordError, setPasswordError] = useState("");

  // The client's OWN likes, persisted per-device. The DB's gallery_images.is_liked
  // is the PHOTOGRAPHER's global flag, so we track the client's likes locally and
  // override is_liked when rendering — this keeps the heart filled after refetch
  // and across reloads on this device.
  const [clientLikes, setClientLikes] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(`imagick-client-likes-${galleryId}`);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  // Fetch gallery by client_link using secure function (bypasses RLS safely)
  const { data: gallery, isLoading: galleryLoading, error: galleryError } = useQuery({
    queryKey: ["client-gallery", galleryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_public_gallery", { p_client_link: galleryId });

      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0] as Gallery;
    },
    enabled: !!galleryId
  });

  // Fetch gallery images — try RPC first, fall back to direct query
  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ["client-gallery-images", gallery?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_client_gallery_images" as any, {
          p_gallery_id: gallery!.id,
          p_session_token: sessionToken
        });

      if (error) {
        console.error("Gallery images fetch error:", error);
        throw error;
      }
      return (data || []) as GalleryImage[];
    },
    enabled: !!gallery?.id && isAuthenticated
  });

  // Fetch face clusters for this gallery
  const { data: faceClusters = [] } = useQuery({
    queryKey: ["client-face-clusters", gallery?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_clusters" as any)
        .select(`
          id, face_count, representative_bbox,
          representative_image:gallery_images!representative_image_id (
            id, original_url
          )
        `)
        .eq("gallery_id", gallery!.id)
        .order("face_count", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!gallery?.id && isAuthenticated,
  });

  // Fetch image IDs for the active face cluster
  const { data: faceClusterImageIds = [] } = useQuery({
    queryKey: ["client-face-cluster-images", activeFaceCluster],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_detections" as any)
        .select("image_id")
        .eq("cluster_id", activeFaceCluster!);
      if (error) throw error;
      const ids = new Set((data || []).map((d: any) => d.image_id));
      return Array.from(ids);
    },
    enabled: !!activeFaceCluster,
  });

  // Check if gallery requires password
  useEffect(() => {
    if (gallery && !gallery.requires_password) {
      setIsAuthenticated(true);
    }
  }, [gallery]);

  // Toggle like mutation - only record interaction, don't directly update gallery_images.
  // We deliberately do NOT invalidate ["client-gallery-images"] here: that query returns
  // the PHOTOGRAPHER's global is_liked flag (unchanged by this insert), so refetching would
  // flip the client's heart back. The client's own like is tracked in `clientLikes` instead.
  const likeMutation = useMutation({
    mutationFn: async ({ imageId, isLiked }: { imageId: string; isLiked: boolean }) => {
      // Record the interaction (client_interactions table allows public inserts for shared galleries)
      await supabase.from("client_interactions").insert({
        gallery_id: gallery!.id,
        image_id: imageId,
        interaction_type: isLiked ? "like" : "unlike",
        client_name: clientName || null
      });
    }
  });

  // Submit feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: async ({ imageId, feedbackText }: { imageId: string; feedbackText: string }) => {
      const { error } = await supabase.from("client_interactions").insert({
        gallery_id: gallery!.id,
        image_id: imageId,
        interaction_type: "feedback",
        feedback_text: feedbackText,
        client_name: clientName || null
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setFeedbackSubmitted(true);
      setTimeout(() => {
        setShowFeedbackModal(null);
        setFeedback("");
        setFeedbackSubmitted(false);
      }, 1500);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit feedback");
    }
  });

  // Record view on authentication
  useEffect(() => {
    if (isAuthenticated && gallery) {
      supabase.from("client_interactions").insert({
        gallery_id: gallery.id,
        interaction_type: "view",
        client_name: clientName || null
      });
    }
  }, [isAuthenticated, gallery, clientName]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gallery || !galleryId) return;
    
    setIsVerifying(true);
    setPasswordError("");
    
    try {
      const response = await supabase.functions.invoke("verify-gallery-password", {
        body: {
          galleryId: galleryId,
          password: password
        }
      });
      
      if (response.error) {
        setPasswordError("Failed to verify password. Please try again.");
        return;
      }
      
      if (response.data?.valid) {
        setSessionToken(response.data.accessToken || null);
        setIsAuthenticated(true);
      } else {
        setPasswordError("Incorrect password. Please try again.");
      }
    } catch (error) {
      setPasswordError("Failed to verify password. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLike = (imageId: string) => {
    // Toggle against the CLIENT's own likes (not the photographer's is_liked flag),
    // optimistically and persisted per-device, so the heart stays filled across refetch/reload.
    const next = !clientLikes.has(imageId);
    setClientLikes((prev) => {
      const updated = new Set(prev);
      if (next) updated.add(imageId);
      else updated.delete(imageId);
      try {
        window.localStorage.setItem(
          `imagick-client-likes-${galleryId}`,
          JSON.stringify(Array.from(updated))
        );
      } catch {
        // Ignore storage failures (private mode, quota) — in-memory state still works.
      }
      return updated;
    });
    likeMutation.mutate({ imageId, isLiked: next });
    toast(next ? "Added to your favorites" : "Removed from favorites");
  };

  const handleDownload = async (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (!image) return;
    try {
      const response = await fetch(image.original_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = image.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Failed to download image");
    }
  };

  // Compute categories from culling labels (MUST be before early returns - React hooks rules)
  const categories = useMemo(() => {
    const labels = new Set<string>();
    images.forEach(img => {
      if (img.culling_label) labels.add(normalizeLabel(img.culling_label));
    });
    return Array.from(labels).sort();
  }, [images]);

  // Filter images by active category and/or face cluster
  const filteredImages = useMemo(() => {
    let result = images;
    if (activeCategory) {
      result = result.filter(img =>
        img.culling_label && normalizeLabel(img.culling_label) === activeCategory
      );
    }
    if (activeFaceCluster && faceClusterImageIds.length > 0) {
      const idSet = new Set(faceClusterImageIds);
      result = result.filter(img => idSet.has(img.id));
    }
    return result;
  }, [images, activeCategory, activeFaceCluster, faceClusterImageIds]);

  // Prepare images for templates — use compressed/preview URLs so RAW files display correctly.
  // is_liked is overridden with the CLIENT's own likes so the heart reflects what THIS client
  // tapped (the DB's is_liked is the photographer's global flag). The same list feeds the
  // template grid AND the lightbox, so both stay in sync.
  const templateImages = useMemo(
    () =>
      filteredImages.map(img => ({
        id: img.id,
        filename: img.filename,
        original_url: getPreviewUrl(img.original_url),
        is_liked: clientLikes.has(img.id),
        ai_rating: img.ai_rating,
        culling_label: img.culling_label
      })),
    [filteredImages, clientLikes]
  );

  const template = gallery?.template || "elegant";
  const darkMode = gallery?.client_dark_mode ?? true;
  const downloadEnabled = gallery?.download_enabled ?? true;

  // Loading state
  if (galleryLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state - gallery not found
  if (galleryError || !gallery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="surface-1 rounded-3xl border-border/60 p-10 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-semibold mb-2">Gallery not found</h1>
          <p className="text-muted-foreground">
            The gallery you're looking for doesn't exist or the link may have expired.
          </p>
        </Card>
      </div>
    );
  }

  // Password Protection Screen
  if (!isAuthenticated && gallery.requires_password) {
    return (
      <div
        className={cn(
          "min-h-screen flex items-center justify-center p-4 bg-background text-foreground",
          darkMode ? "dark" : "light"
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: PRISM_EASE }}
          className="w-full max-w-md"
        >
          <div className="surface-1 rounded-3xl p-8 text-center border border-border/60">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
              <Lock className="w-7 h-7 text-foreground" />
            </div>

            <h1 className="font-display text-2xl font-semibold tracking-tight mb-2">
              {gallery.name}
            </h1>
            <p className="text-muted-foreground mb-7">
              {gallery.description || "Protected gallery"}
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="text-left">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2 block">
                  Your name (optional)
                </label>
                <input
                  type="text"
                  placeholder="Enter your name (optional)"
                  value={clientName}
                  maxLength={100}
                  onChange={(e) => setClientName(e.target.value.replace(/[<>]/g, ''))}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/60 focus:bg-muted"
                />
              </div>

              <div className="text-left">
                <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2 block">
                  Gallery password
                </label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/60 focus:bg-muted"
                />
                {passwordError && (
                  <p className="text-destructive text-sm mt-2">{passwordError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 rounded-full font-medium bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
              >
                <span className="flex items-center justify-center gap-2">
                  {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {isVerifying ? "Verifying..." : "View gallery"}
                </span>
              </button>
            </form>

            <p className="text-xs text-muted-foreground/80 mt-6 leading-relaxed">
              This gallery is password protected. Please enter the password provided by your photographer.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Loading images
  if (imagesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Empty gallery
  if (images.length === 0) {
    return (
      <div
        className={cn(
          "min-h-screen flex items-center justify-center p-4 bg-background text-foreground",
          darkMode ? "dark" : "light"
        )}
      >
        <div className="text-center max-w-md">
          <div className="mx-auto mb-6 w-14 h-14 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
            <Sparkle size={26} className="text-primary" />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight mb-3">
            {gallery.name}
          </h1>
          <p className="text-base text-foreground/90 mb-2">
            Your photos are still being prepared.
          </p>
          <p className="text-sm text-muted-foreground">
            Please check back soon — your photographer will let you know when they're ready.
          </p>
        </div>
      </div>
    );
  }

  // Render based on template
  const renderTemplate = () => {
    const commonProps = {
      galleryName: gallery.name,
      description: gallery.description || undefined,
      images: templateImages,
      heroImage: gallery.hero_image_url || undefined,
      darkMode,
      downloadEnabled,
      onLike: handleLike,
      onDownload: handleDownload,
      categories,
      activeCategory,
      onCategoryChange: setActiveCategory
    };

    switch (template) {
      case "modern":
        return <ModernTemplate {...commonProps} />;
      case "editorial":
        return <EditorialTemplate {...commonProps} />;
      case "classic":
        return <ClassicTemplate {...commonProps} />;
      case "filmstrip":
        return <FilmstripTemplate {...commonProps} />;
      case "story":
        return <StoryTemplate {...commonProps} />;
      case "elegant":
      default:
        return <ElegantTemplate {...commonProps} />;
    }
  };

  return (
    <>
      {/* Face Search Bar — AI face clustering, so it carries the brand AI
          signature: the 4-point royal-blue sparkle + a royal-blue active ring
          on the selected face. Scoped to the gallery's theme so it matches the
          template beneath it. */}
      {faceClusters.length > 0 && isAuthenticated && (
        <div className={cn(darkMode ? "dark" : "light")}>
          <div className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/60">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <Sparkle size={18} className="text-primary" />
                  <span className="font-display text-sm font-medium whitespace-nowrap text-foreground">
                    Find your photos
                  </span>
                  <span className="aura-microlabel hidden sm:inline text-primary/80">AI</span>
                </div>
                <button
                  onClick={() => setActiveFaceCluster(null)}
                  className={cn(
                    "flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors",
                    !activeFaceCluster
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/70 text-muted-foreground"
                  )}
                >
                  All
                </button>
                {faceClusters.map((cluster: any) => (
                  <button
                    key={cluster.id}
                    onClick={() => setActiveFaceCluster(
                      activeFaceCluster === cluster.id ? null : cluster.id
                    )}
                    className={cn(
                      "flex items-center gap-2 flex-shrink-0 rounded-full pr-3 p-0.5 transition-all",
                      activeFaceCluster === cluster.id
                        ? "aura-ai-border bg-muted"
                        : "bg-muted hover:bg-muted/70"
                    )}
                  >
                    {cluster.representative_image && cluster.representative_bbox ? (
                      <FaceThumbnail
                        imageUrl={cluster.representative_image.original_url}
                        bbox={cluster.representative_bbox}
                        size={32}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                        <ScanFace className="w-4 h-4" />
                      </div>
                    )}
                    <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                      {cluster.face_count}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provide the feedback handler to the lightbox (rendered inside the template) so the
          "Leave a note" button opens the existing styled modal for that photo. This wires the
          modal without changing the locked TemplateProps contract. */}
      <LightboxFeedbackProvider onFeedback={(id) => setShowFeedbackModal(id)}>
        {renderTemplate()}
      </LightboxFeedbackProvider>

      {/* Feedback Modal - Overlay on top of templates */}
      <AnimatePresence>
        {showFeedbackModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: PRISM_EASE }}
            className={cn(
              "fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4",
              darkMode ? "dark" : "light"
            )}
            onClick={() => setShowFeedbackModal(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.3, ease: PRISM_EASE }}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="surface-2 rounded-3xl p-6 border border-border/60">
                {feedbackSubmitted ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-2xl bg-secondary/15 flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-secondary" />
                    </div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Thank you!</h3>
                    <p className="text-muted-foreground">Your feedback has been submitted.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
                          <MessageSquare className="w-5 h-5 text-foreground" />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-foreground">Add feedback</h3>
                      </div>
                      <button
                        onClick={() => setShowFeedbackModal(null)}
                        className="p-2 rounded-full hover:bg-muted transition-colors"
                      >
                        <X className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </div>

                    <Textarea
                      placeholder="Share your thoughts about this image..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="min-h-[120px] rounded-2xl bg-muted/60 border-border"
                    />

                    <div className="flex gap-3 mt-4">
                      <Button
                        variant="outline"
                        className="flex-1 rounded-full"
                        onClick={() => setShowFeedbackModal(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 gap-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => {
                          if (feedback.trim() && showFeedbackModal) {
                            feedbackMutation.mutate({ imageId: showFeedbackModal, feedbackText: feedback });
                          }
                        }}
                        disabled={!feedback.trim() || feedbackMutation.isPending}
                      >
                        {feedbackMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Submit
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
