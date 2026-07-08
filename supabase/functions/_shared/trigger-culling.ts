// Shared server-side trigger for the AI Culling pipeline (process-pipeline).
//
// Both the style-edit webhook (image-webhook) and the Google-Drive transfer
// webhook (gd-transfer-webhook) use this to auto-start culling once a gallery's
// photos are in place, so there is ONE culling engine and one code path.
//
// It stamps culling_status='processing' + culling_started_at itself (so the
// gallery overlay/clock light up), reads the admin model + EXIF time gate from
// platform_settings.culling_config, then invokes process-pipeline as an
// internal (service-key) call. process-pipeline reaches the VLM layer via its
// own SCORE_VISION_URL secret — no window origin exists server-side — and fails
// loudly if that secret is unset.

interface TriggerOptions {
  cluster: boolean;
  faces: boolean;
  labels: string[];
}

// `supabase` is a service-role client. Returns true if the pipeline was
// dispatched, false on a (logged, non-fatal) failure.
export async function triggerCullingPipeline(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  galleryId: string,
  opts: TriggerOptions,
): Promise<boolean> {
  try {
    // Admin-configured model + EXIF time gate (platform_settings.culling_config).
    let adminModel: string | undefined;
    let adminTime = 600;
    try {
      const { data: cfgRow } = await supabase
        .from("platform_settings").select("value").eq("key", "culling_config").single();
      if (cfgRow?.value) {
        const cfg = JSON.parse(cfgRow.value);
        if (typeof cfg.model === "string") adminModel = cfg.model;
        if (typeof cfg.timeThreshold === "number") adminTime = cfg.timeThreshold;
      }
    } catch { /* fall back to defaults */ }

    // Flag the gallery as culling up front so the UI reflects it immediately,
    // and so a racing trigger sees culling_status='processing' and backs off.
    // culling_started_at is NOT stamped here — the compression barrier stamps it
    // at the real culling start (after all images are compressed), so the
    // timeline shows the compression wait as its own stage.
    await supabase
      .from("galleries")
      .update({ culling_status: "processing" })
      .eq("id", galleryId);

    // Gate culling behind the compression barrier: await-compression waits for
    // every image's compressed webp to exist, then dispatches process-pipeline
    // with these exact options. It falls back after a safety timeout so culling
    // can never hang.
    const res = await fetch(`${supabaseUrl}/functions/v1/await-compression`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        galleryId,
        options: {
          culling: true,
          tags: true,
          cluster: opts.cluster,
          faces: opts.faces,
          labels: opts.labels,
          thresholds: [0.5, 0.7, 0.9],
          timeThreshold: adminTime,
          ...(adminModel ? { model: adminModel } : {}),
          // Production VLM endpoint as a fallback candidate — server-triggered
          // runs have no browser origin to offer, so without this a broken
          // SCORE_VISION_URL secret had nothing to fall back to.
          scoreVisionUrl: `${(Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "")}/api/score-vision`,
        },
      }),
    });

    if (!res.ok) {
      console.error("process-pipeline trigger failed:", res.status, await res.text());
      // Leave culling_status='processing' — the gallery's self-healer / stuck
      // detection will recover it rather than us guessing a terminal state.
      return false;
    }
    console.log("process-pipeline dispatched for gallery:", galleryId);
    return true;
  } catch (err) {
    console.error("Error dispatching process-pipeline:", err);
    return false;
  }
}
