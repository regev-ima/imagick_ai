import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAccessToken, getPayPalMode } from "../_shared/paypal.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { captureException } from "../_shared/sentry.ts";

// Admin bootstrap: creates the PayPal product + billing plans for every
// published paid plan version and records the mappings.
//
// DUPLICATE-SAFE by design (running it twice must be a no-op):
//   1. PayPal-Request-Id — a deterministic idempotency key per resource;
//      PayPal returns the existing resource for a repeated key instead of
//      creating a duplicate.
//   2. The product id is persisted in platform_settings per mode and reused.
//   3. Plan versions that already have a mapping are skipped — a price
//      change is a NEW plan version (new row, no mapping yet), which is
//      exactly what triggers creation.
//   4. A short-lived run lock blocks concurrent invocations.

async function getApiBaseForSetup(): Promise<string> {
  const mode = await getPayPalMode();
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function paypalPost(path: string, body: unknown, requestId?: string) {
  const token = await getAccessToken();
  const apiBase = await getApiBaseForSetup();
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
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

function billingPlanBody(
  productId: string,
  planName: string,
  cycle: "monthly" | "yearly",
  price: number,
) {
  return {
    product_id: productId,
    name: `${planName} – ${cycle === "monthly" ? "Monthly" : "Yearly"}`,
    description: `${planName} subscription billed ${cycle}`,
    status: "ACTIVE",
    billing_cycles: [
      {
        frequency: { interval_unit: cycle === "monthly" ? "MONTH" : "YEAR", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0, // infinite
        pricing_scheme: {
          fixed_price: { value: String(price), currency_code: "USD" },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      payment_failure_threshold: 3,
    },
  };
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
    const { data: adminCheck } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paypalMode = await getPayPalMode();
    const isSandbox = paypalMode === "sandbox";

    // Run lock — blocks a concurrent second invocation; a crashed run
    // self-heals after 5 minutes.
    const lockKey = `paypal_setup_lock_${paypalMode}`;
    const { data: lockRow } = await supabase
      .from("platform_settings").select("value, updated_at").eq("key", lockKey).maybeSingle();
    const lockFresh = lockRow?.value === "locked" && lockRow?.updated_at &&
      Date.now() - new Date(lockRow.updated_at).getTime() < 5 * 60_000;
    if (lockFresh) {
      return new Response(
        JSON.stringify({ error: "Plan setup is already running — try again in a few minutes" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    await supabase.from("platform_settings").upsert(
      { key: lockKey, value: "locked", updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

    try {
      // 1. One PayPal Product per mode — persisted and reused, idempotent create.
      const productKey = `paypal_product_id_${paypalMode}`;
      const { data: productRow } = await supabase
        .from("platform_settings").select("value").eq("key", productKey).maybeSingle();
      let productId: string | null = productRow?.value || null;
      if (!productId) {
        console.log("Creating PayPal product...");
        const product = await paypalPost("/v1/catalogs/products", {
          name: "Imagick Subscription",
          description: "AI-powered photo editing platform subscription",
          type: "SERVICE",
          category: "SOFTWARE",
        }, `imagick-product-${paypalMode}`);
        productId = product.id;
        await supabase.from("platform_settings").upsert(
          { key: productKey, value: productId, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
        console.log(`Product created: ${productId}`);
      } else {
        console.log(`Reusing PayPal product: ${productId}`);
      }

      // 2. Published paid plan versions from DB.
      const { data: plans, error: plansError } = await supabase
        .from("subscription_plans")
        .select("id, name, slug, price_monthly, price_yearly")
        .eq("is_active", true)
        .eq("is_published", true)
        // Paid = any nonzero price (covers yearly-only plans too).
        .or("price_monthly.gt.0,price_yearly.gt.0")
        .order("sort_order");
      if (plansError || !plans?.length) {
        throw new Error("No paid plans found in database");
      }

      // 3. Skip anything already mapped for this mode.
      const { data: existingMappings } = await supabase
        .from("paypal_plan_mapping")
        .select("plan_id, billing_cycle")
        .eq("is_sandbox", isSandbox);
      const mapped = new Set(
        (existingMappings || []).map((m: { plan_id: string; billing_cycle: string }) =>
          `${m.plan_id}:${m.billing_cycle}`),
      );

      const results: any[] = [];
      for (const plan of plans) {
        const planResult: any = { plan: plan.name, slug: plan.slug };
        for (const cycle of ["monthly", "yearly"] as const) {
          if (mapped.has(`${plan.id}:${cycle}`)) {
            planResult[cycle] = { skipped: true };
            continue;
          }
          const price = cycle === "monthly" ? plan.price_monthly : plan.price_yearly;
          console.log(`Creating ${cycle} plan for ${plan.name}...`);
          const created = await paypalPost(
            "/v1/billing/plans",
            billingPlanBody(productId!, plan.name, cycle, price),
            `imagick-${paypalMode}-${plan.id}-${cycle}`,
          );
          console.log(`${cycle} plan created: ${created.id}`);
          await supabase.from("paypal_plan_mapping").upsert(
            {
              plan_id: plan.id,
              billing_cycle: cycle,
              paypal_plan_id: created.id,
              is_sandbox: isSandbox,
            },
            { onConflict: "plan_id,billing_cycle,is_sandbox" },
          );
          planResult[cycle] = { paypalPlanId: created.id, price };
        }
        results.push(planResult);
      }

      console.log("PayPal plan setup complete.");
      return new Response(
        JSON.stringify({ productId, plans: results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      await supabase.from("platform_settings").upsert(
        { key: lockKey, value: "released", updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    }
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
