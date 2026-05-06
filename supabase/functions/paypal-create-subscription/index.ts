import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSubscription, getPayPalMode } from "../_shared/paypal.ts";
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

    const { planSlug, billingCycle } = await req.json();

    if (!planSlug || !billingCycle) {
      return new Response(JSON.stringify({ error: "planSlug and billingCycle are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up plan
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id, name, slug")
      .eq("slug", planSlug)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up PayPal plan mapping
    const paypalMode = await getPayPalMode();
    const { data: mapping, error: mappingError } = await supabase
      .from("paypal_plan_mapping")
      .select("paypal_plan_id")
      .eq("plan_id", plan.id)
      .eq("billing_cycle", billingCycle)
      .eq("is_sandbox", paypalMode === "sandbox")
      .single();

    if (mappingError || !mapping) {
      return new Response(JSON.stringify({ error: "PayPal plan mapping not found for this plan/cycle" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create PayPal subscription
    const result = await createSubscription({
      paypalPlanId: mapping.paypal_plan_id,
      subscriberEmail: user.email || "",
      customId: user.id,
      returnUrl: `${studioUrl}/dashboard/billing?paypal=success&plan=${planSlug}`,
      cancelUrl: `${studioUrl}/dashboard/billing?paypal=cancelled`,
    });

    console.log(`PayPal subscription created: ${result.subscriptionId} for user ${user.id}, plan ${planSlug}`);

    return new Response(
      JSON.stringify({
        approvalUrl: result.approvalUrl,
        subscriptionId: result.subscriptionId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error creating PayPal subscription:", error);
    await captureException(error, {
      tags: { fn: "paypal-create-subscription" },
      level: "error",
    });
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
