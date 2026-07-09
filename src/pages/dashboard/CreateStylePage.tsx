import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Upload,
  X,
  Loader2,
  CloudIcon,
  Pencil,
  Zap,
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

/**
 * The AI mark — a 4-point sparkle (the logo star). Royal blue by default,
 * tinted via currentColor so it inherits text-primary / text-accent.
 */
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

/** Live-summary chip for the header row (mirrors the New Collection pattern). */
function Pill({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
      accent
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border bg-surface-2 text-muted-foreground",
    )}>
      {children}
    </span>
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
  const [isCreating, setIsCreating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Details
  const [name, setName] = useState("");
  const [selectedModelTypes, setSelectedModelTypes] = useState<string[]>([]);

  // Upload source
  const [uploadSource, setUploadSource] = useState<UploadSource>("local");

  // Images — Local
  const [beforeFiles, setBeforeFiles] = useState<LocalFile[]>([]);
  const [afterFiles, setAfterFiles] = useState<LocalFile[]>([]);
  const [isDraggingBefore, setIsDraggingBefore] = useState(false);
  const [isDraggingAfter, setIsDraggingAfter] = useState(false);

  // Images — Google Drive
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

  // Apply an upload-progress event (from the shared uploadStyleFiles helper) to
  // local state — active/done/failed + per-side counter bookkeeping.
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
          description: null,
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

  // ── Derived summary (drives the header pills + footer) ───────────────────────
  const beforeCount = uploadSource === "local" ? beforeFiles.length : beforeDriveLinks.length;
  const afterCount = uploadSource === "local" ? afterFiles.length : afterDriveLinks.length;
  const typeLabel = galleryTypes.find((t) => t.value === selectedModelTypes[0])?.label ?? "any subject";

  const hasName = name.trim().length > 0;
  const hasImages =
    uploadSource === "local"
      ? beforeFiles.length >= 5 && afterFiles.length >= 5
      : beforeDriveLinks.length > 0 && afterDriveLinks.length > 0;
  const canCreate = hasName && hasImages;

  // Local before/after should be matched pairs — surface a non-blocking nudge.
  const localCountMismatch =
    uploadSource === "local" &&
    beforeFiles.length > 0 &&
    afterFiles.length > 0 &&
    beforeFiles.length !== afterFiles.length;

  // Leaving mid-flow throws away typed details, staged files, and Drive links.
  const hasUnsavedWork =
    name.trim().length > 0 ||
    selectedModelTypes.length > 0 ||
    beforeFiles.length > 0 ||
    afterFiles.length > 0 ||
    beforeDriveLinks.length > 0 ||
    afterDriveLinks.length > 0 ||
    isCreating;

  const handleLeave = () => {
    if (hasUnsavedWork) setShowLeaveConfirm(true);
    else navigate("/dashboard/styles");
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

  // ── One reusable local upload column (before / after) ────────────────────────
  const renderLocalZone = (type: "before" | "after") => {
    const files = type === "before" ? beforeFiles : afterFiles;
    const dragging = type === "before" ? isDraggingBefore : isDraggingAfter;
    const percent = type === "before" ? beforePercent : afterPercent;
    const side = uploadProgress?.[type];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="caption flex items-center gap-1.5">
            <Upload className="h-3 w-3" />
            {type === "before" ? "Before · originals" : "After · edited"}
          </span>
          <span className="aura-chip">{files.length} {files.length === 1 ? "file" : "files"}</span>
        </div>

        {uploadProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between caption">
              <span>{side?.uploaded ?? 0}/{side?.total ?? 0}</span>
              <span className="text-accent">{percent}%</span>
            </div>
            <Progress value={percent} className="h-1.5" />
          </div>
        )}

        {!isCreating && (
          <div
            onDragOver={(e) => handleDragOver(e, type)}
            onDragLeave={(e) => handleDragLeave(e, type)}
            onDrop={(e) => handleDrop(e, type)}
            className={cn(
              "relative overflow-hidden rounded-[--radius] border-2 border-dashed p-5 text-center transition-colors",
              dragging ? "border-primary bg-primary/[0.04]" : "border-border hover:border-primary/50 hover:bg-primary/[0.03]",
            )}
          >
            <input
              type="file"
              multiple
              accept={type === "before" ? IMAGE_ACCEPT : "image/*"}
              onChange={(e) => handleFileSelect(e, type)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={`Upload ${type} images`}
            />
            <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag &amp; drop or click</p>
            <p className="caption mt-1">
              {type === "before" ? "Min 5 · RAW ok" : "Matched by filename"}
            </p>
          </div>
        )}

        {files.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {files.slice(0, 8).map((file) => {
              const isActive = uploadProgress?.activeIds.has(file.id);
              const isDone = uploadProgress?.doneIds.has(file.id);
              const isFailed = uploadProgress?.failedIds.has(file.id);
              return (
                <div key={file.id} className="group relative">
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt=""
                      className={cn("aspect-square w-full rounded-sm object-cover plate-keyline transition-opacity", isActive && "opacity-60")}
                    />
                  ) : (
                    <div className={cn("grid aspect-square w-full place-items-center rounded-sm bg-surface-2 plate-keyline transition-opacity", isActive && "opacity-60")}>
                      <span className="caption">RAW</span>
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute inset-0 grid place-items-center rounded-sm bg-background/40">
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    </div>
                  )}
                  {isDone && (
                    <div className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-primary">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  {isFailed && (
                    <div className="absolute inset-0 grid place-items-center rounded-sm bg-destructive/20">
                      <X className="h-5 w-5 text-destructive" />
                    </div>
                  )}
                  {!uploadProgress && (
                    <button
                      onClick={() => removeFile(file.id, type)}
                      aria-label={`Remove ${type} image`}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {files.length > 8 && (
              <div className="grid aspect-square w-full place-items-center rounded-sm bg-muted font-mono text-sm text-muted-foreground">
                +{files.length - 8}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-full bg-background px-4 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-6xl">
        {/* ════ HEADER — plan-first: microlabel · back + inline name + live pills ══ */}
        <span className="aura-microlabel flex items-center gap-1.5 text-accent">
          <Sparkle size={11} /> Train a style · new look
        </span>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={handleLeave} aria-label="Back to styles">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="group relative min-w-0 flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
              className="w-full rounded-md bg-surface-2/40 py-1 pl-2.5 pr-10 text-2xl font-bold tracking-tight outline-none ring-1 ring-inset ring-border/60 transition-colors placeholder:text-muted-foreground/40 hover:bg-surface-2/70 hover:ring-border focus:bg-surface-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Untitled look"
              aria-label="Style name"
            />
            <Pencil className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50 transition-colors group-hover:text-foreground/70" />
          </div>
          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
            <Pill><Upload className="h-3 w-3" /> {beforeCount} before</Pill>
            <Pill><Upload className="h-3 w-3" /> {afterCount} after</Pill>
            <Pill>{typeLabel}</Pill>
            <Pill accent={canCreate}>
              <Sparkle size={11} /> {canCreate ? "Ready to train" : "Add 5+ pairs"}
            </Pill>
          </div>
        </div>

        {/* ════ WORK — single calm column of panels ═══════════════════════════ */}
        <div className={cn("mt-6 space-y-4", isCreating && "pointer-events-none select-none opacity-60")}>
          {/* ── Look details — model type ── */}
          <div className="glass-card rounded-[--radius] p-5">
            <div className="caption mb-1.5 flex items-center gap-1.5 text-accent">
              <Sparkle size={11} /> What is this look for?
            </div>
            <p className="mb-3.5 text-xs text-muted-foreground">
              Pick up to 5 subjects — seeds where this style is suggested. Optional.
            </p>
            <div className="flex flex-wrap gap-2">
              {galleryTypes.map((t) => {
                const Icon = t.icon;
                const on = selectedModelTypes.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleModelType(t.value)}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                      on
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface-2 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", on ? "text-accent" : "text-muted-foreground")} strokeWidth={1.75} />
                    {t.label}
                    {on && <Check className="h-3.5 w-3.5 text-accent" />}
                  </button>
                );
              })}
            </div>
            {selectedModelTypes.length > 0 && (
              <p className="caption mt-3">{selectedModelTypes.length}/5 selected</p>
            )}
          </div>

          {/* ── Training pairs ── */}
          <div className="glass-card rounded-[--radius] p-5">
            <div className="mb-3.5">
              <div className="caption flex items-center gap-1.5"><Upload className="h-3 w-3" /> Training pairs · minimum 5</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload matching before/after images — the AI learns your edit from each pair.
              </p>
            </div>

            <UploadSourceSelector value={uploadSource} onChange={setUploadSource} />

            {uploadSource === "local" ? (
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {renderLocalZone("before")}
                {renderLocalZone("after")}
              </div>
            ) : (
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <span className="caption flex items-center gap-1.5"><CloudIcon className="h-3 w-3" /> Before · originals</span>
                  <GoogleDriveInput
                    folderInfo={beforeFolderInfo}
                    onUpdate={(info, links) => { setBeforeFolderInfo(info); setBeforeDriveLinks(links); }}
                  />
                </div>
                <div className="space-y-2.5">
                  <span className="caption flex items-center gap-1.5"><CloudIcon className="h-3 w-3" /> After · edited</span>
                  <GoogleDriveInput
                    folderInfo={afterFolderInfo}
                    onUpdate={(info, links) => { setAfterFolderInfo(info); setAfterDriveLinks(links); }}
                  />
                </div>
              </div>
            )}

            {localCountMismatch && (
              <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-[--radius] border border-rating/30 bg-rating/[0.08] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rating" />
                <p className="text-xs leading-snug text-muted-foreground">
                  <span className="font-medium text-rating">Counts don't match — {beforeFiles.length} before vs {afterFiles.length} after.</span>{" "}
                  Training works best with an equal number of matched pairs.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ════ FOOTER — training plan + glow CTA ═════════════════════════════ */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
          <div className="glass-card min-w-0 flex-1 rounded-[--radius] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkle size={12} className="text-accent" /> Training plan
              </span>
              <span className="font-mono text-sm font-semibold folio">{beforeCount} · {afterCount}</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {canCreate
                ? `${typeLabel} look · ${beforeCount} before + ${afterCount} after · typically 30–60 min to train.`
                : "Add a name and at least 5 before and 5 after images to start."}
            </p>
          </div>

          <div className="sm:flex sm:w-[300px] sm:shrink-0 sm:flex-col sm:justify-center">
            <Button
              variant="glow"
              size="lg"
              disabled={!canCreate || isCreating}
              className="w-full gap-2"
              onClick={() => setShowConfirmDialog(true)}
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {isCreating ? "Uploading…" : "Create & start training"}
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
              {canCreate ? "Trains a real AI model on your pairs" : "Finish the steps above to continue"}
            </p>
          </div>
        </div>
      </div>

      {/* ════ CONFIRMATION DIALOG ═══════════════════════════════════════════ */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-2 flex items-center gap-3">
              <Orb className="h-9 w-9 shrink-0" />
              <AlertDialogTitle>Ready to train your style?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              This uploads your images and starts training the AI model. Training typically takes 30–60 minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirmDialog(false); handleCreate(); }}>
              <Sparkle size={14} className="mr-2 text-accent-foreground" />
              Confirm &amp; train
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════ LEAVE GUARD ═══════════════════════════════════════════════════ */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isCreating ? "Leave while training is starting?" : "Leave without training?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isCreating
                ? "Your images are still uploading. Leaving now may interrupt the upload and training won't start."
                : "Your style details and staged images haven't been saved yet. Leaving will discard them."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/dashboard/styles")}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
