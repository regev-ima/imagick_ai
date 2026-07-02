// Phase A orchestrator: pull a gallery's images from B2, run them through the
// Modal GPU engine (CLIP + aesthetic + ArcFace) in batches, store the results
// in pgvector, then cluster images (visual) and faces (by person).
//
// Required env (Supabase function secrets):
//   MODAL_URL   - the deployed Modal endpoint (https://...modal.run/...)
//   MODAL_TOKEN - the PIPELINE_TOKEN shared secret set on Modal
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

const IMAGES_PER_INVOCATION = 100; // keep each invocation under the runtime limit
const MODAL_BATCH = 12;            // images per Modal HTTP call
const MODAL_CONCURRENCY = 3;       // Modal calls in flight at once (matches max_containers)
const CULLING_CONCURRENCY = 8;     // parallel VLM culling calls (score-vision)
const TIME_BUDGET_MS = 110_000;

// Old default photo-shoot labels, used if the caller doesn't pass its own.
const DEFAULT_LABELS = [
  "Preparations", "Outdoor photography", "Couple moments",
  "Family & Reception", "Ceremony", "Dance/Party", "Other",
];

// Photo-style tag candidates the VLM chooses from (tagging is via OpenRouter now,
// not CLIP). Overridable by the caller via options.tagsList.
const DEFAULT_TAGS = [
  "תקריב פנים", "גוף מלא", "קלוז-אפ", "פרופיל", "סביבתי", "סטודיו",
  "אור טבעי", "שחור-לבן", "הבעה", "מונחה", "ספונטני", "יצירתי",
];

// Rough Modal L4 GPU price (~$0.80/hr) for an ESTIMATED cost — Modal bills GPU
// container-seconds, not per-call. Only an approximation for the test dashboard.
const MODAL_L4_USD_PER_SEC = 0.80 / 3600;

// B2 originals have a small compressed `.webp` sibling (matches src/lib/imageUrls.ts) —
// cheaper bandwidth + faster downloads, still big enough for accurate face embeddings.
// (The thumbnail variant is even smaller but too low-res for reliable ArcFace.)
function toPreviewUrl(originalUrl: string): string {
  try {
    if (originalUrl.includes("/compressed/") && originalUrl.includes("_reduced")) return originalUrl;
    const lastSlash = originalUrl.lastIndexOf("/");
    if (lastSlash === -1) return originalUrl;
    let base = originalUrl.substring(0, lastSlash);
    const full = originalUrl.substring(lastSlash + 1);
    const dot = full.lastIndexOf(".");
    let name = dot > 0 ? full.substring(0, dot) : full;
    // Strip any already-derived markers so we point at the canonical preview.
    base = base.replace(/\/(thumbnail|compressed)$/, "");
    name = name.replace(/_reduced_thumbnail$/, "").replace(/_reduced$/, "");
    return `${base}/compressed/${name}_reduced.webp`;
  } catch {
    return originalUrl;
  }
}

// The tiny thumbnail (~256px). Fine for CLIP (rating/clustering/tags all use 224px),
// too small for faces — so only used when faces are off. Much cheaper/faster.
function toThumbnailUrl(originalUrl: string): string {
  try {
    if (originalUrl.includes("/thumbnail/") && originalUrl.includes("_reduced_thumbnail")) return originalUrl;
    const lastSlash = originalUrl.lastIndexOf("/");
    if (lastSlash === -1) return originalUrl;
    let base = originalUrl.substring(0, lastSlash);
    const full = originalUrl.substring(lastSlash + 1);
    const dot = full.lastIndexOf(".");
    let name = dot > 0 ? full.substring(0, dot) : full;
    base = base.replace(/\/(thumbnail|compressed)$/, "");
    name = name.replace(/_reduced_thumbnail$/, "").replace(/_reduced$/, "");
    return `${base}/thumbnail/${name}_reduced_thumbnail.webp`;
  } catch {
    return originalUrl;
  }
}

interface ModalFace {
  bbox: [number, number, number, number]; // raw px in the detection frame
  bbox_norm?: [number, number, number, number]; // 0..1 in the detection frame
  frame?: [number, number]; // detection-frame [w, h]
  det_score: number;
  embedding: number[];
}
interface ModalTag { tag: string; score: number }
interface ModalResult {
  id: string;
  clip?: number[];
  aesthetic?: number;
  faces?: ModalFace[];
  tags?: ModalTag[];
  error?: string;
}

