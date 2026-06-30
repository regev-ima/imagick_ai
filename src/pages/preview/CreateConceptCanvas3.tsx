import { ArrowLeft, Images, Sparkles as SparklesIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadProgress } from "./UploadProgress";
import { useCanvasFlow, SHOOT_TYPES } from "./useCanvasFlow";
import { Sparkle, FileInput, SourceUpload, ShootTypeChips, LookGrid, CullCard } from "./canvasParts";

function Pill({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
      accent ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground"
    }`}>
      {children}
    </span>
  );
}

// Concept C3 — "Plan-first": the live plan is a prominent hero at the top
// (name + summary pills + CTA), with the editable controls in a balanced
// single column below. Symmetric, no off-to-the-side rail.
export default function CreateConceptCanvas3() {
  const flow = useCanvasFlow();
  const typeLabel = SHOOT_TYPES.find((t) => t.value === flow.type)?.label ?? flow.type;

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <FileInput flow={flow} />
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => flow.navigate("/dashboard/galleries")} aria-label="Back to galleries">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <span className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={11} /> Concept C3 · Plan-first</span>
            <h1 className="text-2xl font-bold tracking-tight">New collection</h1>
          </div>
        </div>

        {/* Plan hero */}
        <div className="glass-card mt-8 rounded-[--radius] p-6">
          <span className="aura-microlabel flex items-center gap-1.5 text-accent"><SparklesIcon className="h-3 w-3" /> Live plan</span>
          <input
            value={flow.name}
            onChange={(e) => flow.setName(e.target.value)}
            className="mt-2 w-full border-0 bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
            placeholder="Untitled shoot"
            aria-label="Collection name"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Pill><Images className="h-3 w-3" /> {flow.photos ? `${flow.photos.toLocaleString()} photos` : "no photos yet"}</Pill>
            <Pill>{typeLabel}</Pill>
            <Pill>{flow.styleId ? flow.style?.name : "Hosting only"}</Pill>
            <Pill>{flow.cull ? "Culling on" : "No culling"}</Pill>
            <Pill accent><Sparkle size={11} /> {flow.editsNeeded.toLocaleString()} edits{!flow.isUnlimited ? ` / ${flow.availableEdits.toLocaleString()}` : ""}</Pill>
          </div>

          {flow.busy ? (
            <div className="mt-5"><UploadProgress uploading={flow.isUploading} progress={flow.uploadProgress} total={flow.photos} previews={flow.previews} /></div>
          ) : (
            <Button variant="glow" size="lg" disabled={!flow.complete} className="mt-5 w-full gap-2" onClick={flow.onCreate}>
              <Zap className="h-4 w-4" /> Create &amp; start editing
            </Button>
          )}
        </div>

        {/* Controls */}
        <div className="mt-5 space-y-5">
          <div className="glass-card rounded-[--radius] p-5">
            <div className="caption mb-2.5">Photos</div>
            <SourceUpload flow={flow} />
          </div>

          <div className="glass-card rounded-[--radius] p-5">
            <div className="caption mb-2.5">Shoot type</div>
            <ShootTypeChips flow={flow} />
          </div>

          <div className="glass-card rounded-[--radius] p-5">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="caption">Look — tap to choose</div>
              <span className="caption">{flow.styleId ? flow.style?.name : "Hosting only"}</span>
            </div>
            <LookGrid flow={flow} />
          </div>

          <CullCard flow={flow} />
        </div>

        <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground/70">
          <Images className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Concept C3 — the live plan leads at the top and updates as you edit the controls below.
        </p>
      </div>
    </div>
  );
}
