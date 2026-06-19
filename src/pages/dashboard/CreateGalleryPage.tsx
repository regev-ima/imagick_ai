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
  ChevronDown,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useOnboardingQuestionnaire } from "@/hooks/useOnboardingQuestionnaire";

// The AI mark — a 4-point sparkle (the logo star), royal blue.
// Copied from the approved LIGHTROOM dashboard.
function Sparkle({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
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
  { number: 1, title: "Details", icon: FolderOpen, ask: "What are we working on?", say: "Name the shoot." },
  { number: 2, title: "Styles", icon: Palette, ask: "How should I edit them?", say: "Pick up to three looks — or skip." },
  { number: 3, title: "Culling", icon: Sparkles, ask: "Want me to cull first?", say: "I surface the keepers before you edit." },
  { number: 4, title: "Upload", icon: Upload, ask: "Send me the photos.", say: "From your device or a Drive folder." },
];

export default function CreateGalleryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { processImages } = useImageProcessing();
  const { uppy, uploadImages, uploadProgress, isUploading: hookIsUploading } = useImageUpload();
  const uppyFileCount = useUppyState(uppy, (state) => Object.keys(state.files).length);
  const { availableEdits, editsReserved, isUnlimited, isFreePlan } = useSubscription();
  // FIX 5 — onboarding answers (shoot types) can prefill the gallery type
  const { answers: onboardingAnswers, allQuestions: onboardingQuestions } = useOnboardingQuestionnaire();
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
  const [cullingAdvancedOpen, setCullingAdvancedOpen] = useState(false);
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

  // FIX 3 — guard leaving mid-upload (staged files or active transfer)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

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

  // Aura hand-off: ⌘K "start a collection named X" lands here with ?name=X
  const prefillName = searchParams.get("name");
  useEffect(() => {
    if (prefillName) setGalleryName((prev) => prev || prefillName);
  }, [prefillName]);

  // FIX 5 — default the gallery type from the onboarding questionnaire's
  // "What do you shoot?" answer (question_key === "photography_types").
  // Onboarding option ids are plural (e.g. "weddings") and a few don't map
  // to a wizard galleryType; we only prefill on a clean match and never
  // override an existing pick (manual choice or ?styleId/?name flows).
  useEffect(() => {
    if (galleryType) return;
    const shootQuestion = onboardingQuestions.find((q) => q.question_key === "photography_types");
    if (!shootQuestion) return;
    const answer = onboardingAnswers.find((a) => a.question_id === shootQuestion.id);
    const picked: string[] = Array.isArray(answer?.answer) ? answer.answer : [];
    if (picked.length === 0) return;
    // Map onboarding shoot-type ids -> wizard galleryType values.
    const ONBOARDING_TO_GALLERY_TYPE: Record<string, string> = {
      weddings: "wedding",
      portraits: "portrait",
      events: "event",
      commercial: "commercial",
      landscape: "landscape",
      real_estate: "real_estate",
      fashion: "fashion",
      food: "food",
      sports: "sports",
      newborn: "newborn",
      // "wildlife" and "other" have no clean wizard equivalent — left unmapped.
    };
    const validTypes = new Set(galleryTypes.map((t) => t.value));
    const match = picked.map((id) => ONBOARDING_TO_GALLERY_TYPE[id]).find((v) => v && validTypes.has(v));
    if (match) setGalleryType(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingQuestions, onboardingAnswers]);

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

    // When AI culling is on, the labels that actually drive the first automatic
    // culling live in `culling_labels` (the backend's image-webhook reads that
    // column, not `categories`). If the photographer didn't pick any, fall back
    // to the curated label set for the shoot type, so simply toggling culling on
    // still tags sensibly instead of sending Aura an empty list.
    const effectiveCullingLabels = aiCulling
      ? (selectedCategories.length > 0
          ? selectedCategories
          : getCullingLabels(galleryType || "wedding", cullingLanguage))
      : [];

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
            culling_labels: effectiveCullingLabels,
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
          culling_labels: effectiveCullingLabels,
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
        return true; // Styles are optional — gallery can be host & share only
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

  // FIX 3 — the back button abandons staged photos / an active transfer.
  // Intercept with a confirm when there's something to lose; otherwise leave.
  const hasUnsavedWork = uppyFileCount > 0 || busy;
  const handleLeave = () => {
    if (hasUnsavedWork) {
      setShowLeaveConfirm(true);
    } else {
      navigate("/dashboard/galleries");
    }
  };

  // FIX 3 — warn on tab close / reload ONLY while an upload/transfer is active.
  useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);

  return (
    <div className="relative min-h-full bg-background px-4 py-8 lg:px-8 lg:py-12">
      <div className="relative mx-auto max-w-3xl">
        {/* Header — back mark + module index */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLeave}
            aria-label="Back to galleries"
            className="-ml-2 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="caption">Galleries</span>
          </Button>
          <span className="caption hidden sm:inline">New collection · {String(active.number).padStart(2, "0")} / 04</span>
        </div>

        {/* Stepper — mono module index on a hairline */}
        <div className="mt-6">
          <hr className="aura-hairline" />
          <div className="-mt-px flex flex-wrap items-stretch">
            {steps.map((step, i) => {
              const isActive = currentStep === step.number;
              const isDone = currentStep > step.number || completedSteps.has(step.number);
              const reachable = isDone;
              return (
                <button
                  key={step.number}
                  type="button"
                  disabled={!reachable || busy}
                  onClick={() => reachable && setCurrentStep(step.number)}
                  className={cn(
                    "group relative flex items-center gap-2 py-3 pr-5",
                    i > 0 && "pl-5",
                    reachable ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  {/* active = royal-blue tick on the rule */}
                  <span
                    className={cn(
                      "absolute left-0 top-0 h-0.5 w-full -translate-y-px transition-colors",
                      isActive ? "bg-primary" : "bg-transparent",
                    )}
                  />
                  <span
                    className={cn(
                      "caption text-xs transition-colors",
                      isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground/55",
                    )}
                  >
                    {String(step.number).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "caption transition-colors",
                      isActive
                        ? "text-foreground"
                        : isDone
                          ? "text-muted-foreground group-hover:text-foreground"
                          : "text-muted-foreground/55",
                    )}
                  >
                    {step.title}
                  </span>
                  {isDone && !isActive && <Check className="h-3 w-3 text-primary" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
          <hr className="aura-hairline" />
        </div>

        {/* Masthead — Aura mark + step title + helper line */}
        <div className="mb-7 mt-9 flex items-start gap-4">
          <Orb className="mt-0.5 h-10 w-10 shrink-0" />
          <div className="min-w-0">
            <span className="aura-microlabel text-accent">Aura</span>
            <h1 className="mt-1 text-3xl font-bold leading-[1.05] tracking-tight text-foreground lg:text-4xl">
              {active.ask}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{active.say}</p>
          </div>
        </div>

        {/* Step panel */}
        <div className="glass-card rounded-md p-5 lg:p-8">
          <AnimatePresence mode="wait">
            {/* Step 1: Details */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                className="space-y-8"
              >
                <div>
                  <label className="aura-microlabel mb-2.5 block">Gallery name</label>
                  <Input
                    placeholder="Cohen Wedding, June 2026"
                    value={galleryName}
                    onChange={(e) => setGalleryName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="aura-microlabel mb-2.5 block">Notes for me (optional)</label>
                  <Textarea
                    placeholder="Anything I should know about this shoot?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[90px]"
                  />
                </div>

                <div>
                  <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
                    <label className="aura-microlabel">What kind of shoot?</label>
                    <span className="caption text-muted-foreground/70">{String(galleryTypes.length).padStart(2, "0")}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
                    {galleryTypes.map((type) => {
                      const selected = galleryType === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setGalleryType(type.value)}
                          className={cn(
                            "relative flex flex-col items-center gap-2.5 bg-card p-4 transition-colors duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)]",
                            selected ? "bg-primary/[0.1]" : "hover:bg-muted/60",
                          )}
                        >
                          {/* active = royal-blue keyline */}
                          {selected && <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-primary" />}
                          <type.icon className={cn("h-5 w-5 transition-colors", selected ? "text-primary" : "text-foreground/70")} strokeWidth={1.5} />
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
                transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                className="space-y-6"
              >
                {/* Tabs — segmented control */}
                <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
                  {([["public", "Public looks", Globe], ["yours", "Your looks", Sparkles]] as const).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStyleTab(key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-[5px] px-4 py-1.5 text-xs font-semibold transition-colors",
                        styleTab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Optional — host & share without AI editing */}
                <p className="text-sm text-muted-foreground">
                  Optional — skip to host &amp; share your photos as-is, with no AI editing.
                </p>

                {/* Selected index — chips with cover + count */}
                <div className="border-y border-border py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="caption shrink-0 text-primary">{String(selectedStyles.length).padStart(2, "0")}<span className="text-muted-foreground/50"> / 03</span></span>
                    {selectedStyles.length === 0 ? (
                      <>
                        <span className="text-sm text-muted-foreground">Nothing picked yet. Choose a look below — or</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCompletedSteps((prev) => new Set([...prev, 2]));
                            setCurrentStep(3);
                          }}
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Skip — no AI editing
                        </button>
                      </>
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
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
                                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/[0.1] py-1 pl-1 pr-2"
                              >
                                {chipCover ? (
                                  <img src={getThumbnailUrl(chipCover)} alt="" className="h-6 w-6 rounded-full object-cover" />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-primary/20" />
                                )}
                                <span className="max-w-[80px] truncate text-xs font-medium">{style.name}</span>
                                <button onClick={() => toggleStyle(id)} className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary">
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
                    <div className="border-t border-border py-14 text-center">
                      <Orb className="mx-auto mb-4 h-9 w-9" />
                      <p className="text-lg font-semibold text-foreground">
                        {styleTab === "yours" ? "You haven't trained a look yet." : "No public looks available."}
                      </p>
                      {styleTab === "yours" && (
                        <>
                          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">Train one and I'll match your editing exactly.</p>
                          <Button variant="glow" size="sm" className="mt-5 gap-1.5" onClick={() => navigate("/dashboard/styles/new")}>
                            <Plus className="h-3.5 w-3.5" />
                            Train a look
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <ScrollArea className="h-[360px] pr-2">
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
                                "group relative flex cursor-pointer items-center gap-3.5 rounded-md border border-border bg-card p-2.5 transition-colors duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)]",
                                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                                isSelected ? "bg-primary/[0.06]" : "hover:bg-muted/50",
                              )}
                            >
                              {/* selected = royal-blue ring */}
                              {isSelected && <span className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-primary" />}
                              {coverUrl ? (
                                <img src={getThumbnailUrl(coverUrl)} alt={style.name} className="plate-keyline h-16 w-16 shrink-0 rounded object-cover" />
                              ) : (
                                <div className="plate-keyline h-16 w-16 shrink-0 rounded bg-muted" />
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  {style.is_preset ? <Palette className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.75} /> : <Sparkle size={13} className="shrink-0 text-accent" />}
                                  <span className="truncate text-base font-semibold leading-tight text-foreground">{style.name}</span>
                                </div>
                                {style.description && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{style.description}</p>}
                                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                  {style.category && <span className="caption text-[0.625rem] tracking-[0.14em]">{style.category}</span>}
                                  {style.associated_tags?.slice(0, 2).map((tag) => (
                                    <Badge key={tag} variant="outline" className="h-4 px-1.5 py-0 text-[10px] font-normal">{tag}</Badge>
                                  ))}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`/dashboard/styles/${style.id}`, "_blank");
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                {isSelected && (
                                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
                                    <Check className="h-4 w-4" strokeWidth={2.5} />
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
                transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between gap-4 border-y border-border py-5">
                  <div className="flex items-center gap-3.5">
                    <Orb className="h-10 w-10 shrink-0" />
                    <div>
                      <p className="text-lg font-semibold leading-tight text-foreground">Let me cull this gallery</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">I rank every frame before any editing, so you only pay to edit the keepers.</p>
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
                      transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 rounded-md border border-border bg-card p-4">
                        {/* Calm default — Aura handles it automatically */}
                        <div className="flex items-center gap-2.5">
                          <Sparkle size={14} className="shrink-0 text-accent" />
                          <p className="text-sm text-muted-foreground">
                            Aura will tag and rank your best shots automatically.
                          </p>
                        </div>

                        {/* Advanced (optional) — detailed label controls, collapsed by default */}
                        <Collapsible open={cullingAdvancedOpen} onOpenChange={setCullingAdvancedOpen}>
                          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-left transition-colors hover:bg-muted/50">
                            <span className="flex items-center gap-2">
                              <Tag className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                              <span className="text-sm font-medium">Advanced (optional)</span>
                              {selectedCategories.length > 0 && (
                                <span className="caption text-primary">{String(selectedCategories.length).padStart(2, "0")}<span className="text-muted-foreground/50"> / 20</span></span>
                              )}
                            </span>
                            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", cullingAdvancedOpen && "rotate-180")} />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-4 pt-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                                <span className="text-sm font-medium">What should I look for?</span>
                                <span className="caption text-primary">{String(selectedCategories.length).padStart(2, "0")}<span className="text-muted-foreground/50"> / 20</span></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Globe className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
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
                                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)]",
                                      on
                                        ? "border-primary/50 bg-primary/[0.1] text-foreground"
                                        : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                                      locked && "cursor-not-allowed opacity-50",
                                    )}
                                  >
                                    {on && <Check className="mr-1 inline h-3 w-3 text-primary" strokeWidth={2.5} />}
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
                          </CollapsibleContent>
                        </Collapsible>

                        <p className="text-xs text-muted-foreground">
                          You can also do this later in the editor.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!aiCulling && (
                  <p className="py-2 text-center text-sm italic text-muted-foreground">
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
                transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                className="space-y-6"
              >
                <div>
                  <span className="aura-microlabel mb-2.5 block">Source</span>
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
                </div>

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
                          transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                          className="space-y-3 overflow-hidden rounded-md border border-border bg-card p-4"
                        >
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                            <motion.div
                              className="h-full rounded-full bg-primary"
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
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

                {/* Hosting-only summary — no styles selected */}
                {imageCount > 0 && stylesCount === 0 && (
                  <div className="rounded-md border border-border bg-card p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        <span className="font-mono font-semibold text-foreground">{imageCount}</span> photos
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <FolderOpen className="h-4 w-4" strokeWidth={1.75} /> Hosting only — no AI edits
                      </span>
                    </div>
                  </div>
                )}

                {/* Edit cost summary */}
                {imageCount > 0 && stylesCount > 0 && (
                  <div className={cn("rounded-md border p-4 text-sm", hasInsufficientEdits && !isUnlimited ? "border-destructive/40 bg-destructive/[0.06]" : "border-border bg-card")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        <span className="font-mono font-semibold text-foreground">{imageCount}</span> photos
                        <span className="text-muted-foreground/50"> × </span>
                        <span className="font-mono font-semibold text-foreground">{stylesCount}</span> look{stylesCount > 1 ? "s" : ""}
                        <span className="text-muted-foreground/50"> = </span>
                        <strong className="font-mono text-primary">{editsNeeded} edits</strong>
                      </span>
                      {isUnlimited ? (
                        <span className="inline-flex items-center gap-1.5 text-secondary">
                          <Check className="h-4 w-4" strokeWidth={2.5} /> Covered by your plan
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          <strong className={cn("font-mono font-semibold", hasInsufficientEdits ? "text-destructive" : "text-foreground")}>{availableEdits.toLocaleString()}</strong> available
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

                {/* Smart culling plan — estimated keepers so the value is tangible */}
                {imageCount > 0 && aiCulling && (
                  <div className="rounded-md border border-primary/25 bg-primary/[0.05] p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Sparkle size={14} className="shrink-0 text-accent" />
                        AI culling first — I'll surface the keepers before you edit
                      </span>
                      <span className="text-muted-foreground">
                        ~<span className="font-mono font-semibold text-foreground">{Math.round(imageCount * 0.3)}</span> keepers
                        <span className="text-muted-foreground/50"> est.</span>
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
            <Button variant="ghost" onClick={() => setCurrentStep((p) => p - 1)} disabled={currentStep === 1 || busy} className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {currentStep < 4 ? (
              <Button
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
                    {selectedStyles.length > 0 ? "Import & hand to Aura" : "Import & share"}
                  </>
                ) : selectedStyles.length > 0 ? (
                  <>
                    <Sparkle size={15} />
                    Hand it to Aura
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload & share
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* FIX 3 — confirm before abandoning staged photos / an active transfer */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without creating?</AlertDialogTitle>
            <AlertDialogDescription>
              Your selected photos won't be uploaded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/dashboard/galleries")}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
