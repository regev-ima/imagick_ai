import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UploadCloud, Check, Ban, Pencil, Images, Scissors, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { useCreateGalleryFlow } from "@/hooks/useCreateGalleryFlow";
import { CullingTags, defaultCullingTags } from "./CullingTags";
import { UploadProgress, isPreviewable } from "./UploadProgress";
import { UploadSourceSelector, type UploadSource } from "@/components/gallery/UploadSourceSelector";
import { GoogleDriveInput, type DriveFolderInfo } from "@/components/gallery/GoogleDriveInput";
import { isImageFile as isImage, IMAGE_ACCEPT } from "@/lib/imageFileTypes";

function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

type Phase = "drop" | "analyzing" | "plan";
type FileWithPath = File & { webkitRelativePath?: string };

const TYPES: { value: string; label: string }[] = [
  { value: "wedding", label: "Wedding" },
  { value: "portrait", label: "Portrait" },
  { value: "event", label: "Event" },
  { value: "family", label: "Family" },
  { value: "newborn", label: "Newborn" },
  { value: "commercial", label: "Commercial" },
];

type StyleRow = ReturnType<typeof useCreateGalleryFlow>["styles"][number];

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

function titleCase(s: string) {
  return s.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
function deriveName(files: FileWithPath[]): string {
  const folder = files.find((f) => f.webkitRelativePath)?.webkitRelativePath?.split("/")[0];
  if (folder) return titleCase(folder);
  const ts = files.map((f) => f.lastModified).filter(Boolean).sort((a, b) => a - b);
  const d = ts.length ? new Date(ts[Math.floor(ts.length / 2)]) : new Date();
  return `Shoot · ${d.toLocaleString("en-US", { month: "long", year: "numeric" })}`;
}
function deriveDateLabel(files: File[]): string {
  const ts = files.map((f) => f.lastModified).filter(Boolean).sort((a, b) => a - b);
  if (!ts.length) return "";
  const a = new Date(ts[0]);
  const b = new Date(ts[ts.length - 1]);
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return a.toDateString() === b.toDateString()
    ? a.toLocaleDateString("en-US", opt)
    : `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${b.toLocaleDateString("en-US", opt)}`;
}

export default function CreateConceptPlan() {
  const navigate = useNavigate();
  const { styles, submit, busy, isUploading, uploadProgress, availableEdits, isUnlimited, cullingLanguage } = useCreateGalleryFlow();

  const [phase, setPhase] = useState<Phase>("drop");
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [galleryType, setGalleryType] = useState("wedding");
  const [styleId, setStyleId] = useState<string | null>(null);
  const [styleTouched, setStyleTouched] = useState(false);
  const [culling, setCulling] = useState(true);
  const [categories, setCategories] = useState<string[]>(() => defaultCullingTags("wedding"));
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadSource, setUploadSource] = useState<UploadSource>("local");
  const [driveFolderInfo, setDriveFolderInfo] = useState<DriveFolderInfo | null>(null);
  const [driveLinks, setDriveLinks] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => () => { objectUrls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  // Keep culling tags meaningful: when culling turns on (or the shoot type
  // changes while it's on) pre-fill the curated labels for that type.
  const toggleCulling = () =>
    setCulling((on) => {
      const next = !on;
      if (next) setCategories(defaultCullingTags(galleryType, cullingLanguage));
      return next;
    });
  const changeType = (value: string) => {
    setGalleryType(value);
    if (culling) setCategories(defaultCullingTags(value, cullingLanguage));
  };

  const count = uploadSource === "drive" ? (driveFolderInfo?.totalImageCount || 0) : files.length;
  const rankedStyles = rankStyles(styles, galleryType);
  // Exact only — edits = photos × looks (matches the real wizard). No
  // fabricated keepers/timing guesses.
  const stylesCount = styleId ? 1 : 0;
  const editsNeeded = count * stylesCount;

  // Aura pre-picks the top-ranked look once we reach the plan — the user can
  // tap any card to change it (or choose "No editing").
  useEffect(() => {
    if (phase === "plan" && !styleTouched && rankedStyles.length > 0) {
      setStyleId(rankedStyles[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, styles, galleryType]);

  const ingest = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const imgs = Array.from(list).filter(isImage) as FileWithPath[];
    if (imgs.length === 0) return;
    setFiles(imgs);
    // Previews feed the live upload filmstrip (capped, revoked on unmount).
    setPreviews(imgs.filter(isPreviewable).slice(0, 120).map((f) => {
      const url = URL.createObjectURL(f);
      objectUrls.current.push(url);
      return url;
    }));
    setName(deriveName(imgs));
    setDateLabel(deriveDateLabel(imgs));
    setPhase("analyzing");
    window.setTimeout(() => setPhase("plan"), 1200);
  };

  // Drive: once folders are linked, go straight to the plan (the transfer runs
  // server-side, so there's nothing to "read" locally).
  const continueWithDrive = (info: DriveFolderInfo | null) => {
    if (!info || info.folders.length === 0) return;
    setName(info.folders[0].folderName || "Imported shoot");
    setDateLabel("");
    setPhase("plan");
  };

  const reset = () => {
    setPhase("drop");
    setFiles([]);
    setPreviews([]);
    setName("");
    setDateLabel("");
    setCulling(true);
    setStyleId(null);
    setStyleTouched(false);
    setUploadSource("local");
    setDriveFolderInfo(null);
    setDriveLinks([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const pickStyle = (id: string | null) => {
    setStyleId(id);
    setStyleTouched(true);
  };

  const onCreate = () => {
    submit({
      name: name.trim() || "Untitled shoot",
      galleryType,
      styleIds: styleId ? [styleId] : [],
      aiCulling: culling,
      categories: culling ? categories : [],
      cullingLanguage,
      source: uploadSource === "drive"
        ? { kind: "drive", links: driveLinks, totalImageCount: driveFolderInfo?.totalImageCount || 0, totalSizeMB: driveFolderInfo?.totalSizeMB || 0 }
        : { kind: "local", files },
    });
  };

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => ingest(e.target.files)}
      />

      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/galleries")} aria-label="Back to galleries">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <span className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={11} /> Concept A · AI Plan</span>
            <h1 className="text-2xl font-bold tracking-tight">New collection</h1>
          </div>
        </div>

        <div className="mt-8">
          <AnimatePresence mode="wait">
            {(phase === "drop" || phase === "analyzing") && (
              <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
                {phase === "drop" && (
                  <UploadSourceSelector value={uploadSource} onChange={setUploadSource} disabled={busy} />
                )}

                {uploadSource === "drive" && phase === "drop" ? (
                  <div className="glass-card rounded-[--radius] p-6">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
                      <Sparkle size={13} className="text-accent" /> Import from Google Drive
                    </div>
                    <GoogleDriveInput folderInfo={driveFolderInfo} onUpdate={(info, links) => { setDriveFolderInfo(info); setDriveLinks(links); }} disabled={busy} />
                    {driveFolderInfo && driveFolderInfo.folders.length > 0 && (
                      <Button variant="glow" className="mt-4 w-full gap-2" onClick={() => continueWithDrive(driveFolderInfo)}>
                        <Sparkle size={14} className="text-accent-foreground" /> Continue — {driveFolderInfo.totalImageCount.toLocaleString()} photos
                      </Button>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={phase === "drop" ? () => inputRef.current?.click() : undefined}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (phase === "drop") ingest(e.dataTransfer.files); }}
                    className={`glass-card relative overflow-hidden rounded-[--radius] border-2 border-dashed border-border p-12 text-center transition-colors ${
                      phase === "drop" ? "cursor-pointer hover:border-primary/50 hover:bg-primary/[0.03]" : ""
                    }`}>
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                      {phase === "analyzing" ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
                    </div>
                    <h2 className="mt-4 text-xl font-semibold tracking-tight">
                      {phase === "analyzing" ? `Reading ${count.toLocaleString()} photos…` : "Drop your shoot — I'll handle the setup"}
                    </h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {phase === "analyzing" ? "Building your plan." : "RAW or JPG — drag them in or browse. No naming, no settings up front."}
                    </p>
                    {phase === "drop" && (
                      <div className="mt-6 flex flex-col items-center gap-2.5">
                        <Button variant="glow" className="gap-2" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
                          <UploadCloud className="h-4 w-4" /> Select photos
                        </Button>
                        <span className="text-xs text-muted-foreground/70">your real photos — they'll upload when you hit create</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {phase === "plan" && (
              <motion.div key="plan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkle size={14} className="text-accent" />
                  <span className="aura-microlabel text-accent">Aura's plan — confirm or tweak</span>
                </div>

                {/* Name + real stats + type */}
                <div className="glass-card rounded-[--radius] p-4">
                  <label htmlFor="plan-name" className="caption flex items-center gap-1.5">
                    Name <Pencil className="h-3 w-3" /> <span className="text-muted-foreground/60">(from your files — edit freely)</span>
                  </label>
                  <input
                    id="plan-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-0.5 w-full border-0 bg-transparent text-lg font-semibold tracking-tight outline-none"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <Images className="h-3 w-3" /> {count.toLocaleString()} photos
                    </span>
                    {dateLabel && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {dateLabel}
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="caption mb-1.5">Shoot type</div>
                    <div className="flex flex-wrap gap-1.5">
                      {TYPES.map((t) => (
                        <button key={t.value} type="button" onClick={() => changeType(t.value)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            galleryType === t.value ? "bg-primary text-primary-foreground" : "border border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                          }`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Look — tap a card to choose (Aura pre-picks the best match) */}
                <div className="glass-card rounded-[--radius] p-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="caption">Look — tap to choose</div>
                    <span className="caption">{styleId ? "editing on" : "hosting only"}</span>
                  </div>
                  {rankedStyles.length === 0 ? (
                    <p className="caption">No trained looks yet — I'll host your photos as-is. You can train your own look later.</p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {/* No-editing card */}
                      <button type="button" onClick={() => pickStyle(null)}
                        className={`relative w-[112px] shrink-0 overflow-hidden rounded-[--radius] border text-left transition-colors ${styleId === null ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/40"}`}>
                        <div className="grid h-[70px] w-full place-items-center bg-surface-2 text-muted-foreground"><Ban className="h-5 w-5" /></div>
                        <div className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium">
                          No editing {styleId === null && <Check className="h-3 w-3 text-primary" />}
                        </div>
                      </button>
                      {rankedStyles.map((s, i) => {
                        const cover = s.thumbnail_url || s.after_image_urls?.[0];
                        const on = styleId === s.id;
                        return (
                          <button key={s.id} type="button" onClick={() => pickStyle(s.id)}
                            className={`relative w-[112px] shrink-0 overflow-hidden rounded-[--radius] border text-left transition-colors ${on ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/40"}`}>
                            {cover ? (
                              <img src={getThumbnailUrl(cover)} alt="" className="h-[70px] w-full object-cover" />
                            ) : (
                              <div className="h-[70px] w-full bg-[image:var(--gradient-primary)]" />
                            )}
                            {i === 0 && (
                              <span className="absolute left-1 top-1 rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">Aura's pick</span>
                            )}
                            <div className="flex items-center gap-1 px-2 py-1.5">
                              <span className="truncate text-xs font-medium">{s.name}</span>
                              {on && <Check className="h-3 w-3 shrink-0 text-primary" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Culling + edits */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" onClick={toggleCulling}
                    className={`glass-card flex items-center gap-3 rounded-[--radius] p-4 text-left transition-colors ${culling ? "border-primary/40" : ""}`}>
                    <div className={`grid h-9 w-9 place-items-center rounded-[--radius] ${culling ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Scissors className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Cull first {culling ? "· on" : "· off"}</div>
                      <div className="caption">{culling ? "Aura surfaces the keepers first" : "edit everything"}</div>
                    </div>
                  </button>
                  <div className="glass-card flex items-center gap-3 rounded-[--radius] p-4">
                    <div className="grid h-9 w-9 place-items-center rounded-[--radius] bg-secondary/15 text-secondary"><Sparkle size={16} /></div>
                    <div>
                      <div className="text-sm font-semibold">{editsNeeded.toLocaleString()} edits</div>
                      <div className="caption">{stylesCount === 0 ? "hosting only — no edits" : isUnlimited ? "unlimited on your plan" : `${availableEdits.toLocaleString()} available`}</div>
                    </div>
                  </div>
                </div>

                {/* Culling tags — what Aura looks for (curated for the type) */}
                <AnimatePresence initial={false}>
                  {culling && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="glass-card rounded-[--radius] p-4">
                        <CullingTags galleryType={galleryType} language={cullingLanguage} value={categories} onChange={setCategories} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {busy ? (
                  <UploadProgress uploading={isUploading} progress={uploadProgress} total={count} previews={previews} />
                ) : (
                  <Button variant="glow" size="lg" className="mt-1 w-full gap-2" onClick={onCreate} disabled={count === 0}>
                    <Sparkle size={15} className="text-accent-foreground" /> Create &amp; start editing
                  </Button>
                )}
                {!busy && (
                  <button onClick={reset} className="caption mx-auto block pt-1 hover:text-foreground">← start over</button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground/70">
          <Images className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Concept A — drop your real photos; Aura proposes the plan and you confirm. This creates a real collection and starts editing. Counts and timing are computed on your device; the shoot type is a guess you can change.
        </p>
      </div>
    </div>
  );
}
