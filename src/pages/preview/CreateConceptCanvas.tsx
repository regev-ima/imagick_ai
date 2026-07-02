import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Images, Scissors, Sparkles as SparklesIcon, Zap, UploadCloud, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getThumbnailUrl } from "@/lib/imageUrls";
import { useCreateGalleryFlow } from "@/hooks/useCreateGalleryFlow";
import { CullingTags, defaultCullingTags } from "./CullingTags";
import { UploadProgress, isPreviewable } from "./UploadProgress";
import { UploadSourceSelector, type UploadSource } from "@/components/gallery/UploadSourceSelector";
import { GoogleDriveInput, type DriveFolderInfo } from "@/components/gallery/GoogleDriveInput";
import { isImageFile as isImage, IMAGE_ACCEPT } from "@/lib/imageFileTypes";

function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z" fill="currentColor" />
    </svg>
  );
}

type StyleRow = ReturnType<typeof useCreateGalleryFlow>["styles"][number];

// Rank styles for the shoot type: tag/category match first, then presets.
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

const TYPES: { value: string; label: string }[] = [
  { value: "wedding", label: "Wedding" },
  { value: "portrait", label: "Portrait" },
  { value: "event", label: "Event" },
  { value: "newborn", label: "Newborn" },
  { value: "commercial", label: "Commercial" },
];