// Face bboxes are detected on whatever frame Modal downloaded (preview OR the tiny
// thumbnail). Consumers (FaceThumbnail / FaceCrop) render the face against the
// PREVIEW/ORIGINAL image, so the box must be in ORIGINAL-image pixels. Convert the
// normalized (0..1) coords by the original width/height. We store BOTH {x,y} and
// {left,top} aliases so every consumer key works, plus source_* for traceability.
// Fallback (no original dims yet): keep detection-frame px + record its frame size.
function faceBox(f: ModalFace, origW: number | null, origH: number | null) {
  const n = f.bbox_norm;
  if (n && origW && origH && origW > 0 && origH > 0) {
    const x = n[0] * origW, y = n[1] * origH;
    const width = (n[2] - n[0]) * origW, height = (n[3] - n[1]) * origH;
    return { x, y, left: x, top: y, width, height, source_width: origW, source_height: origH };
  }
  const [x1, y1, x2, y2] = f.bbox;
  const sw = f.frame?.[0] ?? null, sh = f.frame?.[1] ?? null;
  return { x: x1, y: y1, left: x1, top: y1, width: x2 - x1, height: y2 - y1, source_width: sw, source_height: sh };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const modalUrl = Deno.env.get("MODAL_URL");
    const modalToken = Deno.env.get("MODAL_TOKEN");
    const modalGroupUrl = Deno.env.get("MODAL_GROUP_URL"); // whole-gallery grouping endpoint

    if (!modalUrl || !modalToken) {
      return json({ error: "MODAL_URL / MODAL_TOKEN not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const body = await req.json();
    const { galleryId, stall = 0, options } = body as {
      galleryId: string; userId?: string; stall?: number;
      options?: {
        faces?: boolean; cluster?: boolean; tags?: boolean; culling?: boolean;
        source?: "preview" | "thumbnail";
        // OLD-pipeline grouping/culling params (ported into Modal + score-vision).
        labels?: string[]; thresholds?: number[]; timeThreshold?: number | null;
        scoreVisionUrl?: string;
        // VLM tagging + model selection (tagging is via OpenRouter, not CLIP).
        tagsList?: string[]; model?: string;
      };
    };
    if (!galleryId) return json({ error: "Missing galleryId" }, 400);
    // Which optional steps to run. Faces (ArcFace) is the heavy, premium-gated one;
    // CLIP-based clustering/tagging always ride on the one cheap embedding.
    const doFaces = options?.faces !== false;
    const doCluster = options?.cluster !== false;
    const doTags = options?.tags !== false;
    // Culling = the OLD VLM rating/label pass (score-vision `mode:"culling"`), which
    // writes the old gallery_images columns. On by default; needs a score-vision URL.
    // Source of truth = the Edge Function secret SCORE_VISION_URL (a stable PUBLIC
    // endpoint). The frontend-provided value is only a FALLBACK — a browser preview
    // URL is often auth-protected and returns HTML/401 to server-to-server calls.
    const scoreVisionUrl = Deno.env.get("SCORE_VISION_URL") ||
      (typeof options?.scoreVisionUrl === "string" ? options.scoreVisionUrl : null);
    // Optional Vercel "Protection Bypass for Automation" token, so we can reach a
    // PROTECTED preview /api/score-vision server-to-server without opening it to the
    // public. Sent as a request header only — NEVER logged or stored.
    const scoreVisionBypass = Deno.env.get("SCORE_VISION_BYPASS_TOKEN") || null;
    const cullingRequested = options?.culling !== false;
    const doCulling = cullingRequested && !!scoreVisionUrl;
    // Image source: preview (default) or the tiny thumbnail (cheaper; CLIP-only, no faces).
    const source = options?.source === "thumbnail" ? "thumbnail" : "preview";
    // OLD grouping params. `thresholds` → similarity_group_1/2/3; `timeThreshold`
    // (SECONDS) is the hard EXIF gate: images more than this far apart never group.
    const labels = Array.isArray(options?.labels) && options.labels.length
      ? options.labels.filter((t): t is string => typeof t === "string")
      : DEFAULT_LABELS;
    const thresholds = Array.isArray(options?.thresholds) && options.thresholds.length === 3
      ? options.thresholds.map((t) => Number(t))
      : [0.5, 0.7, 0.9];
    const timeThreshold = typeof options?.timeThreshold === "number" ? options.timeThreshold : null;
    // VLM tagging candidates + the chosen vision model (per-test comparison).
    const tagsList = Array.isArray(options?.tagsList) && options.tagsList.length
      ? options.tagsList.filter((t): t is string => typeof t === "string")
      : DEFAULT_TAGS;
    const vlmModel = typeof options?.model === "string" && options.model ? options.model : null;

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Whole-gallery grouping: OLD community-detection over CLIP embeddings + hard
    // EXIF time gate, ported into Modal. Writes similarity_group_1/2/3. Falls back
    // to the SQL clusterer if the Modal group endpoint isn't configured.
    async function groupViaModal() {
      const { data: feats } = await admin
        .from("image_features").select("image_id, clip_vector").eq("gallery_id", galleryId);
      const { data: imgRows } = await admin
        .from("gallery_images").select("id, taken_at").eq("gallery_id", galleryId);
      const takenAt = new Map<string, string | null>(
        (imgRows || []).map((r: { id: string; taken_at: string | null }) => [r.id, r.taken_at] as [string, string | null]),
      );
      const ids: string[] = [];
      const embeddings: number[][] = [];
      const times: (number | null)[] = [];
      for (const f of (feats || []) as { image_id: string; clip_vector: unknown }[]) {
        if (!f.clip_vector) continue;
        let vec: number[];
        try { vec = typeof f.clip_vector === "string" ? JSON.parse(f.clip_vector) : (f.clip_vector as number[]); }
        catch { continue; }
        if (!Array.isArray(vec) || !vec.length) continue;
        ids.push(f.image_id);
        embeddings.push(vec);
        const t = takenAt.get(f.image_id);
        times.push(t ? Math.floor(new Date(t).getTime() / 1000) : null); // epoch seconds; null→1970 in Modal
      }
      if (!ids.length) return;
      const res = await fetch(modalGroupUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: modalToken, embeddings, times, thresholds, time_threshold: timeThreshold }),
      });
      const data = await res.json();
      const groups = data?.groups as number[][] | undefined;
      if (!groups || groups.length !== ids.length) {
        console.error("group endpoint returned unexpected shape", data?.error);
        return;
      }
      // similarity_group_1/2/3 aligned to thresholds[0..2].
      const CHUNK = 25; // keep the update fan-out modest
      for (let i = 0; i < ids.length; i += CHUNK) {
        await Promise.all(ids.slice(i, i + CHUNK).map((id, j) => {
          const g = groups[i + j] || [];
          return admin.from("gallery_images").update({
            similarity_group_1: g[0] ?? null,
            similarity_group_2: g[1] ?? null,
            similarity_group_3: g[2] ?? null,
          }).eq("id", id);
        }));
      }
    }

    // Finalize a fully-processed gallery: group images, cluster faces, mark ready.
    async function finalize() {
      if (doCluster) {
        if (modalGroupUrl) await groupViaModal();
        else await admin.rpc("cluster_gallery_images", { p_gallery_id: galleryId });
      }
      if (doFaces) await admin.rpc("cluster_gallery_faces_arcface", { p_gallery_id: galleryId });
      // Mirror to the legacy culling_* fields the gallery UI watches.
      await admin.from("galleries").update({
        pipeline_status: "ready",
        culling_status: "ready",
        culling_completed_at: new Date().toISOString(),
      }).eq("id", galleryId);
    }

    // Auth: either the gallery owner (user JWT) or an internal self-chain (service key).
    const isInternal = token === supabaseServiceKey;
    if (!isInternal) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser(token);
      if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
      const { data: gallery } = await userClient
        .from("galleries").select("id").eq("id", galleryId).eq("user_id", userData.user.id).single();
      if (!gallery) return json({ error: "Gallery not found or access denied" }, 404);
    }

    await admin.from("galleries").update({
      pipeline_status: "processing",
      pipeline_error: null,
      // Mirror the legacy culling_* fields the gallery UI watches. Stamp the start
      // time only on a fresh user-initiated run (not internal self-chains).
      culling_status: "processing",
      ...(isInternal ? {} : { pipeline_timing: null, culling_started_at: new Date().toISOString() }),
    }).eq("id", galleryId);

    // Culling was requested but there's no endpoint to call it — fail loudly with
    // an actionable message instead of silently skipping the rating pass.
    if (cullingRequested && !scoreVisionUrl) {
      await admin.from("galleries").update({
        pipeline_status: "error",
        culling_status: "error",
        pipeline_error: "חסר scoreVisionUrl: הגדר secret בשם SCORE_VISION_URL ב-Edge Function " +
          "(endpoint ציבורי של /api/score-vision), או שלח options.scoreVisionUrl תקין.",
      }).eq("id", galleryId);
      return json({ error: "missing scoreVisionUrl / SCORE_VISION_URL" }, 400);
    }

    // Images in this gallery that don't yet have CLIP features (computed in JS —
    // more robust than a PostgREST anti-join embed). `faces_done` tracks whether an
    // image's faces were computed in the CURRENT (original-coord) scheme — images
    // with stale/old-scheme faces have faces_done=false and get recomputed.
    const { data: doneRows } = await admin
      .from("image_features").select("image_id, faces_done").eq("gallery_id", galleryId);
    const clipDone = new Set((doneRows || []).map((r: { image_id: string }) => r.image_id));
    const facesDone = new Set(
      (doneRows || []).filter((r: { faces_done?: boolean }) => r.faces_done).map((r: { image_id: string }) => r.image_id),
    );

    // Images that already have an OLD culling score (so we don't re-pay the VLM).
    let cullDone = new Set<string>();
    if (doCulling) {
      const { data: cullRows } = await admin
        .from("gallery_images").select("id").eq("gallery_id", galleryId).not("culling_score", "is", null);
      cullDone = new Set((cullRows || []).map((r: { id: string }) => r.id));
    }

    const { data: allImgs, error: imgErr } = await admin
      .from("gallery_images").select("id, original_url, width, height").eq("gallery_id", galleryId);
    if (imgErr) return json({ error: imgErr.message }, 500);

    const withUrl = (allImgs || [])
      .filter((i: { id: string; original_url: string | null }) => i.original_url) as
      { id: string; original_url: string; width: number | null; height: number | null }[];

    // Original-image dimensions, for converting normalized face boxes → original px.
    const dims = new Map<string, { w: number | null; h: number | null }>(
      withUrl.map((i) => [i.id, { w: i.width, h: i.height }]),
    );

    // A image needs (re)processing on Modal if it lacks CLIP features OR (faces are
    // on and its faces aren't computed in the current scheme yet).
    const images = withUrl
      .filter((i) => !clipDone.has(i.id) || (doFaces && !facesDone.has(i.id)))
      .slice(0, IMAGES_PER_INVOCATION);
    const cullTodo = doCulling ? withUrl.filter((i) => !cullDone.has(i.id)) : [];

    // Everything (CLIP + faces + culling) already computed → finalize and finish.
    if (images.length === 0 && cullTodo.length === 0) {
      await finalize();
      return json({ success: true, done: true });
    }

    const start = Date.now();
    let processed = 0;
    let cullProcessed = 0;

    // Split into batches, then run several Modal calls concurrently (Modal scales
    // to multiple containers under the parallel load).
    const batches: { id: string; original_url: string }[][] = [];
    for (let i = 0; i < images.length; i += MODAL_BATCH) batches.push(images.slice(i, i + MODAL_BATCH));

    const storeResult = async (r: ModalResult) => {
      if (r.error || !r.clip) {
        console.warn("Image failed in Modal:", r.id, r.error);
        return;
      }
      await admin.from("image_features").upsert({
        image_id: r.id,
        gallery_id: galleryId,
        clip_vector: JSON.stringify(r.clip),
        aesthetic: r.aesthetic ?? null,
        tags: r.tags ?? null,
        updated_at: new Date().toISOString(),
        // Mark faces computed in the current (original-coord) scheme, so we don't
        // reprocess. Only set when faces actually ran this call — otherwise leave the
        // existing value untouched (omitted keys aren't overwritten on upsert-update).
        ...(doFaces ? { faces_done: true } : {}),
      });
      if (doFaces) {
        // Replace this image's faces (clears any stale old-scheme boxes first).
        await admin.from("face_detections").delete().eq("image_id", r.id).not("arcface_vector", "is", null);
        if (r.faces && r.faces.length) {
          const d = dims.get(r.id);
          await admin.from("face_detections").insert(r.faces.map((f) => ({
            image_id: r.id,
            gallery_id: galleryId,
            bounding_box: faceBox(f, d?.w ?? null, d?.h ?? null), // ORIGINAL-image pixels
            det_score: f.det_score,
            arcface_vector: JSON.stringify(f.embedding),
          })));
        }
      }
      processed++;
    };

    const timing = { download_ms: 0, clip_ms: 0, faces_ms: 0, count: 0 };
    let facesProvider: string | null = null; // "GPU" / "CPU" — surfaced in the UI
    let cursor = 0;
    const worker = async () => {
      while (cursor < batches.length) {
        if (Date.now() - start > TIME_BUDGET_MS) return;
        const batch = batches[cursor++];
        try {
          const res = await fetch(modalUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: modalToken,
              faces: doFaces, // skip ArcFace on Modal when faces are off
              tags: false,    // tagging is via the VLM (OpenRouter) now, not CLIP
              images: batch.map((img) => {
                const preview = toPreviewUrl(img.original_url);
                const thumb = toThumbnailUrl(img.original_url);
                // Primary source + progressively larger fallbacks if it's missing.
                const url = source === "thumbnail" ? thumb : preview;
                const fallbacks = source === "thumbnail"
                  ? [preview, img.original_url]
                  : [img.original_url];
                return { id: img.id, url, fallbacks };
              }),
            }),
          });
          const data = await res.json();
          const tm = data.timing;
          if (tm) {
            timing.download_ms += tm.download_ms || 0;
            timing.clip_ms += tm.clip_ms || 0;
            timing.faces_ms += tm.faces_ms || 0;
            timing.count += tm.count || 0;
            if (tm.faces_provider) facesProvider = tm.faces_provider;
          }
          for (const r of (data.results || []) as ModalResult[]) await storeResult(r);
        } catch (err) {
          console.error("Modal call failed:", err); // leave for next invocation
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(MODAL_CONCURRENCY, batches.length) }, worker));

    // OLD culling pass: one VLM call per image via score-vision `mode:"culling"`,
    // writing the old gallery_images columns (culling_score/label + the 4 sub-scores).
    // Runs on the thumbnail (~small, cheap) with the gallery's labels. Bounded by the
    // same time budget; whatever's left over is picked up by the next chained call.
    let cullStart = 0;
    let cullFirstError: string | null = null; // first failure this invocation (for pipeline_error)
    let cullCostUsd = 0;                       // summed OpenRouter cost this invocation
    let cullModel: string | null = null;       // the model the VLM actually used

    // Safe score-vision caller: never throws. Reads the body as TEXT first, checks
    // status + content-type, and only JSON.parses when it's actually JSON. Returns a
    // COMPACT diagnostic (status/content-type/body prefix ≤300 chars) — so a bad
    // endpoint (protected preview → HTML/401, wrong URL → 404) is visible instead of
    // silently stalling with a misleading "Modal/GPU" message.
    // Header set for the culling call. The bypass token (if any) rides here only —
    // it must never appear in errors/logs; we surface just a boolean.
    const scoreVisionHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (scoreVisionBypass) scoreVisionHeaders["x-vercel-protection-bypass"] = scoreVisionBypass;
    const bypassInfo = `protection_bypass_configured=${!!scoreVisionBypass}`;

    const callScoreVision = async (image: string): Promise<{ data?: Record<string, unknown>; error?: string }> => {
      let res: Response;
      try {
        res = await fetch(scoreVisionUrl!, {
          method: "POST",
          headers: scoreVisionHeaders,
          body: JSON.stringify({
            mode: "culling", image, labels,
            tags: doTags ? tagsList : [], // VLM tagging (blue chips) — from the fixed list
            extras: true,                 // eyes / expression / keeper / hero / technical flags
            ...(vlmModel ? { model: vlmModel } : {}), // per-test model choice
          }),
        });
      } catch (e) {
        return { error: `fetch failed: ${e instanceof Error ? e.message : String(e)} (${bypassInfo})` };
      }
      const ct = res.headers.get("content-type") || "";
      const text = await res.text();
      if (!res.ok) return { error: `status=${res.status} ct=${ct || "?"} ${bypassInfo} body=${text.slice(0, 300)}` };
      if (!ct.includes("application/json")) {
        return { error: `non-json response ct=${ct || "?"} status=${res.status} ${bypassInfo} body=${text.slice(0, 300)}` };
      }
      try {
        return { data: JSON.parse(text) as Record<string, unknown> };
      } catch {
        return { error: `json parse failed ct=${ct} ${bypassInfo} body=${text.slice(0, 300)}` };
      }
    };

    const cullOne = async (img: { id: string; original_url: string }) => {
      const { data: d, error } = await callScoreVision(toThumbnailUrl(img.original_url));
      if (error || !d) {
        if (!cullFirstError) cullFirstError = error ?? "unknown culling error";
        console.error("Culling call failed:", img.id, error);
        return; // leave for next invocation
      }
      const num = (v: unknown) => (typeof v === "number" ? v : 0);
      // VLM-chosen tags → the old gallery_images.ai_tags column (text[]).
      const aiTags = Array.isArray(d.tags) ? (d.tags as unknown[]).filter((t): t is string => typeof t === "string") : [];
      try {
        const boolOrNull = (v: unknown) => (typeof v === "boolean" ? v : null);
        await admin.from("gallery_images").update({
          culling_score: num(d.overall_score),
          culling_label: typeof d.label === "string" ? d.label : null,
          subject_sharpness: num(d.subject_sharpness),
          background_sharpness: num(d.background_sharpness),
          thirds_rule: num(d.thirds_rule),
          intended_facial_expression: num(d.intended_facial_expression),
          ai_tags: aiTags,
          // Extra VLM signals.
          eyes_status: typeof d.eyes_status === "string" ? d.eyes_status : null,
          expression: typeof d.expression === "string" ? d.expression : null,
          looking_at_camera: boolOrNull(d.looking_at_camera),
          is_keeper: boolOrNull(d.is_keeper),
          ai_hero_candidate: boolOrNull(d.is_hero), // VLM suggestion — NOT the manual is_hero
          has_blur_issue: boolOrNull(d.has_blur_issue),
          has_exposure_issue: boolOrNull(d.has_exposure_issue),
          people_count: typeof d.people_count === "number" ? d.people_count : null,
        }).eq("id", img.id);
        cullProcessed++;
        // Cost/model telemetry for the test dashboard.
        const usage = d.usage as { cost?: number } | undefined;
        if (usage && typeof usage.cost === "number") cullCostUsd += usage.cost;
        if (typeof d.model === "string") cullModel = d.model;
      } catch (e) {
        if (!cullFirstError) cullFirstError = `db update failed: ${e instanceof Error ? e.message : String(e)}`;
        console.error("Culling DB write failed:", img.id, e);
      }
    };
    if (doCulling && cullTodo.length) {
      cullStart = Date.now();
      let ci = 0;
      const cullWorker = async () => {
        while (ci < cullTodo.length) {
          if (Date.now() - start > TIME_BUDGET_MS) return;
          await cullOne(cullTodo[ci++]);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(CULLING_CONCURRENCY, cullTodo.length) }, cullWorker),
      );
    }

    // Accumulate per-stage timing on the gallery (summed across chained invocations).
    const wallMs = Date.now() - start;
    const cullMs = cullStart ? Date.now() - cullStart : 0;
    // Estimated Modal GPU cost this invocation (container-seconds ≈ sum of the
    // GPU-container stages: download + CLIP + faces) × the L4 rate.
    const modalCostThis = ((timing.download_ms + timing.clip_ms + timing.faces_ms) / 1000) * MODAL_L4_USD_PER_SEC;
    const { data: gPrev } = await admin.from("galleries").select("pipeline_timing").eq("id", galleryId).single();
    const prev = (gPrev?.pipeline_timing as Record<string, number | string | null> | null) || {};
    const pnum = (k: string) => (typeof prev[k] === "number" ? prev[k] as number : 0);
    await admin.from("galleries").update({
      pipeline_timing: {
        download_ms: pnum("download_ms") + timing.download_ms,
        clip_ms: pnum("clip_ms") + timing.clip_ms,
        faces_ms: pnum("faces_ms") + timing.faces_ms,
        cull_ms: pnum("cull_ms") + cullMs,
        wall_ms: pnum("wall_ms") + wallMs,
        images: pnum("images") + timing.count,
        faces_provider: facesProvider ?? prev.faces_provider ?? null,
        // Test-dashboard telemetry: money spent, both engines.
        cull_cost_usd: pnum("cull_cost_usd") + cullCostUsd,
        modal_cost_usd: pnum("modal_cost_usd") + modalCostThis,
        model: cullModel ?? (typeof prev.model === "string" ? prev.model : null),
      },
    }).eq("id", galleryId);

    // Count remaining: an image is "done" only once it has CLIP features, AND (if
    // faces on) faces computed in the current scheme, AND (if culling on) a culling
    // score. Total work left is the sum of all enabled steps.
    const { data: doneRows2 } = await admin
      .from("image_features").select("image_id").eq("gallery_id", galleryId);
    const { count: totalCount } = await admin
      .from("gallery_images").select("id", { count: "exact", head: true }).eq("gallery_id", galleryId);
    const clipRemaining = (totalCount ?? 0) - (doneRows2 || []).length;
    let cullRemaining = 0;
    if (doCulling) {
      const { count: cullDoneCount } = await admin
        .from("gallery_images").select("id", { count: "exact", head: true })
        .eq("gallery_id", galleryId).not("culling_score", "is", null);
      cullRemaining = (totalCount ?? 0) - (cullDoneCount ?? 0);
    }
    let facesRemaining = 0;
    if (doFaces) {
      const { count: facesDoneCount } = await admin
        .from("image_features").select("image_id", { count: "exact", head: true })
        .eq("gallery_id", galleryId).eq("faces_done", true);
      facesRemaining = (totalCount ?? 0) - (facesDoneCount ?? 0);
    }
    const remaining = clipRemaining + cullRemaining + facesRemaining;
    const madeProgress = processed > 0 || cullProcessed > 0;

    if (remaining > 0) {
      // Runaway guard: if an invocation makes zero progress (e.g. Modal has no
      // compute, every image errors), count it as a stall. After 3 consecutive
      // stalls, stop chaining and mark an error instead of looping forever and
      // burning invocations/credits.
      const nextStall = madeProgress ? 0 : stall + 1;
      if (nextStall >= 3) {
        // Point the finger at the step that actually failed to progress.
        let msg: string;
        if (doCulling && cullRemaining > 0 && cullProcessed === 0) {
          msg = "עיבוד נעצר: culling לא התקדם (0 הצלחות) אחרי 3 ניסיונות. " +
            "בדוק שה-SCORE_VISION_URL הוא endpoint ציבורי שמחזיר JSON. " +
            `שגיאה ראשונה: ${cullFirstError ?? "לא ידועה"}`;
        } else if (clipRemaining > 0 && processed === 0) {
          msg = "עיבוד נעצר: CLIP/Modal לא התקדם אחרי 3 ניסיונות (ייתכן ש-Modal ללא משאבי GPU פנויים).";
        } else {
          msg = "עיבוד נעצר: לא הייתה התקדמות אחרי 3 ניסיונות.";
        }
        await admin.from("galleries").update({
          pipeline_status: "error",
          culling_status: "error",
          pipeline_error: msg,
        }).eq("id", galleryId);
        return json({ error: "stalled", remaining, clipRemaining, cullRemaining, cullFirstError }, 200);
      }
      const chain = fetch(`${supabaseUrl}/functions/v1/process-pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ galleryId, stall: nextStall, options }),
      }).catch((e) => console.error("self-chain failed", e));
      EdgeRuntime.waitUntil(chain);
      return json({ success: true, processed, cullProcessed, remaining, chained: true });
    }

    // Everything computed → group + cluster faces + mark ready.
    await finalize();
    return json({ success: true, processed, cullProcessed, done: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return json({ error: message }, 500);
  }
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
