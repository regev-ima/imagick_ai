/**
 * Parsing/classification helpers for style training files (the BEFORE/AFTER
 * originals stored under `styles/{userId}/{styleId}/{before|after}/` in B2).
 *
 * No thumbnail/compressed derivatives exist for `styles/...` paths — the
 * compression pipeline only runs for gallery uploads — so any viewer of
 * training files must load the ORIGINAL url with an onError fallback, and
 * RAW files must render as a file-card placeholder (browsers can't decode
 * CR2/NEF/ARW/...).
 */

export type StyleFileKind = "raw" | "jpeg" | "png" | "heic" | "tiff" | "webp" | "other";

export const RAW_EXTENSIONS = new Set([
  "cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "raf", "dng",
  "orf", "rw2", "pef", "srw", "raw", "rwl", "3fr", "fff", "iiq", "x3f",
]);

export interface ParsedStyleFile {
  url: string;
  filename: string;
  ext: string;
  kind: StyleFileKind;
}

function classifyExt(ext: string): StyleFileKind {
  const e = ext.toLowerCase();
  if (RAW_EXTENSIONS.has(e)) return "raw";
  if (e === "jpg" || e === "jpeg") return "jpeg";
  if (e === "png") return "png";
  if (e === "heic" || e === "heif") return "heic";
  if (e === "tif" || e === "tiff") return "tiff";
  if (e === "webp") return "webp";
  return "other";
}

/** Extract `{ filename, ext, kind }` from a stored B2 url (handles query strings + URL-encoded names). */
export function parseStyleFile(url: string): ParsedStyleFile {
  const raw = url || "";
  // Strip hash/query BEFORE decoding — the delimiters are literal, unencoded characters.
  let path = raw.split("#")[0].split("?")[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    // malformed percent-encoding — fall back to the raw (un-decoded) path
  }
  const lastSlash = path.lastIndexOf("/");
  const filename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  const lastDot = filename.lastIndexOf(".");
  const ext = lastDot > 0 ? filename.slice(lastDot + 1) : "";
  return { url, filename, ext, kind: classifyExt(ext) };
}

export interface FileBreakdown {
  total: number;
  byKind: Record<StyleFileKind, number>;
  files: ParsedStyleFile[];
}

/** Count + classify a list of style file urls, skipping null/empty entries. */
export function breakdownFiles(urls: (string | null | undefined)[] | null | undefined): FileBreakdown {
  const files = (urls || []).filter((u): u is string => !!u).map(parseStyleFile);
  const byKind: Record<StyleFileKind, number> = {
    raw: 0,
    jpeg: 0,
    png: 0,
    heic: 0,
    tiff: 0,
    webp: 0,
    other: 0,
  };
  for (const f of files) byKind[f.kind]++;
  return { total: files.length, byKind, files };
}

/** Lowercased filename stem (extension stripped, last dot only) — the key used to pair before↔after by original filename. */
export function stemOf(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  return base.toLowerCase();
}

export interface StemPair {
  stem: string;
  before?: string;
  after?: string;
}

/**
 * Pair BEFORE/AFTER urls by filename stem (case-insensitive, extension
 * stripped). Unmatched images still get a row with only one side set.
 * Sorted numerically by stem (so "img2" sorts before "img10").
 */
export function pairByStem(
  beforeUrls: (string | null | undefined)[] | null | undefined,
  afterUrls: (string | null | undefined)[] | null | undefined,
): StemPair[] {
  const map = new Map<string, StemPair>();

  for (const u of beforeUrls || []) {
    if (!u) continue;
    const stem = stemOf(parseStyleFile(u).filename);
    const existing = map.get(stem);
    if (existing) existing.before = u;
    else map.set(stem, { stem, before: u });
  }

  for (const u of afterUrls || []) {
    if (!u) continue;
    const stem = stemOf(parseStyleFile(u).filename);
    const existing = map.get(stem);
    if (existing) existing.after = u;
    else map.set(stem, { stem, after: u });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.stem.localeCompare(b.stem, undefined, { numeric: true }),
  );
}
