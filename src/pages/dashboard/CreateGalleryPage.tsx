import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Baby,
  Ban,
  Briefcase,
  Check,
  Globe,
  Heart,
  Home,
  Images,
  Loader2,
  MapPin,
  Mountain,
  PartyPopper,
  Pencil,
  Plus,
  Scissors,
  Shirt,
  Sparkles as SparklesIcon,
  Tag,
  Trophy,
  UploadCloud,
  User as UserIcon,
  Users,
  UtensilsCrossed,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { useCreateGalleryFlow } from "@/hooks/useCreateGalleryFlow";
import { useOnboardingQuestionnaire } from "@/hooks/useOnboardingQuestionnaire";
import { getCullingLabels, supportedLanguages, type LanguageCode } from "@/lib/cullingLabels";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { IMAGE_ACCEPT, isImageFile } from "@/lib/imageFileTypes";
import { UploadSourceSelector, type UploadSource } from "@/components/gallery/UploadSourceSelector";
import { GoogleDriveInput, type DriveFolderInfo } from "@/components/gallery/GoogleDriveInput";

// ── The "New collection" create flow ────────────────────────────────────────
// A single live-plan page (the chosen "C3 / Plan-first" design): the plan leads
// at the top — collection name, a summary of what will happen, and the Create
// button — and the editable controls sit in a balanced column below. Everything
// recalculates live from the real photo count. Wired to the real backend via
// useCreateGalleryFlow (upload + AI editing + culling + Google Drive import).

const MAX_LOOKS = 3;

// How many preview object URLs to build up front. Generous enough to fully
// review a typical shoot; larger selections show the rest as removable tiles.
const PREVIEW_CAP = 500;

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

// Onboarding shoot-type ids (plural) → wizard galleryType values. Used to seed
// a smart default; "wildlife"/"other" have no clean equivalent (left unmapped).
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
};

type StyleRow = ReturnType<typeof useCreateGalleryFlow>["styles"][number];

// One selected photo: the File plus a preview object URL (null for RAW/HEIC the
// browser can't render, or beyond the preview cap).
interface SelImg { file: File; url: string | null }

// RAW/HEIC can't render as <img>; only build previews from web-renderable ones.
const isPreviewable = (f: File) => f.type.startsWith("image/") && !/heic|heif/i.test(f.type);

const curatedTags = (type: string, lang: LanguageCode) => getCullingLabels(type || "wedding", lang);

// Rank styles for the shoot type: tag/category match first, then presets.
function rankStyles(styles: StyleRow[], type: string): StyleRow[] {
  const t = type.toLowerCase();
  const score = (s: StyleRow) => {
    const tagHit = (s.associated_tags ?? []).some((tag) => tag.toLowerCase().includes(t));
    const catHit = (s.category ?? "").toLowerCase().includes(t);
    if (tagHit || catHit) return 0;
    if (s.is_preset) return 1;
    return 2;
  };
  return [...styles].sort((a, b) => score(a) - score(b));
}

// Recursively collect every File from a drag-drop, including dropped folders, so
// a photographer can drag a whole shoot folder in (no browser folder prompt).
async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items || []);
  const entries = items
    .map((it) => it.webkitGetAsEntry?.() ?? null)
    .filter((e): e is FileSystemEntry => !!e);
  if (entries.length === 0) return Array.from(dt.files || []);
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      await new Promise<void>((res) => (entry as FileSystemFileEntry).file((f) => { out.push(f); res(); }, () => res()));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const readBatch = () => new Promise<FileSystemEntry[]>((res) => reader.readEntries((e) => res(e), () => res([])));
      let batch = await readBatch();
      while (batch.length) {
        for (const e of batch) await walk(e);
        batch = await readBatch();
      }
    }
  };
  for (const e of entries) await walk(e);
  return out;
}

