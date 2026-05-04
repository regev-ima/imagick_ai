import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Sparkles,
  Lock,
  Globe,
  Calendar,
  Tag,
  Loader2,
  Image as ImageIcon,
  Plus,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StyleStatusCard } from "@/components/styles/StyleStatusCard";
import { BeforeAfterSlider } from "@/components/styles/BeforeAfterSlider";
import { useImportProgress } from "@/hooks/useImportProgress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getThumbnailUrl, getPreviewUrl } from "@/lib/imageUrls";
import { SHOWCASE_GALLERY_ID } from "@/lib/constants";

type StyleStatus = "importing" | "training" | "ready" | "error";

const statusConfig: Record<StyleStatus, { label: string; className: string }> = {
  importing: { label: "Importing", className: "bg-accent/10 text-accent" },
  training: { label: "Training", className: "bg-secondary/10 text-secondary" },
  ready: { label: "Ready", className: "bg-primary/10 text-primary" },
  error: { label: "Error", className: "bg-destructive/10 text-destructive" },
};

function ImageWithFallback({
  src,
  alt,
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={cn("bg-muted flex items-center justify-center", className)}>
        <ImageIcon className="w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ""}
      className={className}
      onError={() => setError(true)}
    />
  );
}

export default function StyleDetailsPage() {
  const { styleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeSliderIndex, setActiveSliderIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"after" | "before">("after");

  const { data: style, isLoading } = useQuery({
    queryKey: ["style", styleId],
    queryFn: async () => {
      if (!styleId) return null;
      const { data, error } = await supabase
        .from("styles")
        .select("*")
        .eq("id", styleId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!styleId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "importing" || status === "training" ? 5000 : 30000;
    },
  });

  // Fetch edited images with their originals from image_edits table
  const { data: editPairs = [] } = useQuery({
    queryKey: ["style-edits", styleId],
    queryFn: async () => {
      if (!styleId) return [];
      const { data: edits, error: editsError } = await supabase
        .from("image_edits")
        .select("edited_url, image_id")
        .eq("style_id", styleId)
        .eq("gallery_id", SHOWCASE_GALLERY_ID);
      if (editsError) throw editsError;
      if (!edits || edits.length === 0) return [];

      const imageIds = edits.map(e => e.image_id);
      const { data: images } = await supabase
        .from("gallery_images")
        .select("id, thumbnail_url, original_url, filename")
        .in("id", imageIds);

      const imageMap = new Map((images || []).map(img => [img.id, img]));

      return edits.map(edit => {
        const img = imageMap.get(edit.image_id);
        const beforeRaw = img?.thumbnail_url || img?.original_url || "";
        return {
          before: beforeRaw ? getPreviewUrl(beforeRaw) : "",
          after: edit.edited_url,
          filename: img?.filename || "",
        };
      }).sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
    },
    enabled: !!styleId,
  });

  const importProgress = useImportProgress(
    styleId,
    user?.id,
    style?.status,
    style?.google_before_metadata,
    style?.google_after_metadata,
    style?.total_images_imported,
    style?.total_images_to_import
  );

  const afterImages: string[] = useMemo(() => {
    if (editPairs.length > 0) return editPairs.map(p => p.after);
    return [...(style?.after_image_urls?.filter(Boolean) || [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [editPairs, style?.after_image_urls]);

  const beforeImages: string[] = useMemo(() => {
    if (editPairs.length > 0) return editPairs.map(p => p.before);
    return [...(style?.before_image_urls?.filter(Boolean) || [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [editPairs, style?.before_image_urls]);

  const gridImages = activeTab === "after" ? afterImages : beforeImages;

  const activePair = editPairs[activeSliderIndex] || null;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!style) {
    return (
      <div className="p-6 lg:p-8 text-center py-16">
        <h2 className="text-xl font-semibold mb-2">Style not found</h2>
        <p className="text-muted-foreground mb-4">This style doesn't exist or has been deleted.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/styles")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Styles
        </Button>
      </div>
    );
  }

  const status = statusConfig[style.status as StyleStatus] || statusConfig.ready;
  const isOwner = user?.id === style.user_id;

  const heroImage = afterImages[0] ? getPreviewUrl(afterImages[0]) : null;

  return (
    <div className="min-h-screen">
      {/* Hero Section with blurred background */}
      <div className="relative overflow-hidden">
        {/* Blurred background image */}
        {heroImage && (
          <div className="absolute inset-0">
            <img
              src={heroImage}
              alt=""
              className="w-full h-full object-cover scale-110 blur-3xl opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
          </div>
        )}
        {!heroImage && (
          <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-background" />
        )}

        <div className="relative p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto">
            {/* Back link */}
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <button
                onClick={() => navigate("/dashboard/styles")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to All Styles
              </button>
            </motion.div>

            {/* Hero content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-8 text-center"
            >
              {style.category && (
                <Badge variant="outline" className="capitalize mb-4 gap-1.5 px-3 py-1 bg-background/50 backdrop-blur-sm">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  {style.category}
                </Badge>
              )}

              <h1 className="text-4xl sm:text-5xl font-bold text-gradient mb-4">
                {style.name}
              </h1>

              {style.description && (
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
                  {style.description}
                </p>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-center gap-4">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", status.className)}>
                    {status.label}
                  </span>
                  {style.is_preset ? (
                    <Badge variant="outline" className="text-xs gap-1 bg-background/50 backdrop-blur-sm">
                      <Globe className="w-3 h-3" />
                      Public
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1 bg-background/50 backdrop-blur-sm">
                      {style.visibility === "private" ? (
                        <><Lock className="w-3 h-3" /> Private</>
                      ) : (
                        <><Globe className="w-3 h-3" /> Public</>
                      )}
                    </Badge>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(style.created_at).toLocaleDateString()}
                  </span>
                  {style.training_start_date && style.training_completion_date && (() => {
                    const startMs = new Date(style.training_start_date).getTime();
                    const endMs = new Date(style.training_completion_date).getTime();
                    const durationMin = Math.round((endMs - startMs) / 60000);
                    return (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        ⏱ {durationMin < 1 ? "<1" : durationMin} min
                        · {new Date(style.training_completion_date).toLocaleDateString()}
                      </span>
                    );
                  })()}
                </div>

                {style.status === "ready" && (
                  <Button
                    variant="glow"
                    size="sm"
                    onClick={() => navigate(`/dashboard/galleries/new?styleId=${style.id}`)}
                    className="gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Gallery
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6 lg:p-8 -mt-4">
        <div className="max-w-[1400px] mx-auto">
          {/* Status Card */}
          <StyleStatusCard
            status={style.status}
            importProgress={importProgress}
            errorDetails={style.error_details as string[] | undefined}
          />

          {/* Before/After Slider */}
          {activePair && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-8 space-y-4"
            >
              <p className="text-sm font-medium text-muted-foreground text-center uppercase tracking-wider">
                Preview the transformation
              </p>
              <div className="flex justify-center">
                <div className="w-full max-w-5xl">
                  <BeforeAfterSlider
                    key={activeSliderIndex}
                    beforeSrc={activePair.before}
                    afterSrc={getPreviewUrl(activePair.after)}
                    className="max-h-[55vh]"
                  />
                </div>
              </div>
            </motion.section>
          )}

          {/* Sample Gallery Grid */}
          {(afterImages.length > 0 || beforeImages.length > 0) && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-12 space-y-4"
            >
              <div className="flex justify-center">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "after" | "before")}>
                  <TabsList>
                    <TabsTrigger value="after">After ({afterImages.length})</TabsTrigger>
                    <TabsTrigger value="before">Before ({beforeImages.length})</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-5xl mx-auto">
                {gridImages.map((url, index) => (
                  <button
                    key={`${activeTab}-${index}`}
                    onClick={() => {
                      if (activeTab === "after" || activeTab === "before") {
                        setActiveSliderIndex(index);
                      }
                    }}
                    onDoubleClick={() => setLightboxIndex(index)}
                    className={cn(
                      "group relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all",
                      index === activeSliderIndex
                        ? "border-primary shadow-[0_0_16px_hsl(var(--primary)/0.3)] ring-1 ring-primary/20"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <ImageWithFallback
                      src={getThumbnailUrl(url)}
                      alt={editPairs[index]?.filename || `Example ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className={cn(
                      "absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300",
                      index !== activeSliderIndex && "group-hover:bg-black/5"
                    )} />
                  </button>
                ))}
              </div>
            </motion.section>
          )}

          {/* Tags */}
          {style.associated_tags?.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center gap-1.5 mt-8"
            >
              {style.associated_tags.map((tag: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground bg-muted/50 border border-border/50"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </motion.div>
          )}

          {/* Lightbox */}
          <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-black/95 overflow-hidden flex items-center justify-center">
              {lightboxIndex !== null && gridImages[lightboxIndex] && (
                <img
                  src={getPreviewUrl(gridImages[lightboxIndex])}
                  alt="Full size"
                  className="max-w-full max-h-[85vh] object-contain"
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Empty state */}
          {afterImages.length === 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center py-20 mt-8 rounded-2xl border border-border bg-muted/5"
            >
              <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground font-medium">No examples yet</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Use the Showcase Manager to generate comparison images for this style.
              </p>
            </motion.section>
          )}
        </div>
      </div>
    </div>
  );
}
