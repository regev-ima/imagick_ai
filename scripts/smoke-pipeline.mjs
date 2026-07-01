#!/usr/bin/env node
/**
 * Smoke / E2E verification for the AI pipeline (culling + grouping + faces).
 *
 * It triggers the SAME edge function the app triggers (`process-pipeline`),
 * polls until the gallery is `ready`, then reads back the DB and prints a
 * verification table: how many images got a culling_score / culling_label,
 * the four sub-scores, similarity_group_1/2/3, plus face_detections / clusters.
 *
 * No secrets are hard-coded — everything comes from env vars.
 *
 * Requirements: Node 18+ (uses global fetch). No npm install needed.
 *
 * ── Run ───────────────────────────────────────────────────────────────────
 *   SUPABASE_URL="https://<ref>.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
 *   SCORE_VISION_URL="https://<your-app-domain>/api/score-vision" \
 *   node scripts/smoke-pipeline.mjs <galleryId>
 *
 * IMPORTANT — culling endpoint: the Edge Function PREFERS its own `SCORE_VISION_URL`
 * secret over the value sent by this script (or the frontend). The value here is only
 * a FALLBACK. Make sure the Edge Function secret points to a PUBLIC endpoint — a
 * protected Vercel *preview* URL returns HTML/401 to the server-to-server culling call
 * and every culling call fails. Set it once with:
 *   supabase secrets set SCORE_VISION_URL="https://<public-domain>/api/score-vision" \
 *     --project-ref <ref>
 *
 * Optional env:
 *   SUPABASE_USER_JWT   a real user JWT to invoke as the gallery owner (closest
 *                       to the app path). If unset, the SERVICE_ROLE key is used
 *                       to invoke — process-pipeline treats that as an internal
 *                       call and skips the owner check. Reads always use the
 *                       service-role key (bypass RLS) so verification is complete.
 *   TIME_THRESHOLD      EXIF grouping gate in SECONDS (default 600; "" = no gate).
 *   THRESHOLDS          grouping similarity thresholds, e.g. "0.5,0.7,0.9".
 *   LABELS              culling labels, comma-separated (default = old shoot set).
 *   OPT_FACES           "0" to skip face detection (default on).
 *   OPT_CULLING         "0" to skip VLM culling (default on).
 *   OPT_CLUSTER         "0" to skip grouping (default on).
 *   OPT_TAGS            "0" to skip CLIP tags (default on).
 *   SOURCE              "preview" (default) or "thumbnail".
 *   POLL_TIMEOUT_MS     max wait for the gallery to reach ready (default 900000).
 *   POLL_INTERVAL_MS    poll cadence (default 5000).
 * ──────────────────────────────────────────────────────────────────────────
 */

const DEFAULT_LABELS = [
  "Preparations", "Outdoor photography", "Couple moments",
  "Family & Reception", "Ceremony", "Dance/Party", "Other",
];

function need(name) {
  const v = process.env[name];
  if (!v) { console.error(`ERROR: missing env var ${name}`); process.exit(2); }
  return v;
}

const SUPABASE_URL = need("SUPABASE_URL").replace(/\/+$/, "");
const SERVICE_KEY = need("SUPABASE_SERVICE_ROLE_KEY");
const USER_JWT = process.env.SUPABASE_USER_JWT || null;
const SCORE_VISION_URL = process.env.SCORE_VISION_URL || null;
const galleryId = process.argv[2];
if (!galleryId) {
  console.error("Usage: node scripts/smoke-pipeline.mjs <galleryId>");
  process.exit(2);
}

const timeThreshold = process.env.TIME_THRESHOLD === undefined
  ? 600
  : (process.env.TIME_THRESHOLD === "" ? null : Number(process.env.TIME_THRESHOLD));
const thresholds = process.env.THRESHOLDS
  ? process.env.THRESHOLDS.split(",").map((t) => Number(t.trim()))
  : [0.5, 0.7, 0.9];
