import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ExifData {
  taken_at?: string;
  camera_make?: string;
  camera_model?: string;
  lens_model?: string;
  focal_length?: string;
  aperture?: string;
  shutter_speed?: string;
  iso?: number;
}

// --- Minimal JPEG EXIF parser ---

function readUint16(buf: Uint8Array, offset: number, littleEndian: boolean): number {
  return littleEndian
    ? buf[offset] | (buf[offset + 1] << 8)
    : (buf[offset] << 8) | buf[offset + 1];
}

function readUint32(buf: Uint8Array, offset: number, littleEndian: boolean): number {
  return littleEndian
    ? buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)
    : (buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3];
}

function readString(buf: Uint8Array, offset: number, length: number): string {
  let str = "";
  for (let i = 0; i < length; i++) {
    const c = buf[offset + i];
    if (c === 0) break;
    str += String.fromCharCode(c);
  }
  return str.trim();
}

function readRational(buf: Uint8Array, offset: number, le: boolean): number {
  const num = readUint32(buf, offset, le);
  const den = readUint32(buf, offset + 4, le);
  return den === 0 ? 0 : num / den;
}

// EXIF tag IDs
const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_ORIGINAL = 0x9003;
const TAG_EXPOSURE_TIME = 0x829a;
const TAG_FNUMBER = 0x829d;
const TAG_ISO = 0x8827;
const TAG_FOCAL_LENGTH = 0x920a;
const TAG_LENS_MODEL = 0xa434;

// TIFF type sizes
const TYPE_SIZES: Record<number, number> = {
  1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8, 12: 8,
};

function readTagValue(buf: Uint8Array, tiffStart: number, type: number, count: number, valueOffset: number, le: boolean): string | number | null {
  const totalSize = (TYPE_SIZES[type] || 1) * count;
  // If total size <= 4, value is stored inline in the offset field
  const dataOffset = totalSize <= 4 ? valueOffset : tiffStart + readUint32(buf, valueOffset, le);

  if (dataOffset + totalSize > buf.length) return null;

  if (type === 2) {
    // ASCII string
    return readString(buf, dataOffset, count);
  } else if (type === 3) {
    // SHORT
    return readUint16(buf, dataOffset, le);
  } else if (type === 4) {
    // LONG
    return readUint32(buf, dataOffset, le);
  } else if (type === 5 || type === 10) {
    // RATIONAL / SRATIONAL
    return readRational(buf, dataOffset, le);
  }
  return null;
}

function parseIFD(buf: Uint8Array, tiffStart: number, ifdOffset: number, le: boolean, tags: Map<number, unknown>) {
  const abs = tiffStart + ifdOffset;
  if (abs + 2 > buf.length) return;
  const entryCount = readUint16(buf, abs, le);

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = abs + 2 + i * 12;
    if (entryOffset + 12 > buf.length) break;

    const tag = readUint16(buf, entryOffset, le);
    const type = readUint16(buf, entryOffset + 2, le);
    const count = readUint32(buf, entryOffset + 4, le);

    const val = readTagValue(buf, tiffStart, type, count, entryOffset + 8, le);
    if (val !== null) {
      tags.set(tag, val);
    }
  }
}

