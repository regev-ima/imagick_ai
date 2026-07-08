/**
 * Pipeline credit-billing settle — shared between process-pipeline (finalize /
 * stall / crash paths) and pipeline-watchdog (declaring a dead run).
 *
 * Reserve-once, charge-on-settle: a run reserves ceil(todo × menu-rate) and
 * persists a marker on galleries.pipeline_billing. Settling charges only the
 * images that were ACTUALLY newly processed (counted against the marker's
 * base_* snapshots) and releases the leftover reservation — a failed image is
 * never charged.
 *
 * Crash-safe order: (1) idempotent charge (run-tagged usage rows), (2) claimed
 * release (one-shot flag on the marker), (3) clear marker LAST. Every step is
 * safe to re-run, so any later settler finishes the books.
 */
// deno-lint-ignore-file no-explicit-any
import { checkCreditThresholds } from "./credit-alerts.ts";

export async function settlePipelineBilling(
  admin: any,
  supabaseUrl: string,
  serviceKey: string,
  galleryId: string,
): Promise<void> {
  try {
    const { data: g } = await admin
      .from("galleries").select("user_id, pipeline_billing").eq("id", galleryId).single();
    const marker = (g as { pipeline_billing?: Record<string, unknown> | null })?.pipeline_billing ?? null;
    if (!marker) return;
    const ts = String(marker.ts);
    const userId = String(marker.user_id ?? (g as { user_id?: string })?.user_id ?? "");
    const reserved = Number(marker.reserved) || 0;

    // Nothing to settle (unlimited run / bootstrap that never reserved):
    // just clear the marker.
    if (marker.unlimited || !userId || reserved <= 0) {
      await admin.from("galleries").update({ pipeline_billing: null })
        .eq("id", galleryId).eq("pipeline_billing->>ts", ts);
      return;
    }

    const runTag = `run:${ts}`;

    // 1. Charge — skip if this run was already charged (retry path).
    const { data: chargedRows } = await admin
      .from("edit_usage_logs").select("edits_spent")
      .eq("gallery_id", galleryId).like("description", `%${runTag}%`);
    let charged = (chargedRows || []).reduce(
      (s: number, r: { edits_spent: number }) => s + (r.edits_spent || 0), 0);
    if (charged === 0) {
      const { count: cullNowC } = await admin
        .from("gallery_images").select("id", { count: "exact", head: true })
        .eq("gallery_id", galleryId).gt("culling_score", 0);
      const { count: facesNowC } = await admin
        .from("image_features").select("image_id", { count: "exact", head: true })
        .eq("gallery_id", galleryId).eq("faces_done", true);
      const didCull = Math.max(0, (cullNowC ?? 0) - (Number(marker.base_cull) || 0));
      const didFaces = Math.max(0, (facesNowC ?? 0) - (Number(marker.base_faces) || 0));
      let chargeCull = Math.ceil(didCull * (Number(marker.rate_cull) || 0));
      let chargeFaces = Math.ceil(didFaces * (Number(marker.rate_face) || 0));
      // Never charge more than was reserved (rounding can overshoot by 1).
      if (chargeCull > reserved) chargeCull = reserved;
      if (chargeCull + chargeFaces > reserved) chargeFaces = reserved - chargeCull;

      const rows: Record<string, unknown>[] = [];
      if (chargeCull > 0) {
        rows.push({
          user_id: userId, gallery_id: galleryId, action_type: "ai_culling",
          edits_spent: chargeCull, description: `AI culling: ${didCull} photos rated & tagged · ${runTag}`,
        });
      }
      if (chargeFaces > 0) {
        rows.push({
          user_id: userId, gallery_id: galleryId, action_type: "face_recognition",
          edits_spent: chargeFaces, description: `Face recognition: ${didFaces} photos · ${runTag}`,
        });
      }
      // The edit_usage_logs trigger debits the pool AND releases the same
      // amount from edits_reserved.
      if (rows.length) await admin.from("edit_usage_logs").insert(rows);
      charged = chargeCull + chargeFaces;
      // Bulk debits cross alert thresholds too — same choke-point check
      // as single-edit debits in image-webhook.
      if (charged > 0) {
        await checkCreditThresholds(admin, supabaseUrl, serviceKey, userId, charged);
      }
    }

    // 2. Release the leftover — claimed via a one-shot flag on the marker
    // so racing settlers can't double-release.
    const leftover = Math.max(0, reserved - charged);
    if (leftover > 0) {
      const { data: relClaim } = await admin
        .from("galleries")
        .update({ pipeline_billing: { ...marker, released: true } })
        .eq("id", galleryId)
        .eq("pipeline_billing->>ts", ts)
        .is("pipeline_billing->>released", null)
        .select("id");
      if (relClaim && relClaim.length > 0) {
        await admin.rpc("release_credits_simple", { p_user_id: userId, p_amount: leftover });
      }
    }

    // 3. Books closed — clear the marker.
    await admin.from("galleries").update({ pipeline_billing: null })
      .eq("id", galleryId).eq("pipeline_billing->>ts", ts);
  } catch (e) {
    console.error("pipeline billing settle failed:", e);
  }
}
