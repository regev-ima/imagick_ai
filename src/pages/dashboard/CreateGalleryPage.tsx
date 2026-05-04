import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { isAcceptedImageFile, IMAGE_ACCEPT, isRawFile, getFileExtension } from "@/lib/fileTypes";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  X,
  Sparkles,
  Palette,
  FolderOpen,
  Loader2,
  RefreshCw,
  CloudIcon,
  Plus,
  Tag,
  AlertTriangle,
  FileImage,
  Eye,
  Image as ImageIcon,
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
  Globe,
  type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useImageProcessing } from "@/hooks/useImageProcessing";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UploadSourceSelector, type UploadSource } from "@/components/gallery/UploadSourceSelector";
import { GoogleDriveInput, type DriveFolderInfo } from "@/components/gallery/GoogleDriveInput";
import { useSubscription } from "@/hooks/useSubscription";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { SHOWCASE_GALLERY_ID } from "@/lib/constants";
import { getCullingLabels, supportedLanguages, type LanguageCode } from "@/lib/cullingLabels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const suggestedCategories = [
  "Portrait", "Landscape", "Wedding", "Event", "Group Photo", "Close-up",
  "Wide Shot", "Indoor", "Outdoor", "Night", "Golden Hour", "Black & White"
];

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

// Floating particles config (generated once)
const PARTICLES = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  size: Math.random() > 0.5 ? "w-1 h-1" : "w-2 h-2",
  color: Math.random() > 0.5 ? "bg-primary/20" : "bg-secondary/20",
  top: `${Math.random() * 90 + 5}%`,
  left: `${Math.random() * 90 + 5}%`,
  duration: 4 + Math.random() * 4,
  yOffset: 20 + Math.random() * 20,
  xOffset: 10 + Math.random() * 10,
  delay: Math.random() * 3,
}));

// Gradient orbs config
const ORBS = [
  { color: "bg-primary", size: "w-48 h-48 lg:w-72 lg:h-72", top: "10%", left: "15%", duration: 18 },
  { color: "bg-secondary", size: "w-56 h-56 lg:w-64 lg:h-64", top: "60%", left: "70%", duration: 15 },
  { color: "bg-accent", size: "w-48 h-48", top: "40%", left: "45%", duration: 20 },
];