export default function CreateGalleryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    user,
    styles,
    submit,
    busy,
    isUploading,
    uploadProgress,
    availableEdits,
    isUnlimited,
    isFreePlan,
    cullingLanguage,
    setCullingLanguage,
  } = useCreateGalleryFlow();
  const { answers: onboardingAnswers, allQuestions: onboardingQuestions } = useOnboardingQuestionnaire();

  const [name, setName] = useState("");
  const [type, setType] = useState("wedding");
  const [typeTouched, setTypeTouched] = useState(false);
  const [items, setItems] = useState<SelImg[]>([]);
  const [styleIds, setStyleIds] = useState<string[]>([]);
  const [styleTouched, setStyleTouched] = useState(false);
  const [cull, setCull] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [uploadSource, setUploadSource] = useState<UploadSource>("local");
  const [driveFolderInfo, setDriveFolderInfo] = useState<DriveFolderInfo | null>(null);
  const [driveLinks, setDriveLinks] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  useEffect(() => () => { objectUrls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  // Progressive disclosure — sections appear as the previous one is filled, and
  // the page eases down to each newly revealed section so it never feels long.
  const lookSectionRef = useRef<HTMLDivElement>(null);
  const finalSectionRef = useRef<HTMLDivElement>(null);
  const prevPhotos = useRef(0);
  const prevTouched = useRef(false);

  // ── Prefills ───────────────────────────────────────────────────────────────
  // Aura hand-off (⌘K "start a collection named X") → ?name=
  const prefillName = searchParams.get("name");
  useEffect(() => {
    if (prefillName) setName((prev) => prev || prefillName);
  }, [prefillName]);

  // "Use this style" deep link → ?styleId=
  const preStyleId = searchParams.get("styleId");
  useEffect(() => {
    if (preStyleId) {
      setStyleIds([preStyleId]);
      setStyleTouched(true);
    }
  }, [preStyleId]);

  // Smart-default the shoot type from the onboarding questionnaire, unless the
  // user has already picked one (manually or via a deep link).
  useEffect(() => {
    if (typeTouched) return;
    const shootQuestion = onboardingQuestions.find((q) => q.question_key === "photography_types");
    if (!shootQuestion) return;
    const answer = onboardingAnswers.find((a) => a.question_id === shootQuestion.id);
    const picked: string[] = Array.isArray(answer?.answer) ? answer.answer : [];
    if (picked.length === 0) return;
    const valid = new Set(galleryTypes.map((t) => t.value));
    const match = picked.map((id) => ONBOARDING_TO_GALLERY_TYPE[id]).find((v) => v && valid.has(v));
    if (match) setType(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingQuestions, onboardingAnswers]);

  // Keep culling tags in sync with the shoot type + language while culling is on
  // (mirrors the curated set the photographer would see in the classic wizard).
  useEffect(() => {
    if (cull) setCategories(curatedTags(type, cullingLanguage));
  }, [type, cullingLanguage, cull]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const photos = uploadSource === "drive" ? (driveFolderInfo?.totalImageCount || 0) : items.length;
  const previews = useMemo(
    () => items.map((it) => it.url).filter((u): u is string => !!u),
    [items],
  );
  const rankedStyles = useMemo(() => rankStyles(styles, type), [styles, type]);
  const selectedStyles = useMemo(
    () => styleIds.map((id) => styles.find((s) => s.id === id)).filter((s): s is StyleRow => !!s),
    [styleIds, styles],
  );
  const looksCount = styleIds.length;
  const editsNeeded = photos * looksCount;
  const hasInsufficientEdits = !isUnlimited && editsNeeded > availableEdits;
  const maxImages = isUnlimited || looksCount === 0 ? Infinity : Math.floor(availableEdits / looksCount);
  const typeLabel = galleryTypes.find((t) => t.value === type)?.label ?? type;
  const remaining = Math.max(0, availableEdits - editsNeeded);
  const usedPct = availableEdits > 0 ? Math.min(100, Math.round((editsNeeded / availableEdits) * 100)) : (editsNeeded > 0 ? 100 : 0);
  // The look isn't pre-picked — the photographer must explicitly choose a look
  // or "No editing", so styleTouched is part of completeness.
  const complete = name.trim().length > 0 && photos > 0 && !!type && styleTouched && !hasInsufficientEdits;

  // ── Actions ──────────────────────────────────────────────────────────────
  const ingest = (list: FileList | File[] | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter(isImageFile);
    if (imgs.length === 0) return;
    objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrls.current = [];
    let made = 0;
    const next: SelImg[] = imgs.map((f) => {
      let url: string | null = null;
      if (isPreviewable(f) && made < PREVIEW_CAP) {
        url = URL.createObjectURL(f);
        objectUrls.current.push(url);
        made++;
      }
      return { file: f, url };
    });
    setItems(next);
    if (!name.trim()) {
      const mid = imgs.map((f) => f.lastModified).filter(Boolean).sort((a, b) => a - b)[Math.floor(imgs.length / 2)];
      const d = mid ? new Date(mid) : new Date();
      setName(`Shoot · ${d.toLocaleString("en-US", { month: "long", year: "numeric" })}`);
    }
  };

  const removeAt = (index: number) => {
    setItems((prev) => {
      const target = prev[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const changeType = (value: string) => {
    setType(value);
    setTypeTouched(true);
  };

  const toggleStyle = (id: string) => {
    setStyleTouched(true);
    setStyleIds((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= MAX_LOOKS) return prev;
      return [...prev, id];
    });
  };
  const pickHosting = () => {
    setStyleTouched(true);
    setStyleIds([]);
  };

  const toggleCull = () => setCull((on) => !on);

  const onSourceChange = (next: UploadSource) => {
    setUploadSource(next);
    if (next === "local") setDrive(null, []);
  };
  const setDrive = (info: DriveFolderInfo | null, links: string[]) => {
    setDriveFolderInfo(info);
    setDriveLinks(links);
  };

  const handleCreate = () => {
    submit({
      name: name.trim(),
      galleryType: type,
      styleIds,
      aiCulling: cull,
      categories: cull ? categories : [],
      cullingLanguage,
      source: uploadSource === "drive"
        ? { kind: "drive", links: driveLinks, totalImageCount: driveFolderInfo?.totalImageCount || 0, totalSizeMB: driveFolderInfo?.totalSizeMB || 0 }
        : { kind: "local", files: items.map((it) => it.file) },
    });
  };

  // Leave guard — don't silently drop staged photos / an in-flight upload.
  const hasUnsavedWork = photos > 0 || busy;
  const handleLeave = () => {
    if (hasUnsavedWork) setShowLeaveConfirm(true);
    else navigate("/dashboard/galleries");
  };
  useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);

  useEffect(() => { if (photos === 0) setReviewOpen(false); }, [photos]);

  // Ease down to the look section the first time photos are added…
  useEffect(() => {
    const was = prevPhotos.current;
    prevPhotos.current = photos;
    if (was === 0 && photos > 0) {
      const id = setTimeout(() => lookSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      return () => clearTimeout(id);
    }
  }, [photos]);

  // …and to the culling/credits/create section once a look choice is made.
  useEffect(() => {
    const was = prevTouched.current;
    prevTouched.current = styleTouched;
    if (!was && styleTouched) {
      const id = setTimeout(() => finalSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      return () => clearTimeout(id);
    }
  }, [styleTouched]);

  const pct = uploadProgress && uploadProgress.totalBytes > 0
    ? Math.round((uploadProgress.bytesUploaded / uploadProgress.totalBytes) * 100)
    : 0;
  const looksLabel = !styleTouched
    ? "choose a look"
    : looksCount === 0
      ? "Hosting only"
      : looksCount === 1
        ? (selectedStyles[0]?.name ?? "1 look")
        : `${looksCount} looks`;

  return (
    <div className="min-h-full bg-background px-4 py-8 lg:px-8">
      <input ref={inputRef} type="file" multiple accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => ingest(e.target.files)} />

      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleLeave} aria-label="Back to collections">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <span className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={11} /> New collection</span>
            <h1 className="text-2xl font-bold tracking-tight">Plan your shoot</h1>
          </div>
        </div>

        {/* Plan hero — name, live summary, and the create action */}
        <div className="glass-card mt-6 rounded-[--radius] p-6">
          <span className="aura-microlabel flex items-center gap-1.5 text-accent"><SparklesIcon className="h-3 w-3" /> Live plan</span>
          {/* Editable title — a subtle field + pencil so it clearly reads as
              renameable (not a static heading), on desktop and mobile alike. */}
          <div className="group relative mt-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md bg-surface-2/40 py-1.5 pl-3 pr-11 text-3xl font-bold tracking-tight outline-none ring-1 ring-inset ring-border/60 transition-colors placeholder:text-muted-foreground/40 hover:bg-surface-2/70 hover:ring-border focus:bg-surface-2 focus:ring-primary/60"
              placeholder="Untitled shoot"
              aria-label="Collection name"
            />
            <Pencil className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 transition-colors group-hover:text-foreground/70" />
          </div>
          <p className="caption mt-1.5 pl-1">Tap to rename</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Pill><Images className="h-3 w-3" /> {photos ? `${photos.toLocaleString()} photos` : "no photos yet"}</Pill>
            <Pill>{typeLabel}</Pill>
            <Pill>{looksLabel}</Pill>
            <Pill>{cull ? "Culling on" : "No culling"}</Pill>
            <Pill accent={!hasInsufficientEdits} danger={hasInsufficientEdits}>
              <Sparkle size={11} /> {isUnlimited ? `${editsNeeded.toLocaleString()} edits` : `${editsNeeded.toLocaleString()} / ${availableEdits.toLocaleString()} edits`}
            </Pill>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-5 space-y-5">
          {/* Photos */}
          <div className="glass-card rounded-[--radius] p-5">
            <div className="caption mb-2.5">Photos</div>
            <UploadSourceSelector value={uploadSource} onChange={onSourceChange} disabled={busy} />
            {uploadSource === "drive" ? (
              <div className="mt-3">
                <GoogleDriveInput folderInfo={driveFolderInfo} onUpdate={setDrive} disabled={busy} />
              </div>
            ) : photos > 0 ? (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Images className="h-3.5 w-3.5" /> {photos.toLocaleString()} photos selected
                  <button type="button" onClick={() => inputRef.current?.click()} className="text-accent hover:underline">change</button>
                  <span className="text-muted-foreground/40">·</span>
                  <button type="button" onClick={() => setReviewOpen(true)} className="text-accent hover:underline">review &amp; remove</button>
                </div>
                {previews.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {previews.slice(0, 6).map((src, i) => (
                      <button key={i} type="button" onClick={() => setReviewOpen(true)} className="overflow-hidden rounded-md ring-1 ring-border transition hover:ring-primary/60" aria-label="Review selected photos">
                        <img src={src} alt="" className="h-12 w-12 object-cover" />
                      </button>
                    ))}
                    {photos > Math.min(6, previews.length) && (
                      <button
                        type="button"
                        onClick={() => setReviewOpen(true)}
                        className="grid h-12 w-12 place-items-center rounded-md border border-border bg-surface-2 text-xs font-semibold text-foreground/80 transition hover:border-primary/50 hover:text-foreground"
                        aria-label="See all selected photos"
                      >
                        +{(photos - Math.min(6, previews.length)).toLocaleString()}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void filesFromDataTransfer(e.dataTransfer).then(ingest); }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-[--radius] border-2 border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
              >
                <UploadCloud className="h-4 w-4" /> Select or drag your photos (or a whole folder)
              </button>
            )}
          </div>

          {photos > 0 && (
          <motion.div
            ref={lookSectionRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
            className="scroll-mt-24 space-y-5"
          >
          {/* Shoot type */}
          <div className="glass-card rounded-[--radius] p-5">
            <div className="caption mb-2.5">Shoot type</div>
            <div className="flex flex-wrap gap-2">
              {galleryTypes.map((t) => {
                const on = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => changeType(t.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all active:scale-95",
                      on ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-surface-2 text-foreground/80 hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    <t.icon className="h-3.5 w-3.5" strokeWidth={1.75} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI editing model — the most important choice; given an AI-forward
              treatment (rotating royal-blue keyline) to feel like the engine. */}
          <div className="aura-ai-border glass-card rounded-[--radius] p-5">
            <div className="mb-3.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Sparkle size={13} className="text-primary" /> Choose your AI look
                </div>
                <p className="caption mt-1">A trained AI model edits every photo in this look — pick up to {MAX_LOOKS}.</p>
              </div>
              {looksCount > 0 && <span className="aura-microlabel shrink-0 text-primary">{looksCount}/{MAX_LOOKS}</span>}
            </div>
            <LookGrid
              styles={rankedStyles}
              selectedIds={styleIds}
              chosen={styleTouched}
              ownerId={user?.id}
              onToggle={toggleStyle}
              onHosting={pickHosting}
              max={MAX_LOOKS}
            />
            {looksCount >= 1 && (
              <p className="caption mt-3">{photos.toLocaleString()} photos × {looksCount} look{looksCount > 1 ? "s" : ""} = {editsNeeded.toLocaleString()} edits</p>
            )}
          </div>
          </motion.div>
          )}

          {styleTouched && (
          <motion.div
            ref={finalSectionRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
            className="scroll-mt-24 space-y-5"
          >
          {/* Culling */}
          <div className={cn("glass-card rounded-[--radius] transition-colors", cull && "border-primary/40")}>
            <button type="button" onClick={toggleCull} className="flex w-full items-center gap-3 p-5 text-left">
              <div className={cn("grid h-10 w-10 place-items-center rounded-[--radius]", cull ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Scissors className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">Cull {cull ? "· on" : "· off"}</div>
                <div className="caption">{cull ? "Aura ranks every frame & surfaces your best shots before editing" : "no culling — keep every photo"}</div>
              </div>
              <span className={cn("h-6 w-11 rounded-full p-0.5 transition-colors", cull ? "bg-primary" : "bg-muted")}>
                <motion.span layout className="block h-5 w-5 rounded-full bg-white shadow" style={{ marginLeft: cull ? "auto" : 0 }} />
              </span>
            </button>
            {cull && (
              <div className="space-y-3 border-t border-border/60 p-5 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="caption flex items-center gap-1.5">
                    <Tag className="h-3 w-3" /> What should I look for?
                    <span className="text-primary">{categories.length}<span className="text-muted-foreground/50">/20</span></span>
                  </div>
                  <Select value={cullingLanguage} onValueChange={(v) => setCullingLanguage(v as LanguageCode)}>
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
          </div>

          {/* Credits — make the cost tangible right where you decide */}
          <div className="glass-card rounded-[--radius] p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold"><Sparkle size={12} className="text-accent" /> Edits this collection will use</span>
              <span className="font-mono text-sm font-semibold">{isUnlimited ? editsNeeded.toLocaleString() : `${editsNeeded.toLocaleString()} / ${availableEdits.toLocaleString()}`}</span>
            </div>
            {isUnlimited ? (
              <p className="caption mt-2">Unlimited edits on your plan — edit as many as you like.</p>
            ) : (
              <>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-[width] duration-300", hasInsufficientEdits ? "bg-destructive" : "bg-primary")} style={{ width: `${usedPct}%` }} />
                </div>
                <p className="caption mt-2">
                  {looksCount === 0 ? (
                    "Hosting only — no edits used."
                  ) : (
                    <>{photos.toLocaleString()} photos × {looksCount} look{looksCount > 1 ? "s" : ""} = <span className="font-medium text-foreground">{editsNeeded.toLocaleString()} edits</span> · {remaining.toLocaleString()} left after</>
                  )}
                </p>
              </>
            )}

            {!isUnlimited && hasInsufficientEdits && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[--radius] border border-destructive/40 bg-destructive/[0.06] p-3 text-sm">
                <span className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Not enough edits — max {Number.isFinite(maxImages) ? maxImages.toLocaleString() : "—"} photos with {looksCount} look{looksCount > 1 ? "s" : ""}.
                </span>
                <Button size="sm" variant="glow" className="shrink-0" onClick={() => navigate("/dashboard/billing")}>Upgrade</Button>
              </div>
            )}
            {!isUnlimited && !hasInsufficientEdits && isFreePlan && availableEdits === 0 && looksCount > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                You're on the free plan with no edits left — pick "No editing" to host &amp; share, or{" "}
                <button className="text-primary hover:underline" onClick={() => navigate("/dashboard/billing")}>upgrade</button> to let Aura edit.
              </p>
            )}
          </div>

          {/* Create — greyed out until everything above is chosen */}
          {busy ? (
            <div className="space-y-3 rounded-[--radius] border border-border bg-card p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {isUploading ? "Uploading your photos…" : "Creating collection…"}
                </span>
                <span className="font-mono text-primary">{isUploading && uploadProgress ? `${uploadProgress.uploaded}/${uploadProgress.total}` : ""}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${isUploading ? pct : 100}%` }} transition={{ ease: "easeOut", duration: 0.4 }} />
              </div>
              {isUploading && uploadProgress?.currentFile && (
                <p className="truncate text-xs text-muted-foreground">Receiving {uploadProgress.currentFile} · {pct}%</p>
              )}
            </div>
          ) : (
            <div>
              <Button variant="glow" size="lg" disabled={!complete} className="w-full gap-2" onClick={handleCreate}>
                <Zap className="h-4 w-4" /> Create &amp; start editing
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
                {complete
                  ? "Creates a real collection & hands it to Aura"
                  : "Finish the steps above to continue"}
              </p>
            </div>
          )}
          </motion.div>
          )}
        </div>
      </div>

      {reviewOpen && <SelectedPhotosModal items={items} count={photos} onRemove={removeAt} onClose={() => setReviewOpen(false)} />}

      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without creating?</AlertDialogTitle>
            <AlertDialogDescription>Your selected photos won't be uploaded.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/dashboard/galleries")}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// The AI mark — a 4-point sparkle (the logo star), royal blue.
function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

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

function LookGrid({ styles, selectedIds, chosen, ownerId, onToggle, onHosting, max }: {
  styles: StyleRow[];
  selectedIds: string[];
  chosen: boolean;
  ownerId?: string | null;
  onToggle: (id: string) => void;
  onHosting: () => void;
  max: number;
}) {
  const atMax = selectedIds.length >= max;
  const hosting = chosen && selectedIds.length === 0;
  const bestId = styles[0]?.id;
  // The photographer's own trained AI models, kept distinct from the public
  // Aura models so it's clear which engine edits their photos.
  const isMine = (s: StyleRow) => ownerId != null && s.user_id === ownerId && s.status === "ready";
  const mine = styles.filter(isMine);
  const aura = styles.filter((s) => !(ownerId != null && s.user_id === ownerId));

  return (
    <div className="max-h-[360px] space-y-4 overflow-y-auto pr-1">
      {mine.length > 0 && (
        <div className="space-y-2">
          <div className="aura-microlabel flex items-center gap-1.5 text-primary"><Sparkle size={10} /> Your AI models</div>
          {mine.map((s) => (
            <LookRow key={s.id} style={s} on={selectedIds.includes(s.id)} locked={atMax && !selectedIds.includes(s.id)} mine recommended={s.id === bestId} onClick={() => onToggle(s.id)} />
          ))}
        </div>
      )}

      {aura.length > 0 && (
        <div className="space-y-2">
          {mine.length > 0 && <div className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={10} /> Aura looks</div>}
          {aura.map((s) => (
            <LookRow key={s.id} style={s} on={selectedIds.includes(s.id)} locked={atMax && !selectedIds.includes(s.id)} recommended={s.id === bestId} onClick={() => onToggle(s.id)} />
          ))}
        </div>
      )}

      {styles.length === 0 && (
        <p className="caption">No AI models available yet — host &amp; share as-is below, or train your own look later.</p>
      )}

      {/* Opt-out — dashed + separated so it never competes with the AI models. */}
      <div className="pt-1">
        <div className="aura-hairline mb-2.5" />
        <button
          type="button"
          onClick={onHosting}
          className={cn(
            "flex w-full items-center gap-3 rounded-[--radius] border border-dashed p-2.5 text-left transition-colors",
            hosting ? "border-primary bg-primary/10 ring-1 ring-inset ring-primary" : "border-border/70 hover:border-primary/40 hover:bg-surface-2/40",
          )}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-surface-2 text-muted-foreground"><Ban className="h-5 w-5" strokeWidth={1.5} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">No editing</span>
            <span className="caption block">Host &amp; share as-is · 0 edits</span>
          </span>
          <SelectMark on={hosting} />
        </button>
      </div>
    </div>
  );
}

// One AI-model row — premium, AI-forward (never says "preset"). No-cover models
// get a subtle royal-blue aura tile with the sparkle so they read as AI engines.
function LookRow({ style: s, on, locked, mine = false, recommended = false, onClick }: {
  style: StyleRow;
  on: boolean;
  locked: boolean;
  mine?: boolean;
  recommended?: boolean;
  onClick: () => void;
}) {
  const cover = s.thumbnail_url || s.after_image_urls?.[0];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[--radius] border p-2.5 text-left transition-all",
        on
          ? "border-primary bg-primary/10 ring-1 ring-inset ring-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.10)]"
          : "border-border hover:border-primary/40 hover:bg-surface-2/40",
        locked && "cursor-not-allowed opacity-45 hover:border-border hover:bg-transparent",
      )}
    >
      <span className="plate-keyline relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
        {cover ? (
          <img src={getThumbnailUrl(cover)} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="relative grid h-full w-full place-items-center bg-surface-2">
            <span className="absolute inset-0 bg-gradient-to-br from-primary/30 to-transparent" />
            <Sparkle size={15} className="relative text-primary" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{s.name}</span>
          {recommended && !on && <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">Aura pick</span>}
        </span>
        <span className="caption mt-0.5 flex items-center gap-1 truncate">
          <Sparkle size={9} className={mine ? "text-primary" : "text-accent"} />
          {mine ? "Your AI model" : s.category ? `Aura · ${s.category}` : "Aura AI model"}
        </span>
      </span>
      <SelectMark on={on} />
    </button>
  );
}

// Selection indicator for a look row — filled check when chosen, empty ring
// otherwise (signals each row is independently selectable).
function SelectMark({ on }: { on: boolean }) {
  return on ? (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span>
  ) : (
    <span className="h-5 w-5 shrink-0 rounded-full border border-muted-foreground/40" aria-hidden />
  );
}

// Inline culling-tag picker — curated labels for the shoot type + custom
// additions, capped at 20 (matches the classic wizard).
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
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
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
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                on ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-surface-2 text-foreground/80 hover:border-primary/50 hover:text-foreground",
                locked && "cursor-not-allowed opacity-50",
              )}
            >
              {on && <Check className="mr-1 inline h-3 w-3" strokeWidth={2.5} />}
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
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-3 text-base outline-none transition-colors focus:border-primary/50 sm:text-sm"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim() || value.length >= 20}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Full review grid — see every selected photo and drop ones picked by mistake.
function SelectedPhotosModal({ items, count, onRemove, onClose }: {
  items: SelImg[];
  count: number;
  onRemove: (index: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card flex max-h-[90vh] w-full max-w-5xl flex-col rounded-[--radius] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <span className="aura-microlabel text-accent">Review selection</span>
            <h2 className="text-lg font-semibold tracking-tight">{count.toLocaleString()} photos</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></Button>
        </div>
        <p className="caption mb-3">Hover a photo and tap ✕ to drop it before creating. RAW files show as a tile.</p>
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5 overflow-y-auto pr-1">
          {items.map((it, i) => (
            <div key={`${it.file.name}-${it.file.size}-${it.file.lastModified}`} className="group relative aspect-square overflow-hidden rounded-[5px] bg-surface-2">
              {it.url ? (
                <img src={it.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-center text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">RAW</div>
              )}
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label="Remove photo"
                className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-all hover:bg-destructive group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="caption">Click a tile's ✕ to remove · scroll for more</span>
          <Button variant="glow" onClick={onClose}>Done · {count.toLocaleString()} photos</Button>
        </div>
      </div>
    </div>
  );
}
