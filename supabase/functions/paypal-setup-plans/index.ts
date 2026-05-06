import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAccessToken, getPayPalMode } from "../_shared/paypal.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { captureException } from "../_shared/sentry.ts";

async function getApiBaseForSetup(): Promise<string> {
  const mode = await getPayPalMode();
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function paypalPost(path: string, body: unknown) {
  const token = await getAccessToken();
  const apiBase = await getApiBaseForSetup();
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`PayPal ${path} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check – admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Check admin role
    const { data: adminCheck } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create PayPal Product (catalog)
    console.log("Creating PayPal product...");
    const product = await paypalPost("/v1/catalogs/products", {
      name: "Imagick Subscription",
      description: "AI-powered photo editing platform subscription",
      type: "SERVICE",
      category: "SOFTWARE",
    });
    const productId = product.id;
    console.log(`Product created: ${productId}`);

    // 2. Fetch paid plans from DB
    const { data: plans, error: plansError } = await supabase
      .from("subscription_plans")
      .select("id, name, slug, price_monthly, price_yearly")
      .eq("is_active", true)
      .neq("slug", "free")
      .order("sort_order");

    if (plansError || !plans?.length) {
      throw new Error("No paid plans found in database");
    }

    const paypalMode = await getPayPalMode();
    const isSandbox = paypalMode === "sandbox";
    const results: any[] = [];

    for (const plan of plans) {
      // Monthly plan
      console.log(`Creating monthly plan for ${plan.name}...`);
      const monthlyPlan = await paypalPost("/v1/billing/plans", {
        product_id: productId,
        name: `${plan.name} – Monthly`,
        description: `${plan.name} subscription billed monthly`,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0, // infinite
            pricing_scheme: {
              fixed_price: {
                value: String(plan.price_monthly),
                currency_code: "USD",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 3,
        },
      });
      console.log(`Monthly plan created: ${monthlyPlan.id}`);

      // Insert monthly mapping
      await supabase.from("paypal_plan_mapping").upsert(
        {
          plan_id: plan.id,
          billing_cycle: "monthly",
          paypal_plan_id: monthlyPlan.id,
          is_sandbox: isSandbox,
        },
        { onConflict: "plan_id,billing_cycle,is_sandbox" }
      );

      // Yearly plan
      console.log(`Creating yearly plan for ${plan.name}...`);
      const yearlyPlan = await paypalPost("/v1/billing/plans", {
        product_id: productId,
        name: `${plan.name} – Yearly`,
        description: `${plan.name} subscription billed yearly`,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: { interval_unit: "YEAR", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: String(plan.price_yearly),
                currency_code: "USD",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 3,
        },
      });
      console.log(`Yearly plan created: ${yearlyPlan.id}`);

      // Insert yearly mapping
      await supabase.from("paypal_plan_mapping").upsert(
        {
          plan_id: plan.id,
          billing_cycle: "yearly",
          paypal_plan_id: yearlyPlan.id,
          is_sandbox: isSandbox,
        },
        { onConflict: "plan_id,billing_cycle,is_sandbox" }
      );

      results.push({
        plan: plan.name,
        slug: plan.slug,
        monthly: { paypalPlanId: monthlyPlan.id, price: plan.price_monthly },
        yearly: { paypalPlanId: yearlyPlan.id, price: plan.price_yearly },
      });
    }

    console.log("All PayPal plans created successfully!");

    return new Response(
      JSON.stringify({ productId, plans: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error setting up PayPal plans:", error);
    await captureException(error, {
      tags: { fn: "paypal-setup-plans" },
      level: "error",
    });
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
