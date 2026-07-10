// Materializes a style's own BEFORE set as a hidden "source" gallery
// (galleries.is_system = true, name = '__style_source__') so that:
//   1. requirement 2 — training completion auto-edits the style's own
//      training material with the freshly trained model, and
//   2. requirement 3 (T4) — the three-way compare (source · photographer's
//      edit · model's edit) has somewhere to join `image_edits` against.
//
// This file is DENO-only (imported by edge functions under
// supabase/functions/). Do NOT import src/lib/styleFiles.ts here — that
// module lives in the frontend's Vite module graph (`@/` alias) and is not
// resolvable from Deno. The tiny bit of RAW-extension logic needed here is
// duplicated locally instead.

// Kept in sync with RAW_EXTENSIONS in src/lib/styleFiles.ts — the engine and
// every viewer only handle JPEG/PNG/WebP-ish rasters; RAW befores are still
// counted in stats elsewhere (styleFiles.ts, frontend) but are not editable.
const RAW_EXTENSIONS = new Set([
  "cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "raf", "dng",
  "orf", "rw2", "pef", "srw", "raw", "rwl", "3fr", "fff", "iiq", "x3f",
]);

/** Parse `{ filename, ext }` out of a stored B2 url (handles query strings + URL-encoded names). */
function parseUrl(url: string): { filename: string; ext: string } {
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
  const ext = lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : "";
  return { filename, ext };
}

function isRawUrl(url: string): boolean {
  const { ext } = parseUrl(url);
  return RAW_EXTENSIONS.has(ext);
}

const INSERT_BATCH_SIZE = 500;
// Don't auto-run the (paid, external) editing engine against a huge source
// set without an explicit admin click — see style-source-edit/index.ts.
const MAX_AUTO_DISPATCH_IMAGES = 500;

/**
 * Ensure the style has a `__style_source__` gallery materializing its
 * BEFORE set, creating + backfilling it if necessary. Idempotent — safe to
 * call repeatedly (skips images already inserted, skips gallery creation if
 * one already exists).
 *
 * Returns the gallery id, or null if the style doesn't exist / has no
 * trained model (nothing to edit with) — non-fatal, callers should log and
 * move on.
 */
export async function ensureStyleSourceGallery(
  admin: any,
  styleId: string,
): Promise<string | null> {
  const { data: style, error: styleError } = await admin
    .from("styles")
    .select("user_id, before_image_urls, source_gallery_id, style_id_external")
    .eq("id", styleId)
    .maybeSingle();

  if (styleError || !style) {
    console.log(`ensureStyleSourceGallery: style ${styleId} not found, skipping`);
    return null;
  }

  if (!style.style_id_external) {
    console.log(`ensureStyleSourceGallery: style ${styleId} has no trained model yet, skipping`);
    return null;
  }

  // Idempotent fast path: source_gallery_id already set and the gallery
  // still exists (it could have been deleted out-of-band).
  if (style.source_gallery_id) {
    const { data: existingGallery } = await admin
      .from("galleries")
      .select("id")
      .eq("id", style.source_gallery_id)
      .maybeSingle();
    if (existingGallery) {
      return existingGallery.id as string;
    }
    console.warn(
      `ensureStyleSourceGallery: style ${styleId} had source_gallery_id ${style.source_gallery_id} pointing at a missing gallery, recreating`,
    );
  }

  const userId = style.user_id as string;
  const beforeUrls: string[] = (style.before_image_urls || []).filter((u: string | null) => !!u);

  let galleryId = style.source_gallery_id as string | null;

  if (!galleryId) {
    // Minimal shape — only columns that are actually NOT NULL / have no
    // usable default (see src/hooks/useCreateGalleryFlow.ts: name + user_id
    // are required, status/total_images/etc. all default sanely). is_system
    // + status are set explicitly since this gallery must never surface in
    // user-facing gallery lists and needs no upload/processing lifecycle.
    const { data: newGallery, error: createError } = await admin
      .from("galleries")
      .insert({
        user_id: userId,
        name: "__style_source__",
        is_system: true,
        status: "ready",
      })
      .select("id")
      .single();

    if (createError || !newGallery) {
      console.error(`ensureStyleSourceGallery: failed to create source gallery for style ${styleId}:`, createError);
      return null;
    }
    galleryId = newGallery.id as string;
  }

  // Skip RAW befores — not browser-renderable / not engine-editable. Still
  // counted in stats elsewhere (styleFiles.ts on the frontend), just not
  // materialized as editable gallery_images rows here.
  const editableUrls = beforeUrls.filter((u) => !isRawUrl(u));

  // Idempotency for a second/backfill call: don't duplicate rows for
  // filenames already inserted.
  const { data: existingImages } = await admin
    .from("gallery_images")
    .select("filename")
    .eq("gallery_id", galleryId);
  const existingFilenames = new Set((existingImages || []).map((i: any) => i.filename));

  const toInsert = editableUrls
    .map((url, index) => {
      const { filename } = parseUrl(url);
      return {
        gallery_id: galleryId,
        user_id: userId,
        original_url: url,
        filename,
        status: "ready",
        sort_order: index,
      };
    })
    .filter((row) => !existingFilenames.has(row.filename));

  for (let i = 0; i < toInsert.length; i += INSERT_BATCH_SIZE) {
    const batch = toInsert.slice(i, i + INSERT_BATCH_SIZE);
    const { error: insertError } = await admin.from("gallery_images").insert(batch);
    if (insertError) {
      console.error(`ensureStyleSourceGallery: failed to insert batch for style ${styleId}:`, insertError);
      // Keep going with the remaining batches rather than aborting entirely.
    }
  }

  if (!style.source_gallery_id || style.source_gallery_id !== galleryId) {
    await admin.from("styles").update({ source_gallery_id: galleryId }).eq("id", styleId);
  }

  return galleryId;
}

