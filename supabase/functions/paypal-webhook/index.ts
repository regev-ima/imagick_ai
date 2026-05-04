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
  const studioUrl = (Deno.env.get("STUDIO_URL") || "https://studio.imagick.ai").replace(/\/+$/, "");

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

    // 2. Idempotency check
    const eventId = event.id;
    const { data: existing } = await supabase
      .from("paypal_webhook_events")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      console.log(`Duplicate webhook event ${eventId}, skipping`);
      return new Response(JSON.stringify({ status: "duplicate" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Insert event record
    await supabase.from("paypal_webhook_events").insert({
      event_id: eventId,
      event_type: event.event_type,
      resource_type: event.resource_type,
      resource_id: event.resource?.id,
      payload: event,
      processed: false,
    });

    // 4. Process event
    try {
      await processEvent(supabase, event, studioUrl);

      await supabase
        .from("paypal_webhook_events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("event_id", eventId);
    } catch (processErr: any) {
      console.error("Error processing webhook event:", processErr);
      await supabase
        .from("paypal_webhook_events")
        .update({ processing_error: processErr.message || String(processErr) })
        .eq("event_id", eventId);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("PayPal webhook error:", error);
    // Return 200 to prevent PayPal from retrying
    return new Response(JSON.stringify({ status: "error" }), {
      status: 200,
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
          credits_remaining: -1, // unlimited for paid plans
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

      // Revert to free plan
      await supabase
        .from("user_subscriptions")
        .update({
          status: "expired",
          plan_id: freePlan?.id || sub.plan_id,
          credits_remaining: 0, // no free credits after expiry
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
