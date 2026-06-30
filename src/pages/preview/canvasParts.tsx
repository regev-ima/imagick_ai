import { motion } from "framer-motion";
import { Check, Images, Scissors, UploadCloud, Ban } from "lucide-react";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { IMAGE_ACCEPT } from "@/lib/imageFileTypes";
import { UploadSourceSelector } from "@/components/gallery/UploadSourceSelector";
import { GoogleDriveInput } from "@/components/gallery/GoogleDriveInput";
import { CullingTags } from "./CullingTags";
import { SHOOT_TYPES, type CanvasFlow } from "./useCanvasFlow";

export function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

/** Hidden file input — render once per page; uses the flow's ref/ingest. */
export function FileInput({ flow }: { flow: CanvasFlow }) {
  return (
    <input ref={flow.inputRef} type="file" multiple accept={IMAGE_ACCEPT} className="hidden"
      onChange={(e) => flow.ingest(e.target.files)} />
  );
}

export function SourceUpload({ flow }: { flow: CanvasFlow }) {
  return (
    <>
      <UploadSourceSelector value={flow.uploadSource} onChange={flow.setUploadSource} disabled={flow.busy} />
      {flow.uploadSource === "drive" ? (
        <div className="mt-3">
          <GoogleDriveInput folderInfo={flow.driveFolderInfo} onUpdate={flow.setDrive} disabled={flow.busy} />
        </div>
      ) : flow.photos > 0 ? (
        <div className="mt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Images className="h-3.5 w-3.5" /> {flow.photos.toLocaleString()} photos selected
            <button type="button" onClick={() => flow.inputRef.current?.click()} className="text-accent hover:underline">change</button>
          </div>
          {flow.previews.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {flow.previews.slice(0, 6).map((src, i) => (
                <img key={i} src={src} alt="" className="h-12 w-12 rounded-md object-cover ring-1 ring-border" />
              ))}
              {flow.photos > flow.previews.slice(0, 6).length && (
                <div className="grid h-12 w-12 place-items-center rounded-md bg-surface-2 text-xs font-medium text-muted-foreground">
                  +{(flow.photos - flow.previews.slice(0, 6).length).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => flow.inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); flow.ingest(e.dataTransfer.files); }}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-[--radius] border-2 border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
        >
          <UploadCloud className="h-4 w-4" /> Select or drag your real photos
        </button>
      )}
    </>
  );
}

export function ShootTypeChips({ flow }: { flow: CanvasFlow }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SHOOT_TYPES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => flow.changeType(t.value)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all active:scale-95 ${
            flow.type === t.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border bg-surface-2 text-foreground/80 hover:border-primary/50 hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function LookGrid({ flow, columns = "sm:grid-cols-3" }: { flow: CanvasFlow; columns?: string }) {
  if (flow.styles.length === 0) {
    return <p className="caption">No trained looks yet — photos will be hosted as-is. You can train a look later.</p>;
  }
  return (
    <div className={`grid gap-2 ${columns}`}>
      <button
        type="button"
        onClick={() => flow.pickStyle(null)}
        className={`relative rounded-[--radius] border p-3 text-left transition-colors ${
          flow.styleId === null ? "border-primary bg-primary/10 ring-2 ring-inset ring-primary" : "border-border hover:border-primary/40"
        }`}
      >
        {flow.styleId === null && <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span>}
        <div className="mb-2 grid h-10 w-full place-items-center rounded-md bg-surface-2 text-muted-foreground"><Ban className="h-4 w-4" /></div>
        <div className="text-sm font-semibold">No editing</div>
        <div className="caption mt-0.5">Host as-is · 0 edits</div>
      </button>
      {flow.rankedStyles.slice(0, 5).map((s, i) => {
        const cover = s.thumbnail_url || s.after_image_urls?.[0];
        const on = flow.styleId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => flow.pickStyle(s.id)}
            className={`relative rounded-[--radius] border p-3 text-left transition-colors ${
              on ? "border-primary bg-primary/10 ring-2 ring-inset ring-primary" : "border-border hover:border-primary/40"
            }`}
          >
            {on && <span className="absolute right-2 top-2 z-10 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span>}
            {cover ? (
              <img src={getThumbnailUrl(cover)} alt="" className="mb-2 h-10 w-full rounded-md object-cover plate-keyline" />
            ) : (
              <div className="mb-2 h-10 w-full rounded-md bg-[image:var(--gradient-primary)] plate-keyline" />
            )}
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{s.name}</span>
              {i === 0 && !on && <span className="shrink-0 rounded-full bg-primary/15 px-1.5 text-[9px] font-semibold uppercase text-primary">Pick</span>}
            </div>
            {s.description && <div className="caption mt-0.5 truncate">{s.description}</div>}
          </button>
        );
      })}
    </div>
  );
}

export function CullCard({ flow }: { flow: CanvasFlow }) {
  return (
    <div className={`glass-card rounded-[--radius] transition-colors ${flow.cull ? "border-primary/40" : ""}`}>
      <button type="button" onClick={flow.toggleCull} className="flex w-full items-center gap-3 p-5 text-left">
        <div className={`grid h-10 w-10 place-items-center rounded-[--radius] ${flow.cull ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Scissors className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Cull {flow.cull ? "· on" : "· off"}</div>
          <div className="caption">{flow.cull ? "Aura ranks every frame & surfaces your best shots" : "no culling — keep every photo"}</div>
        </div>
        <span className={`h-6 w-11 rounded-full p-0.5 transition-colors ${flow.cull ? "bg-primary" : "bg-muted"}`}>
          <motion.span layout className="block h-5 w-5 rounded-full bg-white shadow" style={{ marginLeft: flow.cull ? "auto" : 0 }} />
        </span>
      </button>
      {flow.cull && (
        <div className="border-t border-border/60 p-5 pt-4">
          <CullingTags galleryType={flow.type} language={flow.cullingLanguage} value={flow.categories} onChange={flow.setCategories} />
        </div>
      )}
    </div>
  );
}

export function PlanRow({ label, value, done }: { label: string; value: string; done: boolean }) {
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

export function PlanStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[--radius] bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon} {label}</div>
      <div className="mt-0.5 font-mono text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}
