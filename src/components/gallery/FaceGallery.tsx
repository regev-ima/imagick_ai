import { useState } from "react";
import { ScanFace, Loader2, AlertCircle, RotateCcw, Trash2, Users, Camera, MousePointerClick, Sparkles, Check, ChevronRight, ArrowLeft, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { FaceThumbnail } from "./FaceThumbnail";

interface FaceCluster {
  id: string;
  face_count: number;
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
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
            <ScanFace className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Face Search</h2>
          <p className="text-muted-foreground text-center max-w-lg mb-8">
            Let your clients find themselves in seconds. Our AI detects every face in your gallery, groups them by person, and creates a beautiful face-based navigation for your clients.
          </p>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mb-8">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="p-4 text-center space-y-2 bg-muted/30 border-border/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>

          {/* How it works */}
          <div className="max-w-lg w-full mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">How it works</h3>
            <div className="space-y-2">
              {[
                "AI scans all photos in your gallery",
                "Faces are detected and grouped by person",
                "A face navigation bar appears in your client gallery",
                "Clients click their face to see all their photos",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <span className="text-muted-foreground">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Button
            size="lg"
            onClick={() => setShowConfirm(true)}
            disabled={isStarting}
            className="gap-2 px-8"
          >
            <Sparkles className="w-4 h-4" />
            Start Face Detection
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            This process may take a few minutes depending on the number of photos.
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
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-primary/20 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          </div>
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
                <p className="text-2xl font-bold text-foreground">{processed}/{total}</p>
                <p className="text-xs text-muted-foreground">Photos scanned</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{facesFound}</p>
                <p className="text-xs text-muted-foreground">Faces found</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{percentage}%</span>
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
              <Check className="w-3.5 h-3.5 text-green-500" />
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
          <span className="text-sm font-medium">
            {clusters.length} {clusters.length === 1 ? "person" : "people"} detected
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
              "flex flex-col items-center gap-2 p-3 cursor-pointer transition-all duration-200",
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
            <Badge variant="secondary" className="text-xs">
              {cluster.face_count} {cluster.face_count === 1 ? "photo" : "photos"}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
