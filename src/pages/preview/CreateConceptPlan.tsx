import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UploadCloud, Check, ThumbsUp, ThumbsDown, Pencil, Images, Scissors, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

type Phase = "drop" | "analyzing" | "plan";

export default function CreateConceptPlan() {
  const [phase, setPhase] = useState<Phase>("drop");
  const [culling, setCulling] = useState(true);

  const start = () => {
    setPhase("analyzing");
    setTimeout(() => setPhase("plan"), 1400);
  };

  return (
    <div className="min-h-screen bg-background px-6 py-8">
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

        {/* Dropzone hero */}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            {phase !== "plan" ? (
              <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}
                onClick={phase === "drop" ? start : undefined}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (phase === "drop") start(); }}
                className={`glass-card relative overflow-hidden rounded-[--radius] border-2 border-dashed border-border p-12 text-center transition-colors ${
                  phase === "drop" ? "cursor-pointer hover:border-primary/50 hover:bg-primary/[0.03]" : ""
                }`}>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                  {phase === "analyzing" ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight">
                  {phase === "analyzing" ? "Reading your shoot…" : "Drop your shoot — I'll handle the setup"}
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {phase === "analyzing" ? "Detecting type, lighting and the best matching style." : "RAW or JPG — drag them in or browse. No naming, no settings up front."}
                </p>
                {phase === "drop" && (
                  <div className="mt-6 flex flex-col items-center gap-2.5">
                    <Button variant="glow" className="gap-2" onClick={(e) => { e.stopPropagation(); start(); }}>
                      <UploadCloud className="h-4 w-4" /> Select photos
                    </Button>
                    <span className="text-xs text-muted-foreground/70">or drag your shoot anywhere in this box</span>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="plan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                {/* Aura's plan header */}
                <div className="flex items-center gap-2">
                  <Sparkle size={14} className="text-accent" />
                  <span className="aura-microlabel text-accent">Aura's plan — confirm or tweak</span>
                </div>

                {/* Name + type */}
                <div className="glass-card rounded-[--radius] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="caption">Name (from your files)</div>
                      <div className="mt-0.5 flex items-center gap-2 text-lg font-semibold tracking-tight">
                        Cohen Wedding · June 2026
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <Check className="h-3 w-3" /> Wedding · 1,847 photos
                    </span>
                  </div>
                </div>

                {/* Suggested style with feedback loop */}
                <div className="glass-card rounded-[--radius] p-4">
                  <div className="caption mb-2.5">Suggested look — matched to the photos</div>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-[--radius] bg-[image:var(--gradient-primary)] plate-keyline" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold tracking-tight">Warm Wedding</div>
                      <div className="caption">Soft warm tones · airy highlights · your trained style</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="glow" size="sm" className="gap-1.5"><ThumbsUp className="h-3.5 w-3.5" /> Use</Button>
                      <Button variant="outline" size="icon" aria-label="Suggest a different style"><ThumbsDown className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </div>

                {/* Culling + ready estimate */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setCulling((c) => !c)}
                    className={`glass-card flex items-center gap-3 rounded-[--radius] p-4 text-left transition-colors ${culling ? "border-primary/40" : ""}`}>
                    <div className={`grid h-9 w-9 place-items-center rounded-[--radius] ${culling ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Scissors className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Cull first {culling ? "· on" : "· off"}</div>
                      <div className="caption">{culling ? "~460 keepers est." : "edit everything"}</div>
                    </div>
                  </button>
                  <div className="glass-card flex items-center gap-3 rounded-[--radius] p-4">
                    <div className="grid h-9 w-9 place-items-center rounded-[--radius] bg-secondary/15 text-secondary"><Clock className="h-4 w-4" /></div>
                    <div>
                      <div className="text-sm font-semibold">Ready soon</div>
                      <div className="caption">I'll email you when done</div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <Button variant="glow" size="lg" className="mt-1 w-full gap-2">
                  <Sparkle size={15} className="text-accent-foreground" /> Create & start editing
                </Button>
                <button onClick={() => setPhase("drop")} className="caption mx-auto block pt-1 hover:text-foreground">
                  ← start over
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground/70">
          <Images className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Concept A — you drop the photos first; Aura proposes the entire plan and you confirm. Every choice stays editable (skip-friendly).
        </p>
      </div>
    </div>
  );
}
