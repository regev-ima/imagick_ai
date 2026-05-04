import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSubscription, cancelSubscription, getPayPalMode } from "../_shared/paypal.ts";
import { sendWhatsAppNotification } from "../_shared/whatsapp.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const studioUrl = (Deno.env.get("STUDIO_URL") || "https://studio.imagick.ai").replace(/\/+$/, "");

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

    const { targetPlanSlug, billingCycle: requestedCycle } = await req.json();

    if (!targetPlanSlug) {
      return new Response(JSON.stringify({ error: "targetPlanSlug is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current subscription
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("*, subscription_plans!inner(*)")
      .eq("user_id", user.id)
      .single();

    if (!sub) {
      return new Response(JSON.stringify({ error: "No subscription found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentPlan = (sub as any).subscription_plans;

    // Get target plan
    const { data: targetPlan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("slug", targetPlanSlug)
      .eq("is_active", true)
      .single();

    if (!targetPlan) {
      return new Response(JSON.stringify({ error: "Target plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isUpgrade = targetPlan.sort_order > currentPlan.sort_order;
    const billingCycle = requestedCycle || sub.billing_cycle || "monthly";

    if (isUpgrade) {
      // UPGRADE: Cancel current subscription and create new one
      // The new subscription will be activated via webhook

      // Get PayPal plan mapping for target
      const paypalMode = await getPayPalMode();
      const { data: mapping } = await supabase
        .from("paypal_plan_mapping")
        .select("paypal_plan_id")
        .eq("plan_id", targetPlan.id)
        .eq("billing_cycle", billingCycle)
        .eq("is_sandbox", paypalMode === "sandbox")
        .single();

      if (!mapping) {
        return new Response(JSON.stringify({ error: "PayPal plan mapping not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cancel current PayPal sub if exists
      if (sub.paypal_subscription_id) {
        try {
          await cancelSubscription(sub.paypal_subscription_id, "Upgrading to higher plan");
        } catch (err) {
          console.warn("Failed to cancel old subscription:", err);
        }
      }

      // Create new subscription
      const result = await createSubscription({
        paypalPlanId: mapping.paypal_plan_id,
        subscriberEmail: user.email || "",
        customId: user.id,
        returnUrl: `${studioUrl}/dashboard/billing?paypal=success&plan=${targetPlanSlug}`,
        cancelUrl: `${studioUrl}/dashboard/billing?paypal=cancelled`,
      });

      const userName = user.user_metadata?.full_name || user.email?.split("@")[0];
      sendWhatsAppNotification(
        `⬆️ Plan Upgrade Started\nUser: ${userName} (${user.email})\n${currentPlan.name} → ${targetPlan.name}`
      ).catch(err => console.error("WhatsApp failed:", err));

      return new Response(
        JSON.stringify({ action: "upgrade", approvalUrl: result.approvalUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // DOWNGRADE: Schedule for end of period
      await supabase
        .from("user_subscriptions")
        .update({
          scheduled_plan_id: targetPlan.id,
          scheduled_change_at: sub.current_period_end,
        })
        .eq("user_id", user.id);

      // Check storage warning
      const storageUsedGb = (sub.storage_used_mb || 0) / 1024;
      const storageWarning = storageUsedGb > targetPlan.max_storage_gb;

      const userName = user.user_metadata?.full_name || user.email?.split("@")[0];
      sendWhatsAppNotification(
        `⬇️ Downgrade Scheduled\nUser: ${userName} (${user.email})\n${currentPlan.name} → ${targetPlan.name}\nSwitch date: ${sub.current_period_end}`
      ).catch(err => console.error("WhatsApp failed:", err));

      return new Response(
        JSON.stringify({
          action: "downgrade_scheduled",
          switchDate: sub.current_period_end,
          storageWarning,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Error changing plan:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