const labels = process.env.LABELS
  ? process.env.LABELS.split(",").map((t) => t.trim()).filter(Boolean)
  : DEFAULT_LABELS;
const options = {
  faces: process.env.OPT_FACES !== "0",
  culling: process.env.OPT_CULLING !== "0",
  cluster: process.env.OPT_CLUSTER !== "0",
  tags: process.env.OPT_TAGS !== "0",
  source: process.env.SOURCE === "thumbnail" ? "thumbnail" : "preview",
  timeThreshold,
  thresholds,
  labels,
  ...(SCORE_VISION_URL ? { scoreVisionUrl: SCORE_VISION_URL } : {}),
};

const POLL_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS || 900_000);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5_000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── PostgREST helpers (service-role → bypass RLS, complete verification) ─────
function restHeaders(extra = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra };
}

async function restRows(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: restHeaders() });
  if (!res.ok) throw new Error(`REST ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Exact count via Content-Range without pulling all rows.
async function restCount(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${sep}select=id`, {
    method: "HEAD",
    headers: restHeaders({ Prefer: "count=exact", Range: "0-0" }),
  });
  const cr = res.headers.get("content-range") || "";
  const total = cr.split("/")[1];
  return total && total !== "*" ? Number(total) : 0;
}

async function main() {
  console.log(`\n▶ Smoke test — gallery ${galleryId}`);
  console.log(`  options: ${JSON.stringify({ ...options, scoreVisionUrl: options.scoreVisionUrl ? "<set>" : undefined })}\n`);

  if (options.culling) {
    console.log("  ⚠ culling is ON. The Edge Function uses its OWN `SCORE_VISION_URL` secret");
    console.log("    if set (preferred), else the fallback URL passed here" +
      `${SCORE_VISION_URL ? "" : " — but you passed NONE, so it relies entirely on the secret"}.`);
    console.log("    Ensure that endpoint is PUBLIC (a protected Vercel preview URL returns HTML/401");
    console.log("    to the server-to-server call and every culling call fails).\n");
  }

  // 1) Trigger the pipeline exactly like the app (edge function invoke).
  const bearer = USER_JWT || SERVICE_KEY;
  console.log(`→ invoking process-pipeline (${USER_JWT ? "as user JWT" : "as service role / internal"})…`);
  const inv = await fetch(`${SUPABASE_URL}/functions/v1/process-pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ galleryId, options }),
  });
  const invBody = await inv.text();
  console.log(`  ↳ ${inv.status}: ${invBody.slice(0, 300)}`);
  if (!inv.ok) { console.error("invoke failed — aborting"); process.exit(1); }

  // 2) Poll the gallery until ready / error / timeout.
  const started = Date.now();
  let status = "processing";
  let timing = null;
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    const rows = await restRows(
      `galleries?id=eq.${galleryId}&select=pipeline_status,pipeline_error,pipeline_timing`);
    const g = rows[0] || {};
    status = g.pipeline_status || "unknown";
    timing = g.pipeline_timing || null;
    const secs = Math.round((Date.now() - started) / 1000);
    process.stdout.write(`\r  polling… status=${status} (${secs}s)      `);
    if (status === "ready") break;
    if (status === "error") {
      console.log(`\n  pipeline_error: ${g.pipeline_error || "(none)"}`);
      break;
    }
  }
  console.log("");

  // 3) Read back and verify.
  const imgs = await restRows(
    `gallery_images?gallery_id=eq.${galleryId}` +
    `&select=id,culling_score,culling_label,subject_sharpness,background_sharpness,` +
    `thirds_rule,intended_facial_expression,similarity_group_1,similarity_group_2,similarity_group_3,taken_at`);
  const total = imgs.length;
  const notNull = (v) => v !== null && v !== undefined;
  const count = (pred) => imgs.filter(pred).length;

  const withCullScore = count((r) => notNull(r.culling_score));
  const withCullLabel = count((r) => notNull(r.culling_label));
  const withAllSub = count((r) =>
    notNull(r.subject_sharpness) && notNull(r.background_sharpness) &&
    notNull(r.thirds_rule) && notNull(r.intended_facial_expression));
  const withG1 = count((r) => notNull(r.similarity_group_1));
  const withG2 = count((r) => notNull(r.similarity_group_2));
  const withG3 = count((r) => notNull(r.similarity_group_3));
  const withTakenAt = count((r) => notNull(r.taken_at));

  const faceDetections = await restCount(
    `face_detections?gallery_id=eq.${galleryId}&arcface_vector=not.is.null`);
  const faceClusters = await restCount(`face_clusters?gallery_id=eq.${galleryId}`);
  const featureRows = await restCount(`image_features?gallery_id=eq.${galleryId}`);

  const pct = (n) => (total ? `${Math.round((n / total) * 100)}%` : "—");
  const row = (label, n) => console.log(
    `  ${label.padEnd(34)} ${String(n).padStart(5)} / ${total}   ${pct(n)}`);

  console.log(`\n════════════ VERIFICATION — gallery ${galleryId} ════════════`);
  console.log(`  final status: ${status}`);
  if (timing) console.log(`  timing (ms): ${JSON.stringify(timing)}`);
  console.log(`  ${"-".repeat(58)}`);
  row("images (total)", total);
  row("image_features (CLIP)", featureRows);
  console.log(`  ${"-".repeat(58)}  culling (old columns)`);
  row("culling_score set", withCullScore);
  row("culling_label set", withCullLabel);
  row("all 4 sub-scores set", withAllSub);
  console.log(`  ${"-".repeat(58)}  grouping`);
  row("similarity_group_1 set", withG1);
  row("similarity_group_2 set", withG2);
  row("similarity_group_3 set", withG3);
  row("taken_at present (EXIF gate input)", withTakenAt);
  console.log(`  ${"-".repeat(58)}  faces (unchanged path)`);
  console.log(`  ${"face_detections (arcface)".padEnd(34)} ${String(faceDetections).padStart(5)}`);
  console.log(`  ${"face_clusters".padEnd(34)} ${String(faceClusters).padStart(5)}`);

  // 4) Five sample rows — only score fields + a shortened id (no filenames/urls).
  console.log(`\n  sample rows (id shortened, no PII):`);
  const shortId = (id) => `${String(id).slice(0, 8)}…`;
  for (const r of imgs.slice(0, 5)) {
    console.log(`   ${shortId(r.id)}  score=${fmt(r.culling_score)} label=${String(r.culling_label ?? "—").padEnd(18)}` +
      ` sub=[${fmt(r.subject_sharpness)},${fmt(r.background_sharpness)},${fmt(r.thirds_rule)},${fmt(r.intended_facial_expression)}]` +
      ` grp=[${r.similarity_group_1 ?? "—"},${r.similarity_group_2 ?? "—"},${r.similarity_group_3 ?? "—"}]`);
  }

  // Exit non-zero if something obviously didn't populate, so CI can gate on it.
  const problems = [];
  if (status !== "ready") problems.push(`status=${status}`);
  if (options.culling && withCullScore === 0) problems.push("no culling_score written");
  if (options.cluster && withG1 === 0) problems.push("no similarity_group_1 written");
  if (options.faces && faceDetections === 0) problems.push("no face_detections written");
  console.log(`\n════════════════════════════════════════════════════════════`);
  if (problems.length) { console.log(`✗ FAIL: ${problems.join("; ")}`); process.exit(1); }
  console.log(`✓ PASS: culling + grouping${options.faces ? " + faces" : ""} populated.`);
}

function fmt(v) { return v === null || v === undefined ? "—" : (Math.round(Number(v) * 100) / 100); }

main().catch((e) => { console.error("\nSMOKE ERROR:", e.message); process.exit(1); });