/**
 * Ensure the source gallery exists, then dispatch process-images for any of
 * its images that don't yet have an edit from this style. Mirrors
 * `autoProcessShowcase` in train-webhook/index.ts. Non-fatal — logs and
 * returns on any failure, never throws.
 */
export async function autoProcessStyleSource(
  admin: any,
  supabaseUrl: string,
  serviceKey: string,
  styleId: string,
): Promise<void> {
  const galleryId = await ensureStyleSourceGallery(admin, styleId);
  if (!galleryId) {
    console.log(`autoProcessStyleSource: no source gallery for style ${styleId}, skipping`);
    return;
  }

  const { data: style } = await admin
    .from("styles")
    .select("user_id")
    .eq("id", styleId)
    .maybeSingle();

  if (!style) {
    console.log(`autoProcessStyleSource: style ${styleId} not found, skipping`);
    return;
  }

  const { data: images } = await admin
    .from("gallery_images")
    .select("id")
    .eq("gallery_id", galleryId)
    .neq("status", "deleted");

  if (!images || images.length === 0) {
    console.log(`autoProcessStyleSource: no images in source gallery for style ${styleId}, skipping`);
    return;
  }

  // Guard against runaway cost — don't auto-run the engine on a huge source
  // set without an explicit admin click (style-source-edit/index.ts).
  if (images.length > MAX_AUTO_DISPATCH_IMAGES) {
    console.log(
      `autoProcessStyleSource: source gallery for style ${styleId} has ${images.length} images (> ${MAX_AUTO_DISPATCH_IMAGES}), skipping automatic dispatch`,
    );
    return;
  }

  const imageIds = images.map((img: any) => img.id);

  const { data: existingEdits } = await admin
    .from("image_edits")
    .select("image_id")
    .eq("style_id", styleId)
    .in("image_id", imageIds);

  const processedSet = new Set((existingEdits || []).map((e: any) => e.image_id));
  const unprocessedIds = imageIds.filter((id: string) => !processedSet.has(id));

  if (unprocessedIds.length === 0) {
    console.log(`autoProcessStyleSource: all source images already processed for style ${styleId}`);
    return;
  }

  console.log(`autoProcessStyleSource: processing ${unprocessedIds.length} source images for style ${styleId}`);

  const response = await fetch(`${supabaseUrl}/functions/v1/process-images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      galleryId,
      imageIds: unprocessedIds,
      styleIds: [styleId],
      userId: style.user_id,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`autoProcessStyleSource: process-images dispatch failed for style ${styleId}:`, errorText);
  } else {
    console.log(`autoProcessStyleSource: process-images dispatched for style ${styleId}`);
  }
}
