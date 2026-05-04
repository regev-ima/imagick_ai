/**
 * billing-cron — Daily billing tasks
 *
 * Triggered via pg_cron at 02:00 UTC (main tasks) and 09:00 UTC (daily summary).
 *
 * Tasks:
 * 1. Expire subscriptions past period end with cancel_at_period_end=true
 * 2. Apply scheduled downgrades
 * 3. Archive galleries (30 days inactive + expired/free user)
 * 4. Process edit warnings for free users (500/100 remaining)
 * 5. Generate daily WhatsApp summary (when ?task=summary)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import {
  subscriptionExpiredTemplate,
  downgradeScheduledTemplate,
  storageOverLimitTemplate,
} from "../_shared/email-templates.ts";
import { sendWhatsAppNotification } from "../_shared/whatsapp.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const studioUrl = (Deno.env.get("STUDIO_URL") || "https://studio.imagick.ai").replace(/\/+$/, "");

  const url = new URL(req.url);
  const task = url.searchParams.get("task");

  const stats: Record<string, number> = {
    expired: 0,
    downgrades: 0,
    staleReservationsReleased: 0,
    grantsExpired: 0,
    archived: 0,
    errors: 0,
  };

  try {
    if (task === "summary") {
      await sendDailySummary(supabase);
      return new Response(
        JSON.stringify({ success: true, task: "summary" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 1. Expire subscriptions ───────────────────────────────────────────
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const { data: expiring } = await supabase
      .from("user_subscriptions")
      .select("user_id, plan_id, current_period_end, subscription_plans!inner(name)")
      .eq("cancel_at_period_end", true)
      .lte("current_period_end", today)
      .neq("status", "expired");

    // Get free plan
    const { data: freePlan } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("slug", "free")
      .single();

    for (const sub of expiring || []) {
      try {
        await supabase
          .from("user_subscriptions")
          .update({
            status: "expired",
            plan_id: freePlan?.id || sub.plan_id,
            edits_remaining: 0,
            cancel_at_period_end: false,
            paypal_subscription_id: null,
            paypal_plan_id: null,
          })
          .eq("user_id", sub.user_id);

        // Send expiry email
        const { data: userRecord } = await supabase.auth.admin.getUserById(sub.user_id);
        if (userRecord?.user?.email) {
          const planName = (sub as any).subscription_plans?.name || "Paid";
          const template = subscriptionExpiredTemplate(planName, `${studioUrl}/dashboard/billing`);
          sendEmail({
            to: userRecord.user.email,
            subject: template.subject,
            html: template.html,
            emailType: "subscription_expired",
            userId: sub.user_id,
            supabaseAdmin: supabase,
          }).catch(err => console.error("Email send failed:", err));

          const userName = userRecord.user.user_metadata?.full_name || userRecord.user.email.split("@")[0];
          sendWhatsAppNotification(
            `⏰ Subscription Expired (cron)\nUser: ${userName} (${userRecord.user.email})\nPlan: ${planName}`
          ).catch(err => console.error("WhatsApp failed:", err));
        }

        stats.expired++;
        console.log(`Expired subscription for user ${sub.user_id}`);
      } catch (err) {
        console.error(`Error expiring user ${sub.user_id}:`, err);
        stats.errors++;
      }
    }

    // ── 2. Apply scheduled downgrades ─────────────────────────────────────
    const { data: downgrades } = await supabase
      .from("user_subscriptions")
      .select("user_id, plan_id, scheduled_plan_id, scheduled_change_at, billing_cycle, subscription_plans!inner(name), storage_used_mb")
      .not("scheduled_plan_id", "is", null)
      .lte("scheduled_change_at", today);

    for (const sub of downgrades || []) {
      try {
        // Get target plan details
        const { data: targetPlan } = await supabase
          .from("subscription_plans")
          .select("id, name, max_storage_gb")
          .eq("id", sub.scheduled_plan_id)
          .single();

        if (!targetPlan) {
          console.error(`Target plan ${sub.scheduled_plan_id} not found for downgrade`);
          continue;
        }

        // Get PayPal plan mapping for new plan
        const billingCycle = sub.billing_cycle || "monthly";
        const { data: mapping } = await supabase
          .from("paypal_plan_mapping")
          .select("paypal_plan_id")
          .eq("plan_id", targetPlan.id)
          .eq("billing_cycle", billingCycle)
          .maybeSingle();

        await supabase
          .from("user_subscriptions")
          .update({
            plan_id: targetPlan.id,
            scheduled_plan_id: null,
            scheduled_change_at: null,
            paypal_plan_id: mapping?.paypal_plan_id || null,
          })
          .eq("user_id", sub.user_id);

        // Check storage warning
        const storageUsedGb = (sub.storage_used_mb || 0) / 1024;
        const { data: userRecord } = await supabase.auth.admin.getUserById(sub.user_id);

        if (userRecord?.user?.email) {
          const currentPlanName = (sub as any).subscription_plans?.name || "Current";
          const userName = userRecord.user.user_metadata?.full_name || userRecord.user.email.split("@")[0];

          // Storage over limit warning
          if (storageUsedGb > targetPlan.max_storage_gb) {
            const template = storageOverLimitTemplate(
              storageUsedGb,
              targetPlan.max_storage_gb,
              `${studioUrl}/dashboard/billing`
            );
            sendEmail({
              to: userRecord.user.email,
              subject: template.subject,
              html: template.html,
              emailType: "storage_over_limit",
              userId: sub.user_id,
              supabaseAdmin: supabase,
            }).catch(err => console.error("Email send failed:", err));
          }

          sendWhatsAppNotification(
            `⬇️ Downgrade Applied (cron)\nUser: ${userName} (${userRecord.user.email})\n${currentPlanName} → ${targetPlan.name}`
          ).catch(err => console.error("WhatsApp failed:", err));
        }

        stats.downgrades++;
        console.log(`Applied downgrade for user ${sub.user_id}: → ${targetPlan.name}`);
      } catch (err) {
        console.error(`Error applying downgrade for user ${sub.user_id}:`, err);
        stats.errors++;
      }
    }

    // ── 3. Release stale edit reservations ────────────────────────────────
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { data: staleGalleries } = await supabase
      .from("galleries")
      .select("id, user_id, edits_reserved")
      .gt("edits_reserved", 0)
      .in("status", ["ready", "error", "archived"])
      .lt("updated_at", oneHourAgo);

    for (const g of staleGalleries || []) {
      try {
        await supabase.rpc("release_gallery_reservation", {
          p_gallery_id: g.id,
          p_user_id: g.user_id,
        });
        stats.staleReservationsReleased = (stats.staleReservationsReleased || 0) + 1;
        console.log(`Released stale reservation (${g.edits_reserved}) for gallery ${g.id}`);
      } catch (err) {
        console.error(`Error releasing stale reservation for gallery ${g.id}:`, err);
        stats.errors++;
      }
    }

    // ── 4. Expire credit grants ──────────────────────────────────────────
    try {
      const { data: expiredGrantCount, error: expireGrantErr } = await supabase
        .rpc("expire_credit_grants");

      if (expireGrantErr) {
        console.error("Error expiring credit grants:", expireGrantErr);
        stats.errors++;
      } else {
        stats.grantsExpired = expiredGrantCount || 0;
        if (expiredGrantCount > 0) {
          console.log(`Expired ${expiredGrantCount} credit grants`);
        }
      }
    } catch (err) {
      console.error("Error in credit grant expiration:", err);
      stats.errors++;
    }

    // ── 5. Archive inactive galleries ─────────────────────────────────────
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Find galleries from expired/free users that haven't been updated in 30 days
    const { data: inactiveGalleries } = await supabase
      .from("galleries")
      .select("id, user_id, name")
      .lt("updated_at", thirtyDaysAgo)
      .neq("status", "archived")
      .limit(100);

    for (const gallery of inactiveGalleries || []) {
      try {
        // Check if user is expired or free with 0 edits
        const { data: userSub } = await supabase
          .from("user_subscriptions")
          .select("status, edits_remaining, subscription_plans!inner(slug)")
          .eq("user_id", gallery.user_id)
          .single();

        const planSlug = (userSub as any)?.subscription_plans?.slug;
        const isExpired = userSub?.status === "expired";
        const isFreeExhausted = planSlug === "free" && userSub?.edits_remaining === 0;

        if (isExpired || isFreeExhausted) {
          await supabase
            .from("galleries")
            .update({ status: "archived" })
            .eq("id", gallery.id);

          stats.archived++;
          console.log(`Archived gallery ${gallery.id} (${gallery.name}) for user ${gallery.user_id}`);
        }
      } catch (err) {
        console.error(`Error archiving gallery ${gallery.id}:`, err);
        stats.errors++;
      }
    }

    console.log("Billing cron completed:", stats);

    return new Response(
      JSON.stringify({ success: true, stats }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Billing cron error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: msg, stats }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendDailySummary(supabase: any) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString();
  const dateLabel = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // New signups in last 24h
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const allUsers = usersData?.users || [];
  const newSignups = allUsers.filter((u: any) =>
    u.created_at && new Date(u.created_at) >= yesterday
  ).length;

  // New subscribers in last 24h
  const { data: newSubs, count: newSubCount } = await supabase
    .from("invoices")
    .select("amount", { count: "exact" })
    .eq("type", "subscription")
    .gte("created_at", yesterdayStr);

  const revenue = (newSubs || []).reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);

  // Cancellations in last 24h
  const { count: cancelCount } = await supabase
    .from("paypal_webhook_events")
    .select("id", { count: "exact" })
    .eq("event_type", "BILLING.SUBSCRIPTION.CANCELLED")
    .gte("created_at", yesterdayStr);

  // Total active subscribers
  const { count: activeCount } = await supabase
    .from("user_subscriptions")
    .select("user_id", { count: "exact" })
    .eq("status", "active")
    .not("paypal_subscription_id", "is", null);

  const summary = [
    `📊 Daily Summary — ${dateLabel}`,
    `New signups: ${newSignups}`,
    `New subscribers: ${newSubCount || 0} ($${revenue.toFixed(2)})`,
    `Cancellations: ${cancelCount || 0}`,
    `Total active subscribers: ${activeCount || 0}`,
  ].join("\n");

  await sendWhatsAppNotification(summary);
  console.log("Daily summary sent:", summary);
}
