/**
 * pipeline-watchdog — the server-side safety net for AI culling runs.
 *
 * Runs every 5 minutes via pg_cron. A culling run is a chain of process-pipeline
 * invocations; each link stamps galleries.pipeline_heartbeat when it starts. A
 * gallery that says 'processing' whose heartbeat is stale means the chain died
 * (killed invocation, hung provider, lost dispatch) — the user meanwhile stares
 * at an eternal spinner and their credit reservation stays open.
 *
 * For each dead run:
 *   1st + 2nd sighting → auto-resume: re-invoke process-pipeline with the run's
 *     persisted options (galleries.pipeline_options). Resume is safe & cheap —
 *     the pipeline re-reads what's already done and only processes the rest.
 *   3rd sighting → declare dead: mark culling_status='error' with an actionable
 *     message, SETTLE the credit books (charge only what was actually processed,
 *     release the rest — no credits burned on a failed run), and page the
 *     admins (WhatsApp + Sentry→Telegram).
 *
 * Also proactive provider health: asks score-vision (which holds the OpenRouter
 * key) for the remaining OpenRouter balance and alerts admins when it drops
 * below the configured threshold — BEFORE runs start failing. Deduped to one
 * alert per 12h via platform_settings.watchdog_state.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { settlePipelineBilling } from "../_shared/pipeline-billing.ts";
import { alertAdminsPipeline } from "../_shared/pipeline-alerts.ts";
import { captureException } from "../_shared/sentry.ts";

// A live chain re-invokes at least every ~2 minutes (110s budget + overhead).
// 6 minutes of silence = the chain is dead, not slow.
const STALE_MS = 6 * 60_000;
// Auto-resume attempts before declaring the run dead.
const MAX_KICKS = 2;
// Default OpenRouter low-balance alert threshold (USD); admin-tunable via
// platform_settings.watchdog_config = {"openrouter_low_usd": N}.
const DEFAULT_LOW_USD = 10;
// Low-balance alert dedup window.
const LOW_ALERT_EVERY_MS = 12 * 60 * 60_000;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const stats = { checked: 0, kicked: 0, declaredDead: 0, lowBalanceAlert: false, errors: 0 };

  try {
    // ── 1. Find culling runs that claim to be live ──────────────────────────
    const { data: processing } = await admin
      .from("galleries")
      .select("id, name, user_id, pipeline_heartbeat, culling_started_at, pipeline_options, pipeline_watchdog, pipeline_error, compression_started_at, compression_completed_at")
      .eq("culling_status", "processing");

    const now = Date.now();
    for (const g of processing || []) {
      stats.checked++;
      try {
        // Runs queued behind a LIVE compression barrier haven't booted
        // process-pipeline yet (trigger-culling flags 'processing' up front;
        // await-compression dispatches later) — there's no heartbeat to judge
        // and nothing is wrong. The barrier self-limits to ~18 minutes; past
        // that it's dead and we fall through to the liveness check below.
        const compStart = (g as { compression_started_at?: string | null }).compression_started_at;
        const compDone = (g as { compression_completed_at?: string | null }).compression_completed_at;
        if (compStart && !compDone && now - new Date(compStart).getTime() < 18 * 60_000) continue;

        // Freshest liveness signal for THIS run. The heartbeat can predate the
        // run (a previous run's stamp survives a barrier-queued restart), so
        // take the max of every signal we have. Pre-watchdog stuck galleries
        // (no heartbeat at all) still qualify via culling_started_at — the
        // watchdog rescues them too. No signal at all → nothing to judge; skip.
        const signals = [
          (g as { pipeline_heartbeat?: string | null }).pipeline_heartbeat,
          (g as { culling_started_at?: string | null }).culling_started_at,
        ].filter(Boolean).map((t) => new Date(t as string).getTime());
        if (!signals.length) continue;
        const beatRaw = new Date(Math.max(...signals)).toISOString();
        const age = now - Math.max(...signals);
        if (age < STALE_MS) continue; // live (or too fresh to judge) — leave it

        const wd = ((g as { pipeline_watchdog?: Record<string, unknown> | null }).pipeline_watchdog) ?? {};
        const kicks = Number(wd.kicks) || 0;

        if (kicks < MAX_KICKS) {
          // ── Auto-resume ──
          // Claim the kick first (guarded on still-processing) so overlapping
          // watchdog runs don't double-kick.
          const { data: claim } = await admin
            .from("galleries")
            .update({
              pipeline_watchdog: { kicks: kicks + 1, last_kick: new Date(now).toISOString() },
              pipeline_heartbeat: new Date(now).toISOString(), // don't re-flag before the kick boots
            })
            .eq("id", g.id)
            .eq("culling_status", "processing")
            .select("id");
          if (!claim || claim.length === 0) continue;

          const options = (g as { pipeline_options?: Record<string, unknown> | null }).pipeline_options ?? {};
          console.log(`watchdog: resuming dead culling run for gallery ${g.id} (kick ${kicks + 1}/${MAX_KICKS})`);
          try {
            await fetch(`${supabaseUrl}/functions/v1/process-pipeline`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
              // Links respond only after finishing their work — a timeout here
              // means "delivered and working", not failure.
              signal: AbortSignal.timeout(10_000),
              body: JSON.stringify({ galleryId: g.id, options }),
            });
          } catch (e) {
            if (!(e instanceof DOMException && e.name === "TimeoutError")) throw e;
          }
          stats.kicked++;
        } else {
          // ── Declare dead ──
          const { data: claim } = await admin
            .from("galleries")
            .update({
              pipeline_status: "error",
              culling_status: "error",
              pipeline_error:
                "הסינון נעצר ולא הצליח להתאושש אוטומטית (כנראה תקלה אצל ספק ה-AI או מחסור בקרדיטים של הספק). " +
                "הקרדיטים על תמונות שלא עובדו שוחררו. אפשר להריץ סינון שוב — הריצה תמשיך מאיפה שעצרה. הצוות קיבל התראה.",
            })
            .eq("id", g.id)
            .eq("culling_status", "processing")
            .select("id");
          if (!claim || claim.length === 0) continue;

          // Close the books: charge only actually-processed images, release
          // the rest of the reservation back to the user.
          await settlePipelineBilling(admin, supabaseUrl, serviceKey, g.id);

          await alertAdminsPipeline("Culling run DEAD — auto-resume failed twice", {
            gallery: `${(g as { name?: string }).name ?? ""} (${g.id})`,
            user: (g as { user_id?: string }).user_id,
            last_heartbeat: beatRaw,
            prior_error: (g as { pipeline_error?: string | null }).pipeline_error,
            action: "credits released; user can re-run",
          });
          stats.declaredDead++;
        }
      } catch (e) {
        stats.errors++;
        console.error(`watchdog: gallery ${g.id} failed:`, e);
      }
    }

    // ── 2. Proactive provider-balance check (OpenRouter via score-vision) ──
    // The OpenRouter key lives only in the Vercel /api project; score-vision's
    // health mode reports the remaining balance without spending tokens.
    try {
      const svUrl = Deno.env.get("SCORE_VISION_URL");
      if (svUrl) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const bypass = Deno.env.get("SCORE_VISION_BYPASS_TOKEN");
        if (bypass) headers["x-vercel-protection-bypass"] = bypass;
        const res = await fetch(svUrl, {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({ mode: "health" }),
        });
        const health = await res.json().catch(() => null) as { ok?: boolean; remaining_usd?: number | null } | null;

        // Threshold — admin-tunable without a deploy.
        let lowUsd = DEFAULT_LOW_USD;
        const { data: cfg } = await admin
          .from("platform_settings").select("value").eq("key", "watchdog_config").maybeSingle();
        try {
          const parsed = cfg?.value ? JSON.parse(cfg.value as string) : null;
          if (parsed && typeof parsed.openrouter_low_usd === "number") lowUsd = parsed.openrouter_low_usd;
        } catch { /* default */ }

        const remaining = typeof health?.remaining_usd === "number" ? health.remaining_usd : null;
        const unhealthy = !res.ok || health?.ok === false;
        const low = remaining !== null && remaining < lowUsd;

        if (unhealthy || low) {
          // Dedup: at most one low-balance/unhealthy alert per 12h.
          const { data: st } = await admin
            .from("platform_settings").select("value").eq("key", "watchdog_state").maybeSingle();
          let lastAlert = 0;
          try { lastAlert = Number(JSON.parse((st?.value as string) || "{}").last_provider_alert) || 0; } catch { /* 0 */ }
          if (now - lastAlert > LOW_ALERT_EVERY_MS) {
            await admin.from("platform_settings").upsert({
              key: "watchdog_state",
              value: JSON.stringify({ last_provider_alert: now }),
            }, { onConflict: "key" });
            await alertAdminsPipeline(
              unhealthy ? "OpenRouter health check FAILED" : "OpenRouter balance LOW",
              {
                remaining_usd: remaining,
                threshold_usd: lowUsd,
                note: "culling runs will start failing when the balance hits 0 — top up at openrouter.ai",
              },
            );
            stats.lowBalanceAlert = true;
          }
        }
      }
    } catch (e) {
      stats.errors++;
      console.error("watchdog: provider health check failed:", e);
    }

    return new Response(JSON.stringify({ success: true, ...stats }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    await captureException(err, { tags: { fn: "pipeline-watchdog" } });
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error", ...stats }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
