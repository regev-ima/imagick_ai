import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { isAcceptedImageFile, IMAGE_ACCEPT, isRawFile, getFileExtension } from "@/lib/fileTypes";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Sparkles, Check, Upload, Images, ChevronLeft, Loader2,
  CloudIcon, AlertTriangle, Plus, FileImage, Eye, Palette, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useImageProcessing } from "@/hooks/useImageProcessing";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UploadSourceSelector, type UploadSource } from "./UploadSourceSelector";
import { GoogleDriveInput, type DriveFolderInfo } from "./GoogleDriveInput";
import { useSubscription } from "@/hooks/useSubscription";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { SHOWCASE_GALLERY_ID } from "@/lib/constants";

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  isRaw: boolean;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error" | "retrying";
  bytesUploaded?: number;
  totalBytes?: number;
}

interface AddImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  galleryId: string;
  galleryName: string;
  onDriveConfirm?: (styleIds: string[], driveLink: string, folderInfo: DriveFolderInfo) => void;
  onUploadComplete?: (count: number) => void;
}

type Step = "styles" | "upload";

export function AddImagesModal({
  isOpen,
  onClose,
  galleryId,
  galleryName,
  onDriveConfirm,
  onUploadComplete,
}: AddImagesModalProps) {
  const [step, setStep] = useState<Step>("styles");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSource, setUploadSource] = useState<UploadSource>("local");
  const [driveLinks, setDriveLinks] = useState<string[]>([]);
  const [driveFolderInfo, setDriveFolderInfo] = useState<DriveFolderInfo | null>(null);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { uploadImages, uploadProgress, isUploading: hookIsUploading } = useImageUpload();
  const { processImages } = useImageProcessing();
  const { editsRemaining, availableEdits, editsReserved, isUnlimited, isFreePlan, canEdit, isSuspended, isExpired } = useSubscription();

  const imageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit calculations
  const imageCount = uploadSource === "drive" ? (driveFolderInfo?.totalImageCount || 0) : uploadedFiles.length;
  const stylesCount = selectedStyles.length;
  const editsNeeded = imageCount * stylesCount;
  const hasInsufficientEdits = !isUnlimited && editsNeeded > availableEdits;
  const maxImages = isUnlimited ? Infinity : (stylesCount > 0 ? Math.floor(availableEdits / stylesCount) : 0);

  const isProcessing = isUploadingLocal || hookIsUploading;

  // Fetch styles
  const { data: styles = [] } = useQuery({
    queryKey: ["styles-for-add-images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("styles")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  // Fetch showcase covers
  const { data: showcaseCovers = {} } = useQuery({
    queryKey: ["showcase-covers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("image_edits")
        .select("style_id, edited_url")
        .eq("gallery_id", SHOWCASE_GALLERY_ID);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (row.style_id && !map[row.style_id]) {
          map[row.style_id] = row.edited_url;
        }
      }
      return map;
    },
    enabled: isOpen,
  });

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("styles");
      setSelectedStyles([]);
      setUploadedFiles([]);
      setUploadSource("local");
      setDriveLinks([]);
      setDriveFolderInfo(null);
      setIsUploadingLocal(false);
    }
  }, [isOpen]);

  // Cleanup previews
  useEffect(() => {
    return () => {
      uploadedFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    };
  }, []);

  const toggleStyle = (styleId: string) => {
    setSelectedStyles(prev => {
      if (prev.includes(styleId)) return prev.filter(id => id !== styleId);
      if (prev.length >= 3) {
        toast.error("Maximum 3 styles allowed");
        return prev;
      }
      return [...prev, styleId];
    });
  };

  const addFiles = useCallback((files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => {
      const raw = isRawFile(file);
      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: raw ? "" : URL.createObjectURL(file),
        isRaw: raw,
        progress: 0,
        status: "pending" as const,
      };
    });

    setUploadedFiles(prev => {
      const combined = [...prev, ...newFiles];
      if (!isUnlimited && stylesCount > 0 && combined.length > maxImages) {
        const allowed = maxImages - prev.length;
        if (allowed <= 0) {
          newFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
          toast.error(`Edit limit reached. You can upload up to ${maxImages} images with ${stylesCount} style(s).`);
          return prev;
        }
        const kept = newFiles.slice(0, allowed);
        newFiles.slice(allowed).forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
        toast.warning(`Only ${allowed} of ${files.length} images added due to edit limit.`);
        return [...prev, ...kept];
      }
      return combined;
    });
  }, [isUnlimited, stylesCount, maxImages]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(isAcceptedImageFile);
    if (files.length === 0) {
      toast.error("Please drop image files only");
      return;
    }
    addFiles(files);
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(isAcceptedImageFile);
      if (files.length > 0) addFiles(files);
    }
  }, [addFiles]);

  const removeFile = (id: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  const handleContinueToUpload = () => {
    if (selectedStyles.length === 0) {
      toast.error("Please select at least one style");
      return;
    }
    setStep("upload");
  };

  const handleConfirm = async () => {
    if (!user) return;

    // Google Drive upload
    if (uploadSource === "drive") {
      if (!driveFolderInfo || driveLinks.length === 0) {
        toast.error("Please add at least one Google Drive folder");
        return;
      }
      if (hasInsufficientEdits) {
        toast.error("Not enough edits remaining for this upload");
        return;
      }
      if (onDriveConfirm) {
        onDriveConfirm(selectedStyles, driveLinks[0], driveFolderInfo);
      }
      return;
    }

    // Local file upload
    if (uploadedFiles.length === 0) {
      toast.error("Please add at least one image");
      return;
    }
    if (hasInsufficientEdits) {
      toast.error("Not enough credits for this upload");
      return;
    }

    setIsUploadingLocal(true);

    try {
      const files = uploadedFiles.map(f => f.file);

      const imageIds = await uploadImages(galleryId, user.id, files, {
        onFileStart: (index) => {
          setUploadedFiles(prev => prev.map((f, i) =>
            i === index ? { ...f, status: "uploading" as const, progress: 0 } : f
          ));
          const fileId = uploadedFiles[index]?.id;
          if (fileId) {
            setTimeout(() => {
              const element = imageRefs.current.get(fileId);
              if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }, 100);
          }
        },
        onFileProgress: (index, _filename, fileProgress) => {
          setUploadedFiles(prev => prev.map((f, i) =>
            i === index ? {
              ...f,
              progress: fileProgress.percentage,
              bytesUploaded: fileProgress.bytesUploaded,
              totalBytes: fileProgress.totalBytes,
              status: fileProgress.status as "uploading" | "retrying",
            } : f
          ));
        },
        onFileComplete: (index) => {
          setUploadedFiles(prev => prev.map((f, i) =>
            i === index ? { ...f, status: "complete" as const, progress: 100 } : f
          ));
        },
        onFileError: (index) => {
          setUploadedFiles(prev => prev.map((f, i) =>
            i === index ? { ...f, status: "error" as const } : f
          ));
        },
        onFileRetry: (index, filename, retryCount) => {
          setUploadedFiles(prev => prev.map((f, i) =>
            i === index ? { ...f, status: "retrying" as const, progress: 0 } : f
          ));
          toast.info(`Retrying ${filename}... (attempt ${retryCount + 1}/6)`);
        },
      });

      if (imageIds.length > 0) {
        // Update gallery total_images and status
        const { data: countData } = await supabase
          .from("gallery_images")
          .select("id", { count: "exact" })
          .eq("gallery_id", galleryId)
          .neq("status", "deleted");

        await supabase
          .from("galleries")
          .update({
            total_images: countData?.length || 0,
            status: selectedStyles.length > 0 ? "processing" : "ready",
            selected_style_ids: selectedStyles,
          })
          .eq("id", galleryId);

        // Mark images as processing and start AI
        if (selectedStyles.length > 0) {
          await supabase
            .from("gallery_images")
            .update({ status: "processing" })
            .in("id", imageIds)
            .eq("status", "uploading");

          processImages(galleryId, imageIds, selectedStyles);
          toast.success(`${imageIds.length} images uploaded! AI processing started...`);
        } else {
          await supabase
            .from("gallery_images")
            .update({ status: "ready" })
            .in("id", imageIds);
          toast.success(`${imageIds.length} images uploaded successfully!`);
        }
      }

      onUploadComplete?.(uploadedFiles.filter(f => f.status === "complete").length || uploadedFiles.length);
      onClose();
    } catch (error: any) {
      console.error("Error uploading images:", error);
      toast.error(error.message || "Failed to upload images");
    } finally {
      setIsUploadingLocal(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={!isProcessing ? onClose : undefined}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-3xl max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="glass-card border-border/50 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Images className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Add Images</h2>
                <p className="text-sm text-muted-foreground">{galleryName}</p>
              </div>
            </div>
            {!isProcessing && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Step Indicator */}
          <div className="px-6 pt-4">
            <div className="flex items-center justify-center gap-0">
              {/* Step 1 */}
              <div className="flex flex-col items-center">
                <motion.div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-all relative z-10",
                    step === "styles" && "bg-primary shadow-[0_0_20px_rgba(236,72,153,0.4)]",
                    step === "upload" && "bg-primary/20"
                  )}
                  animate={step === "styles" ? { boxShadow: [
                    "0 0 12px rgba(236,72,153,0.3)",
                    "0 0 24px rgba(236,72,153,0.5)",
                    "0 0 12px rgba(236,72,153,0.3)",
                  ] } : {}}
                  transition={step === "styles" ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                >
                  {step === "upload" ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-primary-foreground" />
                  )}
                </motion.div>
                <span className={cn("text-xs font-semibold mt-1.5", step === "styles" ? "text-foreground" : "text-primary")}>
                  Styles
                </span>
              </div>
              {/* Connector */}
              <div className="relative w-16 sm:w-24 h-0.5 mt-[-10px] mx-2 bg-muted overflow-hidden rounded-full">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-secondary rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: step === "upload" ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </div>
              {/* Step 2 */}
              <div className="flex flex-col items-center">
                <motion.div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-all relative z-10",
                    step === "upload" && "bg-primary shadow-[0_0_20px_rgba(236,72,153,0.4)]",
                    step === "styles" && "bg-muted"
                  )}
                  animate={step === "upload" ? { boxShadow: [
                    "0 0 12px rgba(236,72,153,0.3)",
                    "0 0 24px rgba(236,72,153,0.5)",
                    "0 0 12px rgba(236,72,153,0.3)",
                  ] } : {}}
                  transition={step === "upload" ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                >
                  <Upload className={cn("w-4 h-4", step === "upload" ? "text-primary-foreground" : "text-muted-foreground")} />
                </motion.div>
                <span className={cn("text-xs font-semibold mt-1.5", step === "upload" ? "text-foreground" : "text-muted-foreground")}>
                  Upload
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {step === "styles" ? (
                <motion.div
                  key="styles"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold mb-1">Select AI Styles</h3>
                      <p className="text-sm text-muted-foreground">Choose up to 3 styles to apply</p>
                    </div>
                    <div className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-semibold",
                      selectedStyles.length > 0
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {selectedStyles.length}/3
                    </div>
                  </div>

                  {styles.length === 0 ? (
                    <div className="text-center py-12">
                      <Palette className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No styles available yet.</p>
                      <p className="text-sm text-muted-foreground mt-1">Create your first AI style to get started.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-2">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {styles.map(style => {
                          const coverUrl = showcaseCovers[style.id];
                          const isSelected = selectedStyles.includes(style.id);
                          return (
                            <motion.div
                              key={style.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => toggleStyle(style.id)}
                              className={cn(
                                "relative rounded-xl overflow-hidden cursor-pointer transition-all h-36 flex flex-col justify-end group",
                                isSelected
                                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/20"
                                  : "ring-1 ring-border/50 hover:ring-primary/40"
                              )}
                            >
                              {coverUrl ? (
                                <img
                                  src={getThumbnailUrl(coverUrl)}
                                  alt={style.name}
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                              {/* Eye icon */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`/dashboard/styles/${style.id}`, "_blank");
                                }}
                                className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background/80"
                              >
                                <Eye className="w-4 h-4 text-foreground" />
                              </button>

                              <div className="relative z-10 p-3">
                                <div className="flex items-center gap-2">
                                  {style.is_preset ? (
                                    <Palette className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Sparkles className="w-4 h-4 text-primary" />
                                  )}
                                  <span className="font-semibold text-sm text-white">{style.name}</span>
                                </div>
                              </div>

                              {isSelected && (
                                <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                  <Check className="w-4 h-4 text-primary-foreground" />
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {/* Selected Styles Summary */}
                  <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">Selected styles:</span>
                    {selectedStyles.map(id => {
                      const style = styles.find(s => s.id === id);
                      return style ? (
                        <span key={id} className="px-2 py-1 rounded-full text-xs bg-primary/20 text-primary">
                          {style.name}
                        </span>
                      ) : null;
                    })}
                  </div>

                  {/* Subscription warnings */}
                  {!canEdit && (isSuspended || isExpired) && (
                    <div className="p-3 rounded-lg border text-sm bg-destructive/10 border-destructive/30">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Your subscription is {isSuspended ? "suspended" : "expired"}. Please update your plan.</span>
                      </div>
                    </div>
                  )}

                  {isFreePlan && availableEdits === 0 && (
                    <div className="p-3 rounded-lg border text-sm bg-destructive/10 border-destructive/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>You've used all 3,000 free edits.</span>
                        </div>
                        <Button size="sm" variant="default" className="ml-3 flex-shrink-0" onClick={() => navigate("/dashboard/billing")}>
                          Upgrade Plan
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Upload Source Selector */}
                  <UploadSourceSelector
                    value={uploadSource}
                    onChange={(source) => {
                      setUploadSource(source);
                      if (source === "local") {
                        setDriveFolderInfo(null);
                        setDriveLinks([]);
                      } else {
                        uploadedFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
                        setUploadedFiles([]);
                      }
                    }}
                    disabled={isProcessing}
                  />

                  {/* Google Drive Input */}
                  {uploadSource === "drive" && (
                    <GoogleDriveInput
                      folderInfo={driveFolderInfo}
                      onUpdate={(info, links) => {
                        setDriveFolderInfo(info);
                        setDriveLinks(links);
                      }}
                      disabled={isProcessing}
                    />
                  )}

                  {/* Local Upload Zone */}
                  {uploadSource === "local" && (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={cn(
                        "relative border-2 border-dashed rounded-xl transition-all min-h-[200px]",
                        isDragging
                          ? "border-primary bg-primary/10 scale-[1.01]"
                          : "border-primary/30 hover:border-primary/50"
                      )}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={IMAGE_ACCEPT}
                        onChange={handleFileSelect}
                        className="hidden"
                        tabIndex={-1}
                      />

                      {uploadedFiles.length === 0 ? (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="flex flex-col items-center gap-4 p-10 cursor-pointer"
                        >
                          <div className="relative">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                              <CloudIcon className="w-10 h-10 text-primary/70" />
                            </div>
                            <motion.div
                              className="absolute inset-0 rounded-full border-2 border-primary/20"
                              animate={isDragging ? { scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] } : {}}
                              transition={{ duration: 1.2, repeat: Infinity }}
                            />
                          </div>
                          <div className="text-center space-y-1.5">
                            <p className="font-semibold text-base">
                              {isDragging ? "Drop your photos here" : "Drop photos here or click to upload"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              JPG, PNG, RAW (CR2, ARW, NEF, DNG…) • Up to 50MB per file
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-3">
                            <p className="font-medium text-sm">{uploadedFiles.length} photos selected</p>
                            <div className="flex items-center gap-2">
                              <label>
                                <Button variant="outline" size="sm" className="gap-1 text-xs" asChild>
                                  <span>
                                    <Plus className="w-3 h-3" />
                                    Add More
                                  </span>
                                </Button>
                                <input
                                  type="file"
                                  multiple
                                  accept={IMAGE_ACCEPT}
                                  onChange={handleFileSelect}
                                  className="hidden"
                                />
                              </label>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  uploadedFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
                                  setUploadedFiles([]);
                                }}
                                disabled={isProcessing}
                              >
                                Clear All
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-[280px] overflow-y-auto">
                            {uploadedFiles.map(file => (
                              <div
                                key={file.id}
                                className="relative aspect-square group rounded-lg overflow-hidden"
                                ref={(el) => {
                                  if (el) imageRefs.current.set(file.id, el);
                                  else imageRefs.current.delete(file.id);
                                }}
                              >
                                {file.isRaw ? (
                                  <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-1">
                                    <FileImage className="w-6 h-6 text-muted-foreground" />
                                    <span className="text-xs font-bold text-foreground">{getFileExtension(file.file.name)}</span>
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[90%] px-1">{file.file.name}</span>
                                  </div>
                                ) : (
                                  <img src={file.preview} alt="" className="w-full h-full object-cover" />
                                )}

                                {/* Hover overlay */}
                                {file.status === "pending" && !isProcessing && (
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                )}

                                {/* Uploading with progress */}
                                {file.status === "uploading" && (
                                  <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center p-1">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary mb-1" />
                                    <span className="text-xs font-medium text-primary">{file.progress}%</span>
                                    {file.bytesUploaded !== undefined && file.totalBytes !== undefined && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {(file.bytesUploaded / (1024 * 1024)).toFixed(1)}MB
                                      </span>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted overflow-hidden">
                                      <motion.div
                                        className="h-full bg-primary"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${file.progress}%` }}
                                        transition={{ duration: 0.2 }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Retrying */}
                                {file.status === "retrying" && (
                                  <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                                    <RefreshCw className="w-5 h-5 animate-spin text-accent-foreground mb-1" />
                                    <span className="text-xs font-medium text-accent-foreground">Retrying...</span>
                                  </div>
                                )}

                                {file.status === "complete" && (
                                  <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                    <Check className="w-3 h-3 text-primary-foreground" />
                                  </div>
                                )}

                                {file.status === "error" && (
                                  <div className="absolute inset-0 bg-destructive/60 flex flex-col items-center justify-center">
                                    <X className="w-6 h-6 text-destructive-foreground" />
                                    <span className="text-xs text-destructive-foreground mt-1">Failed</span>
                                  </div>
                                )}

                                {file.status === "pending" && !isProcessing && (
                                  <button
                                    onClick={() => removeFile(file.id)}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload Progress Bar */}
                  {uploadSource === "local" && (
                    <AnimatePresence>
                      {isProcessing && uploadProgress && (() => {
                        const totalBytes = uploadedFiles.reduce((acc, f) => f.file.size + acc, 0);
                        const uploadedBytes = Array.from(uploadProgress.fileProgress.values())
                          .reduce((acc, p) => acc + p.bytesUploaded, 0);
                        const percentage = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
                        const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            className="space-y-3 p-4 bg-muted/50 rounded-xl border border-border/50 overflow-hidden"
                          >
                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                              <motion.div
                                className="h-full bg-primary rounded-full animate-neon-pulse"
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Uploading: <span className="text-foreground font-medium">{uploadProgress.currentFile}</span>
                              </span>
                              <span className="font-medium text-primary">
                                {percentage}% — {formatMB(uploadedBytes)} / {formatMB(totalBytes)} MB
                              </span>
                            </div>
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>
                  )}

                  {/* Edit Cost Summary */}
                  {imageCount > 0 && stylesCount > 0 && (
                    <div className={cn(
                      "p-3 rounded-lg border text-sm",
                      hasInsufficientEdits && !isUnlimited
                        ? "bg-destructive/10 border-destructive/30"
                        : "bg-muted/50 border-border/50"
                    )}>
                      <div className="flex items-center justify-between">
                        <span>
                          {imageCount} images × {stylesCount} style{stylesCount > 1 ? "s" : ""} = <strong>{editsNeeded} edits</strong>
                        </span>
                        {isUnlimited ? (
                          <span className="flex items-center gap-1.5 text-primary">
                            <Check className="w-4 h-4" />
                            Included in your plan
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            You have <strong className={hasInsufficientEdits ? "text-destructive" : "text-primary"}>{availableEdits.toLocaleString()}</strong> available
                            {editsReserved > 0 && <span className="text-xs ml-1">({editsReserved.toLocaleString()} reserved)</span>}
                          </span>
                        )}
                      </div>
                      {!isUnlimited && hasInsufficientEdits && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-destructive/20">
                          <div className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span>Not enough edits. Max {maxImages} images with {stylesCount} style{stylesCount > 1 ? "s" : ""}.</span>
                          </div>
                          <Button size="sm" variant="default" className="ml-3 flex-shrink-0" onClick={() => navigate("/dashboard/billing")}>
                            Upgrade Plan
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border/50 flex items-center justify-between">
            <div>
              {step === "upload" && !isProcessing && (
                <Button variant="ghost" onClick={() => setStep("styles")} className="gap-2">
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!isProcessing && (
                <Button variant="outline" onClick={onClose}>Cancel</Button>
              )}
              {step === "styles" ? (
                <Button
                  variant="glow"
                  disabled={selectedStyles.length === 0}
                  onClick={handleContinueToUpload}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  variant="glow"
                  disabled={
                    isProcessing ||
                    !canEdit ||
                    hasInsufficientEdits ||
                    (uploadSource === "local" && uploadedFiles.length === 0) ||
                    (uploadSource === "drive" && !driveFolderInfo)
                  }
                  onClick={handleConfirm}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Uploading...
                    </>
                  ) : uploadSource === "drive" ? (
                    <>
                      <CloudIcon className="w-4 h-4 mr-2" />
                      Import & Process
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Process
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
