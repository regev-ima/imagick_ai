import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { PanelRightClose, Star, Calendar, FileText, Tag, Camera, Heart, Download, Award, Maximize, Minimize, Trash2, GripHorizontal, Bot, Aperture, Layers, Clock, Zap, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AIAnalysisSection, type SimilarityLevel } from "./AIAnalysisSection";
import { FaceThumbnail } from "./FaceThumbnail";
import { useImageFaces } from "@/hooks/useFaceSearch";
import { getEditedThumbnailUrl, getPreviewUrl } from "@/lib/imageUrls";

interface ImageDetails {
  id: string;
  filename: string;
  original_url: string;
  edited_url: string | null;
  width: number | null;
  height: number | null;
  ai_rating: number | null;
  ai_tags: string[] | null;
  category: string | null;
  is_liked: boolean;
  is_hero: boolean;
  created_at: string;
  status: string;
  // AI Culling metrics
  culling_score?: number | null;
  culling_label?: string | null;
  background_sharpness?: number | null;
  subject_sharpness?: number | null;
  thirds_rule?: number | null;
  intended_facial_expression?: number | null;
  // VLM extra signals
  ai_tags?: string[] | null;
  eyes_status?: string | null;
  expression?: string | null;
  looking_at_camera?: boolean | null;
  is_keeper?: boolean | null;
  ai_hero_candidate?: boolean | null;
  has_blur_issue?: boolean | null;
  has_exposure_issue?: boolean | null;
  people_count?: number | null;
  similarity_group_1?: number | null;
  similarity_group_2?: number | null;
  similarity_group_3?: number | null;
  // Processing timestamps
  last_processing_attempt_at?: string | null;
  processing_completed_at?: string | null;
  processing_attempts?: number | null;
  last_processing_error?: string | null;
  // EXIF metadata
  taken_at?: string | null;
  file_size_bytes?: number | null;
  camera_make?: string | null;
  camera_model?: string | null;
  lens_model?: string | null;
  focal_length?: string | null;
  aperture?: string | null;
  shutter_speed?: string | null;
  iso?: number | null;
}

interface SimilarImage {
  id: string;
  original_url: string;
  culling_score: number | null;
}

interface GalleryStyle {
  id: string;
  name: string;
  style_id_external: string | null;
}

interface ImageDetailsPanelProps {
  image: ImageDetails;
  onClose: () => void;
  onToggleLike: () => void;
  onSetAsHero?: () => void;
  onDelete?: () => void;
  onDeleteEdit?: (styleId: string) => void;
  onFullscreen?: () => void;
  similarImages?: SimilarImage[];
  onSimilarImageClick?: (imageId: string) => void;
  onSelectEditVersion?: (styleId: string, styleName: string) => void;
  galleryStyles?: GalleryStyle[];
  activeStyleId?: string;
  similarityLevel?: SimilarityLevel;
  onSimilarityLevelChange?: (level: SimilarityLevel) => void;
  variant?: "default" | "lightbox";
  hideHeader?: boolean;
  onUpdateCategory?: (imageId: string, label: string) => void;
  availableLabels?: string[];
  /** Open the People view for a detected person's face cluster (optional). */
  onFaceClusterClick?: (clusterId: string) => void;
}

// Reusable section card wrapper — a Lightroom develop sub-panel
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-sm surface-2 border border-border/60 p-3", className)}>
      {children}
    </div>
  );
}

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

