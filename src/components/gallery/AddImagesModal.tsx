import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUppyState } from "@uppy/react";
import { UppyUploadArea } from "@/components/upload/UppyUploadArea";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Images, Loader2, CloudIcon, AlertTriangle, Check, Ban, Zap,
  Tag, Scissors, Layers, ScanFace, Globe, Plus,
  Heart, User as UserIcon, Baby, Users, PartyPopper, Briefcase, Home,
  Shirt, UtensilsCrossed, Mountain, MapPin, Trophy, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useImageProcessing } from "@/hooks/useImageProcessing";
import { UploadSourceSelector, type UploadSource } from "./UploadSourceSelector";
import { GoogleDriveInput, type DriveFolderInfo } from "./GoogleDriveInput";
import { useSubscription } from "@/hooks/useSubscription";
import { useShowcaseCovers } from "@/hooks/useShowcaseCovers";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { getCullingLabels, supportedLanguages, type LanguageCode } from "@/lib/cullingLabels";

const MAX_LOOKS = 3;

// Shoot types (with icons) — mirrors the create-collection page so the shoot
// type here seeds the same curated culling tags.
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

const curatedTags = (type: string, lang: LanguageCode) => getCullingLabels(type || "wedding", lang);

/** The AI mark — 4-point sparkle (the logo star), royal blue via currentColor. */
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

// Live-plan pill — same language as the create-collection page.
function Pill({ children, accent = false, danger = false }: { children: React.ReactNode; accent?: boolean; danger?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
      danger
        ? "border-destructive/50 bg-destructive/10 text-destructive"
        : accent
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-surface-2 text-muted-foreground",
    )}>
      {children}
    </span>
  );
}

// Selection indicator — filled check when chosen, empty ring otherwise.
function SelectMark({ on }: { on: boolean }) {
  return on ? (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span>
  ) : (
    <span className="h-5 w-5 shrink-0 rounded-full border border-muted-foreground/40" aria-hidden />
  );
}

