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
// resolvable from Deno.
//
// RAW befores ARE materialized and edited: the engine processes RAW (customer
// galleries accept RAW and are edited identically). RAW isn't browser-
// renderable, so the compare's SOURCE pane shows a file-card — the model's
// edit output is a normal raster and displays fine.

/** Parse `{ filename }` out of a stored B2 url (handles query strings + URL-encoded names). */
function parseUrl(url: string): { filename: string } {
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
  return { filename };
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

  // Materialize ALL befores — including RAW. The editing engine processes RAW
  // (customer galleries accept CR2/CR3/NEF/... uploads and are edited the same
  // way), so a RAW-source style like a Drive import must still get its
  // "model's edit" for the three-way compare. RAW just isn't browser-
  // renderable, so viewers show a file-card for the SOURCE pane — the model's
  // edit output is a normal raster and displays fine.
  const editableUrls = beforeUrls;

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

/** Outcome of a source-edit attempt, so callers can surface a status/notify. */
export interface SourceEditResult {
  status:
    | "dispatched" // process-images was kicked off for `dispatched` images
    | "already_done" // every source image already has an edit for this style
    | "skipped_too_many" // over the auto cap and not forced — needs a manual run
    | "no_editable_source" // source gallery has 0 editable (e.g. all-RAW befores)
    | "no_gallery" // no trained model / couldn't materialize the gallery
    | "error"; // process-images dispatch failed
  dispatched: number;
  total: number;
}

/**
 * Ensure the source gallery exists, then dispatch process-images for any of
 * its images that don't yet have an edit from this style. Mirrors
 * `autoProcessShowcase` in train-webhook/index.ts. Non-fatal — logs and
 * returns a result on any failure, never throws.
 *
 * Pass `{ force: true }` (manual admin trigger) to bypass the auto-dispatch
 * size cap so large source sets can still be edited on demand.
 */
export async function autoProcessStyleSource(
  admin: any,
  supabaseUrl: string,
  serviceKey: string,
  styleId: string,
  opts?: { force?: boolean },
): Promise<SourceEditResult> {
  const galleryId = await ensureStyleSourceGallery(admin, styleId);
  if (!galleryId) {
    console.log(`autoProcessStyleSource: no source gallery for style ${styleId}, skipping`);
    return { status: "no_gallery", dispatched: 0, total: 0 };
  }

  const { data: style } = await admin
    .from("styles")
    .select("user_id")
    .eq("id", styleId)
    .maybeSingle();

  if (!style) {
    console.log(`autoProcessStyleSource: style ${styleId} not found, skipping`);
    return { status: "no_gallery", dispatched: 0, total: 0 };
  }

  const { data: images } = await admin
    .from("gallery_images")
    .select("id")
    .eq("gallery_id", galleryId)
    .neq("status", "deleted");

  const total = images?.length ?? 0;
  if (total === 0) {
    // Nothing editable — typically an all-RAW before set (RAW isn't materialized).
    console.log(`autoProcessStyleSource: no editable source images for style ${styleId}, skipping`);
    return { status: "no_editable_source", dispatched: 0, total: 0 };
  }

  // Guard against runaway cost — don't auto-run the engine on a huge source
  // set without an explicit admin click (opts.force from style-source-edit).
  if (!opts?.force && total > MAX_AUTO_DISPATCH_IMAGES) {
    console.log(
      `autoProcessStyleSource: source gallery for style ${styleId} has ${total} images (> ${MAX_AUTO_DISPATCH_IMAGES}), skipping automatic dispatch`,
    );
    return { status: "skipped_too_many", dispatched: 0, total };
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
    return { status: "already_done", dispatched: 0, total };
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
    return { status: "error", dispatched: 0, total };
  }

  console.log(`autoProcessStyleSource: process-images dispatched for style ${styleId}`);
  return { status: "dispatched", dispatched: unprocessedIds.length, total };
}
