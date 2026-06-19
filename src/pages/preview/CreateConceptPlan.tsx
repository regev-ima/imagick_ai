import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UploadCloud, Check, ThumbsUp, ThumbsDown, Pencil, Images, Scissors, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { useCreateGalleryFlow } from "@/hooks/useCreateGalleryFlow";
import { CullingTags, defaultCullingTags } from "./CullingTags";

function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

type Phase = "drop" | "analyzing" | "plan";
type FileWithPath = File & { webkitRelativePath?: string };

const IMAGE_RE = /\.(jpe?g|png|heic|heif|tiff?|webp|cr2|cr3|nef|arw|raf|rw2|dng|orf|srw|pef)$/i;
const isImage = (f: File) => f.type.startsWith("image/") || IMAGE_RE.test(f.name);

const TYPES: { value: string; label: string }[] = [
  { value: "wedding", label: "Wedding" },
  { value: "portrait", label: "Portrait" },
  { value: "event", label: "Event" },
  { value: "family", label: "Family" },
  { value: "newborn", label: "Newborn" },
  { value: "commercial", label: "Commercial" },
];

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
  const [styleIdx, setStyleIdx] = useState(0);
  const [useStyle, setUseStyle] = useState(true);
  const [culling, setCulling] = useState(true);
  const [categories, setCategories] = useState<string[]>(() => defaultCullingTags("wedding"));
  const inputRef = useRef<HTMLInputElement>(null);

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

  const count = files.length;
  const style = styles.length ? styles[styleIdx % styles.length] : null;
  const keepers = Math.round(count * 0.25);
  const editCount = culling ? keepers : count;
  const readyHours = Math.max(1, Math.round(editCount / 600));
  const styleCover = style ? (style.thumbnail_url || style.after_image_urls?.[0]) : null;

  const ingest = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const imgs = Array.from(list).filter(isImage) as FileWithPath[];
    if (imgs.length === 0) return;
    setFiles(imgs);
    setName(deriveName(imgs));
    setDateLabel(deriveDateLabel(imgs));
    setPhase("analyzing");
    window.setTimeout(() => setPhase("plan"), 1200);
  };

  const reset = () => {
    setPhase("drop");
    setFiles([]);
    setName("");
    setDateLabel("");
    setCulling(true);
    setUseStyle(true);
    setStyleIdx(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onCreate = () => {
    submit({
      name: name.trim() || "Untitled shoot",
      galleryType,
      styleIds: useStyle && style ? [style.id] : [],
      aiCulling: culling,
      categories: culling ? categories : [],
      cullingLanguage,
      files,
    });
  };

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.cr2,.cr3,.nef,.arw,.raf,.rw2,.dng,.orf,.srw,.pef"
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
              <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}
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

                {/* Suggested style — real, from your library */}
                <div className="glass-card rounded-[--radius] p-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="caption">Suggested look</div>
                    <button type="button" onClick={() => setUseStyle((v) => !v)} className="caption text-accent hover:underline">
                      {useStyle ? "skip editing" : "add editing"}
                    </button>
                  </div>
                  {useStyle ? (
                    style ? (
                      <div className="flex items-center gap-3">
                        {styleCover ? (
                          <img src={getThumbnailUrl(styleCover)} alt="" className="h-12 w-12 shrink-0 rounded-[--radius] object-cover plate-keyline" />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-[--radius] bg-[image:var(--gradient-primary)] plate-keyline" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold tracking-tight">{style.name}</div>
                          <div className="caption truncate">{style.description || "Your trained look"}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button variant="glow" size="sm" className="gap-1.5 pointer-events-none"><ThumbsUp className="h-3.5 w-3.5" /> Use</Button>
                          <Button variant="outline" size="icon" aria-label="Suggest a different style"
                            disabled={styles.length < 2}
                            onClick={() => setStyleIdx((i) => (i + 1) % Math.max(styles.length, 1))}>
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="caption">No trained looks yet — your photos will be hosted as-is. Train a look later in the editor.</p>
                    )
                  ) : (
                    <p className="caption">Hosting only — no AI editing. Your photos upload and share as-is.</p>
                  )}
                </div>

                {/* Culling + ready */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" onClick={toggleCulling}
                    className={`glass-card flex items-center gap-3 rounded-[--radius] p-4 text-left transition-colors ${culling ? "border-primary/40" : ""}`}>
                    <div className={`grid h-9 w-9 place-items-center rounded-[--radius] ${culling ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Scissors className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Cull first {culling ? "· on" : "· off"}</div>
                      <div className="caption">{culling ? `~${keepers.toLocaleString()} keepers est.` : "edit everything"}</div>
                    </div>
                  </button>
                  <div className="glass-card flex items-center gap-3 rounded-[--radius] p-4">
                    <div className="grid h-9 w-9 place-items-center rounded-[--radius] bg-secondary/15 text-secondary"><Clock className="h-4 w-4" /></div>
                    <div>
                      <div className="text-sm font-semibold">Ready in ~{readyHours}h</div>
                      <div className="caption">I'll email you when done</div>
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

                {!isUnlimited && (
                  <p className="caption text-right">{availableEdits.toLocaleString()} edits available on your plan</p>
                )}

                <Button variant="glow" size="lg" className="mt-1 w-full gap-2" onClick={onCreate} disabled={busy || count === 0}>
                  {busy ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {isUploading ? uploadProgressLabel(uploadProgress) : "Creating…"}</>
                  ) : (
                    <><Sparkle size={15} className="text-accent-foreground" /> Create &amp; start editing</>
                  )}
                </Button>
                <button onClick={reset} disabled={busy} className="caption mx-auto block pt-1 hover:text-foreground disabled:opacity-50">← start over</button>
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

function uploadProgressLabel(p: { bytesUploaded: number; totalBytes: number } | null): string {
  if (!p || p.totalBytes <= 0) return "Uploading…";
  return `Uploading ${Math.round((p.bytesUploaded / p.totalBytes) * 100)}%`;
}
