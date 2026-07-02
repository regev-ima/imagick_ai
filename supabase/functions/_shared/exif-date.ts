// Minimal, cheap EXIF capture-time extractor.
//
// Grouping's temporal gate needs each photo's true capture time. Previously that
// lived only in extract-exif, triggered by the style-edit webhook — so
// culling-only galleries never got it and grouping collapsed to pure-CLIP
// (everything merged). This module lets the pipeline populate capture times
// itself, right before grouping, with a cheap 128KB range-fetch of the original
// (EXIF lives in the JPEG header). JPEG only — non-JPEG originals return null,
// same limitation extract-exif always had.

function readUint16(buf: Uint8Array, o: number, le: boolean): number {
  return le ? buf[o] | (buf[o + 1] << 8) : (buf[o] << 8) | buf[o + 1];
}
function readUint32(buf: Uint8Array, o: number, le: boolean): number {
  return le
    ? buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)
    : (buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3];
}
function readString(buf: Uint8Array, o: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    const c = buf[o + i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
}

const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_ORIGINAL = 0x9003;

// Returns DateTimeOriginal as an ISO-8601 string, or null.
export function parseCaptureTime(buf: Uint8Array): string | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null; // not JPEG
  let offset = 2;
  while (offset < buf.length - 4) {
    if (buf[offset] !== 0xff) { offset++; continue; }
    const marker = buf[offset + 1];
    if (marker === 0xe1) {
      if (readString(buf, offset + 4, 4) === "Exif") {
        const tiffStart = offset + 10;
        if (tiffStart + 8 > buf.length) return null;
        const le = buf[tiffStart] === 0x49;
        const ifd0 = readUint32(buf, tiffStart + 4, le);

        // Walk IFD0 to find the EXIF sub-IFD pointer.
        const abs0 = tiffStart + ifd0;
        if (abs0 + 2 > buf.length) return null;
        const count0 = readUint16(buf, abs0, le);
        let exifIfd = 0;
        for (let i = 0; i < count0; i++) {
          const e = abs0 + 2 + i * 12;
          if (e + 12 > buf.length) break;
          if (readUint16(buf, e, le) === TAG_EXIF_IFD) {
            exifIfd = readUint32(buf, e + 8, le);
            break;
          }
        }
        if (!exifIfd) return null;

        // Walk the EXIF sub-IFD for DateTimeOriginal (ASCII "YYYY:MM:DD HH:MM:SS").
        const absE = tiffStart + exifIfd;
        if (absE + 2 > buf.length) return null;
        const countE = readUint16(buf, absE, le);
        for (let i = 0; i < countE; i++) {
          const e = absE + 2 + i * 12;
          if (e + 12 > buf.length) break;
          if (readUint16(buf, e, le) === TAG_DATE_ORIGINAL) {
            const type = readUint16(buf, e + 2, le);
            const cnt = readUint32(buf, e + 4, le);
            if (type !== 2) return null; // expect ASCII
            const total = cnt; // ASCII = 1 byte each
            const dataOffset = total <= 4 ? e + 8 : tiffStart + readUint32(buf, e + 8, le);
            if (dataOffset + total > buf.length) return null;
            const raw = readString(buf, dataOffset, cnt);
            const iso = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
            const ms = Date.parse(iso);
            return Number.isNaN(ms) ? null : new Date(ms).toISOString();
          }
        }
        return null;
      }
    }
    const len = readUint16(buf, offset + 2, false);
    offset += 2 + len;
  }
  return null;
}

// Cheap capture-time fetch: range-request the first 128KB of the ORIGINAL
// (EXIF is in the header) and parse DateTimeOriginal. Never throws — returns
// null on any failure so the caller can proceed without a time gate.
export async function fetchCaptureTime(originalUrl: string): Promise<string | null> {
  try {
    let bytes: Uint8Array;
    const res = await fetch(originalUrl, { headers: { Range: "bytes=0-131071" } });
    if (res.ok || res.status === 206) {
      bytes = new Uint8Array(await res.arrayBuffer());
    } else {
      const full = await fetch(originalUrl);
      if (!full.ok) return null;
      bytes = new Uint8Array(await full.arrayBuffer());
    }
    return parseCaptureTime(bytes);
  } catch {
    return null;
  }
}
