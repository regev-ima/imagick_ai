import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  MessageSquare,
  X,
  Send,
  Eye,
  Check,
  Sparkles,
  Loader2,
  Clock,
  Mail,
  MessageCircle,
  Copy,
  Instagram,
  Facebook,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { BrandThemeProvider } from "@/components/gallery/BrandThemeProvider";
import { SelectionFlow } from "@/components/gallery/SelectionFlow";

interface GalleryImage {
  id: string;
  original_url: string;
  thumbnail_url: string | null;
  is_liked: boolean;
  filename: string;
  ai_rating: number | null;
  culling_label: string | null;
  is_ai_suggested?: boolean;
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
  brand_logo_url?: string | null;
  brand_primary_color?: string | null;
  brand_accent_color?: string | null;
  brand_font_pair?: string | null;
  intro_mode?: string | null;
  intro_music_url?: string | null;
  selection_mode_enabled?: boolean;
  selection_target_count?: number;
  email_gate_enabled?: boolean;
  share_secret?: string | null;
}

const EMAIL_GATE_STORAGE_PREFIX = "imagick:gallery-email:";
const SELECTION_DONE_STORAGE_PREFIX = "imagick:selection-done:";

export default function ClientGalleryPage() {
  const { galleryId } = useParams();
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [password, setPassword] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [emailGatePassed, setEmailGatePassed] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeFaceCluster, setActiveFaceCluster] = useState<string | null>(null);
  const [showSelectionFlow, setShowSelectionFlow] = useState(false);
  const [selectionCompleted, setSelectionCompleted] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Restore email gate state from localStorage on mount
  useEffect(() => {
    if (!galleryId) return;
    const storedEmail = localStorage.getItem(EMAIL_GATE_STORAGE_PREFIX + galleryId);
    if (storedEmail) {
      try {
        const parsed = JSON.parse(storedEmail);
        if (parsed?.email) {
          setClientEmail(parsed.email);
          setClientName(parsed.name ?? "");
          setEmailGatePassed(true);
        }
      } catch {
        // Legacy format (raw email string) — accept it
        setClientEmail(storedEmail);
        setEmailGatePassed(true);
      }
    }
    const selectionDone = localStorage.getItem(SELECTION_DONE_STORAGE_PREFIX + galleryId);
    if (selectionDone === "true") setSelectionCompleted(true);
  }, [galleryId]);

  // Fetch gallery via the upgraded RPC (returns brand + intro + selection fields).
  // The new columns aren't in supabase/types.ts yet, so cast to any.
  const { data: gallery, isLoading: galleryLoading, error: galleryError } = useQuery({
    queryKey: ["client-gallery", galleryId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_public_gallery", {
        p_client_link: galleryId,
      });
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0] as Gallery;
    },
    enabled: !!galleryId,
  });

  // Fetch gallery images — RPC returns is_ai_suggested flag among other fields
  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ["client-gallery-images", gallery?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_client_gallery_images" as any, {
        p_gallery_id: gallery!.id,
        p_session_token: sessionToken,
      });

      if (error) {
        console.error("Gallery images fetch error:", error);
        throw error;
      }
      return (data || []) as GalleryImage[];
    },
    enabled: !!gallery?.id && isAuthenticated,
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

  // Gate logic:
  // - If gallery requires password, we still need password to unlock.
  // - If email gate is on, require it before authenticated state regardless of password.
  // - If neither is on, auto-authenticate.
  useEffect(() => {
    if (!gallery) return;
    if (!gallery.requires_password && !gallery.email_gate_enabled) {
      setIsAuthenticated(true);
      return;
    }
    if (!gallery.requires_password && gallery.email_gate_enabled && emailGatePassed) {
      setIsAuthenticated(true);
    }
  }, [gallery, emailGatePassed]);

  // Toggle like mutation - only record interaction
  const likeMutation = useMutation({
    mutationFn: async ({ imageId, isLiked }: { imageId: string; isLiked: boolean }) => {
      await supabase.from("client_interactions").insert({
        gallery_id: gallery!.id,
        image_id: imageId,
        interaction_type: isLiked ? "like" : "unlike",
        client_name: clientName || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-gallery-images"] });
    },
  });

  // Submit feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: async ({ imageId, feedbackText }: { imageId: string; feedbackText: string }) => {
      const { error } = await supabase.from("client_interactions").insert({
        gallery_id: gallery!.id,
        image_id: imageId,
        interaction_type: "feedback",
        feedback_text: feedbackText,
        client_name: clientName || null,
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
    },
  });

  // Record view on authentication
  useEffect(() => {
    if (isAuthenticated && gallery) {
      supabase.from("client_interactions").insert({
        gallery_id: gallery.id,
        interaction_type: "view",
        client_name: clientName || null,
      });
    }
  }, [isAuthenticated, gallery, clientName]);

  // ── Dwell tracking ───────────────────────────────────────────────────
  // Track how long the user stays on the gallery. Posts via sendBeacon on
  // tab close / route change. Falls back to client_interactions insert when
  // the edge function isn't available.
  const dwellStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !gallery) return;
    dwellStartRef.current = Date.now();

    const flushDwell = () => {
      const start = dwellStartRef.current;
      if (!start) return;
      const seconds = Math.round((Date.now() - start) / 1000);
      if (seconds < 2) return; // ignore micro-visits
      dwellStartRef.current = Date.now(); // reset window
      const payload = {
        gallery_id: gallery.id,
        seconds,
        client_email: clientEmail || null,
        client_name: clientName || null,
      };
      try {
        const supabaseUrl =
          (import.meta as any).env?.VITE_SUPABASE_URL ||
          (supabase as any).supabaseUrl ||
          "";
        const url = supabaseUrl
          ? `${supabaseUrl}/functions/v1/gallery-record-dwell`
          : null;
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        const ok =
          url && typeof navigator.sendBeacon === "function"
            ? navigator.sendBeacon(url, blob)
            : false;
        if (!ok) {
          // TODO: edge function may not exist yet. Fall back to direct insert
          // into client_interactions so we don't lose the dwell signal.
          supabase.from("client_interactions").insert({
            gallery_id: gallery.id,
            interaction_type: "dwell",
            feedback_text: JSON.stringify({ seconds }),
            client_name: clientName || null,
          });
        }
      } catch {
        // Best effort — never break the page on telemetry errors.
      }
    };

    window.addEventListener("beforeunload", flushDwell);
    window.addEventListener("pagehide", flushDwell);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushDwell();
    });
    return () => {
      flushDwell();
      window.removeEventListener("beforeunload", flushDwell);
      window.removeEventListener("pagehide", flushDwell);
    };
  }, [isAuthenticated, gallery, clientEmail, clientName]);

  // ── Share-event tracking ─────────────────────────────────────────────
  const recordShare = useCallback(
    (imageId: string | null, channel: string) => {
      if (!gallery) return;
      // Fire-and-forget: don't await.
      supabase.functions
        .invoke("gallery-record-share", {
          body: { galleryId: gallery.id, imageId, channel },
        })
        .catch(() => {
          // TODO: silently swallow — edge function may not be deployed yet.
        });
    },
    [gallery]
  );

  const shareUrlForImage = useCallback(
    (imageId?: string | null) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      if (imageId && gallery?.id) {
        return `${origin}/gallery/${galleryId}/photo/${imageId}`;
      }
      return `${origin}/gallery/${galleryId}`;
    },
    [galleryId, gallery?.id]
  );

  const handleShare = useCallback(
    async (channel: "whatsapp" | "copy" | "instagram" | "facebook", imageId?: string) => {
      const url = shareUrlForImage(imageId);
      recordShare(imageId ?? null, channel);
      switch (channel) {
        case "whatsapp":
          window.open(
            `https://wa.me/?text=${encodeURIComponent(url)}`,
            "_blank",
            "noopener,noreferrer"
          );
          break;
        case "copy":
          try {
            await navigator.clipboard.writeText(url);
            toast.success("Link copied");
          } catch {
            toast.error("Couldn't copy link");
          }
          break;
        case "instagram":
          window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
          break;
        case "facebook":
          window.open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
            "_blank",
            "noopener,noreferrer"
          );
          break;
      }
    },
    [shareUrlForImage, recordShare]
  );

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gallery || !galleryId) return;
    // If email gate is on but the email hasn't been captured, save it now.
    if (gallery.email_gate_enabled && !emailGatePassed) {
      if (!isValidEmail(clientEmail)) {
        setPasswordError("Please enter a valid email so your photographer can reach you.");
        return;
      }
    }

    setIsVerifying(true);
    setPasswordError("");

    try {
      const response = await supabase.functions.invoke("verify-gallery-password", {
        body: { galleryId, password },
      });

      if (response.error) {
        setPasswordError("Failed to verify password. Please try again.");
        return;
      }

      if (response.data?.valid) {
        setSessionToken(response.data.accessToken || null);
        setIsAuthenticated(true);
        if (gallery.email_gate_enabled) persistEmailGate();
      } else {
        setPasswordError("Incorrect password. Please try again.");
      }
    } catch {
      setPasswordError("Failed to verify password. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const persistEmailGate = useCallback(() => {
    if (!galleryId) return;
    localStorage.setItem(
      EMAIL_GATE_STORAGE_PREFIX + galleryId,
      JSON.stringify({ email: clientEmail, name: clientName })
    );
    setEmailGatePassed(true);
  }, [galleryId, clientEmail, clientName]);

  const handleEmailGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(clientEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    persistEmailGate();
  };

  const handleLike = (imageId: string) => {
    const image = images.find((img) => img.id === imageId);
    if (image) {
      likeMutation.mutate({ imageId, isLiked: !image.is_liked });
    }
  };

  const handleDownload = async (imageId: string) => {
    const image = images.find((img) => img.id === imageId);
    if (!image) return;
    try {
      const response = await fetch(image.original_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
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
    images.forEach((img) => {
      if (img.culling_label) labels.add(normalizeLabel(img.culling_label));
    });
    return Array.from(labels).sort();
  }, [images]);

  // Filter images by active category and/or face cluster
  const filteredImages = useMemo(() => {
    let result = images;
    if (activeCategory) {
      result = result.filter(
        (img) =>
          img.culling_label && normalizeLabel(img.culling_label) === activeCategory
      );
    }
    if (activeFaceCluster && faceClusterImageIds.length > 0) {
      const idSet = new Set(faceClusterImageIds);
      result = result.filter((img) => idSet.has(img.id));
    }
    return result;
  }, [images, activeCategory, activeFaceCluster, faceClusterImageIds]);

  // Prepare images for templates
  const templateImages = filteredImages.map((img) => ({
    id: img.id,
    filename: img.filename,
    original_url: getPreviewUrl(img.original_url),
    is_liked: img.is_liked,
    ai_rating: img.ai_rating,
    culling_label: img.culling_label,
  }));

  // All images shaped for SelectionFlow (use unfiltered set)
  const selectionImages = useMemo(
    () =>
      images.map((img) => ({
        id: img.id,
        filename: img.filename,
        original_url: getPreviewUrl(img.original_url),
        is_liked: img.is_liked,
        ai_rating: img.ai_rating,
        culling_label: img.culling_label,
      })),
    [images]
  );

  const suggestedImageIds = useMemo(
    () => new Set(images.filter((img) => img.is_ai_suggested).map((img) => img.id)),
    [images]
  );

  const template = gallery?.template || "elegant";
  const darkMode = gallery?.client_dark_mode ?? true;
  const downloadEnabled = gallery?.download_enabled ?? true;

  // ── Render: loading state ────────────────────────────────────────────
  if (galleryLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render: expired / revoked / not found ────────────────────────────
  // get_public_gallery filters revoked + expired galleries server-side, so
  // a null response on an otherwise-valid client_link means one of those.
  if (galleryError || !gallery) {
    return (
      <BrandThemeProvider>
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#0b0a09] text-[#f5f3ee]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-md"
          >
            <div className="w-16 h-16 rounded-full border border-white/15 flex items-center justify-center mx-auto mb-8">
              <Clock className="w-7 h-7 opacity-70" />
            </div>
            <p className="text-[10px] tracking-[0.32em] uppercase opacity-60 mb-4">
              Gallery
            </p>
            <h1
              className="text-3xl md:text-4xl mb-4 leading-tight"
              style={{ fontFamily: "var(--brand-font-display, 'Playfair Display', serif)" }}
            >
              This gallery is no longer available.
            </h1>
            <p className="opacity-70 leading-relaxed">
              The link may have expired or been revoked by your photographer.
              Please reach out to them for a new one.
            </p>
          </motion.div>
        </div>
      </BrandThemeProvider>
    );
  }

  // ── Render: password / email gate ────────────────────────────────────
  const needsPassword = !isAuthenticated && gallery.requires_password;
  const needsEmail =
    !isAuthenticated && gallery.email_gate_enabled && !emailGatePassed;

  // Email gate (no password) — show standalone capture before gallery.
  if (needsEmail && !gallery.requires_password) {
    return (
      <BrandThemeProvider
        primaryColor={gallery.brand_primary_color}
        accentColor={gallery.brand_accent_color}
        fontPair={gallery.brand_font_pair}
        logoUrl={gallery.brand_logo_url}
      >
        <EmailGateCard
          gallery={gallery}
          clientName={clientName}
          clientEmail={clientEmail}
          onName={setClientName}
          onEmail={setClientEmail}
          onSubmit={handleEmailGateSubmit}
        />
      </BrandThemeProvider>
    );
  }

  // Password screen — also collects email if email gate is on.
  if (needsPassword) {
    return (
      <BrandThemeProvider
        primaryColor={gallery.brand_primary_color}
        accentColor={gallery.brand_accent_color}
        fontPair={gallery.brand_font_pair}
        logoUrl={gallery.brand_logo_url}
      >
        <div
          className={cn(
            "min-h-screen flex items-center justify-center p-4",
            darkMode ? "bg-[#0a0a0f]" : "bg-[#faf9f7]"
          )}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
          >
            <div
              className={cn(
                "rounded-2xl p-8 text-center border",
                darkMode
                  ? "bg-white/5 border-white/10 text-white"
                  : "bg-white border-gray-200 text-gray-900"
              )}
            >
              {gallery.brand_logo_url ? (
                <img
                  src={gallery.brand_logo_url}
                  alt={gallery.name}
                  className="mx-auto mb-6 max-h-12 object-contain"
                />
              ) : (
                <div
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6",
                    darkMode ? "bg-white/10" : "bg-gray-100"
                  )}
                >
                  <Lock
                    className={cn(
                      "w-8 h-8",
                      darkMode ? "text-white" : "text-gray-900"
                    )}
                  />
                </div>
              )}

              <h1
                className="text-2xl font-light mb-2"
                style={{
                  fontFamily: "var(--brand-font-display, 'Playfair Display', serif)",
                }}
              >
                {gallery.name}
              </h1>
              <p className={cn("mb-6", darkMode ? "text-white/60" : "text-gray-500")}>
                {gallery.description || "Protected Gallery"}
              </p>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="text-left">
                  <label
                    className={cn(
                      "text-sm font-medium mb-2 block",
                      darkMode ? "text-white/80" : "text-gray-700"
                    )}
                  >
                    Your Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={clientName}
                    maxLength={100}
                    onChange={(e) =>
                      setClientName(e.target.value.replace(/[<>]/g, ""))
                    }
                    className={cn(
                      "w-full px-4 py-3 rounded-lg border outline-none transition-colors",
                      darkMode
                        ? "bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-white/30"
                        : "bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                    )}
                  />
                </div>

                {gallery.email_gate_enabled && (
                  <div className="text-left">
                    <label
                      className={cn(
                        "text-sm font-medium mb-2 block",
                        darkMode ? "text-white/80" : "text-gray-700"
                      )}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 rounded-lg border outline-none transition-colors",
                        darkMode
                          ? "bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-white/30"
                          : "bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                      )}
                    />
                  </div>
                )}

                <div className="text-left">
                  <label
                    className={cn(
                      "text-sm font-medium mb-2 block",
                      darkMode ? "text-white/80" : "text-gray-700"
                    )}
                  >
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
                  style={
                    gallery.brand_primary_color
                      ? {
                          background: gallery.brand_primary_color,
                          color: "#0b0a09",
                        }
                      : undefined
                  }
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

              <p
                className={cn(
                  "text-xs mt-6",
                  darkMode ? "text-white/40" : "text-gray-400"
                )}
              >
                This gallery is private. Please enter the password provided by
                your photographer.
              </p>
            </div>
          </motion.div>
        </div>
      </BrandThemeProvider>
    );
  }

  // ── Render: loading images ───────────────────────────────────────────
  if (imagesLoading) {
    return (
      <BrandThemeProvider
        primaryColor={gallery.brand_primary_color}
        accentColor={gallery.brand_accent_color}
        fontPair={gallery.brand_font_pair}
      >
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </BrandThemeProvider>
    );
  }

  // ── Render: empty gallery ────────────────────────────────────────────
  if (images.length === 0) {
    return (
      <BrandThemeProvider
        primaryColor={gallery.brand_primary_color}
        accentColor={gallery.brand_accent_color}
        fontPair={gallery.brand_font_pair}
        logoUrl={gallery.brand_logo_url}
      >
        <div
          className={cn(
            "min-h-screen flex items-center justify-center p-4",
            darkMode ? "bg-[#0a0a0f] text-white" : "bg-[#faf9f7] text-gray-900"
          )}
        >
          <div className="text-center max-w-md">
            {gallery.brand_logo_url ? (
              <img
                src={gallery.brand_logo_url}
                alt={gallery.name}
                className="mx-auto mb-8 max-h-12 object-contain"
              />
            ) : null}
            <h1
              className="text-3xl font-light mb-3"
              style={{
                fontFamily: "var(--brand-font-display, 'Playfair Display', serif)",
              }}
            >
              {gallery.name}
            </h1>
            <p
              className={cn(
                "text-base mb-2",
                darkMode ? "text-white/80" : "text-gray-700"
              )}
            >
              Your photos are still being prepared.
            </p>
            <p className={cn("text-sm", darkMode ? "text-white/50" : "text-gray-500")}>
              Please check back soon — your photographer will let you know when
              they're ready.
            </p>
          </div>
        </div>
      </BrandThemeProvider>
    );
  }

  // ── Render: main gallery ─────────────────────────────────────────────
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
      onCategoryChange: setActiveCategory,
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

  const selectionTarget = gallery.selection_target_count ?? 60;
  const selectedSoFar = images.filter((img) => img.is_ai_suggested).length;

  return (
    <BrandThemeProvider
      primaryColor={gallery.brand_primary_color}
      accentColor={gallery.brand_accent_color}
      fontPair={gallery.brand_font_pair}
      logoUrl={gallery.brand_logo_url}
    >
      {/* Photographer logo header — replaces generic Imagick chrome. */}
      {gallery.brand_logo_url && (
        <div className="sticky top-0 z-30 backdrop-blur-md bg-black/30 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
            <img
              src={gallery.brand_logo_url}
              alt={gallery.name}
              className="max-h-8 md:max-h-10 object-contain"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShareMenuOpen((v) => !v)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/80"
                aria-label="Share gallery"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selection-mode banner */}
      {gallery.selection_mode_enabled && (
        <SelectionBanner
          completed={selectionCompleted}
          target={selectionTarget}
          selectedCount={selectedSoFar}
          onOpen={() => setShowSelectionFlow(true)}
        />
      )}

      {/* Face search bar — kept from the original page */}
      {faceClusters.length > 0 && isAuthenticated && (
        <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/50">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3 overflow-x-auto">
              <div className="flex items-center gap-2 flex-shrink-0">
                <ScanFace className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium whitespace-nowrap">
                  Find your photos:
                </span>
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
                  onClick={() =>
                    setActiveFaceCluster(
                      activeFaceCluster === cluster.id ? null : cluster.id
                    )
                  }
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
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {cluster.face_count}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {renderTemplate()}

      {/* Floating share dock — gallery-level share for the photographer's brand.
          The lightbox is owned by templates so we surface share affordances at
          the page level. Each click fires a beacon to gallery-record-share. */}
      <ShareDock
        open={shareMenuOpen}
        onToggle={() => setShareMenuOpen((v) => !v)}
        onShare={(channel) => handleShare(channel)}
      />

      {/* Selection overlay */}
      <AnimatePresence>
        {showSelectionFlow && gallery.selection_mode_enabled && (
          <SelectionFlow
            galleryId={gallery.id}
            images={selectionImages}
            targetCount={selectionTarget}
            suggestedImageIds={suggestedImageIds}
            sessionToken={sessionToken ?? undefined}
            clientEmail={clientEmail || undefined}
            clientName={clientName || undefined}
            onComplete={() => {
              setShowSelectionFlow(false);
              setSelectionCompleted(true);
              if (galleryId) {
                localStorage.setItem(
                  SELECTION_DONE_STORAGE_PREFIX + galleryId,
                  "true"
                );
              }
            }}
            onClose={() => setShowSelectionFlow(false)}
          />
        )}
      </AnimatePresence>

      {/* Feedback modal */}
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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Thank you!
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Your feedback has been submitted.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Add Feedback
                        </h3>
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
                            feedbackMutation.mutate({
                              imageId: showFeedbackModal,
                              feedbackText: feedback,
                            });
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
    </BrandThemeProvider>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function EmailGateCard({
  gallery,
  clientName,
  clientEmail,
  onName,
  onEmail,
  onSubmit,
}: {
  gallery: Gallery;
  clientName: string;
  clientEmail: string;
  onName: (s: string) => void;
  onEmail: (s: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0b0a09] text-[#f5f3ee]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md text-center"
      >
        {gallery.brand_logo_url ? (
          <img
            src={gallery.brand_logo_url}
            alt={gallery.name}
            className="mx-auto mb-10 max-h-14 object-contain"
          />
        ) : (
          <div className="mx-auto mb-10 w-12 h-12 rounded-full border border-white/15 flex items-center justify-center">
            <Mail className="w-5 h-5 opacity-70" />
          </div>
        )}
        <p className="text-[10px] tracking-[0.32em] uppercase opacity-60 mb-3">
          Welcome
        </p>
        <h1
          className="text-3xl md:text-4xl mb-3 leading-tight"
          style={{
            fontFamily: "var(--brand-font-display, 'Playfair Display', serif)",
          }}
        >
          {gallery.name}
        </h1>
        <p className="opacity-70 mb-10 leading-relaxed">
          Tell us who you are so your photographer knows you've seen the gallery.
        </p>
        <form onSubmit={onSubmit} className="space-y-3 text-left">
          <div>
            <label className="text-[10px] tracking-[0.24em] uppercase opacity-60 mb-2 block">
              Your name
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => onName(e.target.value.replace(/[<>]/g, ""))}
              maxLength={100}
              className="w-full bg-transparent border-b border-white/20 focus:border-white/60 outline-none py-3 text-lg placeholder:text-white/30 transition-colors"
              placeholder="Maya Levi"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.24em] uppercase opacity-60 mb-2 block">
              Email
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => onEmail(e.target.value)}
              className="w-full bg-transparent border-b border-white/20 focus:border-white/60 outline-none py-3 text-lg placeholder:text-white/30 transition-colors"
              placeholder="maya@example.com"
            />
          </div>
          <button
            type="submit"
            className="w-full mt-8 py-4 rounded-full text-sm tracking-[0.16em] uppercase font-medium transition-all"
            style={{
              background: "var(--brand-primary, #f5f3ee)",
              color: "#0b0a09",
            }}
          >
            Enter Gallery
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function SelectionBanner({
  completed,
  target,
  selectedCount,
  onOpen,
}: {
  completed: boolean;
  target: number;
  selectedCount: number;
  onOpen: () => void;
}) {
  return (
    <motion.button
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={completed ? undefined : onOpen}
      className={cn(
        "sticky top-0 z-30 w-full text-left transition-colors",
        "border-b backdrop-blur-md",
        completed
          ? "bg-[color:var(--brand-accent,#26241f)]/20 border-[color:var(--brand-accent,#fff)]/10 cursor-default"
          : "bg-[color:var(--brand-primary,#0b0a09)]/12 border-white/8 hover:bg-[color:var(--brand-primary,#0b0a09)]/18"
      )}
      style={{ fontFamily: "var(--brand-font-body)" }}
    >
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-3 md:py-4 flex items-center gap-4">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: completed
              ? "color-mix(in srgb, var(--brand-accent, #6c8c52) 30%, transparent)"
              : "color-mix(in srgb, var(--brand-primary, #f5f3ee) 18%, transparent)",
          }}
        >
          {completed ? (
            <Check className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-[0.28em] uppercase opacity-60 mb-0.5">
            {completed ? "Sent" : "Selection mode"}
          </p>
          <p
            className="text-sm md:text-base leading-snug truncate"
            style={{ fontFamily: "var(--brand-font-display)" }}
          >
            {completed
              ? `Your selection of ${selectedCount} photos has been sent.`
              : `Your photographer pre-selected ${target} photos. Tap to review.`}
          </p>
        </div>
        {!completed && (
          <span className="text-[10px] tracking-[0.2em] uppercase opacity-60 hidden md:inline">
            Review →
          </span>
        )}
      </div>
    </motion.button>
  );
}

function ShareDock({
  open,
  onToggle,
  onShare,
}: {
  open: boolean;
  onToggle: () => void;
  onShare: (channel: "whatsapp" | "copy" | "instagram" | "facebook") => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-2 items-end"
          >
            <ShareButton
              label="WhatsApp"
              onClick={() => onShare("whatsapp")}
              icon={<MessageCircle className="w-4 h-4" />}
            />
            <ShareButton
              label="Copy link"
              onClick={() => onShare("copy")}
              icon={<Copy className="w-4 h-4" />}
            />
            <ShareButton
              label="Instagram"
              onClick={() => onShare("instagram")}
              icon={<Instagram className="w-4 h-4" />}
            />
            <ShareButton
              label="Facebook"
              onClick={() => onShare("facebook")}
              icon={<Facebook className="w-4 h-4" />}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={onToggle}
        aria-label="Share"
        className="w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-95"
        style={{
          background: "color-mix(in srgb, var(--brand-primary, #0b0a09) 85%, transparent)",
          color: "#f5f3ee",
        }}
      >
        {open ? <X className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
      </button>
    </div>
  );
}

function ShareButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-md shadow-md text-sm transition-transform active:scale-95"
      style={{
        background: "color-mix(in srgb, var(--brand-primary, #0b0a09) 85%, transparent)",
        color: "#f5f3ee",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
