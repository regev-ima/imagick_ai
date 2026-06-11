import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUppyState } from "@uppy/react";
import { UppyUploadArea } from "@/components/upload/UppyUploadArea";
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
  CloudIcon,
  Plus,
  Tag,
  AlertTriangle,
  Eye,
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
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Orb } from "@/components/aura/Orb";
import { UploadSourceSelector, type UploadSource } from "@/components/gallery/UploadSourceSelector";
import { GoogleDriveInput, type DriveFolderInfo } from "@/components/gallery/GoogleDriveInput";
import { useSubscription } from "@/hooks/useSubscription";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { useShowcaseCovers } from "@/hooks/useShowcaseCovers";
import { getCullingLabels, supportedLanguages, type LanguageCode } from "@/lib/cullingLabels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// Aura speaks each step — clean, confident, first-person.
const steps = [
  { number: 1, title: "Details", icon: FolderOpen, ask: "What are we working on?", say: "Name the shoot and tell me its type, so I can tailor everything that follows." },
  { number: 2, title: "Styles", icon: Palette, ask: "How should I edit them?", say: "Pick up to three looks. I learn each one and apply it to every photo." },
  { number: 3, title: "Culling", icon: Sparkles, ask: "Want me to cull first?", say: "I score every frame for focus, eyes and expression, then surface the keepers." },
  { number: 4, title: "Upload", icon: Upload, ask: "Send me the photos.", say: "Drop them from your device or point me at a Drive folder. I start the moment they land." },
];

