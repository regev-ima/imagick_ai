// Single source of truth for "what counts as an uploadable image".
//
// Allowed: any raster photo (image/* MIME) + camera RAW + HEIC/HEIF.
// Rejected: video, PDF, audio, archives, documents — everything else.
//
// Used by the Uppy uploader (restrictions.allowedFileTypes), the <input
// accept> attributes, and the runtime guard for drag-and-drop / programmatic
// adds, so the policy can't drift between entry points.

// RAW + formats browsers frequently report with an empty or non-image MIME,
// so they must be allowed by extension (image/* won't match them).
const RAW_EXTENSIONS = [
  "cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "dng", "raf",
  "rw2", "orf", "pef", "ptx", "srw", "x3f", "3fr", "fff", "iiq", "rwl",
  "mos", "mef", "mrw", "dcr", "kdc", "erf", "raw", "heic", "heif",
];

// Common raster extensions — normally covered by the image/* MIME, listed
// too for files that arrive with no MIME at all.
const RASTER_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff", "avif"];

const ALL_IMAGE_EXTENSIONS = [...RASTER_EXTENSIONS, ...RAW_EXTENSIONS];

/** For Uppy `restrictions.allowedFileTypes` (MIME wildcards + extensions). */
export const IMAGE_ACCEPT_TYPES: string[] = ["image/*", ...RAW_EXTENSIONS.map((e) => `.${e}`)];

/** Comma-joined for an HTML `<input accept="...">`. */
export const IMAGE_ACCEPT = IMAGE_ACCEPT_TYPES.join(",");

const EXT_RE = new RegExp(`\\.(${ALL_IMAGE_EXTENSIONS.join("|")})$`, "i");

/**
 * True only for real images (raster or RAW). Explicitly rejects video, and
 * anything else without an image/* MIME or a known image extension — so PDFs,
 * audio, archives, etc. never get uploaded.
 */
export function isImageFile(file: File): boolean {
  if (file.type.startsWith("video/")) return false;
  if (file.type.startsWith("image/")) return true;
  return EXT_RE.test(file.name);
}
