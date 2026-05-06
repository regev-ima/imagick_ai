import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cancelSubscription } from "../_shared/paypal.ts";
import { sendEmail } from "../_shared/email-sender.ts";
import { subscriptionCancelledTemplate } from "../_shared/email-templates.ts";
import { sendWhatsAppNotification } from "../_shared/whatsapp.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { captureException } from "../_shared/sentry.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const studioUrl = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reason } = await req.json();

    // Get user's subscription
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("paypal_subscription_id, current_period_end, plan_id, subscription_plans!inner(name)")
      .eq("user_id", user.id)
      .single();

    if (!sub?.paypal_subscription_id) {
      return new Response(JSON.stringify({ error: "No active PayPal subscription found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cancel on PayPal
    await cancelSubscription(sub.paypal_subscription_id, reason || "User requested cancellation");

    // Mark as cancelling at period end
    await supabase
      .from("user_subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("user_id", user.id);

    // Send email
    const planName = (sub as any).subscription_plans?.name || "Paid";
    const template = subscriptionCancelledTemplate(
      planName,
      sub.current_period_end,
      `${studioUrl}/dashboard/billing`
    );
    sendEmail({
      to: user.email!,
      subject: template.subject,
      html: template.html,
      emailType: "subscription_change",
      userId: user.id,
      supabaseAdmin: supabase,
    }).catch(err => console.error("Email send failed:", err));

    // WhatsApp
    const userName = user.user_metadata?.full_name || user.email?.split("@")[0];
    sendWhatsAppNotification(
      `❌ Subscription Cancelled\nUser: ${userName} (${user.email})\nPlan: ${planName}\nActive until: ${sub.current_period_end}`
    ).catch(err => console.error("WhatsApp failed:", err));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error cancelling subscription:", error);
    await captureException(error, {
      tags: { fn: "paypal-cancel-subscription" },
      level: "error",
    });
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
