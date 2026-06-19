import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Check, UploadCloud, FolderOpen, Loader2, Images, Sparkles as SparklesIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { useCreateGalleryFlow } from "@/hooks/useCreateGalleryFlow";

function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

type StyleRow = ReturnType<typeof useCreateGalleryFlow>["styles"][number];
type FileWithPath = File & { webkitRelativePath?: string };

const IMAGE_RE = /\.(jpe?g|png|heic|heif|tiff?|webp|cr2|cr3|nef|arw|raf|rw2|dng|orf|srw|pef)$/i;
const isImage = (f: File) => f.type.startsWith("image/") || IMAGE_RE.test(f.name);
// RAW files can't be shown as <img>; only make previews from web-renderable ones.
const isPreviewable = (f: File) => f.type.startsWith("image/") && !/heic|heif/i.test(f.type);

const TYPES: { value: string; label: string }[] = [
  { value: "wedding", label: "Wedding" },
  { value: "portrait", label: "Portrait" },
  { value: "event", label: "Event" },
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

// Rank styles for the chosen shoot type: tag/category matches first, then
// presets, then the rest — so Aura's first suggestions are relevant.
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

type Step = "upload" | "type" | "name" | "style" | "cull" | "done";
type Msg = { id: number; sender: "aura" | "user"; text: string; thumbs?: string[]; more?: number };

export default function CreateConceptChat() {
  const navigate = useNavigate();
  const { styles, submit, busy, isUploading, uploadProgress } = useCreateGalleryFlow();

  const [step, setStep] = useState<Step>("upload");
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 0, sender: "aura", text: "Let's start a new collection. Drop your shoot — photos or a whole folder — and I'll set everything up." },
  ]);
  const [input, setInput] = useState("");
  const [showAllStyles, setShowAllStyles] = useState(false);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [galleryType, setGalleryType] = useState("wedding");
  const [name, setName] = useState("");
  const [styleId, setStyleId] = useState<string | null>(null);
  const [culling, setCulling] = useState(true);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, step]);

  // Revoke any preview blob URLs when leaving.
  useEffect(() => () => { objectUrls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const say = (sender: Msg["sender"], text: string, extra?: Partial<Msg>) =>
    setMsgs((m) => [...m, { id: idRef.current++, sender, text, ...extra }]);

  const ingest = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter(isImage) as FileWithPath[];
    if (imgs.length === 0) return;
    setFiles(imgs);

    // Build up to 5 visual previews to confirm the upload inside the chat.
    const previewFiles = imgs.filter(isPreviewable).slice(0, 5);
    const thumbs = previewFiles.map((f) => {
      const url = URL.createObjectURL(f);
      objectUrls.current.push(url);
      return url;
    });
    const more = imgs.length - thumbs.length;

    say("user", `Added ${imgs.length.toLocaleString()} photos`, { thumbs, more: more > 0 ? more : undefined });
    say("aura", `Got ${imgs.length.toLocaleString()} photos. What kind of shoot is this?`);
    setStep("type");
  };

  const pickType = (t: { value: string; label: string }) => {
    setGalleryType(t.value);
    say("user", t.label);
    say("aura", "What should I call this gallery?");
    setName(deriveName(files as FileWithPath[]));
    setStep("name");
  };

  const confirmName = (value: string) => {
    const finalName = value.trim() || deriveName(files as FileWithPath[]);
    setName(finalName);
    say("user", finalName);
    const typeLabel = TYPES.find((t) => t.value === galleryType)?.label ?? "this";
    if (styles.length > 0) {
      say("aura", `Since it's a ${typeLabel.toLowerCase()} shoot, here are the looks I'd recommend. Tap one — or browse more.`);
      setStep("style");
    } else {
      say("aura", "You haven't trained a look yet — I'll host them as-is. Want me to cull first so you only keep the best?");
      setStep("cull");
    }
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
    submit({ name: name.trim() || deriveName(files as FileWithPath[]), galleryType, styleIds: styleId ? [styleId] : [], aiCulling: culling, files });
  };

  const ranked = rankStyles(styles, galleryType);
  const shown = showAllStyles ? ranked : ranked.slice(0, 4);
  const selectedStyleName = styleId ? styles.find((s) => s.id === styleId)?.name : "Hosting only";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <input ref={photosRef} type="file" multiple accept="image/*,.cr2,.cr3,.nef,.arw,.raf,.rw2,.dng,.orf,.srw,.pef" className="hidden" onChange={(e) => ingest(e.target.files)} />
      {/* @ts-expect-error -- webkitdirectory is a valid non-standard attribute */}
      <input ref={folderRef} type="file" webkitdirectory="" directory="" multiple className="hidden" onChange={(e) => ingest(e.target.files)} />

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
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                  : "glass-card max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-foreground"}>
                  {m.sender === "aura" && (
                    <span className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium text-accent">
                      <Sparkle size={10} /> Aura
                    </span>
                  )}
                  {m.thumbs && m.thumbs.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {m.thumbs.map((src, i) => (
                        <img key={i} src={src} alt="" className="h-14 w-14 rounded-md object-cover ring-1 ring-primary-foreground/20" />
                      ))}
                      {m.more ? (
                        <div className="grid h-14 w-14 place-items-center rounded-md bg-primary-foreground/15 text-xs font-semibold">
                          +{m.more}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {m.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Final summary + real create (with live upload progress) */}
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

                {busy ? (
                  <UploadBar uploading={isUploading} progress={uploadProgress} total={files.length} />
                ) : (
                  <Button variant="glow" size="lg" className="mt-4 w-full gap-2" onClick={onCreate}>
                    <Sparkle size={15} className="text-accent-foreground" /> Create &amp; start editing
                  </Button>
                )}
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
              <div className="grid grid-cols-2 gap-2">
                <Button variant="glow" className="gap-2" onClick={() => photosRef.current?.click()}>
                  <UploadCloud className="h-4 w-4" /> Select photos
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => folderRef.current?.click()}>
                  <FolderOpen className="h-4 w-4" /> Select a folder
                </Button>
              </div>
            )}

            {step === "type" && (
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <Chip key={t.value} onClick={() => pickType(t)}>{t.label}</Chip>
                ))}
              </div>
            )}

            {step === "style" && (
              <div>
                <div className={showAllStyles ? "flex max-h-[42vh] flex-wrap gap-2 overflow-y-auto pb-1" : "flex gap-2 overflow-x-auto pb-1"}>
                  {shown.map((s) => {
                    const cover = s.thumbnail_url || s.after_image_urls?.[0];
                    return (
                      <button key={s.id} type="button" onClick={() => pickStyle(s.name, s.id)}
                        className="group w-[120px] shrink-0 overflow-hidden rounded-[--radius] border border-border bg-card text-left transition-colors hover:border-primary/50">
                        {cover ? (
                          <img src={getThumbnailUrl(cover)} alt="" className="h-[78px] w-full object-cover" />
                        ) : (
                          <div className="h-[78px] w-full bg-[image:var(--gradient-primary)]" />
                        )}
                        <div className="truncate px-2 py-1.5 text-xs font-medium">{s.name}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {!showAllStyles && ranked.length > 4 && (
                    <button type="button" onClick={() => setShowAllStyles(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10">
                      Show more looks <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Chip muted onClick={() => pickStyle("No editing — host as-is", null)}>No editing</Chip>
                </div>
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
                  <Chip onClick={() => confirmName(deriveName(files as FileWithPath[]))}>{deriveName(files as FileWithPath[])}</Chip>
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

function UploadBar({ uploading, progress, total }: {
  uploading: boolean;
  progress: ReturnType<typeof useCreateGalleryFlow>["uploadProgress"];
  total: number;
}) {
  const done = progress?.uploaded ?? 0;
  const totalCount = progress?.total || total;
  const pct = progress && progress.totalBytes > 0
    ? Math.round((progress.bytesUploaded / progress.totalBytes) * 100)
    : 0;
  return (
    <div className="mt-4 space-y-2 rounded-[--radius] border border-border bg-card p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          {uploading ? "Uploading your photos…" : "Creating gallery…"}
        </span>
        <span className="font-mono text-primary">{uploading ? `${done}/${totalCount}` : ""}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }}
          animate={{ width: `${uploading ? pct : 100}%` }} transition={{ ease: "easeOut", duration: 0.4 }} />
      </div>
      {uploading && progress?.currentFile && (
        <p className="truncate text-xs text-muted-foreground">Receiving {progress.currentFile} · {pct}%</p>
      )}
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
