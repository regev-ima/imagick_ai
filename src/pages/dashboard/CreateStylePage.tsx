import { useState, useCallback, useMemo, useRef, useEffect, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  X,
  Sparkles,
  FileText,
  Loader2,
  CloudIcon,
  Heart,
  User as UserIcon,
  Baby,
  Users,
  PartyPopper,
  Briefcase,
  Home,
  Shirt,
  UtensilsCrossed,
  Mountain,
  MapPin,
  Trophy,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Orb } from "@/components/aura/Orb";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { UploadSourceSelector, type UploadSource } from "@/components/gallery/UploadSourceSelector";
import { GoogleDriveInput, type DriveFolderInfo } from "@/components/gallery/GoogleDriveInput";
import { Progress } from "@/components/ui/progress";
import { IMAGE_ACCEPT, isImageFile } from "@/lib/imageFileTypes";
import { uploadStyleFiles, type UploadStyleFileEvent } from "@/lib/uploadStyleFiles";

interface UploadProgress {
  before: { uploaded: number; total: number };
  after: { uploaded: number; total: number };
  /** Set of file IDs currently uploading */
  activeIds: Set<string>;
  /** Set of file IDs that finished uploading */
  doneIds: Set<string>;
  /** Set of file IDs that failed */
  failedIds: Set<string>;
}
const galleryTypes: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "wedding", label: "Wedding", icon: Heart },
  { value: "portrait", label: "Portrait", icon: UserIcon },
  { value: "newborn", label: "Newborn", icon: Baby },
  { value: "family", label: "Family", icon: Users },
  { value: "event", label: "Event", icon: PartyPopper },
  { value: "commercial", label: "Commercial", icon: Briefcase },
  { value: "real_estate", label: "Real Estate", icon: Home },
  { value: "fashion", label: "Fashion", icon: Shirt },
  { value: "food", label: "Food", icon: UtensilsCrossed },
  { value: "landscape", label: "Landscape", icon: Mountain },
  { value: "street", label: "Street", icon: MapPin },
  { value: "sports", label: "Sports", icon: Trophy },
];

// LIGHTROOM motion — calm, responsive fades/slides.
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

// Floating particles config (generated once) — brand royal-blue dust
const PARTICLES = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  size: Math.random() > 0.5 ? "w-1 h-1" : "w-2 h-2",
  color: Math.random() > 0.5 ? "bg-primary/20" : "bg-accent/20",
  top: `${Math.random() * 90 + 5}%`,
  left: `${Math.random() * 90 + 5}%`,
  duration: 4 + Math.random() * 4,
  yOffset: 20 + Math.random() * 20,
  xOffset: 10 + Math.random() * 10,
  delay: Math.random() * 3,
}));

// Gradient orbs config — royal-blue AI bloom
const ORBS = [
  { color: "bg-primary", size: "w-48 h-48 lg:w-72 lg:h-72", top: "10%", left: "15%", duration: 18 },
  { color: "bg-accent", size: "w-56 h-56 lg:w-64 lg:h-64", top: "60%", left: "70%", duration: 15 },
  { color: "bg-primary", size: "w-48 h-48", top: "40%", left: "45%", duration: 20 },
];

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

