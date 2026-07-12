import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Baby,
  Briefcase,
  Check,
  Globe,
  Heart,
  Home,
  Images,
  Layers,
  Loader2,
  MapPin,
  Mountain,
  PartyPopper,
  Pencil,
  Plus,
  ScanFace,
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
import { toast } from "sonner";
import { useCreateGalleryFlow } from "@/hooks/useCreateGalleryFlow";
import { useOnboardingQuestionnaire } from "@/hooks/useOnboardingQuestionnaire";
import { getCullingLabels, supportedLanguages, type LanguageCode } from "@/lib/cullingLabels";
import { LookGrid } from "@/components/gallery/LookGrid";
import { IMAGE_ACCEPT, isImageFile } from "@/lib/imageFileTypes";
import { LazyThumb } from "@/components/gallery/LazyThumb";
import { UploadSourceSelector, type UploadSource } from "@/components/gallery/UploadSourceSelector";
import { GoogleDriveInput, type DriveFolderInfo } from "@/components/gallery/GoogleDriveInput";
import { BuyCreditsModal } from "@/components/billing/BuyCreditsModal";
import { useCreditPricing, estimateGalleryCredits } from "@/hooks/useCreditPricing";

// ── The "New collection" create flow ────────────────────────────────────────
// A single live-plan page (the chosen "C3 / Plan-first" design): the plan leads
// at the top — collection name, a summary of what will happen, and the Create
// button — and the editable controls sit in a balanced column below. Everything
// recalculates live from the real photo count. Wired to the real backend via
// useCreateGalleryFlow (upload + AI editing + culling + Google Drive import).

const MAX_LOOKS = 3;

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