// Section header with gradient icon
function SectionHeader({ icon: Icon, label, accent = "violet" }: { icon: React.ComponentType<{ className?: string }>; label: string; accent?: "violet" | "blue" | "amber" | "emerald" }) {
  // One disciplined accent for every section header; the accent prop is
  // kept for call-site compatibility but no longer fans out into a rainbow.
  const gradientMap = {
    violet: "from-primary/15 to-primary/5",
    blue: "from-primary/15 to-primary/5",
    amber: "from-primary/15 to-primary/5",
    emerald: "from-primary/15 to-primary/5",
  };
  const textMap = {
    violet: "text-primary",
    blue: "text-primary",
    amber: "text-primary",
    emerald: "text-primary",
  };
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <div className={cn("w-6 h-6 rounded-sm bg-gradient-to-br flex items-center justify-center", gradientMap[accent])}>
        <Icon className={cn("w-3.5 h-3.5", textMap[accent])} />
      </div>
      <span className="aura-microlabel">{label}</span>
    </div>
  );
}

// Timeline dot for dates
function TimelineDot({ color = "default", pulse = false }: { color?: "default" | "primary" | "yellow" | "red"; pulse?: boolean }) {
  const colorMap = {
    default: "bg-muted-foreground/40",
    primary: "bg-primary",
    yellow: "bg-rating",
    red: "bg-destructive",
  };
  return (
    <div className="relative flex items-center justify-center w-3 flex-shrink-0">
      <div className={cn("w-1.5 h-1.5 rounded-full", colorMap[color])} />
      {pulse && <div className={cn("absolute w-3 h-3 rounded-full animate-ping opacity-30", colorMap[color])} />}
    </div>
  );
}

