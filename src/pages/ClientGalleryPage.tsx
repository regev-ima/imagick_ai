import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Sparkles,
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
import { ScanFace } from "lucide-react";
import { FaceThumbnail } from "@/components/gallery/FaceThumbnail";
import { Badge } from "@/components/ui/badge";

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
  const queryClient = useQueryClient();
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

  // Toggle like mutation - only record interaction, don't directly update gallery_images
  const likeMutation = useMutation({
    mutationFn: async ({ imageId, isLiked }: { imageId: string; isLiked: boolean }) => {
      // Record the interaction (client_interactions table allows public inserts for shared galleries)
      await supabase.from("client_interactions").insert({
        gallery_id: gallery!.id,
        image_id: imageId,
        interaction_type: isLiked ? "like" : "unlike",
        client_name: clientName || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-gallery-images"] });
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
    const image = images.find(img => img.id === imageId);
    if (image) {
      likeMutation.mutate({ imageId, isLiked: !image.is_liked });
    }
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

  // Prepare images for templates — use compressed/preview URLs so RAW files display correctly
  const templateImages = filteredImages.map(img => ({
    id: img.id,
    filename: img.filename,
    original_url: getPreviewUrl(img.original_url),
    is_liked: img.is_liked,
    ai_rating: img.ai_rating,
    culling_label: img.culling_label
  }));

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
        <Card className="glass-card border-border/50 p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Gallery Not Found</h1>
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
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4",
        darkMode ? "bg-[#0a0a0f]" : "bg-[#faf9f7]"
      )}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className={cn(
            "rounded-2xl p-8 text-center border",
            darkMode 
              ? "bg-white/5 border-white/10 text-white" 
              : "bg-white border-gray-200 text-gray-900"
          )}>
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6",
              darkMode ? "bg-white/10" : "bg-gray-100"
            )}>
              <Lock className={cn("w-8 h-8", darkMode ? "text-white" : "text-gray-900")} />
            </div>
            
            <h1 className="text-2xl font-light mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              {gallery.name}
            </h1>
            <p className={cn("mb-6", darkMode ? "text-white/60" : "text-gray-500")}>
              {gallery.description || "Protected Gallery"}
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="text-left">
                <label className={cn(
                  "text-sm font-medium mb-2 block",
                  darkMode ? "text-white/80" : "text-gray-700"
                )}>
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={clientName}
                  maxLength={100}
                  onChange={(e) => setClientName(e.target.value.replace(/[<>]/g, ''))}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border outline-none transition-colors",
                    darkMode
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-white/30"
                      : "bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                  )}
                />
              </div>

              <div className="text-left">
                <label className={cn(
                  "text-sm font-medium mb-2 block",
                  darkMode ? "text-white/80" : "text-gray-700"
                )}>
                  Gallery Password
                </label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border outline-none transition-colors",
                    darkMode
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-white/30"
                      : "bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                  )}
                />
                {passwordError && (
                  <p className="text-red-400 text-sm mt-2">{passwordError}</p>
                )}
              </div>

              <button 
                type="submit"
                disabled={isVerifying}
                className={cn(
                  "w-full py-3 rounded-lg font-medium transition-all disabled:opacity-50",
                  darkMode 
                    ? "bg-white text-black hover:bg-white/90" 
                    : "bg-gray-900 text-white hover:bg-gray-800"
                )}
              >
                <span className="flex items-center justify-center gap-2">
                  {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {isVerifying ? "Verifying..." : "View Gallery"}
                </span>
              </button>
            </form>

            <p className={cn(
              "text-xs mt-6",
              darkMode ? "text-white/40" : "text-gray-400"
            )}>
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
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4",
        darkMode ? "bg-[#0a0a0f] text-white" : "bg-[#faf9f7] text-gray-900"
      )}>
        <div className="text-center">
          <h1 className="text-2xl font-light mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            {gallery.name}
          </h1>
          <p className={darkMode ? "text-white/50" : "text-gray-400"}>
            This gallery is empty.
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
      {/* Face Search Bar — shown when face clusters exist */}
      {faceClusters.length > 0 && isAuthenticated && (
        <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/50">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3 overflow-x-auto">
              <div className="flex items-center gap-2 flex-shrink-0">
                <ScanFace className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium whitespace-nowrap">Find your photos:</span>
              </div>
              <button
                onClick={() => setActiveFaceCluster(null)}
                className={cn(
                  "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  !activeFaceCluster
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
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
                    "flex items-center gap-2 flex-shrink-0 rounded-full pr-3 transition-all",
                    activeFaceCluster === cluster.id
                      ? "bg-primary/20 ring-2 ring-primary"
                      : "bg-muted hover:bg-muted/80"
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
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {cluster.face_count}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {renderTemplate()}

      {/* Feedback Modal - Overlay on top of templates */}
      <AnimatePresence>
        {showFeedbackModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowFeedbackModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl">
                {feedbackSubmitted ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Thank you!</h3>
                    <p className="text-gray-500 dark:text-gray-400">Your feedback has been submitted.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Feedback</h3>
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
                      className="min-h-[120px] bg-muted border-border"
                    />
                    
                    <div className="flex gap-3 mt-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowFeedbackModal(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700 text-white"
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
