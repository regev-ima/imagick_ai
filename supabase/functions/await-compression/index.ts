import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Compression barrier for AI culling.
//
// The compressed/{name}_reduced.webp derivatives are produced by an ASYNC step
// in the upload/transfer infrastructure that has no callback into this repo, so
// the only signal that an image is compressed is the object existing (HEAD 200
// vs 404). This function polls those objects, records progress on the gallery
// (for the admin pipeline timeline), and dispatches process-pipeline (the
// culling/tagging/faces engine) ONLY once every image is compressed — or once a
// safety timeout elapses, after which process-pipeline falls back to originals
// so culling can never hang forever.
//
// Callers (useCreateGalleryFlow, gd-transfer-webhook, image-webhook via
// trigger-culling) invoke this instead of process-pipeline directly; `options`
// is forwarded verbatim so the pipeline behaves exactly as before, just gated.

const HEAD_CONCURRENCY = 24;
const POLL_INTERVAL_MS = 5_000;
// Stay well under the edge function wall-clock limit; hand off to a fresh
// invocation past this so a long compression wait spans several calls.
const PER_INVOCATION_BUDGET_MS = 90_000;
// Safety timeout so culling is never blocked forever if compression stalls or
// an object never lands. Estimated from the image count, floored and capped.
const PER_IMAGE_ESTIMATE_MS = 1_500;
const MIN_WAIT_MS = 60_000;
const MAX_WAIT_MS = 15 * 60_000;
// A few images can fail to compress (infra hiccup) and their compressed webp
// never appears. Don't hang the whole gallery on stragglers: once all but a
// small fraction are compressed AND progress has plateaued, proceed (the
// pipeline falls back to the original for any missing compressed image). This
// also makes the common case dispatch in the FIRST invocation, so it doesn't
// depend on a long, fragile self-chain surviving many hops.
const STALL_MS = 25_000;

// Build the culling options from the gallery's own settings — used when a
// re-kick (e.g. the frontend watchdog) invokes us without an options payload,
// so the barrier is self-sufficient and can always recover.
async function buildOptionsFromGallery(
  admin: ReturnType<typeof createClient>,
  galleryId: string,
): Promise<Record<string, unknown>> {
  const { data: g } = await admin
    .from("galleries")
    .select("ai_grouping_enabled, ai_faces_enabled, culling_labels")
    .eq("id", galleryId)
    .single();
  let model: string | undefined;
  let timeThreshold = 600;
  try {
    const { data: cfg } = await admin
      .from("platform_settings").select("value").eq("key", "culling_config").single();
    if (cfg?.value) {
      const parsed = JSON.parse(cfg.value as string);
      if (typeof parsed.model === "string") model = parsed.model;
      if (typeof parsed.timeThreshold === "number") timeThreshold = parsed.timeThreshold;
    }
  } catch { /* defaults */ }
  return {
    culling: true,
    tags: true,
    cluster: (g as { ai_grouping_enabled?: boolean } | null)?.ai_grouping_enabled ?? true,
    faces: (g as { ai_faces_enabled?: boolean } | null)?.ai_faces_enabled ?? false,
    labels: (g as { culling_labels?: string[] } | null)?.culling_labels ?? [],
    thresholds: [0.5, 0.7, 0.9],
    timeThreshold,
    ...(model ? { model } : {}),
  };
}