// Sparkle burst component for step completion & micro-interactions
function SparkleBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const sparks = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    const dist = 14 + Math.random() * 10;
    return { id: i, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  });
  return (
    <>
      {sparks.map((s) => (
        <motion.div
          key={s.id}
          className="absolute w-1 h-1 rounded-full bg-accent"
          style={{ top: "50%", left: "50%" }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: s.x, y: s.y, opacity: 0, scale: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

// Button hover sparkle effect
function ButtonSparkles({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-accent-foreground/80"
          style={{ bottom: 0, left: `${20 + i * 20}%` }}
          initial={{ y: 0, opacity: 0.8, scale: 1 }}
          animate={{ y: -20 - Math.random() * 15, opacity: 0, scale: 0 }}
          transition={{ duration: 0.6, delay: i * 0.08, repeat: Infinity, repeatDelay: 0.5 }}
        />
      ))}
    </>
  );
}

interface LocalFile {
  id: string;
  file: File;
  /** Object URL for an <img> preview, or null for RAW/HEIC the browser can't render. */
  preview: string | null;
}

// RAW/HEIC can't render as <img>; only build previews from web-renderable files.
const isPreviewable = (f: File) => f.type.startsWith("image/") && !/heic|heif/i.test(f.type);

export default function CreateStylePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Respect the OS "reduce motion" setting — gates all ambient/looping motion.
  const prefersReducedMotion = useReducedMotion();
  const [isCreating, setIsCreating] = useState(false);
  const [sparkleTarget, setSparkleTarget] = useState<string | null>(null);
  const [shimmerZone, setShimmerZone] = useState<"before" | "after" | null>(null);
  const [hoveringCreate, setHoveringCreate] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Step 1: Details + Model Types
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedModelTypes, setSelectedModelTypes] = useState<string[]>([]);

  // Step 2: Upload source
  const [uploadSource, setUploadSource] = useState<UploadSource>("local");

  // Step 2: Images - Local
  const [beforeFiles, setBeforeFiles] = useState<LocalFile[]>([]);
  const [afterFiles, setAfterFiles] = useState<LocalFile[]>([]);
  const [isDraggingBefore, setIsDraggingBefore] = useState(false);
  const [isDraggingAfter, setIsDraggingAfter] = useState(false);

  // Step 2: Images - Google Drive
  const [beforeFolderInfo, setBeforeFolderInfo] = useState<DriveFolderInfo | null>(null);
  const [beforeDriveLinks, setBeforeDriveLinks] = useState<string[]>([]);
  const [afterFolderInfo, setAfterFolderInfo] = useState<DriveFolderInfo | null>(null);
  const [afterDriveLinks, setAfterDriveLinks] = useState<string[]>([]);

  // Upload progress
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const beforePercent = useMemo(() => {
    if (!uploadProgress) return 0;
    const { uploaded, total } = uploadProgress.before;
    return total > 0 ? Math.round((uploaded / total) * 100) : 0;
  }, [uploadProgress]);

  const afterPercent = useMemo(() => {
    if (!uploadProgress) return 0;
    const { uploaded, total } = uploadProgress.after;
    return total > 0 ? Math.round((uploaded / total) * 100) : 0;
  }, [uploadProgress]);

  const toggleModelType = (value: string) => {
    setSparkleTarget(value);
    setTimeout(() => setSparkleTarget(null), 500);
    setSelectedModelTypes((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= 5) {
        toast.error("Maximum 5 types allowed");
        return prev;
      }
      return [...prev, value];
    });
  };

  // Local file handlers
  const handleDragOver = useCallback((e: React.DragEvent, type: "before" | "after") => {
    e.preventDefault();
    if (type === "before") setIsDraggingBefore(true);
    else setIsDraggingAfter(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, type: "before" | "after") => {
    e.preventDefault();
    if (type === "before") setIsDraggingBefore(false);
    else setIsDraggingAfter(false);
  }, []);

  // Before = original captures (RAW/HEIC allowed); After = edited exports (raster
  // only — a RAW "after" makes no sense as a training target).
  const acceptsFile = (f: File, type: "before" | "after") =>
    type === "before" ? isImageFile(f) : f.type.startsWith("image/");

  const handleDrop = useCallback((e: React.DragEvent, type: "before" | "after") => {
    e.preventDefault();
    if (type === "before") setIsDraggingBefore(false);
    else setIsDraggingAfter(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => acceptsFile(f, type));
    if (files.length > 0) {
      setShimmerZone(type);
      setTimeout(() => setShimmerZone(null), 600);
    }
    addFiles(files, type);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "before" | "after") => {
    if (e.target.files) addFiles(Array.from(e.target.files).filter((f) => acceptsFile(f, type)), type);
  };

  const addFiles = (files: File[], type: "before" | "after") => {
    const newFiles: LocalFile[] = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: isPreviewable(file) ? URL.createObjectURL(file) : null,
    }));
    if (type === "before") setBeforeFiles((prev) => [...prev, ...newFiles]);
    else setAfterFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string, type: "before" | "after") => {
    const setter = type === "before" ? setBeforeFiles : setAfterFiles;
    setter((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  // Apply an upload-progress event (from the shared uploadStyleFiles helper)
  // to local state — same active/done/failed + per-side counter bookkeeping
  // the inline uploader used to do directly.
  const applyUploadProgress = (subDir: "before" | "after") => (event: UploadStyleFileEvent) => {
    setUploadProgress((prev) => {
      if (!prev) return prev;
      const next = { ...prev, activeIds: new Set(prev.activeIds), doneIds: new Set(prev.doneIds), failedIds: new Set(prev.failedIds) };
      if (event.type === "active") {
        next.activeIds.add(event.fileId);
      } else if (event.type === "done") {
        next.activeIds.delete(event.fileId);
        next.doneIds.add(event.fileId);
        next[subDir] = { ...next[subDir], uploaded: next[subDir].uploaded + 1 };
      } else if (event.type === "failed") {
        next.activeIds.delete(event.fileId);
        next.failedIds.add(event.fileId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!user) {
      toast.error("Please sign in to create a style");
      return;
    }

    setIsCreating(true);
    try {
      const isGoogleDrive = uploadSource === "drive";
      const initialStatus = isGoogleDrive ? "importing" : "uploading";

      const { data: style, error: insertError } = await supabase
        .from("styles")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          category: selectedModelTypes[0] || null,
          associated_tags: selectedModelTypes,
          user_id: user.id,
          status: initialStatus,
          visibility: "private",
          is_preset: false,
          upload_method: isGoogleDrive ? "google_drive" : "direct",
          google_before_urls: isGoogleDrive ? beforeDriveLinks : null,
          google_after_urls: isGoogleDrive ? afterDriveLinks : null,
          google_before_metadata: isGoogleDrive && beforeFolderInfo ? beforeFolderInfo as any : null,
          google_after_metadata: isGoogleDrive && afterFolderInfo ? afterFolderInfo as any : null,
        })
        .select("id")
        .single();

      if (insertError || !style) throw insertError || new Error("Failed to create style");

      const styleId = style.id;

      if (isGoogleDrive) {
        const transferCount = beforeDriveLinks.length + afterDriveLinks.length;

        await supabase
          .from("styles")
          .update({ import_transfers_total: transferCount } as any)
          .eq("id", styleId);

        const beforeDir = `styles/${user.id}/${styleId}/before/`;
        const afterDir = `styles/${user.id}/${styleId}/after/`;

        if (beforeDriveLinks.length > 0) {
          supabase.functions.invoke("gd-import", {
            body: {
              driveLinks: beforeDriveLinks,
              styleId,
              transferType: "style-before",
              outputDir: beforeDir,
              modelType: selectedModelTypes[0] || "event",
            },
          }).catch((err) => console.error("Before GD transfer failed:", err));
        }

        if (afterDriveLinks.length > 0) {
          supabase.functions.invoke("gd-import", {
            body: {
              driveLinks: afterDriveLinks,
              styleId,
              transferType: "style-after",
              outputDir: afterDir,
              modelType: selectedModelTypes[0] || "event",
            },
          }).catch((err) => console.error("After GD transfer failed:", err));
        }

        toast.success("Style created! Import from Google Drive has started.");
      } else {
        // Initialize upload progress
        setUploadProgress({
          before: { uploaded: 0, total: beforeFiles.length },
          after: { uploaded: 0, total: afterFiles.length },
          activeIds: new Set(),
          doneIds: new Set(),
          failedIds: new Set(),
        });

        const beforeDir = `styles/${user.id}/${styleId}/before/`;
        const afterDir = `styles/${user.id}/${styleId}/after/`;

        await supabase
          .from("styles")
          .update({
            import_start_date: new Date().toISOString(),
            total_images_to_import: beforeFiles.length + afterFiles.length,
          })
          .eq("id", styleId);

        const [beforeUrls, afterUrls] = await Promise.all([
          uploadStyleFiles(beforeFiles, user.id, styleId, "before", applyUploadProgress("before")),
          uploadStyleFiles(afterFiles, user.id, styleId, "after", applyUploadProgress("after")),
        ]);

        await supabase
          .from("styles")
          .update({
            before_image_urls: beforeUrls,
            after_image_urls: afterUrls,
            import_completion_date: new Date().toISOString(),
            total_images_imported: beforeUrls.length + afterUrls.length,
          })
          .eq("id", styleId);

        const { error: trainError } = await supabase.functions.invoke("train-style", {
          body: {
            styleId,
            modelType: selectedModelTypes[0] || "event",
            beforeDirs: [beforeDir],
            afterDirs: [afterDir],
          },
        });

        if (trainError) {
          console.error("Failed to start training:", trainError);
          toast.error("Images uploaded but training failed to start. Please try again from the style page.");
        } else {
          toast.success("Style created! Training has started.");
        }
      }

      navigate(`/dashboard/styles/${styleId}`);
    } catch (error: any) {
      console.error("Create style error:", error);
      toast.error(error.message || "Failed to create style");
    } finally {
      setIsCreating(false);
    }
  };

  const hasName = name.trim().length > 0;
  const hasImages =
    uploadSource === "local"
      ? beforeFiles.length >= 5 && afterFiles.length >= 5
      : beforeDriveLinks.length > 0 && afterDriveLinks.length > 0;
  const canCreate = hasName && hasImages;

  // Leaving mid-flow throws away typed details, staged files, and Drive links.
  // Intercept Cancel / back with a confirm when there's something to lose.
  const hasUnsavedWork =
    name.trim().length > 0 ||
    description.trim().length > 0 ||
    selectedModelTypes.length > 0 ||
    beforeFiles.length > 0 ||
    afterFiles.length > 0 ||
    beforeDriveLinks.length > 0 ||
    afterDriveLinks.length > 0 ||
    isCreating;

  const handleLeave = () => {
    if (hasUnsavedWork) {
      setShowLeaveConfirm(true);
    } else {
      navigate("/dashboard/styles");
    }
  };

  // Warn on tab close / reload only while an upload is actually in flight.
  useEffect(() => {
    if (!isCreating) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isCreating]);

  // Local before/after should be matched pairs — surface a non-blocking nudge.
  const localCountMismatch =
    uploadSource === "local" &&
    beforeFiles.length > 0 &&
    afterFiles.length > 0 &&
    beforeFiles.length !== afterFiles.length;

  return (
    <div className="relative min-h-full overflow-hidden bg-background px-5 py-7 lg:px-10 lg:py-10">
      {/* === AI Ambient Animations (Background) — royal-blue dust === */}
      {!prefersReducedMotion && (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Floating particles */}
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className={cn("absolute rounded-full opacity-40", p.size, p.color)}
            style={{ top: p.top, left: p.left }}
            animate={{
              y: [-p.yOffset, p.yOffset, -p.yOffset],
              x: [-p.xOffset, p.xOffset, -p.xOffset],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: p.delay,
            }}
          />
        ))}
        {/* Gradient orbs */}
        {ORBS.map((orb, i) => (
          <motion.div
            key={i}
            className={cn("absolute rounded-full blur-[100px] opacity-[0.06]", orb.size, orb.color)}
            style={{ top: orb.top, left: orb.left }}
            animate={{
              x: [0, 60, -40, 0],
              y: [0, -50, 30, 0],
            }}
            transition={{
              duration: orb.duration,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      )}

      <div className="relative mx-auto w-full max-w-[1100px]">
        {/* ════ MASTHEAD — single page, inspired by the collection planner ══ */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleLeave} aria-label="Back to styles">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <span className="aura-microlabel flex items-center gap-1.5 text-accent">
              <Sparkle size={11} /> Train an AI style
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Train New <span className="text-accent">AI Style</span>
            </h1>
          </div>
        </div>

        {/* ════ SINGLE PANEL — Details + Training pairs stacked ══════════ */}
        <div className="relative mt-6 glass-card overflow-hidden rounded-[--radius]">
          {/* ── Section 1 · Details ── */}
          <div className="p-6 lg:p-8">
            <div className="space-y-6">
                  {/* Hero Section */}
                  <div className="mb-6 flex items-center gap-4">
                    <Orb className="h-10 w-10 shrink-0" />
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight lg:text-3xl">
                        Teach AI <span className="text-accent">Your Unique Eye</span>
                      </h2>
                      <p className="mt-1 font-sans text-sm text-muted-foreground">
                        Your editing style, replicated across hundreds of photos in minutes.
                      </p>
                    </div>
                  </div>

                  {/* Compact Form: Name + Description on same row */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="name" className="mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Style Name *
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Warm Wedding, Moody Portrait"
                        className="bg-input border-border"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description" className="mb-2 block">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the look and feel..."
                        className="min-h-[68px] bg-input border-border"
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Model Type - compact grid */}
                  <div>
                    <Label className="mb-3 flex items-center gap-2">Model Type</Label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {galleryTypes.map((type) => {
                        const Icon = type.icon;
                        const isSelected = selectedModelTypes.includes(type.value);
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => toggleModelType(type.value)}
                            aria-pressed={isSelected}
                            aria-label={type.label}
                            className={cn(
                              "relative flex flex-col items-center gap-1 rounded-[--radius] border p-2 text-center transition-all",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                              isSelected
                                ? "border-primary bg-primary/10"
                                : "border-border bg-card hover:border-primary/50",
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-4 w-4",
                                isSelected ? "text-accent" : "text-muted-foreground",
                              )}
                            />
                            <span className={cn(
                              "text-xs font-medium",
                              isSelected ? "text-accent" : "text-muted-foreground",
                            )}>
                              {type.label}
                            </span>
                            {isSelected && (
                              <Check className="absolute right-1 top-1 h-3 w-3 text-accent" />
                            )}
                            {/* Sparkle micro-interaction on select */}
                            <SparkleBurst active={sparkleTarget === type.value && !prefersReducedMotion} />
                          </button>
                        );
                      })}
                    </div>
                    {selectedModelTypes.length > 0 && (
                      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                        {selectedModelTypes.length}/5 selected
                      </p>
                    )}
                  </div>
            </div>
          </div>

          {/* ── divider between the two former steps ── */}
          <hr className="aura-hairline" />

          {/* ── Section 2 · Training pairs ── */}
          <div className="p-6 lg:p-8">
            <div className="space-y-6">
                  <div>
                    <h2 className="mb-1 text-xl font-semibold tracking-tight">Training Images</h2>
                    <p className="font-sans text-sm text-muted-foreground">
                      Upload matching before and after images to train your AI style
                    </p>
                  </div>

                  <UploadSourceSelector value={uploadSource} onChange={setUploadSource} />

                  {uploadSource === "local" ? (
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Before Images - Local */}
                      <div className="space-y-4">
                        <Label className="flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          Before Images (Original) - {beforeFiles.length} files
                        </Label>

                        {/* Upload progress bar for Before */}
                        {uploadProgress && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span className="text-muted-foreground">
                                Uploading: {uploadProgress.before.uploaded}/{uploadProgress.before.total}
                              </span>
                              <span className="font-semibold text-accent">{beforePercent}%</span>
                            </div>
                            <Progress value={beforePercent} className="h-2" />
                          </div>
                        )}

                        {!isCreating && (
                          <div
                            onDragOver={(e) => handleDragOver(e, "before")}
                            onDragLeave={(e) => handleDragLeave(e, "before")}
                            onDrop={(e) => handleDrop(e, "before")}
                            className={cn(
                              "relative overflow-hidden rounded-[--radius] border-2 border-dashed p-6 text-center transition-all",
                              isDraggingBefore
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50",
                            )}
                          >
                            {/* Shimmer on file drop */}
                            {shimmerZone === "before" && (
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                                initial={{ x: "-100%" }}
                                animate={{ x: "100%" }}
                                transition={{ duration: 0.6, ease: "easeInOut" }}
                              />
                            )}
                            <input
                              type="file"
                              multiple
                              accept={IMAGE_ACCEPT}
                              onChange={(e) => handleFileSelect(e, "before")}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            />
                            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                            <p className="font-sans text-sm text-muted-foreground">Drag & drop or click to upload</p>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">Minimum 5 unedited images · RAW supported</p>
                          </div>
                        )}

                        {beforeFiles.length > 0 && (
                          <div className="grid grid-cols-4 gap-2">
                            {beforeFiles.slice(0, 8).map((file) => {
                              const isActive = uploadProgress?.activeIds.has(file.id);
                              const isDone = uploadProgress?.doneIds.has(file.id);
                              const isFailed = uploadProgress?.failedIds.has(file.id);
                              return (
                                <div key={file.id} className="group relative">
                                  {file.preview ? (
                                    <img
                                      src={file.preview}
                                      alt="Before"
                                      className={cn(
                                        "aspect-square w-full rounded-sm object-cover plate-keyline transition-opacity",
                                        isActive && "opacity-60",
                                      )}
                                    />
                                  ) : (
                                    <div
                                      className={cn(
                                        "grid aspect-square w-full place-items-center rounded-sm bg-surface-2 plate-keyline transition-opacity",
                                        isActive && "opacity-60",
                                      )}
                                    >
                                      <span className="font-mono text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">RAW</span>
                                    </div>
                                  )}
                                  {/* Upload status overlay */}
                                  {isActive && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-background/40">
                                      <Loader2 className="h-5 w-5 animate-spin text-accent" />
                                    </div>
                                  )}
                                  {isDone && (
                                    <div className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                      <Check className="h-3 w-3 text-primary-foreground" />
                                    </div>
                                  )}
                                  {isFailed && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-destructive/20">
                                      <X className="h-5 w-5 text-destructive" />
                                    </div>
                                  )}
                                  {!uploadProgress && (
                                    <button
                                      onClick={() => removeFile(file.id, "before")}
                                      aria-label="Remove before image"
                                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            {beforeFiles.length > 8 && (
                              <div className="flex aspect-square w-full items-center justify-center rounded-sm bg-muted font-mono text-sm text-muted-foreground">
                                +{beforeFiles.length - 8}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* After Images - Local */}
                      <div className="space-y-4">
                        <Label className="flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          After Images (Edited) - {afterFiles.length} files
                        </Label>

                        {/* Upload progress bar for After */}
                        {uploadProgress && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span className="text-muted-foreground">
                                Uploading: {uploadProgress.after.uploaded}/{uploadProgress.after.total}
                              </span>
                              <span className="font-semibold text-accent">{afterPercent}%</span>
                            </div>
                            <Progress value={afterPercent} className="h-2" />
                          </div>
                        )}

                        {!isCreating && (
                          <div
                            onDragOver={(e) => handleDragOver(e, "after")}
                            onDragLeave={(e) => handleDragLeave(e, "after")}
                            onDrop={(e) => handleDrop(e, "after")}
                            className={cn(
                              "relative overflow-hidden rounded-[--radius] border-2 border-dashed p-6 text-center transition-all",
                              isDraggingAfter
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50",
                            )}
                          >
                            {/* Shimmer on file drop */}
                            {shimmerZone === "after" && (
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                                initial={{ x: "-100%" }}
                                animate={{ x: "100%" }}
                                transition={{ duration: 0.6, ease: "easeInOut" }}
                              />
                            )}
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => handleFileSelect(e, "after")}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            />
                            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                            <p className="font-sans text-sm text-muted-foreground">Drag & drop or click to upload</p>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">Matching edited images</p>
                          </div>
                        )}

                        {afterFiles.length > 0 && (
                          <div className="grid grid-cols-4 gap-2">
                            {afterFiles.slice(0, 8).map((file) => {
                              const isActive = uploadProgress?.activeIds.has(file.id);
                              const isDone = uploadProgress?.doneIds.has(file.id);
                              const isFailed = uploadProgress?.failedIds.has(file.id);
                              return (
                                <div key={file.id} className="group relative">
                                  <img
                                    src={file.preview ?? undefined}
                                    alt="After"
                                    className={cn(
                                      "aspect-square w-full rounded-sm object-cover plate-keyline transition-opacity",
                                      isActive && "opacity-60",
                                    )}
                                  />
                                  {isActive && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-background/40">
                                      <Loader2 className="h-5 w-5 animate-spin text-accent" />
                                    </div>
                                  )}
                                  {isDone && (
                                    <div className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                      <Check className="h-3 w-3 text-primary-foreground" />
                                    </div>
                                  )}
                                  {isFailed && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-destructive/20">
                                      <X className="h-5 w-5 text-destructive" />
                                    </div>
                                  )}
                                  {!uploadProgress && (
                                    <button
                                      onClick={() => removeFile(file.id, "after")}
                                      aria-label="Remove after image"
                                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            {afterFiles.length > 8 && (
                              <div className="flex aspect-square w-full items-center justify-center rounded-sm bg-muted font-mono text-sm text-muted-foreground">
                                +{afterFiles.length - 8}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Google Drive mode */
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <CloudIcon className="w-4 h-4" />
                          Before Images (Original)
                        </Label>
                        <GoogleDriveInput
                          folderInfo={beforeFolderInfo}
                          onUpdate={(info, links) => {
                            setBeforeFolderInfo(info);
                            setBeforeDriveLinks(links);
                          }}
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <CloudIcon className="w-4 h-4" />
                          After Images (Edited)
                        </Label>
                        <GoogleDriveInput
                          folderInfo={afterFolderInfo}
                          onUpdate={(info, links) => {
                            setAfterFolderInfo(info);
                            setAfterDriveLinks(links);
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {localCountMismatch && (
                    <div
                      role="alert"
                      className="flex items-start gap-3 rounded-[--radius] border border-amber-500/30 bg-amber-500/10 p-4"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <p className="font-sans text-sm leading-snug text-muted-foreground">
                        <span className="font-medium text-amber-500">
                          Counts don't match — {beforeFiles.length} before vs {afterFiles.length} after.
                        </span>{" "}
                        Training works best with the same number of matched before/after pairs.
                      </p>
                    </div>
                  )}

                  <div className="flex items-start gap-3 rounded-[--radius] border border-primary/25 bg-primary/[0.06] p-4">
                    <Sparkle size={14} className="mt-0.5 shrink-0 text-accent" />
                    <p className="font-sans text-sm leading-snug text-muted-foreground">
                      <span className="font-medium text-foreground">Tip: </span>
                      For best results, use images with consistent editing style. The AI will learn your unique look from these examples.
                      {uploadSource === "local" ? " Minimum 5 pairs required." : " Each folder should contain at least 5 images."}
                    </p>
                  </div>
            </div>
          </div>

          {/* ════ ACTION BAR — single create, no wizard ══════════════════ */}
          <div className="flex items-center justify-end gap-3 border-t border-border bg-background/40 px-6 py-4">
            <Button variant="outline" onClick={handleLeave}>
              Cancel
            </Button>
            <Button
              variant="glow"
              onClick={() => setShowConfirmDialog(true)}
              disabled={!canCreate || isCreating}
              className="relative gap-2 overflow-hidden"
              onMouseEnter={() => setHoveringCreate(true)}
              onMouseLeave={() => setHoveringCreate(false)}
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkle size={14} className="text-accent-foreground" />}
              {isCreating ? "Uploading..." : "Create Style"}
              <ButtonSparkles active={hoveringCreate && !isCreating && !prefersReducedMotion} />
            </Button>
          </div>
        </div>
      </div>

      {/* ════ CONFIRMATION DIALOG — peak AI moment ═════════════════════ */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-2 flex items-center gap-3">
              <Orb className="h-9 w-9 shrink-0" />
              <AlertDialogTitle className="flex items-center gap-2">
                Ready to train your style?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              This will upload your images and start training the AI model.
              Training typically takes 30-60 minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmDialog(false);
                handleCreate();
              }}
            >
              <Sparkle size={14} className="mr-2 text-accent-foreground" />
              Confirm & Train
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════ LEAVE GUARD — protect typed details + staged uploads ══════ */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isCreating ? "Leave while training is starting?" : "Leave without training?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isCreating
                ? "Your images are still uploading. Leaving now may interrupt the upload and training won't start."
                : "Your style details and uploaded images haven't been saved yet. Leaving will discard them."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/dashboard/styles")}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
