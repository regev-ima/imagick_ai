/**
 * re-engagement-cron — Send "we miss you" email to users inactive 30+ days.
 *
 * A user is considered inactive if no gallery they own has finished
 * processing in the last 30 days. We dedupe via email_logs: if a
 * journey_reengagement email was sent in the last 60 days we skip them.
 *
 * Honors user_email_preferences.journey_emails (handled by sendEmail).
 *
 * Triggered daily at 10:00 UTC by pg_cron.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import { journeyReEngagementTemplate } from "../_shared/email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { captureException } from "../_shared/sentry.ts";

const INACTIVITY_DAYS = 30;
const RESEND_COOLDOWN_DAYS = 60;
const BATCH_LIMIT = 100;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const studioUrl = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");

  const stats = { eligible: 0, sent: 0, skipped: 0, errors: 0 };

  try {
    const inactiveCutoff = new Date(Date.now() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const cooldownCutoff = new Date(Date.now() - RESEND_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Candidates: users who signed up before the inactivity window
    const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;

    const candidates = (usersData?.users || []).filter((u: any) =>
      u.created_at && new Date(u.created_at) < new Date(inactiveCutoff)
    );

    for (const user of candidates) {
      if (stats.sent >= BATCH_LIMIT) break;

      try {
        // Skip if user has any gallery edited in the last 30 days
        const { count: recentEditCount } = await supabase
          .from("galleries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("processing_completed_at", inactiveCutoff);

        if ((recentEditCount || 0) > 0) {
          stats.skipped++;
          continue;
        }

        // Skip if we already sent a re-engagement email in the cooldown window
        const { count: recentEmailCount } = await supabase
          .from("email_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("email_type", "journey_reengagement")
          .gte("created_at", cooldownCutoff);

        if ((recentEmailCount || 0) > 0) {
          stats.skipped++;
          continue;
        }

        stats.eligible++;

        const firstName =
          user.user_metadata?.full_name?.split(" ")[0] ||
          user.email?.split("@")[0] ||
          "there";

        const unsubscribeUrl = `${studioUrl}/journey-unsubscribe?user_id=${user.id}`;
        const template = journeyReEngagementTemplate(studioUrl, firstName, unsubscribeUrl);

        const result = await sendEmail({
          to: user.email!,
          subject: template.subject,
          html: template.html,
          emailType: "journey_reengagement",
          userId: user.id,
          metadata: { reason: "inactivity_30d" },
          supabaseAdmin: supabase,
        });

        if (result.success && !result.skipped) {
          stats.sent++;
        } else if (result.skipped) {
          stats.skipped++;
        } else {
          stats.errors++;
        }
      } catch (err) {
        console.error(`re-engagement-cron user ${user.id} failed:`, err);
        stats.errors++;
      }
    }

    console.log("re-engagement-cron completed:", stats);

    return new Response(
      JSON.stringify({ success: true, stats }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("re-engagement-cron error:", error);
    await captureException(error, {
      tags: { fn: "re-engagement-cron" },
      extra: { stats },
      level: "error",
    });
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: msg, stats }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
