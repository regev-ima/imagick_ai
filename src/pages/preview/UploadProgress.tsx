import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

// RAW files can't render as <img>; only build previews from web-renderable ones.
export const isPreviewable = (f: File) => f.type.startsWith("image/") && !/heic|heif/i.test(f.type);

interface Progress {
  uploaded: number;
  total: number;
  currentFile: string;
  bytesUploaded: number;
  totalBytes: number;
}

// Shared upload progress card used by all three create-collection concepts:
// a sliding window of 5 preview thumbnails that tracks progress (done shots
// get a check, the current one is ringed), plus count, bar and current file.
export function UploadProgress({ uploading, progress, total, previews }: {
  uploading: boolean;
  progress: Progress | null;
  total: number;
  previews: string[];
}) {
  const done = progress?.uploaded ?? 0;
  const totalCount = progress?.total || total;
  const pct = progress && progress.totalBytes > 0
    ? Math.round((progress.bytesUploaded / progress.totalBytes) * 100)
    : 0;

  const ratio = totalCount > 0 ? done / totalCount : 0;
  const curIdx = previews.length ? Math.min(previews.length - 1, Math.floor(ratio * previews.length)) : 0;
  const start = Math.max(0, Math.min(curIdx - 4, previews.length - 5));
  const windowUrls = previews.slice(start, start + 5);

  return (
    <div className="space-y-3 rounded-[--radius] border border-border bg-card p-4">
      {uploading && windowUrls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {windowUrls.map((src, i) => {
            const gi = start + i;
            const state = gi < curIdx ? "done" : gi === curIdx ? "current" : "pending";
            return (
              <div key={src} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md">
                <img src={src} alt="" className={`h-full w-full object-cover transition-opacity ${state === "pending" ? "opacity-40" : "opacity-100"}`} />
                {state === "current" && (
                  <span className="absolute inset-0 rounded-md ring-2 ring-inset ring-primary">
                    <span className="absolute inset-0 animate-pulse bg-primary/10" />
                  </span>
                )}
                {state === "done" && (
                  <span className="absolute inset-0 grid place-items-center bg-background/55">
                    <Check className="h-4 w-4 text-primary" strokeWidth={3} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
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