// One selected photo. Previews are built lazily per-tile by <LazyThumb> as it
// scrolls into view (RAW/HEIC show an extension placeholder) — so queuing
// thousands of files stays instant and memory-light.
interface SelImg { file: File }

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
  // Set true when Create is pressed with an empty name — highlights the field.
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState("wedding");
  const [typeTouched, setTypeTouched] = useState(false);
  const [items, setItems] = useState<SelImg[]>([]);
  const [styleIds, setStyleIds] = useState<string[]>([]);
  const [styleTouched, setStyleTouched] = useState(false);
  // All culling toggles start OFF — the photographer opts in explicitly.
  const [cull, setCull] = useState(false);
  // Culling sub-steps (mirror the AI Culling modal's toggles): grouping
  // collapses burst duplicates; faces powers the People view.
  const [cullGrouping, setCullGrouping] = useState(false);
  const [cullFaces, setCullFaces] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [uploadSource, setUploadSource] = useState<UploadSource>("local");
  const [driveFolderInfo, setDriveFolderInfo] = useState<DriveFolderInfo | null>(null);
  const [driveLinks, setDriveLinks] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const creditPricing = useCreditPricing();

  const inputRef = useRef<HTMLInputElement>(null);


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
  const rankedStyles = useMemo(() => rankStyles(styles, type), [styles, type]);
  const selectedStyles = useMemo(
    () => styleIds.map((id) => styles.find((s) => s.id === id)).filter((s): s is StyleRow => !!s),
    [styleIds, styles],
  );
  const looksCount = styleIds.length;
  // Full credit cost of the run — edits AND the metered AI steps (culling,
  // faces), so the plan the user approves is what the backend will charge.
  const editsNeeded = estimateGalleryCredits(creditPricing, photos, looksCount, cull, cull && cullFaces);
  const hasInsufficientEdits = !isUnlimited && editsNeeded > availableEdits;
  const creditsShort = hasInsufficientEdits ? editsNeeded - availableEdits : 0;
  // Affordability cap uses the FULL per-photo cost (edits + culling + faces),
  // so the cap always matches what the credits check will actually charge.
  const perPhotoCost = looksCount * creditPricing.ai_edit +
    (cull ? creditPricing.ai_culling : 0) +
    (cull && cullFaces ? creditPricing.face_recognition : 0);
  const maxImages = isUnlimited || perPhotoCost <= 0 ? Infinity : Math.floor(availableEdits / perPhotoCost);
  const typeLabel = galleryTypes.find((t) => t.value === type)?.label ?? type;
  const remaining = Math.max(0, availableEdits - editsNeeded);
  const usedPct = availableEdits > 0 ? Math.min(100, Math.round((editsNeeded / availableEdits) * 100)) : (editsNeeded > 0 ? 100 : 0);
  // The look isn't pre-picked — the photographer must explicitly choose a look
  // or "No editing", so styleTouched is part of completeness.
  const complete = name.trim().length > 0 && photos > 0 && !!type && styleTouched && !hasInsufficientEdits;

  // ── Actions ──────────────────────────────────────────────────────────────
  // A picked/dropped batch either REPLACES the current selection or ADDS to it.
  // "Add more" (and any drop while photos already exist) appends, so a
  // photographer can pull frames from several folders into one collection
  // instead of the picker wiping the previous folder each time.
  const ingest = (list: FileList | File[] | null, opts?: { append?: boolean }) => {
    if (!list) return;
    const imgs = Array.from(list).filter(isImageFile);
    if (imgs.length === 0) return;
    const append = opts?.append ?? false;

    setItems((prev) => {
      const base = append ? prev : [];
      // Dedup by identity so re-adding the same folder can't double-count.
      // No object URLs here — LazyThumb builds them per-tile on scroll, so
      // queuing thousands of files stays instant and light.
      const seen = new Set(base.map((it) => `${it.file.name}|${it.file.size}|${it.file.lastModified}`));
      const added: SelImg[] = [];
      for (const f of imgs) {
        const key = `${f.name}|${f.size}|${f.lastModified}`;
        if (seen.has(key)) continue;
        seen.add(key);
        added.push({ file: f });
      }
      return [...base, ...added];
    });

    if (!name.trim()) {
      const mid = imgs.map((f) => f.lastModified).filter(Boolean).sort((a, b) => a - b)[Math.floor(imgs.length / 2)];
      const d = mid ? new Date(mid) : new Date();
      setName(`Shoot · ${d.toLocaleString("en-US", { month: "long", year: "numeric" })}`);
    }
  };

  // The hidden <input> is reused for both "change" and "add more"; a ref carries
  // which mode the next change event should use.
  const pickAppendRef = useRef(false);
  const openPicker = (append: boolean) => {
    pickAppendRef.current = append;
    inputRef.current?.click();
  };

  const removeAt = (index: number) => {
    // No URL to revoke — LazyThumb owns each tile's object URL and revokes it
    // on unmount when the tile is removed.
    setItems((prev) => prev.filter((_, i) => i !== index));
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
      grouping: cullGrouping,
      faces: cullFaces,
      categories: cull ? categories : [],
      cullingLanguage,
      source: uploadSource === "drive"
        ? { kind: "drive", links: driveLinks, totalImageCount: driveFolderInfo?.totalImageCount || 0, totalSizeMB: driveFolderInfo?.totalSizeMB || 0 }
        : { kind: "local", files: items.map((it) => it.file) },
    });
  };

  // Validate on click so a missing required field gives clear feedback instead
  // of a silently dead button.
  const attemptCreate = () => {
    if (busy) return;
    const missing: string[] = [];
    if (name.trim().length === 0) missing.push("a collection name");
    if (photos === 0) missing.push(uploadSource === "drive" ? "a Drive folder" : "photos");
    if (!styleTouched) missing.push("a look (or “No editing”)");
    if (missing.length > 0) {
      toast.error(`Add ${missing.join(", ")} to continue.`);
      if (name.trim().length === 0) {
        setNameError(true);
        nameInputRef.current?.focus();
      }
      return;
    }
    if (hasInsufficientEdits) {
      toast.error(`You're ${creditsShort.toLocaleString()} credits short — buy credits or pick “No editing”.`);
      return;
    }
    handleCreate();
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
    <div className="min-h-full bg-background lg:h-full lg:overflow-hidden">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          ingest(e.target.files, { append: pickAppendRef.current });
          // Clear so re-picking the SAME folder still fires onChange.
          e.target.value = "";
        }}
      />

      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-5 lg:h-full lg:min-h-0 lg:px-8">
        {/* Header + live plan — a header microlabel on its own line, then ONE
            aligned row: back · editable name · summary pills. Keeping the name
            field and pills on the same centered row makes the top bar read as
            symmetric (the microlabel used to push the name below the pills). */}
        <div>
          <span className="aura-microlabel flex items-center gap-1.5 text-accent"><SparklesIcon className="h-3 w-3" /> New collection · live plan</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={handleLeave} aria-label="Back to collections">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="group relative min-w-0 flex-1">
              <input
                ref={nameInputRef}
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(false); }}
                disabled={busy}
                aria-label="Collection name"
                aria-invalid={nameError}
                className={cn(
                  "w-full rounded-md bg-surface-2/40 py-1 pl-2.5 pr-10 text-2xl font-bold tracking-tight outline-none ring-1 ring-inset transition-colors placeholder:text-muted-foreground/40 hover:bg-surface-2/70 focus:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60",
                  nameError
                    ? "ring-destructive/70 focus:ring-destructive placeholder:text-destructive/50"
                    : "ring-border/60 hover:ring-border focus:ring-primary/60",
                )}
                placeholder={nameError ? "Name your collection to continue…" : "Untitled shoot"}
              />
              <Pencil className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50 transition-colors group-hover:text-foreground/70" />
            </div>
            <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
              <Pill><Images className="h-3 w-3" /> {photos ? `${photos.toLocaleString()} photos` : "no photos yet"}</Pill>
              <Pill>{typeLabel}</Pill>
              <Pill>{looksLabel}</Pill>
              <Pill>{cull ? "Culling on" : "No culling"}</Pill>
              <Pill accent={!hasInsufficientEdits} danger={hasInsufficientEdits}>
                <Sparkle size={11} /> {isUnlimited ? `${editsNeeded.toLocaleString()} edits` : `${editsNeeded.toLocaleString()} / ${availableEdits.toLocaleString()} edits`}
              </Pill>
            </div>
          </div>
        </div>

        {/* Two working columns that fit the viewport — each scrolls internally
            so the page itself never scrolls on desktop. */}
        <div
          aria-disabled={busy}
          className={cn(
            "mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-[minmax(0,1fr)]",
            // Once upload/creation starts the plan is locked in — freeze every
            // control so nothing can be changed mid-flight.
            busy && "pointer-events-none select-none opacity-60",
          )}
        >
          {/* LEFT — top half: photo selection · bottom half: culling */}
          <div className="flex min-h-0 flex-col gap-4">
          {/* Top half — photo selection (roomier now the shoot-type chips moved) */}
          <div className="flex min-h-0 flex-1 flex-col">
          {/* Photos */}
          <div className="glass-card flex min-h-0 flex-1 flex-col rounded-[--radius] p-5">
            <div className="caption mb-2.5 shrink-0">Photos</div>
            <UploadSourceSelector value={uploadSource} onChange={onSourceChange} disabled={busy} />
            {uploadSource === "drive" ? (
              <div className="mt-3">
                <GoogleDriveInput folderInfo={driveFolderInfo} onUpdate={setDrive} disabled={busy} />
              </div>
            ) : photos > 0 ? (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Images className="h-3.5 w-3.5" /> {photos.toLocaleString()} photos selected
                  <button type="button" onClick={() => openPicker(true)} className="text-accent hover:underline">add more</button>
                  <span className="text-muted-foreground/40">·</span>
                  <button type="button" onClick={() => openPicker(false)} className="text-accent hover:underline">replace</button>
                  <span className="text-muted-foreground/40">·</span>
                  <button type="button" onClick={() => setReviewOpen(true)} className="text-accent hover:underline">review &amp; remove</button>
                </div>
                {items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {items.slice(0, 6).map((it, i) => (
                      <button key={i} type="button" onClick={() => setReviewOpen(true)} className="relative block h-12 w-12 overflow-hidden rounded-md ring-1 ring-border transition hover:ring-primary/60" aria-label="Review selected photos">
                        <LazyThumb file={it.file} />
                      </button>
                    ))}
                    {photos > 6 && (
                      <button
                        type="button"
                        onClick={() => setReviewOpen(true)}
                        className="grid h-12 w-12 place-items-center rounded-md border border-border bg-surface-2 text-xs font-semibold text-foreground/80 transition hover:border-primary/50 hover:text-foreground"
                        aria-label="See all selected photos"
                      >
                        +{(photos - 6).toLocaleString()}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openPicker(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void filesFromDataTransfer(e.dataTransfer).then((f) => ingest(f, { append: false })); }}
                className="mt-3 flex min-h-[160px] w-full flex-1 flex-col items-center justify-center gap-2 rounded-[--radius] border-2 border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
              >
                <UploadCloud className="h-6 w-6" /> Select or drag your photos (or a whole folder)
              </button>
            )}
          </div>

          </div>{/* end top half */}

          {/* Bottom half — culling (with the shoot type that seeds its tags) */}
          <div className="shrink-0">
          {/* Culling */}
          <div className={cn("glass-card rounded-[--radius] transition-colors", cull && "border-primary/40")}>
            {/* Shoot type — a compact dropdown that seeds the auto culling tags,
                so it lives with culling instead of eating a whole row of chips. */}
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="caption flex items-center gap-1.5"><Tag className="h-3 w-3" /> Shoot type</div>
                <div className="text-[11px] text-muted-foreground/70">Seeds what Aura looks for</div>
              </div>
              <Select value={type} onValueChange={(v) => changeType(v)}>
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
                <div className="caption">{cull ? "Aura ranks every frame & surfaces your best shots before editing" : "no culling — keep every photo"}</div>
              </div>
              <span className={cn("h-6 w-11 rounded-full p-0.5 transition-colors", cull ? "bg-primary" : "bg-muted")}>
                <motion.span layout className="block h-5 w-5 rounded-full bg-white shadow" style={{ marginLeft: cull ? "auto" : 0 }} />
              </span>
            </button>
            {cull && (
              <div className="space-y-2.5 border-t border-border/60 p-4 pt-3">
                {/* Culling sub-steps — same options as the in-gallery AI Culling
                    modal, in this card's design language. */}
                <button
                  type="button"
                  onClick={() => setCullGrouping((v) => !v)}
                  className="flex w-full items-center gap-2.5 text-left"
                >
                  <Layers className={cn("h-3.5 w-3.5", cullGrouping ? "text-primary" : "text-muted-foreground")} />
                  <span className="caption flex-1 text-foreground">Group similar images</span>
                  <span className={cn("h-6 w-11 rounded-full p-0.5 transition-colors", cullGrouping ? "bg-primary" : "bg-muted")}>
                    <motion.span layout className="block h-5 w-5 rounded-full bg-white shadow" style={{ marginLeft: cullGrouping ? "auto" : 0 }} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCullFaces((v) => !v)}
                  className="flex w-full items-center gap-2.5 text-left"
                >
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

          </div>{/* end bottom half */}
          </div>{/* end LEFT column */}

          {/* RIGHT — choose your AI look, full height */}
          <div className="flex min-h-0 flex-col">
          <div className="aura-ai-border glass-card flex min-h-0 flex-1 flex-col rounded-[--radius] p-5">
            <div className="mb-3.5 flex shrink-0 items-start justify-between gap-3">
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
              <p className="caption mt-3 shrink-0">{photos.toLocaleString()} photos × {looksCount} look{looksCount > 1 ? "s" : ""}{cull ? " + culling" : ""}{cull && cullFaces ? " + faces" : ""} = {editsNeeded.toLocaleString()} credits</p>
            )}
          </div>
          </div>
        </div>{/* end grid */}

        {/* Footer — cost + the create action, spanning both columns */}
        <div className="mt-4 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between">
          {/* Credits */}
          <div className="glass-card min-w-0 flex-1 rounded-[--radius] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold"><Sparkle size={12} className="text-accent" /> Edits this collection will use</span>
              <span className="font-mono text-sm font-semibold">{isUnlimited ? editsNeeded.toLocaleString() : `${editsNeeded.toLocaleString()} / ${availableEdits.toLocaleString()}`}</span>
            </div>
            {isUnlimited ? (
              <p className="caption mt-1.5">Unlimited edits on your plan — edit as many as you like.</p>
            ) : (
              <>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-[width] duration-300", hasInsufficientEdits ? "bg-destructive" : "bg-primary")} style={{ width: `${usedPct}%` }} />
                </div>
                <p className="caption mt-1.5">
                  {looksCount === 0 ? (
                    "Hosting only — no edits used."
                  ) : (
                    <>{photos.toLocaleString()} photos × {looksCount} look{looksCount > 1 ? "s" : ""}{cull ? " + culling" : ""}{cull && cullFaces ? " + faces" : ""} = <span className="font-medium text-foreground">{editsNeeded.toLocaleString()} credits</span> · {remaining.toLocaleString()} left after</>
                  )}
                </p>
              </>
            )}
            {!isUnlimited && hasInsufficientEdits && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-[--radius] border border-destructive/40 bg-destructive/[0.06] p-2.5 text-sm">
                <span className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {creditsShort.toLocaleString()} credits short for this plan.
                </span>
                <span className="flex shrink-0 gap-2">
                  <Button size="sm" variant="glow" onClick={() => setShowBuyCredits(true)}>Buy credits</Button>
                  <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/billing")}>Upgrade</Button>
                </span>
              </div>
            )}
            {!isUnlimited && !hasInsufficientEdits && isFreePlan && availableEdits === 0 && looksCount > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                You're on the free plan with no edits left — pick "No editing" to host &amp; share, or{" "}
                <button className="text-primary hover:underline" onClick={() => navigate("/dashboard/billing")}>upgrade</button> to let Aura edit.
              </p>
            )}
          </div>

          {/* Create */}
          <div className="lg:flex lg:w-[320px] lg:shrink-0 lg:flex-col lg:justify-center">
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
              <Button variant="glow" size="lg" aria-disabled={!complete} className={cn("w-full gap-2", !complete && "opacity-60")} onClick={attemptCreate}>
                <Zap className="h-4 w-4" /> Create &amp; start editing
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
                {complete
                  ? "Creates a real collection & hands it to Aura"
                  : "Finish the steps above to continue"}
              </p>
            </div>
          )}
          </div>
        </div>
      </div>

      {reviewOpen && <SelectedPhotosModal items={items} count={photos} onRemove={removeAt} onClose={() => setReviewOpen(false)} />}

      {/* In-flow top-up — buy exactly what's missing without leaving the plan. */}
      <BuyCreditsModal
        isOpen={showBuyCredits}
        onClose={() => setShowBuyCredits(false)}
        neededCredits={creditsShort > 0 ? creditsShort : undefined}
      />


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
              <LazyThumb file={it.file} />
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
