import { ArrowLeft, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadProgress } from "./UploadProgress";
import { useCanvasFlow, SHOOT_TYPES } from "./useCanvasFlow";
import { Sparkle, FileInput, SourceUpload, ShootTypeChips, LookGrid, CullCard } from "./canvasParts";

// Concept C2 — "Focused": one centered column (no side rail), with a sticky
// action bar pinned to the bottom that always shows the live summary + CTA.
export default function CreateConceptCanvas2() {
  const flow = useCanvasFlow();
  const typeLabel = SHOOT_TYPES.find((t) => t.value === flow.type)?.label ?? flow.type;

  return (
    <div className="min-h-screen bg-background px-6 py-8 pb-36">
      <FileInput flow={flow} />
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => flow.navigate("/dashboard/galleries")} aria-label="Back to galleries">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <span className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={11} /> Concept C2 · Focused</span>
            <h1 className="text-2xl font-bold tracking-tight">New collection</h1>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          <div className="glass-card rounded-[--radius] p-5">
            <label htmlFor="c2-name" className="caption">Collection name</label>
            <input
              id="c2-name"
              value={flow.name}
              onChange={(e) => flow.setName(e.target.value)}
              className="mt-1 w-full border-0 bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
              placeholder="Untitled shoot"
            />
            <div className="mt-3"><SourceUpload flow={flow} /></div>
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
      </div>

      {/* Sticky action bar — live summary always visible, symmetric & centered */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/85 px-6 py-3 backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-2xl">
          {flow.busy ? (
            <UploadProgress uploading={flow.isUploading} progress={flow.uploadProgress} total={flow.photos} previews={flow.previews} />
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span><strong className="font-mono text-foreground">{flow.photos || "—"}</strong> photos</span>
                <span className="text-muted-foreground/40">·</span>
                <span>{typeLabel}</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="max-w-[140px] truncate">{flow.styleId ? flow.style?.name : "Hosting only"}</span>
                <span className="text-muted-foreground/40">·</span>
                <span><strong className="font-mono text-primary">{flow.editsNeeded.toLocaleString()}</strong> edits</span>
              </div>
              <Button variant="glow" size="lg" disabled={!flow.complete} className="shrink-0 gap-2" onClick={flow.onCreate}>
                <Zap className="h-4 w-4" /> Create &amp; start
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
