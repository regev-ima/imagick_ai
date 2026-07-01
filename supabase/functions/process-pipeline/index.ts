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
const TIME_BUDGET_MS = 110_000;

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
  bbox: [number, number, number, number];
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const modalUrl = Deno.env.get("MODAL_URL");
    const modalToken = Deno.env.get("MODAL_TOKEN");

    if (!modalUrl || !modalToken) {
      return json({ error: "MODAL_URL / MODAL_TOKEN not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const body = await req.json();
    const { galleryId, stall = 0, options } = body as {
      galleryId: string; userId?: string; stall?: number;
      options?: { faces?: boolean; cluster?: boolean; tags?: boolean; source?: "preview" | "thumbnail" };
    };
    if (!galleryId) return json({ error: "Missing galleryId" }, 400);
    // Which optional steps to run. Faces (ArcFace) is the heavy, premium-gated one;
    // CLIP-based rating/clustering/tagging always ride on the one cheap embedding.
    const doFaces = options?.faces !== false;
    const doCluster = options?.cluster !== false;
    const doTags = options?.tags !== false;
    // Image source: preview (default) or the tiny thumbnail (cheaper; CLIP-only, no faces).
    const source = options?.source === "thumbnail" ? "thumbnail" : "preview";

    const admin = createClient(supabaseUrl, supabaseServiceKey);

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
      ...(isInternal ? {} : { pipeline_timing: null }), // reset timing on a fresh user-initiated run
    }).eq("id", galleryId);

    // Images in this gallery that don't yet have features (computed in JS — more
    // robust than a PostgREST anti-join embed).
    const { data: doneRows } = await admin
      .from("image_features").select("image_id").eq("gallery_id", galleryId);
    const done = new Set((doneRows || []).map((r: { image_id: string }) => r.image_id));

    const { data: allImgs, error: imgErr } = await admin
      .from("gallery_images").select("id, original_url").eq("gallery_id", galleryId);
    if (imgErr) return json({ error: imgErr.message }, 500);

    const images = (allImgs || [])
      .filter((i: { id: string; original_url: string | null }) => i.original_url && !done.has(i.id))
      .slice(0, IMAGES_PER_INVOCATION) as { id: string; original_url: string }[];
    if (images.length === 0) {
      // Nothing left → cluster (only the enabled steps) and finish.
      if (doCluster) await admin.rpc("cluster_gallery_images", { p_gallery_id: galleryId });
      if (doFaces) await admin.rpc("cluster_gallery_faces_arcface", { p_gallery_id: galleryId });
      await admin.from("galleries").update({ pipeline_status: "ready" }).eq("id", galleryId);
      return json({ success: true, done: true });
    }

    const start = Date.now();
    let processed = 0;

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
      });
      await admin.from("face_detections").delete().eq("image_id", r.id).not("arcface_vector", "is", null);
      if (r.faces && r.faces.length) {
        await admin.from("face_detections").insert(r.faces.map((f) => ({
          image_id: r.id,
          gallery_id: galleryId,
          bounding_box: { x: f.bbox[0], y: f.bbox[1], width: f.bbox[2] - f.bbox[0], height: f.bbox[3] - f.bbox[1] },
          det_score: f.det_score,
          arcface_vector: JSON.stringify(f.embedding),
        })));
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
              tags: doTags,
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

    // Accumulate per-stage timing on the gallery (summed across chained invocations).
    const wallMs = Date.now() - start;
    const { data: gPrev } = await admin.from("galleries").select("pipeline_timing").eq("id", galleryId).single();
    const prev = (gPrev?.pipeline_timing as Record<string, number> | null) || {};
    await admin.from("galleries").update({
      pipeline_timing: {
        download_ms: (prev.download_ms || 0) + timing.download_ms,
        clip_ms: (prev.clip_ms || 0) + timing.clip_ms,
        faces_ms: (prev.faces_ms || 0) + timing.faces_ms,
        wall_ms: (prev.wall_ms || 0) + wallMs,
        images: (prev.images || 0) + timing.count,
        faces_provider: facesProvider ?? (prev as Record<string, unknown>).faces_provider ?? null,
      },
    }).eq("id", galleryId);

    // Count remaining (total images minus those that now have features).
    const { data: doneRows2 } = await admin
      .from("image_features").select("image_id").eq("gallery_id", galleryId);
    const { count: totalCount } = await admin
      .from("gallery_images").select("id", { count: "exact", head: true }).eq("gallery_id", galleryId);
    const remaining = (totalCount ?? 0) - (doneRows2 || []).length;

    if (remaining > 0) {
      // Runaway guard: if an invocation makes zero progress (e.g. Modal has no
      // compute, every image errors), count it as a stall. After 3 consecutive
      // stalls, stop chaining and mark an error instead of looping forever and
      // burning invocations/credits.
      const nextStall = processed > 0 ? 0 : stall + 1;
      if (nextStall >= 3) {
        await admin.from("galleries").update({
          pipeline_status: "error",
          pipeline_error: "עיבוד נעצר: לא הייתה התקדמות אחרי 3 ניסיונות (ייתכן ש-Modal ללא משאבי GPU פנויים).",
        }).eq("id", galleryId);
        return json({ error: "stalled", remaining }, 200);
      }
      const chain = fetch(`${supabaseUrl}/functions/v1/process-pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ galleryId, stall: nextStall, options }),
      }).catch((e) => console.error("self-chain failed", e));
      EdgeRuntime.waitUntil(chain);
      return json({ success: true, processed, remaining, chained: true });
    }

    // Done → cluster the enabled steps.
    if (doCluster) await admin.rpc("cluster_gallery_images", { p_gallery_id: galleryId });
    if (doFaces) await admin.rpc("cluster_gallery_faces_arcface", { p_gallery_id: galleryId });
    await admin.from("galleries").update({ pipeline_status: "ready" }).eq("id", galleryId);
    return json({ success: true, processed, done: true });
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
