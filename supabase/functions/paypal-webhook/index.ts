import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyWebhookSignature, getSubscriptionDetails, getPayPalMode } from "../_shared/paypal.ts";
import { sendEmail } from "../_shared/email-sender.ts";
import {
  subscriptionActivatedTemplate,
  subscriptionCancelledTemplate,
  subscriptionExpiredTemplate,
  paymentFailedTemplate,
  invoiceEmailTemplate,
} from "../_shared/email-templates.ts";
import { sendWhatsAppNotification } from "../_shared/whatsapp.ts";
import { captureException } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const studioUrl = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");

  try {
    const bodyText = await req.text();
    const event = JSON.parse(bodyText);

    console.log("PayPal webhook received:", event.event_type, event.id);

    // 1. Verify signature
    const isValid = await verifyWebhookSignature(req.headers, bodyText);
    if (!isValid) {
      console.error("Invalid PayPal webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Atomic idempotency: insert first, rely on the UNIQUE(event_id)
    //    constraint so two simultaneous PayPal retries can't both pass the
    //    check and double-charge the customer. Whichever webhook commits
    //    the row first owns processing; the other(s) bail out as duplicates.
    const eventId = event.id;
    const { error: insertErr } = await supabase
      .from("paypal_webhook_events")
      .insert({
        event_id: eventId,
        event_type: event.event_type,
        resource_type: event.resource_type,
        resource_id: event.resource?.id,
        payload: event,
        processed: false,
      });

    let alreadyProcessed = false;
    if (insertErr) {
      // 23505 = unique_violation — another concurrent webhook (or a PayPal
      // retry of an event we already returned 5xx for) beat us to inserting.
      if ((insertErr as { code?: string }).code !== "23505") {
        throw insertErr;
      }

      // Check the prior row: if it finished processing, this is a true
      // duplicate and we ack with 200. If not, fall through and re-attempt
      // processing — this is the PayPal retry path after a previous 5xx.
      const { data: existing } = await supabase
        .from("paypal_webhook_events")
        .select("processed")
        .eq("event_id", eventId)
        .maybeSingle();

      if (existing?.processed) {
        console.log(`Duplicate webhook event ${eventId} (already processed), acking`);
        return new Response(JSON.stringify({ status: "duplicate" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Webhook event ${eventId} previously failed; retrying processing`);
      alreadyProcessed = true; // skip mark-as-processed on success path? no — still mark it
    }

    // 3. Process event. On failure we re-raise so the outer catch returns
    //    5xx, and PayPal retries the same event_id. The retry path above
    //    will re-attempt processing because processed=false.
    try {
      await processEvent(supabase, event, studioUrl);

      await supabase
        .from("paypal_webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          processing_error: null,
        })
        .eq("event_id", eventId);
    } catch (processErr: any) {
      console.error("Error processing webhook event:", processErr);
      await supabase
        .from("paypal_webhook_events")
        .update({ processing_error: processErr.message || String(processErr) })
        .eq("event_id", eventId);
      await captureException(processErr, {
        tags: { fn: "paypal-webhook", phase: "processEvent", eventType: event.event_type },
        extra: { eventId, retry: alreadyProcessed },
        level: "error",
      });
      // Re-raise so the outer catch returns 5xx and PayPal retries.
      throw processErr;
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("PayPal webhook error:", error);
    await captureException(error, { tags: { fn: "paypal-webhook" }, level: "fatal" });
    // Return 5xx so PayPal retries with the same event_id. The idempotency
    // layer above will dedupe successful processing on the retry.
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ status: "error", message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processEvent(supabase: any, event: any, studioUrl: string) {
  const resource = event.resource;
  const eventType = event.event_type;

  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const paypalSubId = resource.id;
      const customId = resource.custom_id; // our user_id
      if (!customId) {
        console.error("No custom_id (user_id) in subscription activated event");
        return;
      }

      // Get subscription details for billing cycle info
      const subDetails = await getSubscriptionDetails(paypalSubId);
      // billingCycle will be determined from the plan mapping below
      const nextBillingTime = subDetails.billing_info?.next_billing_time;

      // Look up which plan this PayPal plan maps to
      const paypalMode = await getPayPalMode();
      const { data: mapping } = await supabase
        .from("paypal_plan_mapping")
        .select("plan_id, billing_cycle")
        .eq("paypal_plan_id", subDetails.plan_id)
        .eq("is_sandbox", paypalMode === "sandbox")
        .maybeSingle();

      if (!mapping) {
        console.error(`No plan mapping found for PayPal plan ${subDetails.plan_id}`);
        return;
      }

      // Get plan details
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", mapping.plan_id)
        .single();

      // Calculate period dates
      const now = new Date();
      const periodEnd = nextBillingTime
        ? new Date(nextBillingTime)
        : new Date(now.getTime() + (mapping.billing_cycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000);

      // Starting pool = the plan's monthly allowance (or -1 for legacy
      // unlimited plans) + the user's surviving gift/purchased credits.
      // NOTE: the column is edits_remaining — the old `credits_remaining`
      // key here was writing to a column that no longer exists post-rename.
      const { data: grantSum } = await supabase
        .rpc("sum_active_grant_credits", { p_user_id: customId });
      const allowance = plan.edits_included === -1
        ? -1
        : (plan.edits_included ?? 0) + (Number(grantSum) || 0);

      // Update user subscription (upsert to cover missing rows)
      await supabase
        .from("user_subscriptions")
        .upsert({
          user_id: customId,
          plan_id: mapping.plan_id,
          status: "active",
          billing_cycle: mapping.billing_cycle,
          paypal_subscription_id: paypalSubId,
          paypal_plan_id: subDetails.plan_id,
          edits_remaining: allowance,
          edits_used: 0,
          credits_refilled_at: now.toISOString(),
          cancel_at_period_end: false,
          scheduled_plan_id: null,
          scheduled_change_at: null,
          suspension_count: 0,
          current_period_start: now.toISOString().split("T")[0],
          current_period_end: periodEnd.toISOString().split("T")[0],
          last_payment_at: now.toISOString(),
        }, { onConflict: "user_id" });

      // Generate invoice
      const price = mapping.billing_cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
      await generateInvoiceRecord(supabase, customId, {
        type: "subscription",
        description: `${plan.name} Plan - ${mapping.billing_cycle === "yearly" ? "Annual" : "Monthly"}`,
        amount: price,
        plan_id: mapping.plan_id,
        billing_cycle: mapping.billing_cycle,
        paypal_transaction_id: paypalSubId,
      }, studioUrl);

      // Send email
      const { data: userRecord } = await supabase.auth.admin.getUserById(customId);
      if (userRecord?.user?.email) {
        const template = subscriptionActivatedTemplate(
          plan.name,
          mapping.billing_cycle,
          periodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          `${studioUrl}/dashboard/billing`
        );
        sendEmail({
          to: userRecord.user.email,
          subject: template.subject,
          html: template.html,
          emailType: "subscription_change",
          userId: customId,
          supabaseAdmin: supabase,
        }).catch(err => console.error("Email send failed:", err));

        const userName = userRecord.user.user_metadata?.full_name || userRecord.user.email.split("@")[0];
        sendWhatsAppNotification(
          `💰 New Subscriber!\nUser: ${userName} (${userRecord.user.email})\nPlan: ${plan.name} (${mapping.billing_cycle})\nAmount: $${price}`
        ).catch(err => console.error("WhatsApp failed:", err));
      }

      console.log(`Subscription activated for user ${customId}: ${plan.name} (${mapping.billing_cycle})`);
      break;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED": {
      const paypalSubId = resource.id;

      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("user_id, plan_id, current_period_end, subscription_plans!inner(name)")
        .eq("paypal_subscription_id", paypalSubId)
        .maybeSingle();

      if (!sub) {
        console.error(`No subscription found for PayPal sub ${paypalSubId}`);
        return;
      }

      await supabase
        .from("user_subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("paypal_subscription_id", paypalSubId);

      // Send email
      const { data: userRecord } = await supabase.auth.admin.getUserById(sub.user_id);
      if (userRecord?.user?.email) {
        const planName = (sub as any).subscription_plans?.name || "Paid";
        const template = subscriptionCancelledTemplate(
          planName,
          sub.current_period_end,
          `${studioUrl}/dashboard/billing`
        );
        sendEmail({
          to: userRecord.user.email,
          subject: template.subject,
          html: template.html,
          emailType: "subscription_change",
          userId: sub.user_id,
          supabaseAdmin: supabase,
        }).catch(err => console.error("Email send failed:", err));

        const userName = userRecord.user.user_metadata?.full_name || userRecord.user.email.split("@")[0];
        sendWhatsAppNotification(
          `❌ Subscription Cancelled\nUser: ${userName} (${userRecord.user.email})\nPlan: ${planName}\nActive until: ${sub.current_period_end}`
        ).catch(err => console.error("WhatsApp failed:", err));
      }

      console.log(`Subscription cancelled for PayPal sub ${paypalSubId}`);
      break;
    }

    case "BILLING.SUBSCRIPTION.EXPIRED": {
      const paypalSubId = resource.id;

      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("user_id, plan_id, subscription_plans!inner(name)")
        .eq("paypal_subscription_id", paypalSubId)
        .maybeSingle();

      if (!sub) return;

      // Get free plan ID
      const { data: freePlan } = await supabase
        .from("subscription_plans")
        .select("id")
        .eq("slug", "free")
        .single();

      // Revert to free plan. The plan pool is gone, but gift/purchased
      // credits are the USER'S — they survive the downgrade (also the
      // consumer-protection-safe behavior for paid top-ups).
      const { data: expGrantSum } = await supabase
        .rpc("sum_active_grant_credits", { p_user_id: sub.user_id });
      await supabase
        .from("user_subscriptions")
        .update({
          status: "expired",
          plan_id: freePlan?.id || sub.plan_id,
          edits_remaining: Number(expGrantSum) || 0,
          cancel_at_period_end: false,
          paypal_subscription_id: null,
          paypal_plan_id: null,
        })
        .eq("paypal_subscription_id", paypalSubId);

      // Send email
      const { data: userRecord } = await supabase.auth.admin.getUserById(sub.user_id);
      if (userRecord?.user?.email) {
        const planName = (sub as any).subscription_plans?.name || "Paid";
        const template = subscriptionExpiredTemplate(planName, `${studioUrl}/dashboard/billing`);
        sendEmail({
          to: userRecord.user.email,
          subject: template.subject,
          html: template.html,
          emailType: "subscription_change",
          userId: sub.user_id,
          supabaseAdmin: supabase,
        }).catch(err => console.error("Email send failed:", err));

        const userName = userRecord.user.user_metadata?.full_name || userRecord.user.email.split("@")[0];
        sendWhatsAppNotification(
          `⏰ Subscription Expired\nUser: ${userName} (${userRecord.user.email})\nPlan: ${planName}`
        ).catch(err => console.error("WhatsApp failed:", err));
      }

      console.log(`Subscription expired for PayPal sub ${paypalSubId}`);
      break;
    }

    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      const paypalSubId = resource.id;

      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("user_id, suspension_count, subscription_plans!inner(name)")
        .eq("paypal_subscription_id", paypalSubId)
        .maybeSingle();

      if (!sub) return;

      await supabase
        .from("user_subscriptions")
        .update({
          status: "suspended",
          suspension_count: (sub.suspension_count || 0) + 1,
        })
        .eq("paypal_subscription_id", paypalSubId);

      // Send email to user
      const { data: userRecord } = await supabase.auth.admin.getUserById(sub.user_id);
      if (userRecord?.user?.email) {
        const planName = (sub as any).subscription_plans?.name || "Paid";
        const template = paymentFailedTemplate(planName, `${studioUrl}/dashboard/billing`);
        sendEmail({
          to: userRecord.user.email,
          subject: template.subject,
          html: template.html,
          emailType: "subscription_change",
          userId: sub.user_id,
          supabaseAdmin: supabase,
        }).catch(err => console.error("Email send failed:", err));

        const userName = userRecord.user.user_metadata?.full_name || userRecord.user.email.split("@")[0];
        sendWhatsAppNotification(
          `🚨 PAYMENT FAILED\nUser: ${userName} (${userRecord.user.email})\nPlan: ${planName}\nSuspension #${(sub.suspension_count || 0) + 1}`
        ).catch(err => console.error("WhatsApp failed:", err));
      }

      console.log(`Subscription suspended for PayPal sub ${paypalSubId}`);
      break;
    }

    case "BILLING.SUBSCRIPTION.RENEWED": {
      // PayPal can emit RENEWED separately from PAYMENT.SALE.COMPLETED.
      // The payment-side handler below records the invoice + sends mail;
      // here we just refresh the period window so usage gates stay aligned.
      const paypalSubId = resource.id;
      let nextBillingTime: string | undefined;
      try {
        const subDetails = await getSubscriptionDetails(paypalSubId);
        nextBillingTime = subDetails.billing_info?.next_billing_time;
      } catch (err) {
        console.error("Failed to fetch subscription details on RENEWED:", err);
      }

      const updates: Record<string, unknown> = {
        status: "active",
        last_payment_at: new Date().toISOString(),
        suspension_count: 0,
      };
      if (nextBillingTime) {
        updates.current_period_end = new Date(nextBillingTime).toISOString().split("T")[0];
      }

      await supabase
        .from("user_subscriptions")
        .update(updates)
        .eq("paypal_subscription_id", paypalSubId);

      console.log(`Subscription renewed for PayPal sub ${paypalSubId}`);
      break;
    }

    case "PAYMENT.SALE.COMPLETED": {
      // Recurring payment received - generate invoice
      const billingAgreementId = resource.billing_agreement_id;
      if (!billingAgreementId) return;

      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("user_id, plan_id, billing_cycle, subscription_plans!inner(name, price_monthly, price_yearly)")
        .eq("paypal_subscription_id", billingAgreementId)
        .maybeSingle();

      if (!sub) return;

      const plan = (sub as any).subscription_plans;
      const amount = sub.billing_cycle === "yearly" ? plan.price_yearly : plan.price_monthly;

      // Update last payment
      await supabase
        .from("user_subscriptions")
        .update({
          last_payment_at: new Date().toISOString(),
          status: "active",
          suspension_count: 0,
        })
        .eq("paypal_subscription_id", billingAgreementId);

      await generateInvoiceRecord(supabase, sub.user_id, {
        type: "renewal",
        description: `${plan.name} Plan - ${sub.billing_cycle === "yearly" ? "Annual" : "Monthly"} Renewal`,
        amount,
        plan_id: sub.plan_id,
        billing_cycle: sub.billing_cycle,
        paypal_transaction_id: resource.id,
      }, studioUrl);

      console.log(`Payment received for subscription ${billingAgreementId}`);
      break;
    }

    default:
      console.log(`Unhandled PayPal event type: ${eventType}`);
  }
}

async function generateInvoiceRecord(supabase: any, userId: string, details: {
  type: string;
  description: string;
  amount: number;
  plan_id?: string;
  billing_cycle?: string;
  paypal_transaction_id?: string;
}, studioUrl: string) {
  // Generate invoice number using timestamp-based approach
  const now = new Date();
  const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Date.now().toString(36).toUpperCase()}`;

  const { data: invoiceData, error } = await supabase.from("invoices").insert({
    user_id: userId,
    invoice_number: invoiceNumber,
    type: details.type,
    description: details.description,
    amount: details.amount,
    status: "paid",
    paypal_transaction_id: details.paypal_transaction_id,
    plan_id: details.plan_id,
    billing_cycle: details.billing_cycle,
  }).select("id").single();

  if (error) {
    console.error("Failed to create invoice:", error);
  } else {
    console.log(`Invoice ${invoiceNumber} created for user ${userId}`);

    // Trigger HTML invoice generation
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ invoiceId: invoiceData.id }),
      });
    } catch (genErr) {
      console.error("Failed to generate invoice HTML:", genErr);
    }

    // Send invoice email
    try {
      const { data: userRecord } = await supabase.auth.admin.getUserById(userId);
      if (userRecord?.user?.email) {
        const invoiceUrl = `${studioUrl}/dashboard/billing`;
        const template = invoiceEmailTemplate(
          invoiceNumber,
          details.description,
          details.amount,
          invoiceUrl,
        );
        sendEmail({
          to: userRecord.user.email,
          subject: template.subject,
          html: template.html,
          emailType: "subscription_change",
          userId,
          supabaseAdmin: supabase,
        }).catch((err: unknown) => console.error("Invoice email send failed:", err));
      }
    } catch (emailErr) {
      console.error("Failed to send invoice email:", emailErr);
    }
  }
}