function parseExif(buf: Uint8Array): ExifData {
  const result: ExifData = {};

  // Find EXIF APP1 marker
  let offset = 0;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return result; // Not JPEG
  offset = 2;

  while (offset < buf.length - 4) {
    if (buf[offset] !== 0xff) { offset++; continue; }
    const marker = buf[offset + 1];
    if (marker === 0xe1) {
      // APP1 - potential EXIF
      const segLen = readUint16(buf, offset + 2, false);
      const exifHeader = readString(buf, offset + 4, 4);
      if (exifHeader === "Exif") {
        const tiffStart = offset + 10; // After "Exif\0\0"
        if (tiffStart + 8 > buf.length) return result;

        const le = buf[tiffStart] === 0x49; // II = little-endian
        const ifd0Offset = readUint32(buf, tiffStart + 4, le);

        const tags = new Map<number, unknown>();
        parseIFD(buf, tiffStart, ifd0Offset, le, tags);

        // Read Make/Model from IFD0
        if (tags.has(TAG_MAKE)) result.camera_make = String(tags.get(TAG_MAKE));
        if (tags.has(TAG_MODEL)) result.camera_model = String(tags.get(TAG_MODEL));

        // Parse EXIF sub-IFD
        if (tags.has(TAG_EXIF_IFD)) {
          const exifIfdOffset = tags.get(TAG_EXIF_IFD) as number;
          const exifTags = new Map<number, unknown>();
          parseIFD(buf, tiffStart, exifIfdOffset, le, exifTags);

          if (exifTags.has(TAG_DATE_ORIGINAL)) {
            const dateStr = String(exifTags.get(TAG_DATE_ORIGINAL));
            // Convert "YYYY:MM:DD HH:MM:SS" to ISO 8601
            const iso = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
            result.taken_at = iso;
          }

          if (exifTags.has(TAG_EXPOSURE_TIME)) {
            const exp = exifTags.get(TAG_EXPOSURE_TIME) as number;
            result.shutter_speed = exp >= 1 ? `${exp}s` : `1/${Math.round(1 / exp)}s`;
          }

          if (exifTags.has(TAG_FNUMBER)) {
            const fn = exifTags.get(TAG_FNUMBER) as number;
            result.aperture = `f/${fn % 1 === 0 ? fn : fn.toFixed(1)}`;
          }

          if (exifTags.has(TAG_ISO)) {
            result.iso = exifTags.get(TAG_ISO) as number;
          }

          if (exifTags.has(TAG_FOCAL_LENGTH)) {
            const fl = exifTags.get(TAG_FOCAL_LENGTH) as number;
            result.focal_length = `${fl % 1 === 0 ? fl : fl.toFixed(1)}mm`;
          }

          if (exifTags.has(TAG_LENS_MODEL)) {
            result.lens_model = String(exifTags.get(TAG_LENS_MODEL));
          }
        }

        return result;
      }
    }
    // Skip to next marker
    const len = readUint16(buf, offset + 2, false);
    offset += 2 + len;
  }

  return result;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageId, imageUrl } = await req.json();
    if (!imageId || !imageUrl) {
      return new Response(JSON.stringify({ error: "Missing imageId or imageUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Extracting EXIF for image:", imageId);

    // Fetch only the first 128KB (enough for EXIF headers)
    const response = await fetch(imageUrl, {
      headers: { Range: "bytes=0-131071" },
    });

    if (!response.ok && response.status !== 206) {
      // If Range not supported, try full fetch but limit read
      const fullResponse = await fetch(imageUrl);
      if (!fullResponse.ok) {
        console.error("Failed to fetch image:", fullResponse.status);
        return new Response(JSON.stringify({ error: "Failed to fetch image" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const reader = fullResponse.body!.getReader();
      const chunks: Uint8Array[] = [];
      let totalRead = 0;
      while (totalRead < 131072) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        totalRead += value.length;
      }
      reader.cancel();
      const buf = new Uint8Array(totalRead);
      let pos = 0;
      for (const chunk of chunks) {
        buf.set(chunk, pos);
        pos += chunk.length;
      }
      var imageBytes = buf;
    } else {
      var imageBytes = new Uint8Array(await response.arrayBuffer());
    }

    const exifData = parseExif(imageBytes);
    console.log("EXIF data extracted:", JSON.stringify(exifData));

    // Update the database if we found any data
    if (Object.keys(exifData).length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const updateData: Record<string, unknown> = {};
      if (exifData.taken_at) updateData.taken_at = exifData.taken_at;
      if (exifData.camera_make) updateData.camera_make = exifData.camera_make;
      if (exifData.camera_model) updateData.camera_model = exifData.camera_model;
      if (exifData.lens_model) updateData.lens_model = exifData.lens_model;
      if (exifData.focal_length) updateData.focal_length = exifData.focal_length;
      if (exifData.aperture) updateData.aperture = exifData.aperture;
      if (exifData.shutter_speed) updateData.shutter_speed = exifData.shutter_speed;
      if (exifData.iso) updateData.iso = exifData.iso;

      const { error } = await supabase
        .from("gallery_images")
        .update(updateData)
        .eq("id", imageId);

      if (error) {
        console.error("Error updating EXIF data:", error);
      } else {
        console.log("EXIF data saved for image:", imageId);
      }
    }

    return new Response(JSON.stringify({ success: true, exif: exifData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in extract-exif:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
