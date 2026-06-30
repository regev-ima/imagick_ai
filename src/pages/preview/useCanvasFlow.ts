import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateGalleryFlow } from "@/hooks/useCreateGalleryFlow";
import { defaultCullingTags } from "./CullingTags";
import { isImageFile } from "@/lib/imageFileTypes";
import { isPreviewable } from "./UploadProgress";
import type { UploadSource } from "@/components/gallery/UploadSourceSelector";
import type { DriveFolderInfo } from "@/components/gallery/GoogleDriveInput";

export type StyleRow = ReturnType<typeof useCreateGalleryFlow>["styles"][number];

// One selected photo: the File plus a preview object URL (null for RAW/HEIC
// which the browser can't render, or beyond the preview cap).
export interface SelImg { file: File; url: string | null }

// How many object URLs to create up front. Generous enough to fully preview a
// typical shoot in the review modal; large enough sets show the rest as
// removable placeholders.
const PREVIEW_CAP = 500;

export const SHOOT_TYPES: { value: string; label: string }[] = [
  { value: "wedding", label: "Wedding" },
  { value: "portrait", label: "Portrait" },
  { value: "event", label: "Event" },
  { value: "newborn", label: "Newborn" },
  { value: "commercial", label: "Commercial" },
];

// Rank styles for the shoot type: tag/category match first, then presets.
export function rankStyles(styles: StyleRow[], type: string): StyleRow[] {
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

/**
 * Shared "Live Canvas" (Concept C) state + actions. The visual variants
 * (create-c, create-c2, create-c3) are thin layouts over this one hook so the
 * behaviour stays identical while we compare layouts.
 */
export function useCanvasFlow() {
  const navigate = useNavigate();
  const { styles, submit, busy, isUploading, uploadProgress, availableEdits, isUnlimited, cullingLanguage } = useCreateGalleryFlow();

  const [name, setName] = useState("");
  const [type, setType] = useState("wedding");
  const [items, setItems] = useState<SelImg[]>([]);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [styleTouched, setStyleTouched] = useState(false);
  const [cull, setCull] = useState(true);
  const [categories, setCategories] = useState<string[]>(() => defaultCullingTags("wedding"));
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

  const ingest = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter(isImageFile);
    if (imgs.length === 0) return;
    // Replacing the selection — revoke the previous batch's URLs.
    objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrls.current = [];
    let made = 0;
    const next: SelImg[] = imgs.map((f) => {
      let url: string | null = null;
      if (isPreviewable(f) && made < PREVIEW_CAP) {
        url = URL.createObjectURL(f);
        objectUrls.current.push(url);
        made++;
      }
      return { file: f, url };
    });
    setItems(next);
    if (!name.trim()) {
      const mid = imgs.map((f) => f.lastModified).filter(Boolean).sort((a, b) => a - b)[Math.floor(imgs.length / 2)];
      const d = mid ? new Date(mid) : new Date();
      setName(`Shoot · ${d.toLocaleString("en-US", { month: "long", year: "numeric" })}`);
    }
  };

  // Remove a single photo the user picked by mistake.
  const removeAt = (index: number) => {
    setItems((prev) => {
      const target = prev[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const setDrive = (info: DriveFolderInfo | null, links: string[]) => {
    setDriveFolderInfo(info);
    setDriveLinks(links);
  };

  const photos = uploadSource === "drive" ? (driveFolderInfo?.totalImageCount || 0) : items.length;
  const previews = useMemo(
    () => items.map((it) => it.url).filter((u): u is string => !!u),
    [items],
  );

  const style = styles.find((s) => s.id === styleId) ?? null;
  const rankedStyles = rankStyles(styles, type);
  const stylesCount = styleId ? 1 : 0;
  const editsNeeded = useMemo(() => photos * stylesCount, [photos, stylesCount]);
  const complete = name.trim().length > 0 && photos > 0 && !!type;

  // Pre-pick Aura's best-matching look once photos are in.
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
        : { kind: "local", files: items.map((it) => it.file) },
    });
  };

  return {
    navigate,
    styles, busy, isUploading, uploadProgress, availableEdits, isUnlimited, cullingLanguage,
    name, setName, type, changeType,
    photos, previews, items, removeAt, inputRef, ingest,
    uploadSource, setUploadSource, driveFolderInfo, setDrive,
    style, rankedStyles, styleId, pickStyle,
    cull, toggleCull, categories, setCategories,
    stylesCount, editsNeeded, complete, onCreate,
  };
}

export type CanvasFlow = ReturnType<typeof useCanvasFlow>;