// One AI-model tile — mirrors the create-collection LookTile so the two flows
// feel identical: cover fills the tile, name overlaid, sparkle for no-cover.
function LookTile({ name, cover, on, locked, mine = false, recommended = false, onClick }: {
  name: string;
  cover?: string;
  on: boolean;
  locked: boolean;
  mine?: boolean;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      title={name}
      className={cn(
        "group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-[--radius] border text-left transition-all",
        on
          ? "border-primary ring-1 ring-inset ring-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.10)]"
          : "border-border hover:border-primary/50",
        locked && "cursor-not-allowed opacity-45 hover:border-border",
      )}
    >
      {cover ? (
        <img src={getThumbnailUrl(cover)} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-surface-2">
          <span className="absolute inset-0 bg-gradient-to-br from-primary/30 to-transparent" />
          <Sparkle size={18} className="relative text-primary" />
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-1.5 pb-1.5 pt-5">
        <span className="flex items-center gap-1">
          <Sparkle size={8} className={mine ? "text-primary" : "text-accent"} />
          <span className="truncate text-[11px] font-semibold leading-tight text-white">{name}</span>
        </span>
      </span>
      <span className="absolute right-1.5 top-1.5"><SelectMark on={on} /></span>
      {recommended && !on && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary-foreground shadow">Pick</span>
      )}
    </button>
  );
}

// Inline culling-tag picker — curated labels for the shoot type + custom
// additions, capped at 20 (mirrors the create-collection page).
function CullingTags({ type, language, value, onChange }: {
  type: string;
  language: LanguageCode;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const curated = getCullingLabels(type || "wedding", language);
  const all = [...curated, ...value.filter((v) => !curated.includes(v))];
  const toggle = (label: string) => {
    if (value.includes(label)) onChange(value.filter((v) => v !== label));
    else if (value.length < 20) onChange([...value, label]);
  };
  const addCustom = () => {
    const t = custom.trim();
    if (t && !value.includes(t) && value.length < 20) { onChange([...value, t]); setCustom(""); }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {all.map((label) => {
          const on = value.includes(label);
          const locked = value.length >= 20 && !on;
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              disabled={locked}
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-all active:scale-95",
                on ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-surface-2 text-foreground/80 hover:border-primary/50 hover:text-foreground",
                locked && "cursor-not-allowed opacity-50",
              )}
            >
              {on && <Check className="h-2.5 w-2.5" strokeWidth={2.5} />}
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Add your own label…"
          disabled={value.length >= 20}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2.5 text-base outline-none transition-colors focus:border-primary/50 sm:text-xs"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim() || value.length >= 20}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface AddImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  galleryId: string;
  galleryName: string;
  onDriveConfirm?: (styleIds: string[], driveLink: string, folderInfo: DriveFolderInfo) => void;
  onUploadComplete?: (count: number) => void;
}

export function AddImagesModal({
  isOpen,
  onClose,
  galleryId,
  galleryName,
  onDriveConfirm,
  onUploadComplete,
}: AddImagesModalProps) {
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  // The look isn't pre-picked — the photographer must explicitly choose a look
  // or "No editing", mirroring the create-collection flow.
  const [styleTouched, setStyleTouched] = useState(false);
  const [uploadSource, setUploadSource] = useState<UploadSource>("local");
  const [driveLinks, setDriveLinks] = useState<string[]>([]);
  const [driveFolderInfo, setDriveFolderInfo] = useState<DriveFolderInfo | null>(null);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);

  // Culling config — same knobs as the create-collection flow, so the
  // photographer confirms how the NEW photos get culled (not silently reuse
  // whatever the gallery was set to). Seeded from the gallery's current
  // settings when the modal opens, editable here, and persisted on confirm.
  const [type, setType] = useState("wedding");
  const [cull, setCull] = useState(false);
  const [cullGrouping, setCullGrouping] = useState(false);
  const [cullFaces, setCullFaces] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [cullingLanguage, setCullingLanguage] = useState<LanguageCode>("en");
  // Guards the initial seed from being clobbered by the tag-sync effect, so the
  // gallery's existing custom labels survive until the user changes shoot type.
  const seededSettings = useState(() => ({ done: false }))[0];

  const navigate = useNavigate();
  const { user } = useAuth();
  const { uppy, uploadImages, uploadProgress, isUploading: hookIsUploading } = useImageUpload();
  const uppyFileCount = useUppyState(uppy, (state) => Object.keys(state.files).length);
  const { processImages } = useImageProcessing();
  const { availableEdits, editsReserved, isUnlimited, isFreePlan, canEdit, isSuspended, isExpired } = useSubscription();

  // Crash-recovery / dedupe: when this modal opens for an existing
  // gallery, pull the filenames already uploaded so we can detect
  // when a user re-selects them after a tab crash / lost connection.
  const { data: existingFilenames } = useQuery({
    queryKey: ["gallery-existing-filenames", galleryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("filename")
        .eq("gallery_id", galleryId)
        .neq("status", "deleted");
      if (error) {
        console.error("Failed to fetch existing filenames:", error);
        return new Set<string>();
      }
      return new Set((data ?? []).map((r: any) => r.filename as string));
    },
    enabled: isOpen && !!galleryId,
    staleTime: 30_000,
  });

  // The gallery's current culling config — seeds the culling card so the
  // toggles reflect how this collection is already set up.
  const { data: gallerySettings } = useQuery({
    queryKey: ["gallery-culling-settings", galleryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("galleries")
        .select("gallery_type, ai_culling_enabled, ai_grouping_enabled, ai_faces_enabled, culling_labels")
        .eq("id", galleryId)
        .single();
      return data as any;
    },
    enabled: isOpen && !!galleryId,
    staleTime: 30_000,
  });

  // Seed the culling card from the gallery once its settings load.
  useEffect(() => {
    if (!isOpen || !gallerySettings) return;
    setType(gallerySettings.gallery_type || "wedding");
    setCull(!!gallerySettings.ai_culling_enabled);
    setCullGrouping(gallerySettings.ai_grouping_enabled ?? true);
    setCullFaces(!!gallerySettings.ai_faces_enabled);
    setCategories(gallerySettings.culling_labels || []);
    seededSettings.done = true;
  }, [isOpen, gallerySettings, seededSettings]);

  // The photographer's preferred culling-label language (persisted per user).
  useEffect(() => {
    if (!isOpen || !user) return;
    supabase
      .from("user_subscriptions")
      .select("preferred_language")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.preferred_language) setCullingLanguage(data.preferred_language as LanguageCode);
      });
  }, [isOpen, user]);

  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    duplicateIds: string[];
    duplicateNames: string[];
    newCount: number;
  } | null>(null);

  // Edit calculations
  const imageCount = uploadSource === "drive" ? (driveFolderInfo?.totalImageCount || 0) : uppyFileCount;
  const stylesCount = selectedStyles.length;
  const editsNeeded = imageCount * stylesCount;
  const hasInsufficientEdits = !isUnlimited && editsNeeded > availableEdits;
  const maxImages = isUnlimited ? Infinity : (stylesCount > 0 ? Math.floor(availableEdits / stylesCount) : 0);
  const remaining = Math.max(0, availableEdits - editsNeeded);
  const usedPct = availableEdits > 0 ? Math.min(100, Math.round((editsNeeded / availableEdits) * 100)) : (editsNeeded > 0 ? 100 : 0);

  const isProcessing = isUploadingLocal || hookIsUploading;

  // Detect filenames the user is re-uploading — fired whenever Uppy
  // ingests a batch from drag-drop / file picker. We collect the
  // duplicates and surface a dialog: "skip duplicates" or "upload
  // anyway". This is the crash-recovery story — if a 3000-photo
  // upload was interrupted halfway, the user can drop the same folder
  // and we'll only push what's missing.
  useEffect(() => {
    if (!uppy || !existingFilenames) return;
    const handleFilesAdded = (files: any[]) => {
      const dupes: { id: string; name: string }[] = [];
      let newCount = 0;
      files.forEach((f) => {
        const name = f.name ?? "";
        if (name && existingFilenames.has(name)) {
          dupes.push({ id: f.id, name });
        } else {
          newCount++;
        }
      });
      if (dupes.length === 0) return;
      setDuplicatePrompt({
        duplicateIds: dupes.map((d) => d.id),
        duplicateNames: dupes.map((d) => d.name),
        newCount,
      });
    };
    uppy.on("files-added", handleFilesAdded);
    return () => {
      uppy.off("files-added", handleFilesAdded);
    };
  }, [uppy, existingFilenames]);

  const handleSkipDuplicates = () => {
    if (!duplicatePrompt) return;
    duplicatePrompt.duplicateIds.forEach((id) => {
      try {
        uppy.removeFile(id);
      } catch (err) {
        console.error("Failed to remove duplicate from Uppy:", err);
      }
    });
    toast.info(`Skipped ${duplicatePrompt.duplicateIds.length} files already uploaded.`);
    setDuplicatePrompt(null);
  };

  const handleUploadDuplicatesAnyway = () => {
    setDuplicatePrompt(null);
  };

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

  const { data: showcaseCovers = {} } = useShowcaseCovers({ enabled: isOpen });

  // The photographer's own trained models vs the public Aura looks — same split
  // as the create-collection look grid so the two flows read identically.
  const mine = styles.filter((s: any) => user?.id != null && s.user_id === user.id && s.status === "ready");
  const aura = styles.filter((s: any) => !(user?.id != null && s.user_id === user.id));
  const bestId = styles[0]?.id;
  const hosting = styleTouched && selectedStyles.length === 0;

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStyles([]);
      setStyleTouched(false);
      uppy.cancelAll();
      setUploadSource("local");
      setDriveLinks([]);
      setDriveFolderInfo(null);
      setIsUploadingLocal(false);
      seededSettings.done = false;
    }
  }, [isOpen, uppy, seededSettings]);

  // Explicit shoot-type / language changes reseed the curated culling tags
  // (matches the create-collection page). The initial gallery seed is protected
  // by seededSettings so stored custom labels aren't wiped on open.
  const changeType = (value: string) => {
    setType(value);
    if (cull && seededSettings.done) setCategories(curatedTags(value, cullingLanguage));
  };
  const changeLanguage = (lang: LanguageCode) => {
    setCullingLanguage(lang);
    if (user) {
      supabase
        .from("user_subscriptions")
        .update({ preferred_language: lang })
        .eq("user_id", user.id)
        .then(({ error }) => { if (error) console.error("Failed to save language preference:", error); });
    }
    if (cull && seededSettings.done) setCategories(curatedTags(type, lang));
  };
  const toggleCull = () => setCull((on) => {
    const next = !on;
    // Turning culling on with no labels yet → seed the curated set for the type.
    if (next && categories.length === 0) setCategories(curatedTags(type, cullingLanguage));
    return next;
  });

  const toggleStyle = (styleId: string) => {
    setStyleTouched(true);
    setSelectedStyles(prev => {
      if (prev.includes(styleId)) return prev.filter(id => id !== styleId);
      if (prev.length >= MAX_LOOKS) {
        toast.error(`Maximum ${MAX_LOOKS} styles allowed`);
        return prev;
      }
      return [...prev, styleId];
    });
  };
  const pickHosting = () => {
    setStyleTouched(true);
    setSelectedStyles([]);
  };

  // The culling labels that actually drive the cull — the picked tags, or the
  // curated set for the shoot type if culling is on but none were picked.
  const effectiveLabels = () =>
    cull
      ? (categories.length > 0 ? categories : curatedTags(type, cullingLanguage))
      : [];

  // Persist the confirmed culling config onto the gallery so both the incremental
  // culling below AND the Drive transfer webhook use exactly what the user set
  // here (not a stale gallery setting).
  const persistCullingSettings = async (gId: string) => {
    await supabase
      .from("galleries")
      .update({
        gallery_type: type,
        ai_culling_enabled: cull,
        ai_grouping_enabled: cullGrouping,
        ai_faces_enabled: cull && cullFaces,
        culling_labels: effectiveLabels(),
      } as any)
      .eq("id", gId);
  };

  // Re-run AI culling incrementally after new photos land. Re-arms the
  // compression barrier (so it waits for the NEW photos to compress — the old
  // ones already are), flips culling back to "processing", and dispatches the
  // pipeline with the confirmed culling config. process-pipeline skips any image
  // that already has a score/embedding/faces, so only the new photos cost
  // VLM/GPU. No-op when culling is off.
  const triggerIncrementalCulling = async (gId: string) => {
    if (!cull) return;
    try {
      await supabase
        .from("galleries")
        .update({
          compression_started_at: null,
          compression_completed_at: null,
          compression_ready_count: 0,
          compression_total_count: 0,
          culling_status: "processing",
          culling_completed_at: null,
        } as any)
        .eq("id", gId);

      // Admin-configured VLM model + EXIF time gate.
      let adminModel: string | undefined;
      let adminTime = 600;
      try {
        const { data: cfgRow } = await supabase
          .from("platform_settings").select("value").eq("key", "culling_config").single();
        if (cfgRow?.value) {
          const cfg = JSON.parse(cfgRow.value);
          if (typeof cfg.model === "string") adminModel = cfg.model;
          if (typeof cfg.timeThreshold === "number") adminTime = cfg.timeThreshold;
        }
      } catch { /* fall back to defaults */ }

      void supabase.functions.invoke("await-compression", {
        body: {
          galleryId: gId,
          options: {
            culling: true,
            tags: true,
            cluster: cullGrouping,
            faces: cullFaces,
            labels: effectiveLabels(),
            thresholds: [0.5, 0.7, 0.9],
            timeThreshold: adminTime,
            ...(adminModel ? { model: adminModel } : {}),
            scoreVisionUrl: `${window.location.origin}/api/score-vision`,
          },
        },
      });
    } catch (err) {
      console.error("Incremental culling trigger failed (non-fatal):", err);
    }
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
      // Persist the confirmed culling config first so the Drive transfer webhook
      // auto-starts culling with exactly what the user set here.
      await persistCullingSettings(galleryId);
      if (onDriveConfirm) {
        onDriveConfirm(selectedStyles, driveLinks[0], driveFolderInfo);
      }
      return;
    }

    // Local file upload — files already in Uppy state
    if (uppyFileCount === 0) {
      toast.error("Please add at least one image");
      return;
    }
    if (hasInsufficientEdits) {
      toast.error("Not enough credits for this upload");
      return;
    }

    setIsUploadingLocal(true);

    try {
      // Stream uploaded batches into AI processing as they finish so
      // editing starts within seconds, not after the full upload.
      const streamedProcessedIds = new Set<string>();
      const imageIds = await uploadImages(galleryId, user.id, undefined, {
        onBatchInserted: (newIds) => {
          if (selectedStyles.length === 0 || newIds.length === 0) return;
          const fresh = newIds.filter((id) => !streamedProcessedIds.has(id));
          if (fresh.length === 0) return;
          fresh.forEach((id) => streamedProcessedIds.add(id));
          (async () => {
            try {
              await supabase
                .from("gallery_images")
                .update({ status: "processing" })
                .in("id", fresh)
                .eq("status", "uploading");
              processImages(galleryId, fresh, selectedStyles);
            } catch (err) {
              console.error("Streaming processImages batch failed:", err);
            }
          })();
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

        // Persist the confirmed culling config, then rate/group/detect the NEW
        // photos if culling is on. The pipeline is incremental — it only
        // scores/embeds/detects images that don't have those outputs yet — so
        // this spends VLM/GPU on the new photos ONLY; grouping + face clustering
        // re-run over the gallery (cheap, reusing stored vectors) so the new
        // photos join existing bursts/people.
        await persistCullingSettings(galleryId);
        await triggerIncrementalCulling(galleryId);

        // Process any IDs that weren't streamed (last partial batch).
        if (selectedStyles.length > 0) {
          const remainingIds = imageIds.filter((id) => !streamedProcessedIds.has(id));
          if (remainingIds.length > 0) {
            await supabase
              .from("gallery_images")
              .update({ status: "processing" })
              .in("id", remainingIds)
              .eq("status", "uploading");
            processImages(galleryId, remainingIds, selectedStyles);
          }
          toast.success(`${imageIds.length} images uploaded! AI processing started...`);
        } else {
          await supabase
            .from("gallery_images")
            .update({ status: "ready" })
            .in("id", imageIds);
          toast.success(`${imageIds.length} images uploaded successfully!`);
        }
      }

      onUploadComplete?.(imageIds.length);
      onClose();
    } catch (error: any) {
      console.error("Error uploading images:", error);
      toast.error(error.message || "Failed to upload images");
    } finally {
      setIsUploadingLocal(false);
    }
  };

  if (!isOpen) return null;

  const looksLabel = !styleTouched
    ? "choose a look"
    : stylesCount === 0
      ? "Hosting only"
      : stylesCount === 1
        ? (styles.find((s: any) => s.id === selectedStyles[0])?.name ?? "1 look")
        : `${stylesCount} looks`;

  const canSubmit =
    !isProcessing &&
    canEdit &&
    !hasInsufficientEdits &&
    styleTouched &&
    (uploadSource === "local" ? uppyFileCount > 0 : !!driveFolderInfo);

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={!isProcessing ? onClose : undefined}
    >
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        className="flex max-h-[90vh] w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="glass-card flex max-h-[90vh] w-full flex-col rounded-[--radius] border-border">
          {/* Header — collection name + live-plan pills, mirroring the create page */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[--radius] border border-border bg-primary/10">
                <Images className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <span className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={11} /> Add to collection</span>
                <h2 className="truncate text-lg font-bold leading-tight">{galleryName}</h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill><Images className="h-3 w-3" /> {imageCount ? `${imageCount.toLocaleString()} new` : "no photos yet"}</Pill>
              <Pill>{looksLabel}</Pill>
              <Pill>{cull ? "Culling on" : "No culling"}</Pill>
              <Pill accent={!hasInsufficientEdits} danger={hasInsufficientEdits}>
                <Sparkle size={11} /> {isUnlimited ? `${editsNeeded.toLocaleString()} edits` : `${editsNeeded.toLocaleString()} / ${availableEdits.toLocaleString()} edits`}
              </Pill>
              {!isProcessing && (
                <Button variant="ghost" size="icon" onClick={onClose} className="ml-1"><X className="h-5 w-5" /></Button>
              )}
            </div>
          </div>

          {/* Body — two working columns, each scrolls internally so the modal
              itself never grows. Locked once upload starts. */}
          <div
            className={cn(
              "grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
              isProcessing && "pointer-events-none select-none opacity-60",
            )}
          >
            {/* LEFT — photos (top) + culling (bottom), mirrors the create page */}
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
              {/* Photos */}
              <div className="glass-card flex flex-col rounded-[--radius] p-4">
                <div className="caption mb-2.5 shrink-0">Photos</div>

                {/* Subscription warnings */}
                {!canEdit && (isSuspended || isExpired) && (
                  <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Your subscription is {isSuspended ? "suspended" : "expired"}. Please update your plan.</span>
                    </div>
                  </div>
                )}
                {isFreePlan && availableEdits === 0 && (
                  <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>You've used all 3,000 free edits.</span>
                      </div>
                      <Button size="sm" variant="default" className="ml-3 shrink-0" onClick={() => navigate("/dashboard/billing")}>
                        Upgrade Plan
                      </Button>
                    </div>
                  </div>
                )}

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
                  disabled={isProcessing}
                />

                {uploadSource === "drive" ? (
                  <div className="mt-3">
                    <GoogleDriveInput
                      folderInfo={driveFolderInfo}
                      onUpdate={(info, links) => {
                        setDriveFolderInfo(info);
                        setDriveLinks(links);
                      }}
                      disabled={isProcessing}
                    />
                  </div>
                ) : (
                  <div className="mt-3">
                    <UppyUploadArea
                      uppy={uppy}
                      maxFiles={!isUnlimited && stylesCount > 0 ? maxImages : undefined}
                      disabled={isProcessing}
                    />
                  </div>
                )}

                {/* Aggregate upload progress */}
                {uploadSource === "local" && (
                  <AnimatePresence>
                    {isProcessing && uploadProgress && (() => {
                      const totalBytes = uploadProgress.totalBytes;
                      const uploadedBytes = uploadProgress.bytesUploaded;
                      const percentage = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
                      const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
                      return (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 space-y-2 overflow-hidden rounded-xl border border-border/50 bg-muted/50 p-3"
                        >
                          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                            <motion.div
                              className="h-full rounded-full bg-primary animate-neon-pulse"
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate text-muted-foreground">
                              Uploading: <span className="font-medium text-foreground">{uploadProgress.currentFile}</span>
                            </span>
                            <span className="shrink-0 font-medium text-primary">
                              {percentage}% — {formatMB(uploadedBytes)} / {formatMB(totalBytes)} MB
                            </span>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                )}

                {/* Only-the-new-photos note — reassures that adding images
                    won't re-spend on the existing collection. */}
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.05] p-3 text-xs text-muted-foreground">
                  <Sparkle size={13} className="mt-0.5 shrink-0 text-primary" />
                  <span>
                    Only the new photos are processed. If culling is on below, the new photos are rated, grouped &amp; face-tagged and slotted into your existing groups — your current photos and edits aren't touched.
                  </span>
                </div>
              </div>{/* end Photos card */}

              {/* Culling — same knobs as the create-collection flow, so the
                  new photos are culled exactly how you confirm here. Seeded
                  from the collection's current settings. */}
              <div className={cn("glass-card rounded-[--radius] transition-colors", cull && "border-primary/40")}>
                {/* Shoot type — seeds the auto culling tags */}
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="caption flex items-center gap-1.5"><Tag className="h-3 w-3" /> Shoot type</div>
                    <div className="text-[11px] text-muted-foreground/70">Seeds what Aura looks for</div>
                  </div>
                  <Select value={type} onValueChange={changeType}>
                    <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {galleryTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-2"><t.icon className="h-3.5 w-3.5" strokeWidth={1.75} /> {t.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="border-t border-border/60" />
                <button type="button" onClick={toggleCull} className="flex w-full items-center gap-3 p-4 text-left">
                  <div className={cn("grid h-9 w-9 place-items-center rounded-[--radius]", cull ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <Scissors className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Cull {cull ? "· on" : "· off"}</div>
                    <div className="caption">{cull ? "Aura rates & tags the new photos before editing" : "no culling — keep every new photo"}</div>
                  </div>
                  <span className={cn("h-6 w-11 rounded-full p-0.5 transition-colors", cull ? "bg-primary" : "bg-muted")}>
                    <motion.span layout className="block h-5 w-5 rounded-full bg-white shadow" style={{ marginLeft: cull ? "auto" : 0 }} />
                  </span>
                </button>
                {cull && (
                  <div className="space-y-2.5 border-t border-border/60 p-4 pt-3">
                    <button type="button" onClick={() => setCullGrouping((v) => !v)} className="flex w-full items-center gap-2.5 text-left">
                      <Layers className={cn("h-3.5 w-3.5", cullGrouping ? "text-primary" : "text-muted-foreground")} />
                      <span className="caption flex-1 text-foreground">Group similar images</span>
                      <span className={cn("h-6 w-11 rounded-full p-0.5 transition-colors", cullGrouping ? "bg-primary" : "bg-muted")}>
                        <motion.span layout className="block h-5 w-5 rounded-full bg-white shadow" style={{ marginLeft: cullGrouping ? "auto" : 0 }} />
                      </span>
                    </button>
                    <button type="button" onClick={() => setCullFaces((v) => !v)} className="flex w-full items-center gap-2.5 text-left">
                      <ScanFace className={cn("h-3.5 w-3.5", cullFaces ? "text-primary" : "text-muted-foreground")} />
                      <span className="caption flex-1 text-foreground">
                        Recognize people (faces)
                        <span className="ms-1.5 text-muted-foreground/60">heavier step</span>
                      </span>
                      <span className={cn("h-6 w-11 rounded-full p-0.5 transition-colors", cullFaces ? "bg-primary" : "bg-muted")}>
                        <motion.span layout className="block h-5 w-5 rounded-full bg-white shadow" style={{ marginLeft: cullFaces ? "auto" : 0 }} />
                      </span>
                    </button>
                    <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                      <div className="caption flex items-center gap-1.5">
                        <Tag className="h-3 w-3" /> What should I look for?
                        <span className="text-primary">{categories.length}<span className="text-muted-foreground/50">/20</span></span>
                      </div>
                      <Select value={cullingLanguage} onValueChange={(v) => changeLanguage(v as LanguageCode)}>
                        <SelectTrigger className="h-8 w-[150px] text-xs"><Globe className="h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {supportedLanguages.map((lang) => (
                            <SelectItem key={lang.code} value={lang.code} className="text-xs">{lang.name} ({lang.englishName})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <CullingTags type={type} language={cullingLanguage} value={categories} onChange={setCategories} />
                  </div>
                )}
              </div>{/* end Culling card */}
            </div>{/* end LEFT column */}

            {/* RIGHT — choose your AI look, full height */}
            <div className="flex min-h-0 flex-col">
              <div className="aura-ai-border glass-card flex min-h-0 flex-1 flex-col rounded-[--radius] p-4">
                <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Sparkle size={13} className="text-primary" /> Choose your AI look
                    </div>
                    <p className="caption mt-1">A trained AI model edits every new photo in this look — pick up to {MAX_LOOKS}.</p>
                  </div>
                  {stylesCount > 0 && <span className="aura-microlabel shrink-0 text-primary">{stylesCount}/{MAX_LOOKS}</span>}
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {mine.length > 0 && (
                    <div className="space-y-2">
                      <div className="aura-microlabel flex items-center gap-1.5 text-primary"><Sparkle size={10} /> Your AI models</div>
                      <div className="grid grid-cols-3 gap-2">
                        {mine.map((s: any) => (
                          <LookTile
                            key={s.id}
                            name={s.name}
                            cover={showcaseCovers[s.id] || s.thumbnail_url || s.after_image_urls?.[0]}
                            on={selectedStyles.includes(s.id)}
                            locked={stylesCount >= MAX_LOOKS && !selectedStyles.includes(s.id)}
                            mine
                            recommended={s.id === bestId}
                            onClick={() => toggleStyle(s.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {aura.length > 0 && (
                    <div className="space-y-2">
                      {mine.length > 0 && <div className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={10} /> Aura looks</div>}
                      <div className="grid grid-cols-3 gap-2">
                        {aura.map((s: any) => (
                          <LookTile
                            key={s.id}
                            name={s.name}
                            cover={showcaseCovers[s.id] || s.thumbnail_url || s.after_image_urls?.[0]}
                            on={selectedStyles.includes(s.id)}
                            locked={stylesCount >= MAX_LOOKS && !selectedStyles.includes(s.id)}
                            recommended={s.id === bestId}
                            onClick={() => toggleStyle(s.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {styles.length === 0 && (
                    <p className="caption">No AI models available yet — add &amp; host as-is below, or train your own look later.</p>
                  )}

                  {/* Opt-out — dashed + separated so it never competes with the AI models. */}
                  <div className="pt-0.5">
                    <div className="aura-hairline mb-2" />
                    <button
                      type="button"
                      onClick={pickHosting}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-[--radius] border border-dashed p-2 text-left transition-colors",
                        hosting ? "border-primary bg-primary/10 ring-1 ring-inset ring-primary" : "border-border/70 hover:border-primary/40 hover:bg-surface-2/40",
                      )}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-2 text-muted-foreground"><Ban className="h-4 w-4" strokeWidth={1.5} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">No editing</span>
                        <span className="caption block">Add &amp; host as-is · 0 edits</span>
                      </span>
                      <SelectMark on={hosting} />
                    </button>
                  </div>
                </div>

                {stylesCount >= 1 && (
                  <p className="caption mt-3 shrink-0">{imageCount.toLocaleString()} photos × {stylesCount} look{stylesCount > 1 ? "s" : ""} = {editsNeeded.toLocaleString()} edits</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer — credits + the action, spanning both columns */}
          <div className="flex flex-col gap-3 border-t border-border/50 p-4 lg:flex-row lg:items-stretch lg:justify-between">
            {/* Credits */}
            <div className="glass-card min-w-0 flex-1 rounded-[--radius] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-sm font-semibold"><Sparkle size={12} className="text-accent" /> Edits these photos will use</span>
                <span className="font-mono text-sm font-semibold">{isUnlimited ? editsNeeded.toLocaleString() : `${editsNeeded.toLocaleString()} / ${availableEdits.toLocaleString()}`}</span>
              </div>
              {isUnlimited ? (
                <p className="caption mt-1.5">Unlimited edits on your plan — add as many as you like.</p>
              ) : (
                <>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-[width] duration-300", hasInsufficientEdits ? "bg-destructive" : "bg-primary")} style={{ width: `${usedPct}%` }} />
                  </div>
                  <p className="caption mt-1.5">
                    {stylesCount === 0 ? (
                      "Hosting only — no edits used."
                    ) : (
                      <>{imageCount.toLocaleString()} photos × {stylesCount} look{stylesCount > 1 ? "s" : ""} = <span className="font-medium text-foreground">{editsNeeded.toLocaleString()} edits</span> · {remaining.toLocaleString()} left after
                        {editsReserved > 0 && <span className="ml-1 text-muted-foreground/70">({editsReserved.toLocaleString()} reserved)</span>}</>
                    )}
                  </p>
                </>
              )}
              {!isUnlimited && hasInsufficientEdits && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-[--radius] border border-destructive/40 bg-destructive/[0.06] p-2.5 text-sm">
                  <span className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Not enough edits — max {Number.isFinite(maxImages) ? maxImages.toLocaleString() : "—"} photos with {stylesCount} look{stylesCount > 1 ? "s" : ""}.
                  </span>
                  <Button size="sm" variant="glow" className="shrink-0" onClick={() => navigate("/dashboard/billing")}>Upgrade</Button>
                </div>
              )}
            </div>

            {/* Action */}
            <div className="lg:flex lg:w-[320px] lg:shrink-0 lg:flex-col lg:justify-center">
              {isProcessing ? (
                <div className="space-y-3 rounded-[--radius] border border-border bg-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Uploading your photos…
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress && uploadProgress.totalBytes > 0 ? Math.round((uploadProgress.bytesUploaded / uploadProgress.totalBytes) * 100) : 100}%` }}
                      transition={{ ease: "easeOut", duration: 0.4 }}
                    />
                  </div>
                  {uploadProgress?.currentFile && (
                    <p className="truncate text-xs text-muted-foreground">Receiving {uploadProgress.currentFile}</p>
                  )}
                </div>
              ) : (
                <div>
                  <Button variant="glow" size="lg" disabled={!canSubmit} className="w-full gap-2" onClick={handleConfirm}>
                    {uploadSource === "drive" ? <CloudIcon className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                    {uploadSource === "drive" ? "Import & process" : (stylesCount > 0 ? "Upload & start editing" : "Upload & host")}
                  </Button>
                  <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
                    {canSubmit
                      ? "Only the new photos are added & processed"
                      : styleTouched ? "Add photos to continue" : "Pick a look (or “No editing”) to continue"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>

      {/* AlertDialog must NOT be inside the backdrop motion.div above:
          Radix portals the dialog into document.body for layout, but
          React events still bubble through the component tree, so a
          click on any AlertDialog button bubbles up to the backdrop's
          onClick={onClose} and closes the whole modal. Sibling
          placement under the Fragment breaks that bubbling path. */}
      <AlertDialog open={!!duplicatePrompt} onOpenChange={(open) => !open && setDuplicatePrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Already uploaded {duplicatePrompt?.duplicateIds.length ?? 0} of these photos
            </AlertDialogTitle>
            <AlertDialogDescription>
              {duplicatePrompt && duplicatePrompt.newCount > 0
                ? `${duplicatePrompt.duplicateIds.length} files match photos already in this gallery, and ${duplicatePrompt.newCount} are new. Skip the duplicates and only upload the new ones, or upload everything anyway (will create duplicate entries)?`
                : `${duplicatePrompt?.duplicateIds.length ?? 0} files all match photos already in this gallery. Upload them again anyway?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDuplicatePrompt(null)}>Cancel</Button>
            <Button variant="ghost" onClick={handleUploadDuplicatesAnyway}>
              Upload all
            </Button>
            <Button onClick={handleSkipDuplicates}>
              {duplicatePrompt && duplicatePrompt.newCount > 0
                ? `Skip ${duplicatePrompt.duplicateIds.length}, upload ${duplicatePrompt.newCount} new`
                : "Skip all duplicates"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