// Sparkle burst component for step completion
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
          className="absolute w-1 h-1 rounded-full bg-primary"
          style={{ top: "50%", left: "50%" }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: s.x, y: s.y, opacity: 0, scale: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

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

export default function CreateGalleryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { processImages } = useImageProcessing();
  const { uploadImages, uploadProgress, isUploading: hookIsUploading, cancelUploads } = useImageUpload();
  const { editsRemaining, availableEdits, editsReserved, isUnlimited, canEdit, isSuspended, isExpired, isFreePlan } = useSubscription();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  // Form state
  const [galleryName, setGalleryName] = useState("");
  const [galleryType, setGalleryType] = useState("");
  const [description, setDescription] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customLabels, setCustomLabels] = useState<string[]>([]);
  const [aiCulling, setAiCulling] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const imageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload source state
  const [uploadSource, setUploadSource] = useState<UploadSource>("local");
  const [driveLinks, setDriveLinks] = useState<string[]>([]);
  const [driveFolderInfo, setDriveFolderInfo] = useState<DriveFolderInfo | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Language preference for culling labels
  const [cullingLanguage, setCullingLanguage] = useState<LanguageCode>("en");
  const [languageLoaded, setLanguageLoaded] = useState(false);
  const [styleTab, setStyleTab] = useState<"public" | "yours">("public");

  // Edit calculations
  const imageCount = uploadSource === "drive" ? (driveFolderInfo?.totalImageCount || 0) : uploadedFiles.length;
  const stylesCount = selectedStyles.length;
  const editsNeeded = imageCount * stylesCount;
  const hasInsufficientEdits = !isUnlimited && editsNeeded > availableEdits;
  const maxImages = isUnlimited ? Infinity : (stylesCount > 0 ? Math.floor(availableEdits / stylesCount) : 0);

   // Pre-select style from URL parameter
   const preSelectedStyleId = searchParams.get("styleId");
   
   useEffect(() => {
     if (preSelectedStyleId && !selectedStyles.includes(preSelectedStyleId)) {
       setSelectedStyles([preSelectedStyleId]);
     }
   }, [preSelectedStyleId]);

  // Fetch user's preferred language
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_subscriptions")
      .select("preferred_language")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.preferred_language) {
          setCullingLanguage(data.preferred_language as LanguageCode);
        }
        setLanguageLoaded(true);
      });
  }, [user]);

   // Reset selections when gallery type or language changes (don't auto-select)
  useEffect(() => {
    if (!galleryType || !languageLoaded) return;
    setSelectedCategories([]);
    setCustomLabels([]);
  }, [galleryType, cullingLanguage, languageLoaded]);

  // Save language preference when changed
  const handleLanguageChange = async (lang: LanguageCode) => {
    setCullingLanguage(lang);
    if (user) {
      await supabase
        .from("user_subscriptions")
        .update({ preferred_language: lang })
        .eq("user_id", user.id);
    }
  };

  // Fetch styles from database
  const { data: styles = [] } = useQuery({
    queryKey: ["styles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("styles")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch showcase cover images for styles
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
  });

  const steps = [
    { number: 1, title: "Details", subtitle: "Name & gallery type", icon: FolderOpen },
    { number: 2, title: "Styles", subtitle: "Choose AI styles", icon: Palette },
    { number: 3, title: "Culling", subtitle: "Smart AI culling", icon: Sparkles },
    { number: 4, title: "Upload", subtitle: "Add your photos", icon: Upload },
  ];

  const toggleStyle = (styleId: string) => {
    setSelectedStyles(prev => {
      if (prev.includes(styleId)) {
        return prev.filter(id => id !== styleId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, styleId];
    });
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      }
      if (prev.length >= 20) return prev;
      return [...prev, category];
    });
  };

  const addCustomCategory = () => {
    const trimmed = customCategory.trim();
    const predefined = getCullingLabels(galleryType || "wedding", cullingLanguage);
    if (trimmed && !selectedCategories.includes(trimmed) && !predefined.includes(trimmed) && !customLabels.includes(trimmed) && selectedCategories.length < 20) {
      setCustomLabels(prev => [...prev, trimmed]);
      setSelectedCategories(prev => [...prev, trimmed]);
      setCustomCategory("");
    } else if (trimmed && predefined.includes(trimmed) && !selectedCategories.includes(trimmed) && selectedCategories.length < 20) {
      setSelectedCategories(prev => [...prev, trimmed]);
      setCustomCategory("");
    }
  };

  const handleCategoryKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomCategory();
    }
  };

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
    addFiles(files);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  };

  const addFiles = (files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => {
      const raw = isRawFile(file);
      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: raw ? "" : URL.createObjectURL(file),
        isRaw: raw,
        progress: 0,
        status: "pending"
      };
    });
    
    setUploadedFiles(prev => {
      const combined = [...prev, ...newFiles];
      if (!isUnlimited && stylesCount > 0 && combined.length > maxImages) {
        const allowed = maxImages - prev.length;
        if (allowed <= 0) {
          newFiles.forEach(f => URL.revokeObjectURL(f.preview));
          toast.error(`Edit limit reached. You can upload up to ${maxImages} images with ${stylesCount} style(s).`);
          return prev;
        }
        const kept = newFiles.slice(0, allowed);
        newFiles.slice(allowed).forEach(f => URL.revokeObjectURL(f.preview));
        toast.warning(`Only ${allowed} of ${files.length} images added due to edit limit.`);
        return [...prev, ...kept];
      }
      return combined;
    });
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const createGalleryAndUpload = async () => {
    if (!user) {
      toast.error("Please sign in to create a gallery");
      return;
    }

    // Handle Google Drive upload
    if (uploadSource === "drive") {
      if (!driveFolderInfo || driveLinks.length === 0) {
        toast.error("Please add at least one Google Drive folder");
        return;
      }

      setIsTransferring(true);

      try {
        // 1. Create the gallery
        const { data: gallery, error: galleryError } = await supabase
          .from("galleries")
          .insert({
            user_id: user.id,
            name: galleryName,
            gallery_type: galleryType,
            description: description || null,
            categories: selectedCategories,
            ai_culling_enabled: aiCulling,
            total_images: driveFolderInfo.totalImageCount,
            status: "transferring"
          })
          .select()
          .single();

        if (galleryError) throw galleryError;

        // 2. Update gallery with selected styles and save drive links for future cloning
        const updatePayload: Record<string, any> = {};
        if (selectedStyles.length > 0) updatePayload.selected_style_ids = selectedStyles;
        if (driveLinks.length > 0) updatePayload.source_drive_links = driveLinks;
        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from("galleries")
            .update(updatePayload)
            .eq("id", gallery.id);
        }

        // 3. Start the transfer from Google Drive (supports multiple folders)
        const response = await supabase.functions.invoke("gd-transfer", {
          body: {
            driveLinks,
            galleryId: gallery.id,
            styleIds: selectedStyles,
            metadataOnly: false,
            totalImageCount: driveFolderInfo.totalImageCount,
            totalSizeMB: driveFolderInfo.totalSizeMB,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || "Failed to start transfer");
        }

        // Handle storage limit error from response data
        if (response.data?.error === "storage_limit_exceeded") {
          throw new Error(response.data.message || "Storage limit exceeded. Please upgrade your plan or purchase additional storage.");
        }

        toast.success("Transfer started! Your images are being imported from Google Drive...");
        navigate(`/dashboard/galleries/${gallery.id}`);

      } catch (error: any) {
        console.error("Error creating gallery:", error);
        toast.error(error.message || "Failed to create gallery");
        setIsTransferring(false);
      }
      return;
    }

    // Handle local file upload (existing logic)
    setIsUploading(true);

    try {
      // 1. Create the gallery
      const { data: gallery, error: galleryError } = await supabase
        .from("galleries")
        .insert({
          user_id: user.id,
          name: galleryName,
          gallery_type: galleryType,
          description: description || null,
          categories: selectedCategories,
          ai_culling_enabled: aiCulling,
          total_images: uploadedFiles.length,
          status: "uploading"
        })
        .select()
        .single();

      if (galleryError) throw galleryError;

      // 2. Update gallery with selected styles
      if (selectedStyles.length > 0) {
        await supabase
          .from("galleries")
          .update({ selected_style_ids: selectedStyles })
          .eq("id", gallery.id);
      }

      // 3. Upload images directly to B2 using the hook with callbacks
      const files = uploadedFiles.map(f => f.file);

      const imageIds = await uploadImages(gallery.id, user.id, files, {
        onFileStart: (index) => {
          setUploadedFiles(prev => prev.map((f, i) => 
            i === index ? { ...f, status: "uploading" as const, progress: 0 } : f
          ));
          // Auto-scroll to the currently uploading image
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
        onFileProgress: (index, filename, fileProgress) => {
          setUploadedFiles(prev => prev.map((f, i) => 
            i === index ? { 
              ...f, 
              progress: fileProgress.percentage,
              bytesUploaded: fileProgress.bytesUploaded,
              totalBytes: fileProgress.totalBytes,
              status: fileProgress.status as "uploading" | "retrying"
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
          toast.info(`Retrying ${filename}... (attempt ${retryCount + 1}/4)`);
        }
      });

      // 4. Get the first image URL for hero
      let heroImageUrl: string | null = null;
      if (imageIds.length > 0) {
        const { data: firstImage } = await supabase
          .from("gallery_images")
          .select("original_url")
          .eq("id", imageIds[0])
          .single();
        
        if (firstImage) {
          heroImageUrl = firstImage.original_url;
          
          // Mark first image as hero
          await supabase
            .from("gallery_images")
            .update({ is_hero: true })
            .eq("id", imageIds[0]);
        }
      }

      // 5. Update gallery with hero image and status
      await supabase
        .from("galleries")
        .update({
          hero_image_url: heroImageUrl,
          status: selectedStyles.length > 0 ? "processing" : "ready",
          processed_images: 0,
          total_images: imageIds.length
        })
        .eq("id", gallery.id);

      // 6. Send "upload complete" email
      if (imageIds.length > 0) {
        supabase.functions.invoke("send-email", {
          body: {
            type: "gallery_upload_complete",
            galleryName,
            imageCount: imageIds.length,
            galleryId: gallery.id,
          },
        }).catch(err => console.error("Failed to send upload complete email:", err));
      }

      // 7. Start AI processing if styles are selected
      if (selectedStyles.length > 0 && imageIds.length > 0) {
        // Safety net: move uploaded images to "processing" before calling edge function
        // so they are visible to chain recovery even if processImages() fails
        await supabase
          .from("gallery_images")
          .update({ status: "processing" })
          .in("id", imageIds)
          .eq("status", "uploading");

        toast.success("Gallery created! AI processing started...");
        processImages(gallery.id, imageIds, selectedStyles);
      } else {
        // Update images to ready if no styles selected
        await supabase
          .from("gallery_images")
          .update({ status: "ready" })
          .in("id", imageIds);
        toast.success("Gallery created successfully!");
      }

      navigate(`/dashboard/galleries/${gallery.id}`);
    } catch (error: any) {
      console.error("Error creating gallery:", error);
      toast.error(error.message || "Failed to create gallery");
      setIsUploading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return galleryName.trim().length > 0 && galleryType.length > 0;
      case 2:
        return selectedStyles.length > 0;
      case 3:
        return true; // Culling is optional
      case 4:
        if (uploadSource === "drive") {
          return driveFolderInfo !== null;
        }
        return uploadedFiles.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="relative p-6 lg:p-8 overflow-hidden">
      {/* === AI Ambient Animations (Background) === */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
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

      {/* Header */}
      <div className="relative flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/galleries")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            Create New <span className="text-gradient-primary">AI Gallery</span>
          </h1>
          <p className="text-muted-foreground">Upload and process your photos with AI</p>
        </div>
      </div>

      {/* === Immersive Timeline Stepper === */}
      <div className="relative flex items-start justify-center mb-8 px-0 sm:px-4 overflow-x-auto">
        {steps.map((step, index) => {
          const isActive = currentStep === step.number;
          const isCompleted = currentStep > step.number || completedSteps.has(step.number);
          const isUpcoming = !isActive && !isCompleted;

          return (
            <div key={step.number} className="flex items-start">
              {/* Step node */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <motion.div
                    className={cn(
                      "w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all relative z-10",
                      isActive && "bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb,236,72,153),0.4)]",
                      isCompleted && "bg-primary/20",
                      isUpcoming && "bg-muted"
                    )}
                    animate={isActive ? { boxShadow: [
                      "0 0 12px rgba(236,72,153,0.3)",
                      "0 0 24px rgba(236,72,153,0.5)",
                      "0 0 12px rgba(236,72,153,0.3)",
                    ] } : {}}
                    transition={isActive ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                  >
                    {isCompleted ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      </motion.div>
                    ) : (
                      <step.icon className={cn(
                        "w-4 h-4 sm:w-5 sm:h-5",
                        isActive ? "text-primary-foreground" : "text-muted-foreground"
                      )} />
                    )}
                  </motion.div>
                  {/* Sparkle burst on completion */}
                  <SparkleBurst active={isCompleted && completedSteps.has(step.number)} />
                </div>
                <span className={cn(
                  "text-xs sm:text-sm font-semibold mt-2",
                  isActive ? "text-foreground" : isCompleted ? "text-primary" : "text-muted-foreground"
                )}>
                  {step.title}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:block">{step.subtitle}</span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="relative w-8 sm:w-24 h-0.5 mt-[18px] sm:mt-[22px] mx-1 sm:mx-2 bg-muted overflow-hidden rounded-full">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-secondary rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: currentStep > step.number ? "100%" : "0%" }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="glass-card border-border/50 p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {/* Step 1: Details */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold mb-1">Gallery Details</h2>
                <p className="text-muted-foreground">Give your gallery a name and description</p>
              </div>

              <div className="space-y-6">
                {/* Gallery Name */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Gallery Name *</label>
                  <Input
                    placeholder="e.g., Johnson Wedding - June 2024"
                    value={galleryName}
                    onChange={(e) => setGalleryName(e.target.value)}
                    className="bg-muted border-border/50"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    placeholder="Add notes about this gallery..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-muted border-border/50 min-h-[100px]"
                  />
                </div>

                {/* Gallery Type */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Gallery Type *</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {galleryTypes.map(type => (
                      <motion.button
                        key={type.value}
                        type="button"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setGalleryType(type.value)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                          galleryType === type.value
                            ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                            : "border-border/50 bg-muted/30 hover:border-primary/30 hover:bg-muted/50"
                        )}
                      >
                        <type.icon className={cn(
                          "w-5 h-5 transition-colors",
                          galleryType === type.value ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span className={cn(
                          "text-xs font-medium transition-colors",
                          galleryType === type.value ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {type.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Styles */}
          {currentStep === 2 && (
             <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold mb-1">Select AI Styles</h2>
                <p className="text-muted-foreground">
                  Choose up to 3 styles to apply to your photos
                </p>
              </div>

              {/* Style Tabs */}
              <div className="flex gap-2">
                <Button
                  variant={styleTab === "public" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStyleTab("public")}
                  className="gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Public Styles
                </Button>
                <Button
                  variant={styleTab === "yours" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStyleTab("yours")}
                  className="gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Your Styles
                </Button>
              </div>

              {/* Sticky Selected Styles Bar */}
              <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant={selectedStyles.length > 0 ? "default" : "secondary"} className="shrink-0">
                    {selectedStyles.length}/3
                  </Badge>
                  {selectedStyles.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No styles selected yet</span>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <AnimatePresence mode="popLayout">
                        {selectedStyles.map(id => {
                          const style = styles.find(s => s.id === id);
                          if (!style) return null;
                          const chipCover = showcaseCovers[style.id] || (style.user_id === user?.id && style.after_image_urls?.length ? style.after_image_urls[0] : undefined);
                          return (
                            <motion.div
                              key={id}
                              layout
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.8, opacity: 0 }}
                              className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full pl-1 pr-2 py-1"
                            >
                              {chipCover ? (
                                <img src={getThumbnailUrl(chipCover)} alt="" className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-accent/30" />
                              )}
                              <span className="text-xs font-medium max-w-[80px] truncate">{style.name}</span>
                              <button
                                onClick={() => toggleStyle(id)}
                                className="w-4 h-4 rounded-full hover:bg-primary/20 flex items-center justify-center transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>

              {(() => {
                const filteredStyles = styles.filter(s => {
                  if (styleTab === "yours") return s.user_id === user?.id && s.status === "ready";
                  return s.is_preset || (s.visibility === "public" && s.user_id !== user?.id);
                });

                return filteredStyles.length === 0 ? (
                  <div className="text-center py-12">
                    <Palette className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {styleTab === "yours" ? "You haven't created any styles yet." : "No public styles available."}
                    </p>
                    {styleTab === "yours" && (
                      <>
                        <p className="text-sm text-muted-foreground mt-1">Create your first AI style to get started.</p>
                        <Button
                          variant="glow"
                          size="sm"
                          className="mt-4 gap-1.5"
                          onClick={() => navigate("/dashboard/styles/new")}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create Style
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <ScrollArea className="h-[350px] pr-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredStyles.map(style => {
                        const coverUrl = showcaseCovers[style.id] || (style.user_id === user?.id && style.after_image_urls?.length ? style.after_image_urls[0] : undefined);
                        const isSelected = selectedStyles.includes(style.id);
                        return (
                          <motion.div
                            key={style.id}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => toggleStyle(style.id)}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border group",
                              isSelected
                                ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md shadow-primary/10 border-primary/50"
                                : "border-border/50 hover:border-primary/40 hover:bg-muted/30"
                            )}
                          >
                            {/* Thumbnail */}
                            {coverUrl ? (
                              <img
                                src={getThumbnailUrl(coverUrl)}
                                alt={style.name}
                                className="w-16 h-16 rounded-lg object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-lg shrink-0 bg-gradient-to-br from-primary/20 to-accent/20" />
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {style.is_preset ? (
                                  <Palette className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                                )}
                                <span className="font-semibold text-sm truncate">{style.name}</span>
                              </div>
                              {style.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{style.description}</p>
                              )}
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {style.category && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{style.category}</Badge>
                                )}
                                {style.associated_tags?.slice(0, 2).map(tag => (
                                  <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4">{tag}</Badge>
                                ))}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`/dashboard/styles/${style.id}`, "_blank");
                                }}
                                className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                              >
                                <Eye className="w-4 h-4 text-muted-foreground" />
                              </button>
                              <AnimatePresence>
                                {isSelected && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-sm"
                                  >
                                    <Check className="w-4 h-4 text-primary-foreground" />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                );
              })()}
            </motion.div>
          )}

          {/* Step 3: AI Culling (skippable) */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold mb-1">AI Smart Culling</h2>
                <p className="text-muted-foreground">
                  Automatically remove duplicates and poor quality images
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-5 rounded-xl bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Enable AI Culling</p>
                      <p className="text-sm text-muted-foreground">
                        Let AI analyze and filter your photos before editing
                      </p>
                    </div>
                  </div>
                  <Switch checked={aiCulling} onCheckedChange={setAiCulling} />
                </div>

                <AnimatePresence>
                  {aiCulling && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 rounded-xl bg-muted/30 border border-border/30 space-y-3">
                        {/* Language selector */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Culling Labels ({selectedCategories.length}/20)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                            <Select value={cullingLanguage} onValueChange={(v) => handleLanguageChange(v as LanguageCode)}>
                              <SelectTrigger className="h-8 w-[140px] text-xs bg-muted/50 border-border/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {supportedLanguages.map(lang => (
                                  <SelectItem key={lang.code} value={lang.code} className="text-xs">
                                    {lang.name} ({lang.englishName})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {galleryType 
                              ? "Recommended labels for your gallery type. Select the ones you need or add custom ones."
                              : "Select a gallery type in Step 1 to get recommended labels."}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2 shrink-0"
                            onClick={() => {
                              const currentLabels = getCullingLabels(galleryType || "wedding", cullingLanguage);
                              const allSelected = currentLabels.every(l => selectedCategories.includes(l));
                              if (allSelected) {
                                setSelectedCategories(prev => prev.filter(c => !currentLabels.includes(c)));
                              } else {
                                setSelectedCategories(prev => {
                                  const custom = prev.filter(c => !currentLabels.includes(c));
                                  const remaining = 20 - custom.length;
                                  return [...custom, ...currentLabels.slice(0, remaining)];
                                });
                              }
                            }}
                          >
                            {getCullingLabels(galleryType || "wedding", cullingLanguage).every(l => selectedCategories.includes(l)) ? "Deselect All" : "Select All"}
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {[...getCullingLabels(galleryType || "wedding", cullingLanguage), ...customLabels.filter(cl => !getCullingLabels(galleryType || "wedding", cullingLanguage).includes(cl))].map(category => (
                            <button
                              key={category}
                              onClick={() => toggleCategory(category)}
                              disabled={selectedCategories.length >= 20 && !selectedCategories.includes(category)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                selectedCategories.includes(category)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80",
                                selectedCategories.length >= 20 && !selectedCategories.includes(category) && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {selectedCategories.includes(category) && (
                                <Check className="w-3 h-3 inline mr-1" />
                              )}
                              {category}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <Input
                            placeholder="Add custom label..."
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            onKeyPress={handleCategoryKeyPress}
                            className="bg-muted/50 border-border/50 text-sm h-9"
                            disabled={selectedCategories.length >= 20}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={addCustomCategory}
                            disabled={!customCategory.trim() || selectedCategories.length >= 20}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!aiCulling && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Culling is disabled. You can enable it later from the gallery editor.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 4: Upload */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold mb-1">Upload Photos</h2>
                <p className="text-muted-foreground">
                  Choose how to add your photos
                </p>
              </div>

              {/* Upload Source Selector */}
              <UploadSourceSelector 
                value={uploadSource} 
                onChange={(source) => {
                  setUploadSource(source);
                  // Clear the other source's data when switching
                  if (source === "local") {
                    setDriveFolderInfo(null);
                    setDriveLinks([]);
                  } else {
                    uploadedFiles.forEach(f => URL.revokeObjectURL(f.preview));
                    setUploadedFiles([]);
                  }
                }}
                disabled={isUploading || isTransferring}
              />

              {/* Google Drive Input */}
              {uploadSource === "drive" && (
                <GoogleDriveInput
                  folderInfo={driveFolderInfo}
                  onUpdate={(info, links) => {
                    setDriveFolderInfo(info);
                    setDriveLinks(links);
                  }}
                  disabled={isTransferring}
                />
              )}

              {/* Local Upload Drop Zone - merged with preview */}
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
                  {/* Hidden file input triggered programmatically */}
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
                        <p className="font-medium text-sm">
                          {uploadedFiles.length} photos selected
                        </p>
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
                              uploadedFiles.forEach(f => URL.revokeObjectURL(f.preview));
                              setUploadedFiles([]);
                            }}
                            disabled={isUploading}
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
                              if (el) {
                                imageRefs.current.set(file.id, el);
                              } else {
                                imageRefs.current.delete(file.id);
                              }
                            }}
                          >
                            {file.isRaw ? (
                              <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-1">
                                <FileImage className="w-6 h-6 text-muted-foreground" />
                                <span className="text-xs font-bold text-foreground">{getFileExtension(file.file.name)}</span>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[90%] px-1">{file.file.name}</span>
                              </div>
                            ) : (
                              <img
                                src={file.preview}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            )}

                            {/* Hover overlay */}
                            {file.status === "pending" && !isUploading && (
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

                            {file.status === "pending" && !isUploading && (
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

              {/* Upload Progress Bar - only for local uploads */}
              {uploadSource === "local" && (
                <AnimatePresence>
                  {(isUploading || hookIsUploading) && uploadProgress && (() => {
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
                        transition={{ duration: 0.3, ease: "easeOut" }}
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
                      {imageCount} images × {stylesCount} style{stylesCount > 1 ? "s" : ""} = <strong>{editsNeeded} edit{editsNeeded !== 1 ? "s" : ""}</strong>
                    </span>
                    {isUnlimited ? (
                      <span className="flex items-center gap-1.5 text-primary">
                        <Check className="w-4 h-4" />
                        Included in your plan
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        You have <strong className={hasInsufficientEdits ? "text-destructive" : "text-primary"}>{availableEdits.toLocaleString()}</strong> available{editsReserved > 0 && <span className="text-xs ml-1">({editsReserved.toLocaleString()} reserved)</span>}
                      </span>
                    )}
                  </div>
                  {!isUnlimited && hasInsufficientEdits && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-destructive/20">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>Not enough edits. Max {maxImages} images with {stylesCount} style{stylesCount > 1 ? "s" : ""}.</span>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="ml-3 flex-shrink-0"
                        onClick={() => navigate("/dashboard/billing")}
                      >
                        Upgrade Plan
                      </Button>
                    </div>
                  )}
                  {!isUnlimited && !hasInsufficientEdits && availableEdits === 0 && isFreePlan && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-destructive/20">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>You have no edits remaining.</span>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="ml-3 flex-shrink-0"
                        onClick={() => navigate("/dashboard/billing")}
                      >
                        Upgrade Plan
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
          <Button
            variant="ghost"
            onClick={() => {
              setCurrentStep(prev => prev - 1);
            }}
            disabled={currentStep === 1 || isUploading}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          {currentStep < 4 ? (
            <Button
              variant="glow"
              onClick={() => {
                setCompletedSteps(prev => new Set([...prev, currentStep]));
                setCurrentStep(prev => prev + 1);
              }}
              disabled={!canProceed()}
              className="gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="glow"
              onClick={createGalleryAndUpload}
              disabled={!canProceed() || isUploading || isTransferring || hasInsufficientEdits}
              className="gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : isTransferring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting Transfer...
                </>
              ) : uploadSource === "drive" ? (
                <>
                  <CloudIcon className="w-4 h-4" />
                  Import & Create Gallery
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Create Gallery
                </>
              )}
            </Button>
          )}
        </div>
      </Card>

    </div>
  );
}
