import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPayPalMode } from "../_shared/paypal.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      .select("id, name, slug, price_monthly, price_yearly")
      .eq("slug", planSlug)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine PayPal mode and look up plan mapping
    const paypalMode = await getPayPalMode();
    const isSandbox = paypalMode === "sandbox";

    const { data: mapping, error: mappingError } = await supabase
      .from("paypal_plan_mapping")
      .select("paypal_plan_id")
      .eq("plan_id", plan.id)
      .eq("billing_cycle", billingCycle)
      .eq("is_sandbox", isSandbox)
      .single();

    if (mappingError || !mapping) {
      return new Response(JSON.stringify({ error: "PayPal plan mapping not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prefix = isSandbox ? "PAYPAL_SANDBOX" : "PAYPAL_LIVE";
    const clientId = Deno.env.get(`${prefix}_CLIENT_ID`) || Deno.env.get("PAYPAL_CLIENT_ID");
    if (!clientId) {
      return new Response(JSON.stringify({ error: "PayPal not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        clientId,
        paypalPlanId: mapping.paypal_plan_id,
        planName: plan.name,
        priceMonthly: plan.price_monthly,
        priceYearly: plan.price_yearly,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in paypal-client-token:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
