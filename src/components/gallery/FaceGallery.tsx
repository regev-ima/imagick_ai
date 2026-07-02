import { useState } from "react";
import { ScanFace, Loader2, AlertCircle, RotateCcw, Trash2, Users, Camera, MousePointerClick, Check, ChevronRight, ArrowLeft, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Orb } from "@/components/aura/Orb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** The AI mark — 4-point sparkle (logo star). Inherits currentColor. */
function Sparkle({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FaceThumbnail } from "./FaceThumbnail";
import { useNameFaceCluster } from "@/hooks/useFaceSearch";

// Preset family/wedding roles the photographer can tap to name a person, plus
// free text for anything else.
const PERSON_ROLES = [
  "חתן", "כלה",
  "אב החתן", "אם החתן",
  "אב הכלה", "אם הכלה",
  "הורי החתן", "הורי הכלה",
  "משפחה", "אח/אחות", "סבא", "סבתא",
];

interface FaceCluster {
  id: string;
  face_count: number;
  label?: string | null;
  representative_bbox: { top: number; left: number; width: number; height: number } | null;
  representative_image: {
    id: string;
    original_url: string;
  } | null;
}

interface DetectionProgress {
  phase: "loading-models" | "detecting" | "clustering" | "done" | "error";
  processedImages: number;
  totalImages: number;
  facesFound: number;
  error?: string;
}

interface FaceGalleryProps {
  clusters: FaceCluster[];
  galleryId?: string;
  faceSearchStatus: string;
  faceSearchError?: string | null;
  faceSearchStartedAt?: string | null;
  isLoading: boolean;
  totalImages?: number;
  detectedFacesCount?: number;
  detectionProgress?: DetectionProgress | null;
  onClusterSelect: (clusterId: string) => void;
  onStartFaceSearch: () => void;
  onResetFaceSearch: () => void;
  onBackToGallery: () => void;
  onCancel?: () => void;
  isStarting: boolean;
}

const FEATURES = [
  {
    icon: ScanFace,
    title: "AI Face Detection",
    description: "Advanced AI scans every photo and detects all faces automatically",
  },
  {
    icon: Users,
    title: "Smart Grouping",
    description: "Faces are grouped by identity — same person, one group",
  },
  {
    icon: MousePointerClick,
    title: "One-Click Access",
    description: "Your clients click their face and instantly see all their photos",
  },
];

export function FaceGallery({
  clusters,
  galleryId,
  faceSearchStatus,
  faceSearchError,
  isLoading,
  totalImages,
  detectedFacesCount,
  detectionProgress,
  faceSearchStartedAt,
  onClusterSelect,
  onStartFaceSearch,
  onResetFaceSearch,
  onBackToGallery,
  onCancel,
  isStarting,
}: FaceGalleryProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const renameCluster = useNameFaceCluster(galleryId);

  // Back button rendered at the top of every state
  const backButton = (
    <div className="mb-4">
      <Button variant="ghost" size="sm" onClick={onBackToGallery} className="gap-1.5">
        <ArrowLeft className="w-4 h-4" />
        Back to Gallery
      </Button>
    </div>
  );

  // --- IDLE STATE: Marketing explanation + confirmation ---
  if (faceSearchStatus === "idle") {
    return (
      <>
        {backButton}
        <div className="flex flex-col items-center py-12 px-4">
          {/* Hero */}
          <Orb className="w-20 h-20 mb-6" />
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Sparkle size={20} className="text-primary" />
            Face Search
          </h2>
          <p className="text-muted-foreground text-center max-w-lg mb-8">
            Let your clients find themselves in seconds. Our AI detects every face in your gallery, groups them by person, and creates a beautiful face-based navigation for your clients.
          </p>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mb-8">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="p-4 text-center space-y-2 surface-2 border-border/60 rounded-sm">
                <div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>

          {/* How it works */}
          <div className="max-w-lg w-full mb-8">
            <h3 className="aura-microlabel mb-3 text-center">How it works</h3>
            <div className="space-y-2">
              {[
                "AI scans all photos in your gallery",
                "Faces are detected and grouped by person",
                "A face navigation bar appears in your client gallery",
                "Clients click their face to see all their photos",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="font-mono text-xs font-bold text-primary folio">{i + 1}</span>
                  </div>
                  <span className="text-muted-foreground">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA — faces are detected by AI Culling ("Recognize people"), one engine. */}
          <Button
            variant="glow"
            size="lg"
            onClick={() => onStartFaceSearch()}
            disabled={isStarting}
            className="gap-2 px-8"
          >
            <Sparkle size={15} className="text-current" />
            Detect people (AI Culling)
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Faces are detected as part of AI Culling — enable “Recognize people” when you run it.
          </p>
        </div>

        {/* Confirmation dialog */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start Face Detection?</AlertDialogTitle>
              <AlertDialogDescription>
                The AI will scan all photos in this gallery to detect and group faces.
                This process runs in the background and may take several minutes for large galleries.
                You can continue working while it runs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowConfirm(false);
                  onStartFaceSearch();
                }}
              >
                <ScanFace className="w-4 h-4 mr-2" />
                Start Detection
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // --- PROCESSING STATE: Progress tracking ---
  if (faceSearchStatus === "processing" || (detectionProgress && detectionProgress.phase !== "done" && detectionProgress.phase !== "error")) {
    const dp = detectionProgress;
    const facesFound = dp?.facesFound ?? detectedFacesCount ?? 0;
    const processed = dp?.processedImages ?? 0;
    const total = dp?.totalImages ?? totalImages ?? 0;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
    const phaseLabel = dp?.phase === "loading-models" ? "Loading AI models..."
      : dp?.phase === "clustering" ? "Grouping faces..."
      : "Detecting faces...";

    return (
      <div>
        {backButton}
        <div className="flex flex-col items-center justify-center py-16 gap-6">
          <Orb className="w-20 h-20" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">{phaseLabel}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {dp?.phase === "loading-models"
                ? "Downloading face detection models to your browser. This happens once."
                : dp?.phase === "clustering"
                ? "Grouping similar faces together..."
                : "AI is scanning your photos in your browser. Please keep this tab open."
              }
            </p>
          </div>

          {/* Live stats */}
          <div className="w-full max-w-xs space-y-3">
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-foreground folio tabular-nums">{processed}/{total}</p>
                <p className="aura-microlabel mt-0.5">Photos scanned</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-primary folio tabular-nums">{facesFound}</p>
                <p className="aura-microlabel mt-0.5">Faces found</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between font-mono text-xs text-muted-foreground tabular-nums">
                <span>Progress</span>
                <span className="text-foreground folio">{percentage}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground surface-2 border border-border/60 rounded-sm px-4 py-2">
              <Check className="w-3.5 h-3.5 text-secondary" />
              <span>Processing happens in your browser — keep this tab open</span>
            </div>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5 text-xs text-muted-foreground">
                <StopCircle className="w-3.5 h-3.5" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (faceSearchStatus === "error") {
    return (
      <div>
        {backButton}
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-medium">Face Detection Failed</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {faceSearchError || "An error occurred during face detection. Please try again."}
          </p>
        </div>
        <Button variant="outline" onClick={onResetFaceSearch} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Try Again
        </Button>
      </div>
      </div>
    );
  }

  // --- COMPLETED STATE: Show clusters ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div>
        {backButton}
        <div className="flex flex-col items-center justify-center py-16 gap-4">
        <ScanFace className="w-12 h-12 text-muted-foreground" />
        <div className="text-center space-y-1">
          <h3 className="text-lg font-medium">No Faces Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            No faces were detected in this gallery. This can happen if the photos don't contain people or if the images are too small.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onResetFaceSearch} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Re-run Detection
        </Button>
      </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {backButton}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ScanFace className="w-4 h-4 text-primary" />
          <span className="aura-chip">
            <span className="folio text-foreground">{clusters.length}</span> {clusters.length === 1 ? "person" : "people"}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onResetFaceSearch} className="gap-1.5 text-xs text-muted-foreground">
          <Trash2 className="w-3.5 h-3.5" />
          Clear & Re-run
        </Button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {clusters.map((cluster) => (
          <Card
            key={cluster.id}
            className={cn(
              "flex flex-col items-center gap-2 p-3 cursor-pointer transition-all duration-200 rounded-sm",
              "hover:shadow-lg hover:border-primary/50"
            )}
            onClick={() => onClusterSelect(cluster.id)}
          >
            {cluster.representative_image && cluster.representative_bbox ? (
              <FaceThumbnail
                imageUrl={cluster.representative_image.original_url}
                bbox={cluster.representative_bbox}
                size={72}
              />
            ) : (
              <div className="w-[72px] h-[72px] rounded-full bg-muted flex items-center justify-center">
                <ScanFace className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            {/* Person name / role — click to assign, doesn't open the cluster. */}
            <ClusterNamePicker
              label={cluster.label ?? null}
              onSelect={(label) => renameCluster.mutate({ clusterId: cluster.id, label })}
            />
            <span className="aura-chip">
              <span className="folio text-foreground">{cluster.face_count}</span> {cluster.face_count === 1 ? "photo" : "photos"}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Names a detected person: tap to open preset wedding roles + free text.
// Stops click propagation so naming never opens the cluster.
function ClusterNamePicker({
  label,
  onSelect,
}: {
  label: string | null;
  onSelect: (label: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
            label
              ? "bg-primary/15 text-primary hover:bg-primary/25"
              : "text-muted-foreground hover:text-foreground"
          )}
          dir="rtl"
        >
          {label || "+ שם / תפקיד"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex flex-wrap gap-1">
          {PERSON_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => { onSelect(role); setOpen(false); }}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs transition-colors",
                label === role
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
            >
              {role}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) { onSelect(custom.trim()); setCustom(""); setOpen(false); }
          }}
          className="flex gap-1.5"
        >
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="שם מותאם אישית…"
            className="h-7 text-xs"
          />
          <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!custom.trim()}>
            שמור
          </Button>
        </form>
        {label && (
          <button
            type="button"
            onClick={() => { onSelect(null); setOpen(false); }}
            className="mt-2 w-full text-center text-[11px] text-muted-foreground hover:text-destructive"
          >
            הסר שם
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
