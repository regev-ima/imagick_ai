import { ArrowLeft, Images, Sparkles as SparklesIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadProgress } from "./UploadProgress";
import { useCanvasFlow, SHOOT_TYPES } from "./useCanvasFlow";
import { Sparkle, FileInput, SourceUpload, ShootTypeChips, LookGrid, CullCard, PlanRow, PlanStat } from "./canvasParts";

// Concept C — "Side rail": editable canvas on the left, a sticky live-plan
// rail on the right. Thin layout over the shared useCanvasFlow + canvasParts.
export default function CreateConceptCanvas() {
  const flow = useCanvasFlow();
  const typeLabel = SHOOT_TYPES.find((t) => t.value === flow.type)?.label ?? flow.type;

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <FileInput flow={flow} />
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => flow.navigate("/dashboard/galleries")} aria-label="Back to galleries">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <span className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={11} /> Concept C · Side rail</span>
            <h1 className="text-2xl font-bold tracking-tight">New collection</h1>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Canvas */}
          <div className="space-y-5">
            <div className="glass-card rounded-[--radius] p-5">
              <label htmlFor="cc-name" className="caption">Collection name</label>
              <input
                id="cc-name"
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

          {/* Live plan rail */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="glass-card rounded-[--radius] p-5">
              <span className="aura-microlabel flex items-center gap-1.5 text-accent">
                <SparklesIcon className="h-3 w-3" /> Live plan
              </span>

              <div className="mt-4 space-y-3">
                <PlanRow label="Collection" value={flow.name || "Untitled"} done={!!flow.name.trim()} />
                <PlanRow label="Photos" value={flow.photos ? flow.photos.toLocaleString() : "—"} done={flow.photos > 0} />
                <PlanRow label="Type" value={typeLabel} done={!!flow.type} />
                <PlanRow label="Look" value={flow.style?.name ?? "Hosting only"} done />
                <PlanRow label="Culling" value={flow.cull ? "On" : "Off"} done />
              </div>

              <hr className="aura-hairline my-4" />

              <div className="grid grid-cols-2 gap-3">
                <PlanStat icon={<Sparkle size={13} />} label="Edits to use" value={flow.editsNeeded.toLocaleString()} />
                <PlanStat icon={<Images className="h-3.5 w-3.5" />} label="Edits available" value={flow.isUnlimited ? "Unlimited" : flow.availableEdits.toLocaleString()} />
              </div>
              {flow.stylesCount > 0 && (
                <p className="caption mt-2 text-center">{flow.photos.toLocaleString()} photos × 1 look = {flow.editsNeeded.toLocaleString()} edits</p>
              )}

              {flow.busy ? (
                <div className="mt-4"><UploadProgress uploading={flow.isUploading} progress={flow.uploadProgress} total={flow.photos} previews={flow.previews} /></div>
              ) : (
                <>
                  <Button variant="glow" size="lg" disabled={!flow.complete} className="mt-4 w-full gap-2" onClick={flow.onCreate}>
                    <Zap className="h-4 w-4" /> Create &amp; start
                  </Button>
                  <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
                    Creates a real collection &amp; starts editing
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground/70">
          <Images className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Concept C — one page, no steps. Everything editable in place; the plan recalculates live from your real photo count.
        </p>
      </div>
    </div>
  );
}