export default function CreateConceptCanvas() {
  const navigate = useNavigate();
  const { styles, submit, busy, isUploading, uploadProgress, availableEdits, isUnlimited, cullingLanguage } = useCreateGalleryFlow();

  const [name, setName] = useState("");
  const [type, setType] = useState("wedding");
  const [files, setFiles] = useState<File[]>([]);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [styleTouched, setStyleTouched] = useState(false);
  const [cull, setCull] = useState(true);
  const [categories, setCategories] = useState<string[]>(() => defaultCullingTags("wedding"));
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadSource, setUploadSource] = useState<UploadSource>("local");
  const [driveFolderInfo, setDriveFolderInfo] = useState<DriveFolderInfo | null>(null);
  const [driveLinks, setDriveLinks] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => () => { objectUrls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const toggleCull = () =>
    setCull((on) => {
      const next = !on;
      if (next) setCategories(defaultCullingTags(type, cullingLanguage));
      return next;
    });
  const changeType = (value: string) => {
    setType(value);
    if (cull) setCategories(defaultCullingTags(value, cullingLanguage));
  };

  const photos = uploadSource === "drive" ? (driveFolderInfo?.totalImageCount || 0) : files.length;
  const ingest = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter(isImage);
    if (imgs.length === 0) return;
    setFiles(imgs);
    setPreviews(imgs.filter(isPreviewable).slice(0, 120).map((f) => {
      const url = URL.createObjectURL(f);
      objectUrls.current.push(url);
      return url;
    }));
    if (!name.trim()) {
      const mid = imgs.map((f) => f.lastModified).filter(Boolean).sort((a, b) => a - b)[Math.floor(imgs.length / 2)];
      const d = mid ? new Date(mid) : new Date();
      setName(`Shoot · ${d.toLocaleString("en-US", { month: "long", year: "numeric" })}`);
    }
  };

  const style = styles.find((s) => s.id === styleId) ?? null;
  const rankedStyles = rankStyles(styles, type);
  // Exact figures only — edits consumed = photos × looks (matches the real
  // wizard's editsNeeded). No fabricated keepers/timing estimates.
  const stylesCount = styleId ? 1 : 0;
  const editsNeeded = useMemo(() => photos * stylesCount, [photos, stylesCount]);
  const complete = name.trim().length > 0 && photos > 0 && !!type;

  // Pre-pick Aura's best-matching look once photos are in — the user can tap
  // another card or "No editing". Prevents an accidental hosting-only / 0-edits
  // state when they meant to edit.
  useEffect(() => {
    if (photos > 0 && !styleTouched && rankedStyles.length > 0) {
      setStyleId(rankedStyles[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, styles, type]);

  const pickStyle = (id: string | null) => {
    setStyleId(id);
    setStyleTouched(true);
  };

  const onCreate = () => {
    submit({
      name: name.trim(),
      galleryType: type,
      styleIds: styleId ? [styleId] : [],
      aiCulling: cull,
      categories: cull ? categories : [],
      cullingLanguage,
      source: uploadSource === "drive"
        ? { kind: "drive", links: driveLinks, totalImageCount: driveFolderInfo?.totalImageCount || 0, totalSizeMB: driveFolderInfo?.totalSizeMB || 0 }
        : { kind: "local", files },
    });
  };

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => ingest(e.target.files)}
      />
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/galleries")} aria-label="Back to galleries">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <span className="aura-microlabel flex items-center gap-1.5 text-accent"><Sparkle size={11} /> Concept C · Live Canvas</span>
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full border-0 bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
                placeholder="Untitled shoot"
              />

              <div className="mt-3">
                <UploadSourceSelector value={uploadSource} onChange={setUploadSource} disabled={busy} />
              </div>

              {uploadSource === "drive" ? (
                <div className="mt-3">
                  <GoogleDriveInput folderInfo={driveFolderInfo} onUpdate={(info, links) => { setDriveFolderInfo(info); setDriveLinks(links); }} disabled={busy} />
                </div>
              ) : photos > 0 ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Images className="h-3.5 w-3.5" /> {photos.toLocaleString()} photos selected
                  <button type="button" onClick={() => inputRef.current?.click()} className="text-accent hover:underline">change</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); ingest(e.dataTransfer.files); }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[--radius] border-2 border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
                >
                  <UploadCloud className="h-4 w-4" /> Select or drag your real photos
                </button>
              )}
            </div>

            <div className="glass-card rounded-[--radius] p-5">
              <div className="caption mb-2.5">Shoot type</div>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => changeType(t.value)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      type === t.value
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-[--radius] p-5">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="caption">Look — tap to choose</div>
                <span className="caption">{styleId ? style?.name : "Hosting only"}</span>
              </div>
              {styles.length === 0 ? (
                <p className="caption">No trained looks yet — photos will be hosted as-is. You can train a look later.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {/* No-editing card */}
                  <button
                    type="button"
                    onClick={() => pickStyle(null)}
                    className={`relative rounded-[--radius] border p-3 text-left transition-colors ${
                      styleId === null ? "border-primary bg-primary/10 ring-2 ring-inset ring-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    {styleId === null && <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                    <div className="mb-2 grid h-10 w-full place-items-center rounded-md bg-surface-2 text-muted-foreground"><Ban className="h-4 w-4" /></div>
                    <div className="text-sm font-semibold">No editing</div>
                    <div className="caption mt-0.5">Host as-is · 0 edits</div>
                  </button>
                  {rankedStyles.slice(0, 5).map((s, i) => {
                    const cover = s.thumbnail_url || s.after_image_urls?.[0];
                    const on = styleId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => pickStyle(s.id)}
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
              )}
            </div>

            <div className={`glass-card rounded-[--radius] transition-colors ${cull ? "border-primary/40" : ""}`}>
              <button
                type="button"
                onClick={toggleCull}
                className="flex w-full items-center gap-3 p-5 text-left"
              >
                <div className={`grid h-10 w-10 place-items-center rounded-[--radius] ${cull ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Scissors className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Cull first {cull ? "· on" : "· off"}</div>
                  <div className="caption">{cull ? "Aura ranks every frame and surfaces the keepers first" : "Edit every photo in the shoot"}</div>
                </div>
                <span className={`h-6 w-11 rounded-full p-0.5 transition-colors ${cull ? "bg-primary" : "bg-muted"}`}>
                  <motion.span layout className="block h-5 w-5 rounded-full bg-white shadow" style={{ marginLeft: cull ? "auto" : 0 }} />
                </span>
              </button>
              {cull && (
                <div className="border-t border-border/60 p-5 pt-4">
                  <CullingTags galleryType={type} language={cullingLanguage} value={categories} onChange={setCategories} />
                </div>
              )}
            </div>
          </div>

          {/* Live plan rail */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="glass-card rounded-[--radius] p-5">
              <span className="aura-microlabel flex items-center gap-1.5 text-accent">
                <SparklesIcon className="h-3 w-3" /> Live plan
              </span>

              <div className="mt-4 space-y-3">
                <Row label="Collection" value={name || "Untitled"} done={!!name.trim()} />
                <Row label="Photos" value={photos ? photos.toLocaleString() : "—"} done={photos > 0} />
                <Row label="Type" value={TYPES.find((t) => t.value === type)?.label ?? type} done={!!type} />
                <Row label="Look" value={style?.name ?? "Hosting only"} done />
                <Row label="Culling" value={cull ? "On" : "Off"} done />
              </div>

              <hr className="aura-hairline my-4" />

              <div className="grid grid-cols-2 gap-3">
                <Stat icon={<Sparkle size={13} />} label="Edits to use" value={editsNeeded.toLocaleString()} />
                <Stat icon={<Images className="h-3.5 w-3.5" />} label="Edits available" value={isUnlimited ? "Unlimited" : availableEdits.toLocaleString()} />
              </div>
              {stylesCount > 0 && (
                <p className="caption mt-2 text-center">{photos.toLocaleString()} photos × 1 look = {editsNeeded.toLocaleString()} edits</p>
              )}

              {busy ? (
                <div className="mt-4"><UploadProgress uploading={isUploading} progress={uploadProgress} total={photos} previews={previews} /></div>
              ) : (
                <>
                  <Button variant="glow" size="lg" disabled={!complete} className="mt-4 w-full gap-2" onClick={onCreate}>
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

function Row({ label, value, done }: { label: string; value: string; done: boolean }) {
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[--radius] bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon} {label}</div>
      <div className="mt-0.5 font-mono text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}