export function ImageDetailsPanel({
  image,
  onClose,
  onToggleLike,
  onSetAsHero,
  onDelete,
  onDeleteEdit,
  onFullscreen,
  similarImages = [],
  onSimilarImageClick,
  onSelectEditVersion,
  galleryStyles = [],
  activeStyleId,
  similarityLevel,
  onSimilarityLevelChange,
  variant = "default",
  hideHeader = false,
  onUpdateCategory,
  availableLabels = [],
  onFaceClusterClick,
}: ImageDetailsPanelProps) {
  const { data: faces = [] } = useImageFaces(image.id);
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = image.edited_url || image.original_url;
    link.download = image.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download started");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDuration = (startStr: string, endStr: string) => {
    const ms = new Date(endStr).getTime() - new Date(startStr).getTime();
    if (ms < 0) return null;
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return remainMinutes > 0 ? `${hours}h ${remainMinutes}m` : `${hours}h`;
  };

  const getOrientation = () => {
    if (!image.width || !image.height) return null;
    if (image.width > image.height) return "Landscape";
    if (image.height > image.width) return "Portrait";
    return "Square";
  };

  const hasCameraData = image.camera_make || image.camera_model || image.lens_model;
  const hasExposureData = image.aperture || image.shutter_speed || image.iso || image.focal_length;

  // Preload style thumbnails in background when image changes
  useEffect(() => {
    if (!image.edited_url || galleryStyles.length === 0) return;
    galleryStyles.forEach((style) => {
      const apiId = style.style_id_external || "1";
      const img = new Image();
      img.src = getEditedThumbnailUrl(image.original_url, apiId);
    });
  }, [image.id, image.edited_url, image.original_url, galleryStyles]);

  const handleDragEnd = (_: any, info: { offset: { y: number } }) => {
    if (info.offset.y > 100) {
      onClose();
    }
  };

  // Status badge config
  const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; bg: string; text: string; dot: string }> = {
    ready: { icon: CheckCircle2, bg: "bg-secondary/15", text: "text-secondary", dot: "bg-secondary" },
    processing: { icon: Loader2, bg: "bg-rating/15", text: "text-rating", dot: "bg-rating" },
    error: { icon: AlertCircle, bg: "bg-destructive/15", text: "text-destructive", dot: "bg-destructive" },
    pending: { icon: Clock, bg: "bg-rating/15", text: "text-rating", dot: "bg-rating" },
    uploading: { icon: Loader2, bg: "bg-rating/15", text: "text-rating", dot: "bg-rating" },
    deleted: { icon: Trash2, bg: "bg-destructive/15", text: "text-destructive", dot: "bg-destructive" },
  };
  const currentStatus = statusConfig[image.status] || statusConfig.ready;
  const StatusIcon = currentStatus.icon;

  // --- Shared content sections (used by both modes) ---

  const renderStyleVersions = () => {
    if (galleryStyles.length === 0 || !image.edited_url) return null;
    return (
      <div>
        <SectionHeader icon={Layers} label={`Styles (${galleryStyles.length})`} accent="violet" />
        <div className="grid grid-cols-2 gap-2">
          {galleryStyles.map((style) => {
            const apiId = style.style_id_external || "1";
            const isActive = activeStyleId === style.id;
            return (
              <button
                key={style.id}
                className={cn(
                  "relative rounded-sm overflow-hidden cursor-pointer transition-all h-24 flex flex-col justify-end group",
                  isActive
                    ? "ring-2 ring-primary ring-offset-1 ring-offset-background shadow-lg shadow-primary/20"
                    : "ring-1 ring-border/60 hover:ring-primary/40"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEditVersion?.(style.id, style.name);
                }}
              >
                <img
                  src={getEditedThumbnailUrl(image.original_url, apiId)}
                  alt={style.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = image.original_url;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="relative z-10 p-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkle size={11} className="text-primary" />
                    <span className="font-medium text-xs text-white truncate">{style.name}</span>
                  </div>
                </div>
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg z-10">
                    <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderQuickActions = () => (
    <div className="grid grid-cols-2 gap-1.5">
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "gap-2 h-9 text-xs border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] transition-all",
          image.is_liked && "border-primary/30 bg-primary/5"
        )}
        onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
      >
        <Heart className={cn("w-3.5 h-3.5", image.is_liked && "fill-primary text-primary")} />
        {image.is_liked ? "Liked" : "Like"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 h-9 text-xs border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] transition-all"
        onClick={handleDownload}
      >
        <Download className="w-3.5 h-3.5" />
        Download
      </Button>
      {onSetAsHero && (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 h-9 text-xs border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] transition-all",
            image.is_hero && "border-rating/30 bg-rating/5 text-rating"
          )}
          onClick={(e) => { e.stopPropagation(); onSetAsHero(); }}
        >
          <Award className="w-3.5 h-3.5" />
          {image.is_hero ? "Hero" : "Set Hero"}
        </Button>
      )}
      {onFullscreen && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-9 text-xs border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] transition-all"
          onClick={(e) => { e.stopPropagation(); onFullscreen(); }}
        >
          {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          {isFullscreen ? "Exit Full" : "Fullscreen"}
        </Button>
      )}
    </div>
  );

  const renderStatusBadge = () => (
    <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium", currentStatus.bg, currentStatus.text)}>
      <div className={cn("w-1.5 h-1.5 rounded-full", currentStatus.dot, image.status === "processing" && "animate-pulse")} />
      <span className="capitalize">{image.status}</span>
      {image.last_processing_attempt_at && image.processing_completed_at && formatDuration(image.last_processing_attempt_at, image.processing_completed_at) && (
        <span className="text-[10px] opacity-70">({formatDuration(image.last_processing_attempt_at, image.processing_completed_at)})</span>
      )}
    </div>
  );

  const renderCameraAndExposure = () => {
    if (!hasCameraData && !hasExposureData) return null;
    return (
      <SectionCard>
        <SectionHeader icon={Camera} label="Camera" accent="blue" />
        {hasCameraData && (
          <div className="mb-2">
            {(image.camera_make || image.camera_model) && (
              <p className="text-sm font-medium">{[image.camera_make, image.camera_model].filter(Boolean).join(" ")}</p>
            )}
            {image.lens_model && <p className="text-xs text-muted-foreground mt-0.5">{image.lens_model}</p>}
          </div>
        )}
        {hasExposureData && (
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {image.aperture && (
              <div className="rounded-md bg-white/[0.03] border border-white/[0.04] px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Aperture</span>
                <p className="text-sm font-semibold tabular-nums">{image.aperture}</p>
              </div>
            )}
            {image.shutter_speed && (
              <div className="rounded-md bg-white/[0.03] border border-white/[0.04] px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Shutter</span>
                <p className="text-sm font-semibold tabular-nums">{image.shutter_speed}</p>
              </div>
            )}
            {image.iso && (
              <div className="rounded-md bg-white/[0.03] border border-white/[0.04] px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">ISO</span>
                <p className="text-sm font-semibold tabular-nums">{image.iso}</p>
              </div>
            )}
            {image.focal_length && (
              <div className="rounded-md bg-white/[0.03] border border-white/[0.04] px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Focal</span>
                <p className="text-sm font-semibold tabular-nums">{image.focal_length}</p>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    );
  };

  const renderTimeline = () => {
    const timelineItems: { label: string; date: string; color: "default" | "primary" | "yellow" | "red"; pulse?: boolean }[] = [];
    if (image.taken_at) timelineItems.push({ label: "Captured", date: image.taken_at, color: "default" });
    timelineItems.push({ label: "Uploaded", date: image.created_at, color: "default" });
    if (image.processing_completed_at) {
      timelineItems.push({ label: "Processed", date: image.processing_completed_at, color: "primary" });
    } else if (image.last_processing_attempt_at) {
      timelineItems.push({ label: "Sent to AI", date: image.last_processing_attempt_at, color: "yellow", pulse: true });
    }

    return (
      <SectionCard>
        <SectionHeader icon={Calendar} label="Timeline" accent="amber" />
        <div className="relative">
          {/* Vertical connecting line */}
          {timelineItems.length > 1 && (
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gradient-to-b from-muted-foreground/20 via-muted-foreground/10 to-transparent" />
          )}
          <div className="space-y-3">
            {timelineItems.map((item, i) => (
              <div key={item.label} className="flex items-start gap-2.5 relative">
                <TimelineDot color={item.color} pulse={item.pulse} />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] text-muted-foreground/70">{item.label}</span>
                  <p className="text-xs font-medium tabular-nums">{formatShortDate(item.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Duration chip */}
        {image.last_processing_attempt_at && image.processing_completed_at && formatDuration(image.last_processing_attempt_at, image.processing_completed_at) && (
          <div className="mt-2.5 pt-2 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5 text-xs">
              <Zap className="w-3 h-3 text-primary" />
              <span className="text-muted-foreground">Processing took</span>
              <span className="font-semibold text-primary tabular-nums">{formatDuration(image.last_processing_attempt_at, image.processing_completed_at)}</span>
            </div>
          </div>
        )}
        {/* Attempts warning */}
        {(image.processing_attempts ?? 0) > 1 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rating">
            <AlertCircle className="w-3 h-3" />
            <span>{image.processing_attempts} attempts</span>
          </div>
        )}
        {/* Error */}
        {image.status === "error" && image.last_processing_error && (
          <div className="mt-2 rounded-md bg-red-500/10 border border-red-500/20 px-2.5 py-1.5">
            <p className="text-[11px] text-red-400 line-clamp-2" title={image.last_processing_error}>
              {image.last_processing_error}
            </p>
          </div>
        )}
      </SectionCard>
    );
  };

  const renderFileInfo = () => (
    <SectionCard>
      <SectionHeader icon={ImageIcon} label="File" accent="emerald" />
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/70">Name</span>
          <span className="font-medium truncate max-w-[160px] text-right" title={image.filename}>
            {image.filename}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/70">Dimensions</span>
          <span className="font-medium tabular-nums">
            {image.width && image.height ? `${image.width} × ${image.height}` : "Unknown"}
          </span>
        </div>
        {formatFileSize(image.file_size_bytes) && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70">Size</span>
            <span className="font-medium tabular-nums">{formatFileSize(image.file_size_bytes)}</span>
          </div>
        )}
        {getOrientation() && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70">Orientation</span>
            <span className="font-medium">{getOrientation()}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/70">Status</span>
          {renderStatusBadge()}
        </div>
      </div>
    </SectionCard>
  );

  const renderCategory = () => {
    if (!image.culling_label && !image.category && !onUpdateCategory) return null;
    return (
      <SectionCard>
        <SectionHeader icon={Tag} label="Category" accent="violet" />
        {onUpdateCategory ? (
          editingCategory ? (
            <div className="space-y-2">
              <input
                type="text"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                placeholder="Type category name..."
                className="w-full px-3 py-1.5 text-sm rounded-md bg-white/[0.03] border border-white/[0.08] outline-none focus:border-primary/50 transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && categoryInput.trim()) {
                    onUpdateCategory(image.id, categoryInput.trim());
                    setEditingCategory(false);
                  }
                  if (e.key === "Escape") setEditingCategory(false);
                }}
              />
              {availableLabels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {availableLabels.map((label) => (
                    <button
                      key={label}
                      onClick={() => {
                        onUpdateCategory(image.id, label);
                        setEditingCategory(false);
                      }}
                      className="px-2 py-0.5 text-xs rounded-full bg-white/[0.04] border border-white/[0.06] hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                setCategoryInput(image.culling_label || image.category || "");
                setEditingCategory(true);
              }}
              className="inline-flex px-3 py-1 rounded-full text-xs bg-primary/10 text-primary capitalize hover:bg-primary/20 transition-colors"
            >
              {image.culling_label || image.category || "Assign category..."}
            </button>
          )
        ) : (
          <span className="inline-flex px-3 py-1 rounded-full text-xs bg-primary/10 text-primary capitalize">
            {image.culling_label || image.category}
          </span>
        )}
      </SectionCard>
    );
  };

  // The faces detected on this photo (from AI Culling's "Recognize people"
  // pass), cropped from the image and labelled with the person's name when the
  // face cluster has been named. Tapping a face opens that person in People.
  const renderFaces = () => {
    if (!faces || faces.length === 0) return null;
    return (
      <SectionCard>
        <SectionHeader icon={ScanFace} label={`People (${faces.length})`} accent="violet" />
        <div className="flex flex-wrap gap-2.5">
          {faces.map((face) => {
            const clickable = !!(onFaceClusterClick && face.cluster_id);
            const inner = (
              <>
                <FaceThumbnail
                  imageUrl={image.original_url}
                  bbox={face.bounding_box}
                  size={48}
                  className={cn("ring-1 ring-border/60", clickable && "group-hover:ring-primary transition-all")}
                />
                <span
                  className={cn(
                    "block w-full truncate text-center text-[10px]",
                    face.label ? "text-foreground" : "text-muted-foreground/60",
                  )}
                  title={face.label || "Unknown person"}
                >
                  {face.label || "Unknown"}
                </span>
              </>
            );
            return clickable ? (
              <button
                key={face.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); onFaceClusterClick!(face.cluster_id!); }}
                className="group flex w-12 flex-col items-center gap-1"
              >
                {inner}
              </button>
            ) : (
              <div key={face.id} className="flex w-12 flex-col items-center gap-1">{inner}</div>
            );
          })}
        </div>
        {onFaceClusterClick && faces.some((f) => f.cluster_id) && (
          <p className="mt-2 text-[10px] text-muted-foreground/50">Tap a face to see all their photos</p>
        )}
      </SectionCard>
    );
  };

  const renderAITags = () => {
    if (!image.ai_tags || image.ai_tags.length === 0) return null;
    return (
      <SectionCard>
        <SectionHeader icon={Tag} label="AI Tags" accent="blue" />
        <div className="flex flex-wrap gap-1.5">
          {image.ai_tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex px-2 py-0.5 rounded-md text-[11px] bg-white/[0.04] border border-white/[0.06] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </SectionCard>
    );
  };

  const renderBadges = () => {
    if (!image.is_hero && !image.edited_url) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {image.is_hero && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-medium bg-rating/15 text-rating border border-rating/25">
            <Award className="w-3 h-3" />
            Hero
          </span>
        )}
        {image.edited_url && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-medium bg-primary/15 text-primary border border-primary/25">
            <Sparkle size={11} className="text-primary" />
            AI Edited
          </span>
        )}
      </div>
    );
  };

  const isViewingEdit = activeStyleId && activeStyleId !== "original";
  const effectiveStyleId = isViewingEdit
    ? activeStyleId
    : galleryStyles[0]?.id;
  const effectiveStyleName = effectiveStyleId
    ? galleryStyles.find(s => s.id === effectiveStyleId)?.name || "this style"
    : null;

  const [deleteExpanded, setDeleteExpanded] = useState(false);

  // Collapse when image or style changes
  useEffect(() => {
    setDeleteExpanded(false);
  }, [image.id, activeStyleId]);

  const renderDelete = () => {
    if (!onDelete) return null;

    // Show expandable options for any edited image with styles
    const hasEdits = image.edited_url && onDeleteEdit && galleryStyles.length > 0;

    if (!hasEdits) {
      // Simple case: no edits or viewing original — single direct button
      return (
        <div className="space-y-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive/70 hover:text-destructive hover:bg-destructive/10 gap-2 h-8 text-xs"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Move to Trash
          </Button>
          <p className="text-[10px] text-muted-foreground/50 text-center">Recoverable for 30 days</p>
        </div>
      );
    }

    // Has edits: show "Delete" → expands to two choices
    return (
      <div className="space-y-1.5">
        {!deleteExpanded ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive/70 hover:text-destructive hover:bg-destructive/10 gap-2 h-8 text-xs"
            onClick={(e) => { e.stopPropagation(); setDeleteExpanded(true); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Image
          </Button>
        ) : (
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive/80 hover:text-destructive hover:bg-destructive/10 gap-2 h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEdit!(effectiveStyleId!);
                setDeleteExpanded(false);
              }}
            >
              <Layers className="w-3.5 h-3.5" />
              Only "{effectiveStyleName}" Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive/70 hover:text-destructive hover:bg-destructive/10 gap-2 h-8 text-xs"
              onClick={(e) => { e.stopPropagation(); onDelete(); setDeleteExpanded(false); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Original + All Edits
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground/60 hover:text-muted-foreground h-7 text-[10px]"
              onClick={(e) => { e.stopPropagation(); setDeleteExpanded(false); }}
            >
              Cancel
            </Button>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground/50 text-center">Recoverable for 30 days</p>
      </div>
    );
  };

  const renderAIAnalysis = () => {
    if (image.culling_score !== null && image.culling_score !== undefined) {
      return (
        <SectionCard className="bg-primary/[0.05] border-primary/20">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-sm bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Sparkle size={13} className="text-primary" />
            </div>
            <span className="aura-microlabel text-primary">AI Analysis</span>
          </div>
          <AIAnalysisSection
            metrics={{
              culling_score: image.culling_score ?? null,
              culling_label: image.culling_label ?? null,
              background_sharpness: image.background_sharpness ?? null,
              subject_sharpness: image.subject_sharpness ?? null,
              thirds_rule: image.thirds_rule ?? null,
              intended_facial_expression: image.intended_facial_expression ?? null,
            }}
            similarImages={similarImages}
            currentImageId={image.id}
            onSimilarImageClick={onSimilarImageClick || (() => {})}
            similarityLevel={similarityLevel}
            onSimilarityLevelChange={onSimilarityLevelChange}
          />
          {/* Extra VLM signals */}
          {(image.eyes_status || image.is_keeper != null || image.ai_hero_candidate != null ||
            image.has_blur_issue || image.has_exposure_issue || image.expression ||
            image.people_count != null) && (
            <div className="mt-3 pt-3 border-t border-primary/15 space-y-2 text-xs">
              <div className="flex flex-wrap gap-1.5">
                {image.is_keeper && <span className="rounded px-1.5 py-0.5 bg-emerald-500/15 text-emerald-500 font-medium">Keeper</span>}
                {image.ai_hero_candidate && <span className="rounded px-1.5 py-0.5 bg-yellow-500/15 text-yellow-600 dark:text-yellow-500 font-medium">AI hero</span>}
                {image.has_blur_issue && <span className="rounded px-1.5 py-0.5 bg-red-500/15 text-red-500 font-medium">Blur</span>}
                {image.has_exposure_issue && <span className="rounded px-1.5 py-0.5 bg-red-500/15 text-red-500 font-medium">Exposure</span>}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                {image.eyes_status && <span>Eyes: <span className="text-foreground">{image.eyes_status}</span></span>}
                {image.expression && <span>Expression: <span className="text-foreground">{image.expression}</span></span>}
                {image.looking_at_camera != null && <span>Looking: <span className="text-foreground">{image.looking_at_camera ? "yes" : "no"}</span></span>}
                {image.people_count != null && <span>People: <span className="text-foreground">{image.people_count}</span></span>}
              </div>
              {/* ai_tags are shown once, in the dedicated "AI Tags" card below —
                  not duplicated here. */}
            </div>
          )}
        </SectionCard>
      );
    }
    if (image.ai_rating) {
      return (
        <SectionCard>
          <SectionHeader icon={Star} label="AI Rating" accent="amber" />
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-4 h-4 transition-colors",
                  i < (image.ai_rating || 0)
                    ? "text-rating fill-rating"
                    : "text-white/10"
                )}
              />
            ))}
            <span className="ml-2 font-mono text-xs text-muted-foreground tabular-nums folio">
              {image.ai_rating || 0}/5
            </span>
          </div>
        </SectionCard>
      );
    }
    return null;
  };

  // ----- DRAWER MODE (hideHeader) -----
  if (hideHeader) {
    return (
      <div className="flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {renderStyleVersions()}
          {renderQuickActions()}
          {renderBadges()}
          {renderAIAnalysis()}
          {renderFaces()}
          {renderCameraAndExposure()}
          {renderTimeline()}
          {renderFileInfo()}
          {renderCategory()}
          {renderAITags()}
          {renderDelete()}
        </div>
      </div>
    );
  }

  // ----- DEFAULT / LIGHTBOX MODE -----
  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={cn(
        "glass-card border-border/50 flex flex-col z-10 overflow-hidden h-full",
        variant === "lightbox"
          ? "hidden md:flex md:w-80 md:flex-shrink-0 md:rounded-none md:border-l md:border-t-0"
          : "md:absolute md:right-0 md:left-auto md:top-0 md:bottom-0 md:w-80 md:rounded-none md:border-l md:border-t-0",
        "fixed inset-x-0 bottom-0 md:relative md:inset-auto",
        "max-h-[70vh] md:max-h-none",
        "rounded-t-2xl md:rounded-none"
      )}
      onClick={(e) => e.stopPropagation()}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.3 }}
      onDragEnd={handleDragEnd}
      dragDirectionLock
    >
      {/* Mobile Drag Handle */}
      <div className="md:hidden flex justify-center py-2 cursor-grab active:cursor-grabbing">
        <GripHorizontal className="w-8 h-1.5 text-muted-foreground/50" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold tracking-tight">Details</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/[0.06]" onClick={(e) => { e.stopPropagation(); onClose(); }}>
          <PanelRightClose className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {renderStyleVersions()}
        {renderQuickActions()}
        {renderBadges()}
        {renderAIAnalysis()}
        {renderCameraAndExposure()}
        {renderTimeline()}
        {renderFileInfo()}
        {renderCategory()}
        {renderAITags()}
        {renderDelete()}
      </div>
    </motion.div>
  );
}
