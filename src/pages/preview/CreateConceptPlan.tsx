import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UploadCloud, Check, ThumbsUp, ThumbsDown, Pencil, Images, Scissors, Clock, Loader2, PartyPopper, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

type Phase = "drop" | "analyzing" | "plan" | "created";
type FileWithPath = File & { webkitRelativePath?: string };

// A real shoot is RAW + JPG; loose folders carry sidecars/junk we ignore.
const IMAGE_RE = /\.(jpe?g|png|heic|heif|tiff?|webp|cr2|cr3|nef|arw|raf|rw2|dng|orf|srw|pef)$/i;
const isImage = (f: File) => f.type.startsWith("image/") || IMAGE_RE.test(f.name);

const STYLES = [
  { name: "Warm Wedding", desc: "Soft warm tones · airy highlights · your trained style" },
  { name: "Clean Editorial", desc: "Neutral whites · crisp contrast · true-to-life" },
  { name: "Moody Film", desc: "Deep shadows · muted greens · analog grain" },
];

function titleCase(s: string) {
  return s.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveName(files: FileWithPath[]): string {
  // Prefer a real folder name when the browser hands us one.
  const folder = files.find((f) => f.webkitRelativePath)?.webkitRelativePath?.split("/")[0];
  if (folder) return titleCase(folder);
  // Otherwise build a real label from the files' own timestamps.
  const mid = medianDate(files);
  return `Shoot · ${mid.toLocaleString("en-US", { month: "long", year: "numeric" })}`;
}

function medianDate(files: File[]): Date {
  const ts = files.map((f) => f.lastModified).filter(Boolean).sort((a, b) => a - b);
  return ts.length ? new Date(ts[Math.floor(ts.length / 2)]) : new Date();
}

function deriveDateLabel(files: File[]): string {
  const ts = files.map((f) => f.lastModified).filter(Boolean).sort((a, b) => a - b);
  if (!ts.length) return "";
  const a = new Date(ts[0]);
  const b = new Date(ts[ts.length - 1]);
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const sameDay = a.toDateString() === b.toDateString();
  return sameDay ? a.toLocaleDateString("en-US", opt) : `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${b.toLocaleDateString("en-US", opt)}`;
}

export default function CreateConceptPlan() {
  const [phase, setPhase] = useState<Phase>("drop");
  const [culling, setCulling] = useState(true);
  const [name, setName] = useState("");
  const [count, setCount] = useState(0);
  const [dateLabel, setDateLabel] = useState("");
  const [styleIdx, setStyleIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const style = STYLES[styleIdx];
  const keepers = Math.round(count * 0.25);
  const editCount = culling ? keepers : count;
  const readyHours = Math.max(1, Math.round(editCount / 600));

  const ingest = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const imgs = Array.from(fileList).filter(isImage) as FileWithPath[];
    if (imgs.length === 0) return;
    setCount(imgs.length);
    setName(deriveName(imgs));
    setDateLabel(deriveDateLabel(imgs));
    setStyleIdx(0);
    setPhase("analyzing");
    // Brief, real-feeling "read" of the files before the plan appears.
    window.setTimeout(() => setPhase("plan"), 1400);
  };

  const reset = () => {
    setPhase("drop");
    setCount(0);
    setName("");
    setDateLabel("");
    setCulling(true);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      {/* Real file picker — accepts loose photos or a whole folder. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.cr2,.cr3,.nef,.arw,.raf,.rw2,.dng,.orf,.srw,.pef"
        className="hidden"
        onChange={(e) => ingest(e.target.files)}
      />

      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/preview/create" aria-label="Back to concepts"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <span className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={11} /> Concept A · AI Plan</span>
            <h1 className="text-2xl font-bold tracking-tight">New collection</h1>
          </div>
        </div>

        <div className="mt-8">
          <AnimatePresence mode="wait">
            {/* ── Drop / analyzing ── */}
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
                  {phase === "analyzing" ? "Detecting type, lighting and the best matching style." : "RAW or JPG — drag them in or browse. No naming, no settings up front."}
                </p>
                {phase === "drop" && (
                  <div className="mt-6 flex flex-col items-center gap-2.5">
                    <Button variant="glow" className="gap-2" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
                      <UploadCloud className="h-4 w-4" /> Select photos
                    </Button>
                    <span className="text-xs text-muted-foreground/70">your real photos — counted on your device, nothing is uploaded</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Plan ── */}
            {phase === "plan" && (
              <motion.div key="plan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkle size={14} className="text-accent" />
                  <span className="aura-microlabel text-accent">Aura's plan — confirm or tweak</span>
                </div>

                {/* Name (editable) + real stats */}
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
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground">
                      Wedding <span className="text-muted-foreground/50">· guess</span>
                    </span>
                  </div>
                </div>

                {/* Suggested style — thumbs-down really cycles the suggestion */}
                <div className="glass-card rounded-[--radius] p-4">
                  <div className="caption mb-2.5">Suggested look — matched to the photos</div>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-[--radius] bg-[image:var(--gradient-primary)] plate-keyline" style={{ opacity: 1 - styleIdx * 0.28 }} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold tracking-tight">{style.name}</div>
                      <div className="caption">{style.desc}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="glow" size="sm" className="gap-1.5"><ThumbsUp className="h-3.5 w-3.5" /> Use</Button>
                      <Button variant="outline" size="icon" aria-label="Suggest a different style"
                        onClick={() => setStyleIdx((i) => (i + 1) % STYLES.length)}>
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Culling + ready — both computed from the real count */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setCulling((c) => !c)}
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
                      <div className="caption">{editCount.toLocaleString()} photos to edit · I'll email you</div>
                    </div>
                  </div>
                </div>

                <Button variant="glow" size="lg" className="mt-1 w-full gap-2" onClick={() => setPhase("created")}>
                  <Sparkle size={15} className="text-accent-foreground" /> Create &amp; start editing
                </Button>
                <button onClick={reset} className="caption mx-auto block pt-1 hover:text-foreground">← start over</button>
              </motion.div>
            )}

            {/* ── Created (prototype end-state, nothing saved) ── */}
            {phase === "created" && (
              <motion.div key="created" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-[--radius] p-8 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                  <PartyPopper className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight">That's the whole flow ✓</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">In the real app this kicks off editing right here. Your inputs:</p>
                <div className="mx-auto mt-4 max-w-sm space-y-1.5 text-left text-sm">
                  <Row label="Collection" value={name} />
                  <Row label="Photos" value={count.toLocaleString()} />
                  <Row label="Look" value={style.name} />
                  <Row label="Culling" value={culling ? `on · ~${keepers.toLocaleString()} keepers` : "off"} />
                  <Row label="Ready in" value={`~${readyHours}h`} />
                </div>
                <p className="mt-4 text-xs text-muted-foreground/60">Preview prototype — nothing was uploaded or saved.</p>
                <Button variant="outline" className="mt-5 gap-2" onClick={reset}>
                  <RotateCcw className="h-4 w-4" /> Try again
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground/70">
          <Images className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Concept A — drop your real photos; Aura proposes the entire plan and you confirm. Counts and timing are real (computed on your device); the AI type/style guess is simulated in this preview.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
    </div>
  );
}