// Canonical compressed ("preview") URL for an original — matches
// src/lib/imageUrls.ts and process-pipeline's toPreviewUrl.
function toPreviewUrl(originalUrl: string): string {
  try {
    if (originalUrl.includes("/compressed/") && originalUrl.includes("_reduced")) return originalUrl;
    const lastSlash = originalUrl.lastIndexOf("/");
    if (lastSlash === -1) return originalUrl;
    let base = originalUrl.substring(0, lastSlash);
    const full = originalUrl.substring(lastSlash + 1);
    const dot = full.lastIndexOf(".");
    let name = dot > 0 ? full.substring(0, dot) : full;
    base = base.replace(/\/(thumbnail|compressed)$/, "");
    name = name.replace(/_reduced_thumbnail$/, "").replace(/_reduced$/, "");
    return `${base}/compressed/${name}_reduced.webp`;
  } catch {
    return originalUrl;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { galleryId, options: rawOptions } = await req.json();
    if (!galleryId) return json({ error: "galleryId is required" }, 400);

    // Self-sufficient: if invoked without options (e.g. a frontend re-kick of a
    // stalled barrier), rebuild them from the gallery's own culling settings.
    const options = rawOptions && Object.keys(rawOptions).length > 0
      ? rawOptions
      : await buildOptionsFromGallery(admin, galleryId);

    // Already gated through? (idempotent re-entry / racing self-chain)
    const { data: g0 } = await admin
      .from("galleries")
      .select("compression_started_at, compression_completed_at")
      .eq("id", galleryId)
      .single();

    if (g0?.compression_completed_at) {
      return json({ done: true, alreadyDispatched: true });
    }

    // Stamp the barrier start once (atomic guard so a racing invocation can't
    // reset it).
    let startedIso = g0?.compression_started_at as string | null;
    if (!startedIso) {
      startedIso = new Date().toISOString();
      await admin
        .from("galleries")
        .update({ compression_started_at: startedIso })
        .eq("id", galleryId)
        .is("compression_started_at", null);
    }
    const startedMs = new Date(startedIso ?? Date.now()).getTime();

    // Snapshot the images we're waiting on.
    const { data: imgs } = await admin
      .from("gallery_images")
      .select("id, original_url")
      .eq("gallery_id", galleryId)
      .neq("status", "deleted");
    const images = (imgs ?? []).filter((r) => !!r.original_url) as { id: string; original_url: string }[];
    const total = images.length;

    const maxWaitMs = Math.min(MAX_WAIT_MS, Math.max(MIN_WAIT_MS, total * PER_IMAGE_ESTIMATE_MS));
    // Allow a small fraction of never-compressing stragglers before proceeding.
    const stragglerAllowance = Math.max(2, Math.ceil(total * 0.02));
    const ready = new Set<string>();
    const invocationStart = Date.now();
    // Track progress to detect a plateau (compression has effectively finished).
    let lastReadySize = -1;
    let lastProgressAt = Date.now();

    const sweep = async () => {
      const pending = images.filter((i) => !ready.has(i.id));
      let idx = 0;
      const worker = async () => {
        while (idx < pending.length) {
          const img = pending[idx++];
          try {
            const res = await fetch(toPreviewUrl(img.original_url), { method: "HEAD" });
            if (res.ok) ready.add(img.id);
          } catch {
            /* transient network error — retried on the next sweep */
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(HEAD_CONCURRENCY, pending.length) }, worker),
      );
    };

    // Poll until everything is compressed, the safety timeout elapses, or this
    // invocation's budget runs out (then a fresh invocation continues).
    // deno-lint-ignore no-constant-condition
    while (true) {
      await sweep();
      if (ready.size !== lastReadySize) {
        lastReadySize = ready.size;
        lastProgressAt = Date.now();
      }
      await admin
        .from("galleries")
        .update({ compression_ready_count: ready.size, compression_total_count: total })
        .eq("id", galleryId);

      const elapsed = Date.now() - startedMs;
      const allReady = total === 0 || ready.size >= total;
      const timedOut = elapsed > maxWaitMs;
      // Everything but a few stragglers is compressed AND compression has
      // plateaued (no new webp for STALL_MS) — proceed instead of hanging on
      // images that may never compress. Dispatches in the first invocation for
      // the common "N-1 of N compressed fast, 1 stuck" case.
      const nearDoneStalled =
        ready.size >= total - stragglerAllowance &&
        elapsed > MIN_WAIT_MS &&
        Date.now() - lastProgressAt > STALL_MS;

      if (allReady || timedOut || nearDoneStalled) {
        return await dispatchCulling(admin, supabaseUrl, serviceKey, galleryId, options, ready.size, total, timedOut || nearDoneStalled);
      }

      if (Date.now() - invocationStart > PER_INVOCATION_BUDGET_MS) {
        // Hand off to a fresh invocation so we don't hit the wall-clock limit.
        fetch(`${supabaseUrl}/functions/v1/await-compression`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ galleryId, options }),
        }).catch((e) => console.error("await-compression self-chain failed:", e));
        return json({ pending: true, ready: ready.size, total, chained: true });
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  } catch (e) {
    console.error("await-compression error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});

async function dispatchCulling(
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  galleryId: string,
  options: unknown,
  readyCount: number,
  total: number,
  timedOut: boolean,
): Promise<Response> {
  // Atomically claim the dispatch (compression_completed_at IS NULL) so racing
  // barrier invocations dispatch process-pipeline exactly once. culling_started_at
  // is stamped HERE — the real culling start, after compression — so the timeline
  // shows the true gap between compression finishing and culling beginning.
  const nowIso = new Date().toISOString();
  const { data: claimed } = await admin
    .from("galleries")
    .update({
      compression_completed_at: nowIso,
      compression_ready_count: readyCount,
      compression_total_count: total,
      culling_started_at: nowIso,
    })
    .eq("id", galleryId)
    .is("compression_completed_at", null)
    .select("id");

  if (!claimed || claimed.length === 0) {
    return json({ done: true, alreadyDispatched: true });
  }

  if (timedOut) {
    console.warn(
      `await-compression: timeout for gallery ${galleryId} — ${readyCount}/${total} compressed; dispatching culling anyway (pipeline falls back to originals).`,
    );
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/process-pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ galleryId, options }),
  });
  if (!res.ok) {
    console.error("process-pipeline dispatch failed:", res.status, await res.text());
    return json({ dispatched: false, ready: readyCount, total, timedOut, error: `process-pipeline ${res.status}` }, 502);
  }

  return json({ dispatched: true, ready: readyCount, total, timedOut });
}