export default function CreateGalleryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { processImages } = useImageProcessing();
  const { uppy, uploadImages, uploadProgress, isUploading: hookIsUploading } = useImageUpload();
  const uppyFileCount = useUppyState(uppy, (state) => Object.keys(state.files).length);
  const { availableEdits, editsReserved, isUnlimited, isFreePlan } = useSubscription();
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
  const [customCategory, setCustomCategory] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
  const imageCount = uploadSource === "drive" ? (driveFolderInfo?.totalImageCount || 0) : uppyFileCount;
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
    },
  });

  const { data: showcaseCovers = {} } = useShowcaseCovers();

  const toggleStyle = (styleId: string) => {
    setSelectedStyles((prev) => {
      if (prev.includes(styleId)) {
        return prev.filter((id) => id !== styleId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, styleId];
    });
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category);
      }
      if (prev.length >= 20) return prev;
      return [...prev, category];
    });
  };

  const addCustomCategory = () => {
    const trimmed = customCategory.trim();
    const predefined = getCullingLabels(galleryType || "wedding", cullingLanguage);
    if (trimmed && !selectedCategories.includes(trimmed) && !predefined.includes(trimmed) && !customLabels.includes(trimmed) && selectedCategories.length < 20) {
      setCustomLabels((prev) => [...prev, trimmed]);
      setSelectedCategories((prev) => [...prev, trimmed]);
      setCustomCategory("");
    } else if (trimmed && predefined.includes(trimmed) && !selectedCategories.includes(trimmed) && selectedCategories.length < 20) {
      setSelectedCategories((prev) => [...prev, trimmed]);
      setCustomCategory("");
    }
  };

  const handleCategoryKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomCategory();
    }
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
            status: "transferring",
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
          total_images: uppyFileCount,
          status: "uploading",
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

      // 3. Upload images via Uppy. Files are already in Uppy state — we
      // don't pass them again. Uppy Dashboard renders progress per file
      // on its own, so no per-file callbacks needed.
      //
      // We stream completed batches into AI processing as they finish,
      // so editing starts within seconds of the first photos uploading
      // (instead of waiting for the entire 2000-photo upload to drain).
      const streamedProcessedIds = new Set<string>();
      const imageIds = await uploadImages(gallery.id, user.id, undefined, {
        onBatchInserted: (newIds) => {
          if (selectedStyles.length === 0 || newIds.length === 0) return;
          const fresh = newIds.filter((id) => !streamedProcessedIds.has(id));
          if (fresh.length === 0) return;
          fresh.forEach((id) => streamedProcessedIds.add(id));

          // Mark the batch as processing and kick off the AI editor.
          // Fire-and-forget — failures are reported by the edge fn.
          (async () => {
            try {
              await supabase
                .from("gallery_images")
                .update({ status: "processing" })
                .in("id", fresh)
                .eq("status", "uploading");
              processImages(gallery.id, fresh, selectedStyles);
            } catch (err) {
              console.error("Streaming processImages batch failed:", err);
            }
          })();
        },
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
          total_images: imageIds.length,
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
        }).catch((err) => console.error("Failed to send upload complete email:", err));
      }

      // 7. Start AI processing for any IDs that weren't already streamed
      if (selectedStyles.length > 0 && imageIds.length > 0) {
        const remaining = imageIds.filter((id) => !streamedProcessedIds.has(id));
        if (remaining.length > 0) {
          await supabase
            .from("gallery_images")
            .update({ status: "processing" })
            .in("id", remaining)
            .eq("status", "uploading");
          processImages(gallery.id, remaining, selectedStyles);
        }
        toast.success("Gallery created! Aura is on it...");
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
        return uppyFileCount > 0;
      default:
        return false;
    }
  };

  const active = steps[currentStep - 1];
  const busy = isUploading || isTransferring;

  return (
    <div className="relative min-h-full px-4 py-6 lg:px-8 lg:py-10">
      {/* Ambient wash */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[16vh] left-1/2 h-[46vh] w-[52vw] -translate-x-1/2 rounded-full bg-primary/[0.09] blur-[140px]" />
        <div className="absolute top-[40vh] -right-[8vw] h-[34vh] w-[30vw] rounded-full bg-secondary/[0.07] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/galleries")} aria-label="Back to galleries">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Orb className="h-9 w-9" />
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">New gallery</h1>
              <p className="text-sm text-muted-foreground">I'll cull, edit and prep your shoot. Four quick steps.</p>
            </div>
          </div>
        </div>

        {/* Stepper — clean segmented progress */}
        <div className="mt-8 grid grid-cols-4 gap-2">
          {steps.map((step) => {
            const isActive = currentStep === step.number;
            const isDone = currentStep > step.number || completedSteps.has(step.number);
            return (
              <button
                key={step.number}
                type="button"
                disabled={!isDone || busy}
                onClick={() => isDone && setCurrentStep(step.number)}
                className="group text-left"
              >
                <div
                  className={cn(
                    "h-1 rounded-full transition-colors duration-300",
                    isActive || isDone ? "bg-[image:var(--gradient-primary)]" : "bg-muted",
                  )}
                />
                <div className="mt-2.5 flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] transition-colors",
                      isDone
                        ? "bg-primary/15 text-primary"
                        : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : step.number}
                  </span>
                  <span
                    className={cn(
                      "truncate font-mono text-[11px] uppercase tracking-[0.12em]",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Aura's prompt for this step */}
        <div className="mt-8 mb-5">
          <h2 className="font-display text-xl font-semibold tracking-tight lg:text-2xl">{active.ask}</h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">{active.say}</p>
        </div>

        {/* Step card */}
        <div className="rounded-3xl border border-border/60 bg-card/55 p-5 backdrop-blur-xl lg:p-7">
          <AnimatePresence mode="wait">
            {/* Step 1: Details */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className="space-y-6"
              >
                <div>
                  <label className="aura-microlabel mb-2 block">Gallery name</label>
                  <Input
                    placeholder="Cohen Wedding, June 2026"
                    value={galleryName}
                    onChange={(e) => setGalleryName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="aura-microlabel mb-2 block">Notes for me (optional)</label>
                  <Textarea
                    placeholder="Anything I should know about this shoot?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[90px] rounded-2xl"
                  />
                </div>

                <div>
                  <label className="aura-microlabel mb-3 block">What kind of shoot?</label>
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {galleryTypes.map((type) => {
                      const selected = galleryType === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setGalleryType(type.value)}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-2xl border p-3.5 transition-[border-color,background-color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]",
                            selected
                              ? "border-primary/60 bg-primary/10 shadow-[0_0_24px_-10px_hsl(var(--glow-primary)/0.8)]"
                              : "border-border/60 bg-background/40 hover:border-primary/40",
                          )}
                        >
                          <type.icon className={cn("h-5 w-5 transition-colors", selected ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn("text-xs font-medium transition-colors", selected ? "text-foreground" : "text-muted-foreground")}>
                            {type.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Styles */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className="space-y-5"
              >
                {/* Tabs */}
                <div className="inline-flex items-center gap-1 rounded-full bg-muted/70 p-1">
                  {([["public", "Public looks", Globe], ["yours", "Your looks", Sparkles]] as const).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStyleTab(key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                        styleTab === key ? "bg-background text-foreground shadow-[0_0_18px_-8px_hsl(var(--glow-primary)/0.6)]" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Selected bar */}
                <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground">{selectedStyles.length}/3</span>
                    {selectedStyles.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Nothing picked yet. Choose a look below.</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <AnimatePresence mode="popLayout">
                          {selectedStyles.map((id) => {
                            const style = styles.find((s) => s.id === id);
                            if (!style) return null;
                            const chipCover = showcaseCovers[style.id] || (style.user_id === user?.id && style.after_image_urls?.length ? style.after_image_urls[0] : undefined) || style.thumbnail_url || undefined;
                            return (
                              <motion.div
                                key={id}
                                layout
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pl-1 pr-2"
                              >
                                {chipCover ? (
                                  <img src={getThumbnailUrl(chipCover)} alt="" className="h-6 w-6 rounded-full object-cover" />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-[image:var(--gradient-primary)]" />
                                )}
                                <span className="max-w-[80px] truncate text-xs font-medium">{style.name}</span>
                                <button onClick={() => toggleStyle(id)} className="grid h-4 w-4 place-items-center rounded-full transition-colors hover:bg-primary/20">
                                  <X className="h-3 w-3" />
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
                  const filteredStyles = styles.filter((s) => {
                    if (styleTab === "yours") return s.user_id === user?.id && s.status === "ready";
                    return s.is_preset || (s.visibility === "public" && s.user_id !== user?.id);
                  });

                  return filteredStyles.length === 0 ? (
                    <div className="py-12 text-center">
                      <Palette className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {styleTab === "yours" ? "You haven't trained a look yet." : "No public looks available."}
                      </p>
                      {styleTab === "yours" && (
                        <>
                          <p className="mt-1 text-sm text-muted-foreground">Train one and I'll match your editing exactly.</p>
                          <Button variant="glow" size="sm" className="mt-4 gap-1.5" onClick={() => navigate("/dashboard/styles/new")}>
                            <Plus className="h-3.5 w-3.5" />
                            Train a look
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <ScrollArea className="h-[340px] pr-2">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {filteredStyles.map((style) => {
                          const coverUrl = showcaseCovers[style.id] || (style.user_id === user?.id && style.after_image_urls?.length ? style.after_image_urls[0] : undefined) || style.thumbnail_url || undefined;
                          const isSelected = selectedStyles.includes(style.id);
                          return (
                            <div
                              key={style.id}
                              role="checkbox"
                              aria-checked={isSelected}
                              aria-label={style.name}
                              tabIndex={0}
                              onClick={() => toggleStyle(style.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleStyle(style.id);
                                }
                              }}
                              className={cn(
                                "group flex cursor-pointer items-center gap-3 rounded-2xl border p-2.5 transition-[border-color,box-shadow] duration-150",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                isSelected
                                  ? "border-primary/60 shadow-[0_0_28px_-12px_hsl(var(--glow-primary)/0.7)]"
                                  : "border-border/60 hover:border-primary/40",
                              )}
                            >
                              {coverUrl ? (
                                <img src={getThumbnailUrl(coverUrl)} alt={style.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                              ) : (
                                <div className="h-16 w-16 shrink-0 rounded-xl bg-[image:var(--gradient-primary)] opacity-30" />
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  {style.is_preset ? <Palette className="h-3.5 w-3.5 shrink-0 text-primary" /> : <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />}
                                  <span className="truncate text-sm font-semibold">{style.name}</span>
                                </div>
                                {style.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{style.description}</p>}
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  {style.category && <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px]">{style.category}</Badge>}
                                  {style.associated_tags?.slice(0, 2).map((tag) => (
                                    <Badge key={tag} variant="outline" className="h-4 px-1.5 py-0 text-[10px]">{tag}</Badge>
                                  ))}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`/dashboard/styles/${style.id}`, "_blank");
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-full bg-muted/50 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                                >
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                </button>
                                {isSelected && (
                                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
                                    <Check className="h-4 w-4" />
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  );
                })()}
              </motion.div>
            )}

            {/* Step 3: AI Culling */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/40 p-5">
                  <div className="flex items-center gap-3">
                    <Orb className="h-10 w-10 shrink-0" />
                    <div>
                      <p className="font-medium">Let me cull this gallery</p>
                      <p className="text-sm text-muted-foreground">I rank every frame before any editing, so you only pay to edit the keepers.</p>
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
                      <div className="space-y-3 rounded-2xl border border-border/50 bg-background/30 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">What should I look for? ({selectedCategories.length}/20)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                            <Select value={cullingLanguage} onValueChange={(v) => handleLanguageChange(v as LanguageCode)}>
                              <SelectTrigger className="h-8 w-[140px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {supportedLanguages.map((lang) => (
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
                              ? "I suggested labels for this shoot type. Keep the ones you want or add your own."
                              : "Pick a shoot type in step one and I'll suggest labels."}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 px-2 text-xs"
                            onClick={() => {
                              const currentLabels = getCullingLabels(galleryType || "wedding", cullingLanguage);
                              const allSelected = currentLabels.every((l) => selectedCategories.includes(l));
                              if (allSelected) {
                                setSelectedCategories((prev) => prev.filter((c) => !currentLabels.includes(c)));
                              } else {
                                setSelectedCategories((prev) => {
                                  const custom = prev.filter((c) => !currentLabels.includes(c));
                                  const remaining = 20 - custom.length;
                                  return [...custom, ...currentLabels.slice(0, remaining)];
                                });
                              }
                            }}
                          >
                            {getCullingLabels(galleryType || "wedding", cullingLanguage).every((l) => selectedCategories.includes(l)) ? "Clear all" : "Select all"}
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {[...getCullingLabels(galleryType || "wedding", cullingLanguage), ...customLabels.filter((cl) => !getCullingLabels(galleryType || "wedding", cullingLanguage).includes(cl))].map((category) => {
                            const on = selectedCategories.includes(category);
                            const locked = selectedCategories.length >= 20 && !on;
                            return (
                              <button
                                key={category}
                                onClick={() => toggleCategory(category)}
                                disabled={locked}
                                className={cn(
                                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                                  on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
                                  locked && "cursor-not-allowed opacity-50",
                                )}
                              >
                                {on && <Check className="mr-1 inline h-3 w-3" />}
                                {category}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex gap-2">
                          <Input
                            placeholder="Add your own label..."
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            onKeyPress={handleCategoryKeyPress}
                            className="h-9 text-sm"
                            disabled={selectedCategories.length >= 20}
                          />
                          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={addCustomCategory} disabled={!customCategory.trim() || selectedCategories.length >= 20}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!aiCulling && (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    No problem. You can ask me to cull anytime from the editor.
                  </p>
                )}
              </motion.div>
            )}

            {/* Step 4: Upload */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className="space-y-5"
              >
                <UploadSourceSelector
                  value={uploadSource}
                  onChange={(source) => {
                    setUploadSource(source);
                    if (source === "local") {
                      setDriveFolderInfo(null);
                      setDriveLinks([]);
                    } else {
                      uppy.cancelAll();
                    }
                  }}
                  disabled={isUploading || isTransferring}
                />

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

                {uploadSource === "local" && (
                  <UppyUploadArea
                    uppy={uppy}
                    maxFiles={!isUnlimited && stylesCount > 0 ? maxImages : undefined}
                    disabled={isUploading || hookIsUploading}
                  />
                )}

                {uploadSource === "local" && (
                  <AnimatePresence>
                    {(isUploading || hookIsUploading) && uploadProgress && (() => {
                      const totalBytes = uploadProgress.totalBytes;
                      const uploadedBytes = uploadProgress.bytesUploaded;
                      const percentage = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
                      const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
                      return (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className="space-y-3 overflow-hidden rounded-2xl border border-border/60 bg-background/40 p-4"
                        >
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <motion.div
                              className="h-full rounded-full bg-[image:var(--gradient-primary)] shadow-[0_0_12px_hsl(var(--glow-primary)/0.6)]"
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate text-muted-foreground">
                              Receiving <span className="font-medium text-foreground">{uploadProgress.currentFile}</span>
                            </span>
                            <span className="shrink-0 font-mono text-primary">
                              {percentage}% · {formatMB(uploadedBytes)}/{formatMB(totalBytes)} MB
                            </span>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                )}

                {/* Edit cost summary */}
                {imageCount > 0 && stylesCount > 0 && (
                  <div className={cn("rounded-2xl border p-4 text-sm", hasInsufficientEdits && !isUnlimited ? "border-destructive/40 bg-destructive/10" : "border-border/60 bg-background/40")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {imageCount} photos
                        <span className="text-muted-foreground/60"> × </span>
                        {stylesCount} look{stylesCount > 1 ? "s" : ""}
                        <span className="text-muted-foreground/60"> = </span>
                        <strong className="font-mono text-foreground">{editsNeeded} edits</strong>
                      </span>
                      {isUnlimited ? (
                        <span className="inline-flex items-center gap-1.5 text-primary">
                          <Check className="h-4 w-4" /> Covered by your plan
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          <strong className={cn("font-mono", hasInsufficientEdits ? "text-destructive" : "text-primary")}>{availableEdits.toLocaleString()}</strong> available
                          {editsReserved > 0 && <span className="ml-1 text-xs">({editsReserved.toLocaleString()} reserved)</span>}
                        </span>
                      )}
                    </div>
                    {!isUnlimited && hasInsufficientEdits && (
                      <div className="mt-3 flex items-center justify-between border-t border-destructive/20 pt-3">
                        <span className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          Not enough edits. Max {maxImages} photos with {stylesCount} look{stylesCount > 1 ? "s" : ""}.
                        </span>
                        <Button size="sm" className="ml-3 shrink-0" onClick={() => navigate("/dashboard/billing")}>Upgrade</Button>
                      </div>
                    )}
                    {!isUnlimited && !hasInsufficientEdits && availableEdits === 0 && isFreePlan && (
                      <div className="mt-3 flex items-center justify-between border-t border-destructive/20 pt-3">
                        <span className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-4 w-4 shrink-0" /> You have no edits remaining.
                        </span>
                        <Button size="sm" className="ml-3 shrink-0" onClick={() => navigate("/dashboard/billing")}>Upgrade</Button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-7 flex items-center justify-between border-t border-border/50 pt-6">
            <Button variant="ghost" onClick={() => setCurrentStep((p) => p - 1)} disabled={currentStep === 1 || busy} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {currentStep < 4 ? (
              <Button
                variant="glow"
                onClick={() => {
                  setCompletedSteps((prev) => new Set([...prev, currentStep]));
                  setCurrentStep((p) => p + 1);
                }}
                disabled={!canProceed()}
                className="gap-2"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="glow"
                onClick={createGalleryAndUpload}
                disabled={!canProceed() || busy || hasInsufficientEdits}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : isTransferring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting transfer...
                  </>
                ) : uploadSource === "drive" ? (
                  <>
                    <CloudIcon className="h-4 w-4" />
                    Import & hand to Aura
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Hand it to Aura
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
