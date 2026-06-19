import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Check, UploadCloud, Loader2, Images, Sparkles as SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateGalleryFlow } from "@/hooks/useCreateGalleryFlow";

function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

const IMAGE_RE = /\.(jpe?g|png|heic|heif|tiff?|webp|cr2|cr3|nef|arw|raf|rw2|dng|orf|srw|pef)$/i;
const isImage = (f: File) => f.type.startsWith("image/") || IMAGE_RE.test(f.name);

const TYPES: { value: string; label: string }[] = [
  { value: "wedding", label: "Wedding" },
  { value: "portrait", label: "Portrait" },
  { value: "event", label: "Event" },
  { value: "newborn", label: "Newborn" },
  { value: "commercial", label: "Commercial" },
];

function deriveName(files: File[]): string {
  const ts = files.map((f) => f.lastModified).filter(Boolean).sort((a, b) => a - b);
  const d = ts.length ? new Date(ts[Math.floor(ts.length / 2)]) : new Date();
  return `Shoot · ${d.toLocaleString("en-US", { month: "long", year: "numeric" })}`;
}

type Step = "upload" | "type" | "name" | "style" | "cull" | "done";
type Msg = { id: number; sender: "aura" | "user"; text: string };

export default function CreateConceptChat() {
  const navigate = useNavigate();
  const { styles, submit, busy, isUploading, uploadProgress } = useCreateGalleryFlow();

  const [step, setStep] = useState<Step>("upload");
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 0, sender: "aura", text: "Let's start a new collection. Drop your shoot and I'll set everything up." },
  ]);
  const [input, setInput] = useState("");
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Collected, real form state.
  const [files, setFiles] = useState<File[]>([]);
  const [galleryType, setGalleryType] = useState("wedding");
  const [name, setName] = useState("");
  const [styleId, setStyleId] = useState<string | null>(null);
  const [culling, setCulling] = useState(true);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, step]);

  const say = (sender: Msg["sender"], text: string) =>
    setMsgs((m) => [...m, { id: idRef.current++, sender, text }]);

  const ingest = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter(isImage);
    if (imgs.length === 0) return;
    setFiles(imgs);
    say("user", `Added ${imgs.length.toLocaleString()} photos`);
    say("aura", `Got ${imgs.length.toLocaleString()} photos. What kind of shoot is this?`);
    setStep("type");
  };

  const pickType = (t: { value: string; label: string }) => {
    setGalleryType(t.value);
    say("user", t.label);
    say("aura", "What should I call this gallery?");
    setName(deriveName(files));
    setStep("name");
  };

  const confirmName = (value: string) => {
    const finalName = value.trim() || deriveName(files);
    setName(finalName);
    say("user", finalName);
    if (styles.length > 0) {
      say("aura", "Which look should I edit them in?");
    } else {
      say("aura", "You haven't trained a look yet — I'll host them as-is. Want me to cull first so you only keep the best?");
    }
    setStep(styles.length > 0 ? "style" : "cull");
    setInput("");
  };

  const pickStyle = (label: string, id: string | null) => {
    setStyleId(id);
    say("user", label);
    say("aura", "Want me to cull first so you only edit the keepers?");
    setStep("cull");
  };

  const pickCull = (on: boolean) => {
    setCulling(on);
    say("user", on ? "Yes, cull first" : "Edit everything");
    say("aura", "Perfect — here's the plan. Review and create when you're ready.");
    setStep("done");
  };

  const onCreate = () => {
    submit({ name: name.trim() || deriveName(files), galleryType, styleIds: styleId ? [styleId] : [], aiCulling: culling, files });
  };

  const styleChips = styles.slice(0, 4);
  const selectedStyleName = styleId ? styles.find((s) => s.id === styleId)?.name : "Hosting only";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.cr2,.cr3,.nef,.arw,.raf,.rw2,.dng,.orf,.srw,.pef"
        className="hidden"
        onChange={(e) => ingest(e.target.files)}
      />

      {/* Header */}
      <div className="shrink-0 border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/galleries")} aria-label="Back to galleries">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground">
            <Sparkle size={16} className="text-accent-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              Aura <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </div>
            <span className="aura-microlabel text-accent">Concept B · Conversation</span>
          </div>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <AnimatePresence initial={false}>
            {msgs.map((m) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={m.sender === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={m.sender === "user"
                  ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                  : "glass-card max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-foreground"}>
                  {m.sender === "aura" && (
                    <span className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium text-accent">
                      <Sparkle size={10} /> Aura
                    </span>
                  )}
                  {m.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Final summary + real create */}
          <AnimatePresence>
            {step === "done" && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card mt-2 rounded-[--radius] p-5">
                <span className="aura-microlabel flex items-center gap-1.5 text-accent">
                  <SparklesIcon className="h-3 w-3" /> Ready to go
                </span>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">{name}</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> {TYPES.find((t) => t.value === galleryType)?.label} · {files.length.toLocaleString()} photos</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Look: {selectedStyleName}</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> {culling ? `Cull first → ~${Math.round(files.length * 0.25).toLocaleString()} keepers` : "Edit everything"}</li>
                </ul>
                <Button variant="glow" size="lg" className="mt-4 w-full gap-2" onClick={onCreate} disabled={busy}>
                  {busy ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {isUploading ? uploadLabel(uploadProgress) : "Creating…"}</>
                  ) : (
                    <><Sparkle size={15} className="text-accent-foreground" /> Create &amp; start editing</>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={endRef} />
        </div>
      </div>

      {/* Composer — per-step affordance, pinned to the bottom */}
      {step !== "done" && (
        <div className="shrink-0 border-t border-border/60 bg-background/80 px-6 pt-4 backdrop-blur"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto w-full max-w-2xl">
            {step === "upload" && (
              <Button variant="glow" className="w-full gap-2" onClick={() => inputRef.current?.click()}>
                <UploadCloud className="h-4 w-4" /> Select your photos
              </Button>
            )}

            {step === "type" && (
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <Chip key={t.value} onClick={() => pickType(t)}>{t.label}</Chip>
                ))}
              </div>
            )}

            {step === "style" && (
              <div className="flex flex-wrap gap-2">
                {styleChips.map((s) => (
                  <Chip key={s.id} onClick={() => pickStyle(s.name, s.id)}>{s.name}</Chip>
                ))}
                <Chip muted onClick={() => pickStyle("No editing — host as-is", null)}>No editing</Chip>
              </div>
            )}

            {step === "cull" && (
              <div className="flex flex-wrap gap-2">
                <Chip onClick={() => pickCull(true)}>Yes, cull first</Chip>
                <Chip muted onClick={() => pickCull(false)}>Edit everything</Chip>
              </div>
            )}

            {step === "name" && (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Chip onClick={() => confirmName(deriveName(files))}>{deriveName(files)}</Chip>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); confirmName(input); }} className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a name…"
                    aria-label="Gallery name"
                    className="h-11 min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-4 text-base outline-none transition-colors focus:border-primary/50 sm:text-sm"
                  />
                  <Button type="submit" variant="glow" size="icon" className="h-11 w-11 shrink-0" aria-label="Send">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <p className="mx-auto flex w-full max-w-2xl items-start gap-2 px-6 pb-4 pt-2 text-xs text-muted-foreground/70">
        <Images className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Concept B — Aura collects everything in a chat, then creates a real collection and starts editing.
      </p>
    </div>
  );
}

function Chip({ children, onClick, muted = false }: { children: React.ReactNode; onClick: () => void; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={muted
        ? "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        : "rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"}
    >
      {children}
    </button>
  );
}

function uploadLabel(p: { bytesUploaded: number; totalBytes: number } | null): string {
  if (!p || p.totalBytes <= 0) return "Uploading…";
  return `Uploading ${Math.round((p.bytesUploaded / p.totalBytes) * 100)}%`;
}
