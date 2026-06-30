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
const MODAL_BATCH = 10;            // images per Modal HTTP call
const TIME_BUDGET_MS = 110_000;

// B2 originals have a smaller compressed JPEG sibling — cheaper + faster to process.
function toCompressedJpegUrl(originalUrl: string): string {
  try {
    const lastSlash = originalUrl.lastIndexOf("/");
    if (lastSlash === -1) return originalUrl;
    const base = originalUrl.substring(0, lastSlash);
    const full = originalUrl.substring(lastSlash + 1);
    const dot = full.lastIndexOf(".");
    const name = dot > 0 ? full.substring(0, dot) : full;
    return `${base}/compressed/${name}_reduced.jpeg`;
  } catch {
    return originalUrl;
  }
}

interface ModalFace {
  bbox: [number, number, number, number];
  det_score: number;
  embedding: number[];
}
interface ModalResult {
  id: string;
  clip?: number[];
  aesthetic?: number;
  faces?: ModalFace[];
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
    const { galleryId } = body as { galleryId: string; userId?: string };
    if (!galleryId) return json({ error: "Missing galleryId" }, 400);

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

    await admin.from("galleries").update({ pipeline_status: "processing", pipeline_error: null }).eq("id", galleryId);

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
      // Nothing left → cluster and finish.
      await admin.rpc("cluster_gallery_images", { p_gallery_id: galleryId });
      await admin.rpc("cluster_gallery_faces_arcface", { p_gallery_id: galleryId });
      await admin.from("galleries").update({ pipeline_status: "ready" }).eq("id", galleryId);
      return json({ success: true, done: true });
    }

    const start = Date.now();
    let processed = 0;

    for (let i = 0; i < images.length; i += MODAL_BATCH) {
      if (Date.now() - start > TIME_BUDGET_MS) break;
      const batch = images.slice(i, i + MODAL_BATCH);
      const payload = {
        token: modalToken,
        images: batch.map((img) => ({ id: img.id, url: toCompressedJpegUrl(img.original_url) })),
      };

      let results: ModalResult[] = [];
      try {
        const res = await fetch(modalUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        results = data.results || [];
      } catch (err) {
        console.error("Modal call failed:", err);
        continue; // leave these images for the next invocation
      }

      for (const r of results) {
        if (r.error || !r.clip) {
          console.warn("Image failed in Modal:", r.id, r.error);
          continue;
        }
        // Store image features (CLIP + aesthetic).
        await admin.from("image_features").upsert({
          image_id: r.id,
          gallery_id: galleryId,
          clip_vector: JSON.stringify(r.clip),
          aesthetic: r.aesthetic ?? null,
          updated_at: new Date().toISOString(),
        });
        // Replace this image's ArcFace faces.
        await admin.from("face_detections").delete().eq("image_id", r.id).not("arcface_vector", "is", null);
        if (r.faces && r.faces.length) {
          const rows = r.faces.map((f) => ({
            image_id: r.id,
            gallery_id: galleryId,
            bounding_box: { x: f.bbox[0], y: f.bbox[1], width: f.bbox[2] - f.bbox[0], height: f.bbox[3] - f.bbox[1] },
            det_score: f.det_score,
            arcface_vector: JSON.stringify(f.embedding),
          }));
          await admin.from("face_detections").insert(rows);
        }
        processed++;
      }
    }

    // Count remaining (total images minus those that now have features).
    const { data: doneRows2 } = await admin
      .from("image_features").select("image_id").eq("gallery_id", galleryId);
    const { count: totalCount } = await admin
      .from("gallery_images").select("id", { count: "exact", head: true }).eq("gallery_id", galleryId);
    const remaining = (totalCount ?? 0) - (doneRows2 || []).length;

    if (remaining > 0) {
      const chain = fetch(`${supabaseUrl}/functions/v1/process-pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ galleryId }),
      }).catch((e) => console.error("self-chain failed", e));
      EdgeRuntime.waitUntil(chain);
      return json({ success: true, processed, remaining, chained: true });
    }

    // Done → cluster everything.
    await admin.rpc("cluster_gallery_images", { p_gallery_id: galleryId });
    await admin.rpc("cluster_gallery_faces_arcface", { p_gallery_id: galleryId });
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
