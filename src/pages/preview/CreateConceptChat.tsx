import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Check, SkipForward, Images, Sparkles as SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

type Sender = "aura" | "user";
type Msg = { id: number; sender: Sender; text: string; chips?: string[]; soft?: boolean };

// A scripted conversation: each step is what Aura asks + the quick replies.
// Picking a chip (or typing) advances the thread. Fully skippable.
const script: { ask: string; chips: string[]; note?: string }[] = [
  {
    ask: "Let's start a new collection. What kind of shoot is this?",
    chips: ["Wedding", "Portrait", "Event", "Newborn"],
    note: "or just describe it in your own words below",
  },
  {
    ask: "Got it — a wedding. What should I call this gallery?",
    chips: ["Cohen Wedding · June 2026", "Use the folder name", "I'll name it later"],
  },
  {
    ask: "I looked at a few frames. Warm, airy light — your “Warm Wedding” style fits best. Want me to use it?",
    chips: ["Use Warm Wedding", "Show me other looks", "No style, just cull"],
  },
  {
    ask: "Want me to cull first so you only edit the keepers? I'd estimate ~460 of 1,847.",
    chips: ["Yes, cull first", "Edit everything", "Let me pick later"],
  },
];

export default function CreateConceptChat() {
  const [step, setStep] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 0, sender: "aura", text: script[0].ask, chips: script[0].chips, soft: false },
  ]);
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, done]);

  const advance = (reply: string) => {
    const nextStep = step + 1;
    setMsgs((m) => {
      const withUser: Msg[] = [...m.map((x) => ({ ...x, chips: undefined })), { id: m.length, sender: "user", text: reply }];
      if (nextStep < script.length) {
        return [...withUser, { id: m.length + 1, sender: "aura", text: script[nextStep].ask, chips: script[nextStep].chips }];
      }
      return withUser;
    });
    if (nextStep < script.length) {
      setStep(nextStep);
    } else {
      setStep(nextStep);
      setTimeout(() => setDone(true), 500);
    }
    setInput("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    advance(input.trim());
  };

  const currentChips = !done && step < script.length ? script[step].chips : undefined;
  const currentNote = !done && step < script.length ? script[step].note : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/preview/create" aria-label="Back to concepts"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground">
            <Sparkle size={16} className="text-accent-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              Aura
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </div>
            <span className="aura-microlabel text-accent">Concept B · Conversation</span>
          </div>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 px-6 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <AnimatePresence initial={false}>
            {msgs.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={m.sender === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    m.sender === "user"
                      ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                      : "glass-card max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-foreground"
                  }
                >
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

          {/* Final summary card */}
          <AnimatePresence>
            {done && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card mt-2 rounded-[--radius] p-5"
              >
                <span className="aura-microlabel flex items-center gap-1.5 text-accent">
                  <SparklesIcon className="h-3 w-3" /> Ready to go
                </span>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">Cohen Wedding · June 2026</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Wedding · 1,847 photos</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Style: Warm Wedding</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Cull first → ~460 keepers</li>
                </ul>
                <Button variant="glow" size="lg" className="mt-4 w-full gap-2">
                  <Sparkle size={15} className="text-accent-foreground" /> Create &amp; start editing
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={endRef} />
        </div>
      </div>

      {/* Composer */}
      {!done && (
        <div className="sticky bottom-0 border-t border-border/60 bg-background/80 px-6 py-4 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl">
            {currentChips && (
              <div className="mb-3 flex flex-wrap gap-2">
                {currentChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => advance(chip)}
                    className="rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    {chip}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => advance("Skip")}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <SkipForward className="h-3.5 w-3.5" /> Skip
                </button>
              </div>
            )}
            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={currentNote ?? "Type your answer…"}
                aria-label="Message Aura"
                className="h-11 flex-1 rounded-full border border-border bg-surface-2 px-4 text-sm outline-none transition-colors focus:border-primary/50"
              />
              <Button type="submit" variant="glow" size="icon" className="h-11 w-11 shrink-0" aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      <p className="mx-auto flex w-full max-w-2xl items-start gap-2 px-6 pb-8 pt-2 text-xs text-muted-foreground/70">
        <Images className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Concept B — Aura guides you one question at a time. Tap a suggestion, type freely, or skip anything. No forms, no steps to track.
      </p>
    </div>
  );
}
