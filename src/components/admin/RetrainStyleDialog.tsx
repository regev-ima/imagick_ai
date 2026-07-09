import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Check, Loader2, Sparkles, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadStyleFiles, type UploadStyleFileEvent } from "@/lib/uploadStyleFiles";
import type { StyleFull } from "@/pages/dashboard/admin/StyleDetailsSheet";

type Mode = "A" | "B";

interface LocalFile {
  id: string;
  file: File;
}

interface UploadState {
  total: number;
  activeIds: Set<string>;
  doneIds: Set<string>;
  failedIds: Set<string>;
}

interface Props {
  parent: StyleFull;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (newStyleId: string) => void;
}

export function RetrainStyleDialog({ parent, open, onOpenChange, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>("A");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [upload, setUpload] = useState<UploadState | null>(null);

  // Reset local state + compute the default "<parent> vN" name every time the
  // dialog is (re)opened for this parent.
  useEffect(() => {
    if (!open) return;
    setMode("A");
    setFiles([]);
    setSubmitting(false);
    setUpload(null);
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("styles")
        .select("id", { count: "exact", head: true })
        .eq("father_style_id", parent.id);
      if (cancelled) return;
      setName(`${parent.name} v${(count ?? 0) + 1}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, parent.id, parent.name]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const picked = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [
      ...prev,
      ...picked.map((file) => ({ id: Math.random().toString(36).slice(2, 11), file })),
    ]);
    e.target.value = "";
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const canSubmit = name.trim().length > 0 && (mode === "A" || files.length >= 5) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const insertPayload: Record<string, unknown> = {
        name: name.trim(),
        description: parent.description,
        category: parent.category,
        associated_tags: parent.associated_tags,
        upload_method: parent.upload_method,
        google_before_urls: parent.google_before_urls,
        google_before_metadata: (parent as unknown as { google_before_metadata: unknown }).google_before_metadata ?? null,
        before_image_urls: parent.before_image_urls,
        user_id: parent.user_id,
        visibility: "private",
        is_preset: false,
        father_style_id: parent.id,
        status: mode === "A" ? "training" : "uploading",
        training_sessions_count: (parent.training_sessions_count ?? 0) + 1,
      };

      if (mode === "A") {
        insertPayload.after_image_urls = parent.after_image_urls;
        insertPayload.google_after_urls = parent.google_after_urls;
        insertPayload.google_after_metadata = (parent as unknown as { google_after_metadata: unknown }).google_after_metadata ?? null;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("styles")
        .insert(insertPayload as never)
        .select("id")
        .single();

      if (insertError || !inserted) throw insertError || new Error("Failed to create style");
      const newStyleId = inserted.id;

      if (mode === "B") {
        setUpload({ total: files.length, activeIds: new Set(), doneIds: new Set(), failedIds: new Set() });
        const importStart = new Date().toISOString();
        try {
          const urls = await uploadStyleFiles(files, parent.user_id, newStyleId, "after", (event: UploadStyleFileEvent) => {
            setUpload((prev) => {
              if (!prev) return prev;
              const next: UploadState = {
                ...prev,
                activeIds: new Set(prev.activeIds),
                doneIds: new Set(prev.doneIds),
                failedIds: new Set(prev.failedIds),
              };
              if (event.type === "active") next.activeIds.add(event.fileId);
              else if (event.type === "done") {
                next.activeIds.delete(event.fileId);
                next.doneIds.add(event.fileId);
              } else if (event.type === "failed") {
                next.activeIds.delete(event.fileId);
                next.failedIds.add(event.fileId);
              }
              return next;
            });
          });
          const importCompletion = new Date().toISOString();
          await supabase
            .from("styles")
            .update({
              after_image_urls: urls,
              import_start_date: importStart,
              import_completion_date: importCompletion,
            } as never)
            .eq("id", newStyleId);
        } catch (uploadErr: unknown) {
          const message = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          await supabase
            .from("styles")
            .update({
              status: "error",
              error_details: [`Retrain dispatch failed: ${message}`],
            } as never)
            .eq("id", newStyleId);
          toast.error("Upload failed — the new style was saved with an error status.");
          onCreated?.(newStyleId);
          onOpenChange(false);
          return;
        }
      }

      const beforeDir = `styles/${parent.user_id}/${parent.id}/before/`;
      const afterDir =
        mode === "A"
          ? `styles/${parent.user_id}/${parent.id}/after/`
          : `styles/${parent.user_id}/${newStyleId}/after/`;

      const { error: trainError } = await supabase.functions.invoke("train-style", {
        body: {
          styleId: newStyleId,
          modelType: parent.category || "event",
          beforeDirs: [beforeDir],
          afterDirs: [afterDir],
        },
      });

      if (trainError) {
        await supabase
          .from("styles")
          .update({
            status: "error",
            error_details: [`Retrain dispatch failed: ${trainError.message}`],
          } as never)
          .eq("id", newStyleId);
        toast.error("Style created, but training dispatch failed. See its error details.");
      } else {
        toast.success("Retrain started — a new style is training.");
      }

      onCreated?.(newStyleId);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Retrain error:", err);
      const message = err instanceof Error ? err.message : "Failed to start retrain";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Retrain "{parent.name}"
          </DialogTitle>
          <DialogDescription>
            This creates a brand-new style — the parent stays untouched — and starts real
            training compute cost right away.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-2">
            <label
              htmlFor="retrain-mode-a"
              className="flex cursor-pointer items-start gap-3 rounded-[--radius] border border-border bg-surface-2/40 p-3 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem value="A" id="retrain-mode-a" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Same material</span>
                <span className="block text-xs text-muted-foreground">
                  Retrain on the parent's exact BEFORE + AFTER sets — no uploads needed.
                </span>
              </span>
            </label>
            <label
              htmlFor="retrain-mode-b"
              className="flex cursor-pointer items-start gap-3 rounded-[--radius] border border-border bg-surface-2/40 p-3 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem value="B" id="retrain-mode-b" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">New AFTER set</span>
                <span className="block text-xs text-muted-foreground">
                  Same BEFORE shoot, upload a fresh set of edits (a different look on the same photos).
                </span>
              </span>
            </label>
          </RadioGroup>

          <div>
            <Label htmlFor="retrain-name" className="mb-2 block">
              New style name
            </Label>
            <Input
              id="retrain-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warm Wedding v2"
              className="bg-input border-border"
              disabled={submitting}
            />
          </div>

          {mode === "B" && (
            <div className="space-y-3">
              <Label className="aura-microlabel text-muted-foreground">
                New AFTER images ({files.length})
              </Label>
              {!submitting && (
                <div className="relative overflow-hidden rounded-[--radius] border-2 border-dashed border-border p-5 text-center transition-colors hover:border-primary/50">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="font-sans text-sm text-muted-foreground">Click to choose files</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">Minimum 5 images</p>
                </div>
              )}

              {files.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-[--radius] border border-border bg-surface-2/30 p-2">
                  {files.map((f) => {
                    const isActive = upload?.activeIds.has(f.id);
                    const isDone = upload?.doneIds.has(f.id);
                    const isFailed = upload?.failedIds.has(f.id);
                    return (
                      <div key={f.id} className="flex items-center justify-between gap-2 rounded-sm px-1.5 py-1 text-xs">
                        <span className="truncate text-muted-foreground">{f.file.name}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {isActive && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
                          {isDone && <Check className="h-3.5 w-3.5 text-secondary" />}
                          {isFailed && <X className="h-3.5 w-3.5 text-destructive" />}
                          {!upload && (
                            <button
                              type="button"
                              onClick={() => removeFile(f.id)}
                              aria-label="Remove file"
                              className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {files.length > 0 && files.length < 5 && (
                <p className="flex items-center gap-1.5 text-xs text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Minimum 5 images required.
                </p>
              )}

              {upload && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-muted-foreground">
                      Uploading: {upload.doneIds.size}/{upload.total}
                    </span>
                    <span className="font-semibold text-accent">
                      {upload.total > 0 ? Math.round((upload.doneIds.size / upload.total) * 100) : 0}%
                    </span>
                  </div>
                  <Progress value={upload.total > 0 ? (upload.doneIds.size / upload.total) * 100 : 0} className="h-2" />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="glow" onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Start retrain
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
