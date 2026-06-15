import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
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
import { Orb } from "@/components/aura/Orb";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getThumbnailUrl, getPreviewUrl } from "@/lib/imageUrls";
import { SHOWCASE_GALLERY_ID } from "@/lib/constants";

type StyleStatus = "importing" | "training" | "ready" | "error";

const statusConfig: Record<StyleStatus, { label: string; token: string }> = {
  importing: { label: "Importing", token: "var(--accent)" },
  training: { label: "Training", token: "var(--rating)" },
  ready: { label: "Ready", token: "var(--secondary)" },
  error: { label: "Error", token: "var(--destructive)" },
};

// LIGHTROOM motion — calm, responsive fades/slides. No bounce, no float.
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

/**
 * The AI mark — a 4-point sparkle (the logo star). Royal blue by default.
 * Tinted via currentColor so it inherits text-primary / text-accent.
 */
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

/** Mono section header — like a Lightroom module title bar. */
function PanelHeader({
  icon,
  label,
  trailing,
  tone = "muted",
}: {
  icon?: ReactNode;
  label: string;
  trailing?: ReactNode;
  tone?: "muted" | "ai";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-border px-4 py-2.5",
        tone === "ai" ? "bg-primary/[0.08] text-accent" : "bg-background/40 text-muted-foreground",
      )}
    >
      <span className="aura-microlabel flex items-center gap-2" style={tone === "ai" ? { color: "inherit" } : undefined}>
        {icon}
        {label}
      </span>
      {trailing}
    </div>
  );
}

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
      <div className="flex min-h-[400px] items-center justify-center bg-background p-6 lg:p-8">
        <Orb className="h-12 w-12" />
      </div>
    );
  }

  if (!style) {
    return (
      <div className="min-h-full bg-background p-6 text-center lg:p-8">
        <div className="mx-auto mt-16 max-w-md glass-card rounded-[--radius] p-8">
          <h2 className="text-xl font-semibold tracking-tight">Style not found</h2>
          <p className="mb-5 mt-2 font-sans text-sm text-muted-foreground">
            This style doesn't exist or has been deleted.
          </p>
          <Button variant="outline" onClick={() => navigate("/dashboard/styles")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Styles
          </Button>
        </div>
      </div>
    );
  }

  const status = statusConfig[style.status as StyleStatus] || statusConfig.ready;
  const isOwner = user?.id === style.user_id;
  const isReady = style.status === "ready";

  const heroImage = afterImages[0] ? getPreviewUrl(afterImages[0]) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* ════ HERO — blurred backdrop + masthead ═══════════════════════ */}
      <div className="relative overflow-hidden border-b border-border">
        {/* Blurred background image */}
        {heroImage && (
          <div className="absolute inset-0">
            <img
              src={heroImage}
              alt=""
              className="w-full h-full object-cover scale-110 blur-3xl opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
          </div>
        )}
        {!heroImage && (
          <div className="absolute inset-0 bg-gradient-to-b from-card to-background" />
        )}

        <div className="relative px-5 py-7 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-[1320px]">
            {/* Back link */}
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <button
                onClick={() => navigate("/dashboard/styles")}
                className="mb-6 inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground transition-colors hover:text-accent"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to All Styles
              </button>
            </motion.div>

            {/* Mono dateline row */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="flex items-center justify-between gap-3 pb-3"
            >
              <span className="caption flex items-center gap-1.5 text-accent">
                <Sparkle size={11} className="text-accent" />
                AI Style
              </span>
              <span className="caption flex items-center gap-1.5" style={{ color: `hsl(${status.token})` }}>
                <span
                  className={cn("aura-led", (style.status === "training" || style.status === "importing") && "aura-led-pulse")}
                  style={{ "--led": status.token } as CSSProperties}
                />
                {status.label}
              </span>
            </motion.div>
            <hr className="aura-hairline" />

            {/* Hero content */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.5, ease: EASE }}
              className="mt-6"
            >
              {style.category && (
                <span className="aura-chip mb-4 capitalize" style={{ color: "hsl(var(--accent))" }}>
                  <Sparkle size={10} className="text-accent" />
                  {style.category}
                </span>
              )}

              <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                {style.name}
              </h1>

              {style.description && (
                <p className="mt-4 max-w-2xl font-sans text-lg leading-relaxed text-muted-foreground">
                  {style.description}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {style.is_preset ? (
                    <span className="aura-chip">
                      <Globe className="w-3 h-3" />
                      Public
                    </span>
                  ) : (
                    <span className="aura-chip">
                      {style.visibility === "private" ? (
                        <><Lock className="w-3 h-3" /> Private</>
                      ) : (
                        <><Globe className="w-3 h-3" /> Public</>
                      )}
                    </span>
                  )}
                  <span className="aura-chip">
                    <Calendar className="w-3 h-3" />
                    {new Date(style.created_at).toLocaleDateString()}
                  </span>
                  {style.training_start_date && style.training_completion_date && (() => {
                    const startMs = new Date(style.training_start_date).getTime();
                    const endMs = new Date(style.training_completion_date).getTime();
                    const durationMin = Math.round((endMs - startMs) / 60000);
                    return (
                      <span className="aura-chip">
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

      {/* ════ MAIN CONTENT ═════════════════════════════════════════════ */}
      <div className="px-5 py-7 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-[1320px]">
          {/* Status Card — shared component (training / importing / error) */}
          <StyleStatusCard
            status={style.status}
            importProgress={importProgress}
            errorDetails={style.error_details as string[] | undefined}
          />

          {/* Before/After Slider */}
          {activePair && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
              className="mt-8"
            >
              <div className="glass-card overflow-hidden rounded-[--radius]">
                <PanelHeader
                  tone="ai"
                  icon={<Sparkle size={12} className="text-accent" />}
                  label="Preview the transformation"
                  trailing={
                    <span className="caption" style={{ color: "inherit" }}>
                      Before → After
                    </span>
                  }
                />
                <div className="flex justify-center p-4 sm:p-5">
                  <div className="w-full max-w-5xl">
                    <BeforeAfterSlider
                      key={activeSliderIndex}
                      beforeSrc={activePair.before}
                      afterSrc={getPreviewUrl(activePair.after)}
                      className="max-h-[55vh]"
                    />
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Sample Gallery Grid */}
          {(afterImages.length > 0 || beforeImages.length > 0) && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5, ease: EASE }}
              className="mt-8"
            >
              <div className="glass-card overflow-hidden rounded-[--radius]">
                <PanelHeader
                  icon={<ImageIcon className="h-3.5 w-3.5" />}
                  label="Samples — develop grid"
                  trailing={
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "after" | "before")}>
                      <TabsList>
                        <TabsTrigger value="after">After ({afterImages.length})</TabsTrigger>
                        <TabsTrigger value="before">Before ({beforeImages.length})</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  }
                />

                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
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
                        "group relative aspect-[4/3] overflow-hidden rounded-sm bg-muted plate-keyline transition-shadow duration-300 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)]",
                        index === activeSliderIndex
                          ? "ring-2 ring-primary"
                          : "border border-border hover:border-muted-foreground/40 hover:shadow-[var(--elevation-2)]"
                      )}
                    >
                      <ImageWithFallback
                        src={getThumbnailUrl(url)}
                        alt={editPairs[index]?.filename || `Example ${index + 1}`}
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                      {index === activeSliderIndex && (
                        <span className="absolute right-1.5 top-1.5 rounded-sm bg-primary px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
                          Selected
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {/* Tags */}
          {style.associated_tags?.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-6 flex flex-wrap items-center gap-2"
            >
              <span className="aura-microlabel mr-1">Tags</span>
              {style.associated_tags.map((tag: string, index: number) => (
                <span key={index} className="aura-chip">
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
              className="mt-8"
            >
              <div className="glass-card overflow-hidden rounded-[--radius]">
                <PanelHeader
                  icon={<ImageIcon className="h-3.5 w-3.5" />}
                  label="Samples — empty"
                />
                <div className="p-10 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-[--radius] border border-border bg-muted">
                    <ImageIcon className="h-7 w-7 text-muted-foreground/60" />
                  </div>
                  <p className="mt-4 text-lg font-semibold tracking-tight">No examples yet</p>
                  <p className="mx-auto mt-2 max-w-md font-sans text-sm leading-relaxed text-muted-foreground">
                    Use the Showcase Manager to generate comparison images for this style.
                  </p>
                </div>
              </div>
            </motion.section>
          )}
        </div>
      </div>
    </div>
  );
}
