import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Images, Scissors, Sparkles as SparklesIcon, Clock, Zap, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

// A real shoot is RAW + JPG; ignore sidecars/junk in a dropped folder.
const IMAGE_RE = /\.(jpe?g|png|heic|heif|tiff?|webp|cr2|cr3|nef|arw|raf|rw2|dng|orf|srw|pef)$/i;
const isImage = (f: File) => f.type.startsWith("image/") || IMAGE_RE.test(f.name);

function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

const SHOOT_TYPES = ["Wedding", "Portrait", "Event", "Newborn", "Product"];
const STYLES = [
  { id: "warm", name: "Warm Wedding", desc: "Soft warm tones · airy" },
  { id: "clean", name: "Clean Editorial", desc: "Neutral · crisp whites" },
  { id: "moody", name: "Moody Film", desc: "Deep shadows · muted" },
];

export default function CreateConceptCanvas() {
  const [name, setName] = useState("");
  const [type, setType] = useState("Wedding");
  const [photos, setPhotos] = useState(0);
  const [styleId, setStyleId] = useState("warm");
  const [cull, setCull] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingest = (fileList: FileList | null) => {
    if (!fileList) return;
    const imgs = Array.from(fileList).filter(isImage);
    if (imgs.length === 0) return;
    setPhotos(imgs.length);
    if (!name.trim()) {
      const mid = imgs.map((f) => f.lastModified).filter(Boolean).sort((a, b) => a - b)[Math.floor(imgs.length / 2)];
      const d = mid ? new Date(mid) : new Date();
      setName(`Shoot · ${d.toLocaleString("en-US", { month: "long", year: "numeric" })}`);
    }
  };

  const style = STYLES.find((s) => s.id === styleId)!;
  const editCount = useMemo(() => (cull ? Math.round(photos * 0.25) : photos), [cull, photos]);
  const keepers = editCount;
  const ready = useMemo(() => Math.max(1, Math.round(editCount / 600)), [editCount]);

  const complete = name.trim().length > 0 && photos > 0 && !!type && !!styleId;

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
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/preview/create" aria-label="Back to concepts"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <span className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={11} /> Concept C · Live Canvas</span>
            <h1 className="text-2xl font-bold tracking-tight">New collection</h1>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* ── Canvas (editable in place) ── */}
          <div className="space-y-5">
            {/* Name */}
            <div className="glass-card rounded-[--radius] p-5">
              <label htmlFor="cc-name" className="caption">Collection name</label>
              <input
                id="cc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full border-0 bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
                placeholder="Untitled shoot"
              />
              {photos > 0 ? (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Images className="h-3.5 w-3.5" /> {photos.toLocaleString()} photos selected
                  <button type="button" onClick={() => inputRef.current?.click()} className="text-accent hover:underline">change</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); ingest(e.dataTransfer.files); }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[--radius] border-2 border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
                >
                  <UploadCloud className="h-4 w-4" /> Select or drag your real photos
                </button>
              )}
            </div>

            {/* Type */}
            <div className="glass-card rounded-[--radius] p-5">
              <div className="caption mb-2.5">Shoot type</div>
              <div className="flex flex-wrap gap-2">
                {SHOOT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      type === t
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div className="glass-card rounded-[--radius] p-5">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="caption">Look</div>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent">
                  <Sparkle size={10} /> Aura suggests {STYLES[0].name}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyleId(s.id)}
                    className={`rounded-[--radius] border p-3 text-left transition-colors ${
                      styleId === s.id ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="mb-2 h-10 w-full rounded-md bg-[image:var(--gradient-primary)] plate-keyline" style={{ opacity: s.id === "warm" ? 1 : s.id === "clean" ? 0.55 : 0.3 }} />
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      {s.name}
                      {styleId === s.id && <Check className="h-3 w-3 text-primary" />}
                    </div>
                    <div className="caption mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Culling */}
            <button
              type="button"
              onClick={() => setCull((c) => !c)}
              className={`glass-card flex w-full items-center gap-3 rounded-[--radius] p-5 text-left transition-colors ${cull ? "border-primary/40" : ""}`}
            >
              <div className={`grid h-10 w-10 place-items-center rounded-[--radius] ${cull ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <Scissors className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">Cull first {cull ? "· on" : "· off"}</div>
                <div className="caption">{cull ? `Edit only the ~${keepers.toLocaleString()} keepers Aura picks` : "Edit every photo in the shoot"}</div>
              </div>
              <span className={`h-6 w-11 rounded-full p-0.5 transition-colors ${cull ? "bg-primary" : "bg-muted"}`}>
                <motion.span layout className="block h-5 w-5 rounded-full bg-white shadow" style={{ marginLeft: cull ? "auto" : 0 }} />
              </span>
            </button>
          </div>

          {/* ── Live plan rail ── */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="glass-card rounded-[--radius] p-5">
              <span className="aura-microlabel flex items-center gap-1.5 text-accent">
                <SparklesIcon className="h-3 w-3" /> Live plan
              </span>

              <div className="mt-4 space-y-3">
                <Row label="Collection" value={name || "Untitled"} done={!!name.trim()} />
                <Row label="Type" value={type} done={!!type} />
                <Row label="Look" value={style.name} done={!!styleId} />
                <Row label="Culling" value={cull ? "On" : "Off"} done />
              </div>

              <hr className="aura-hairline my-4" />

              <div className="grid grid-cols-2 gap-3">
                <Stat icon={<Images className="h-3.5 w-3.5" />} label="To edit" value={keepers.toLocaleString()} />
                <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Ready in" value={`~${ready}h`} />
              </div>

              <Button variant="glow" size="lg" disabled={!complete} className="mt-5 w-full gap-2">
                <Zap className="h-4 w-4" /> Create &amp; start
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
                Updates live as you edit the canvas
              </p>
            </div>
          </div>
        </div>

        <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground/70">
          <Images className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Concept C — one page, no wizard steps. Everything is editable in place and the plan on the right recalculates in real time.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 font-medium">
        <span className="truncate">{value}</span>
        {done && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
      </span>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[--radius] bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon} {label}</div>
      <div className="mt-0.5 font-mono text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}
