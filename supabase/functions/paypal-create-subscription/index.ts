import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSubscription, getPayPalMode } from "../_shared/paypal.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { captureException } from "../_shared/sentry.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const PLAN_SLUG_RE = /^[a-z0-9_-]{1,32}$/;
const VALID_BILLING_CYCLES = new Set(["monthly", "yearly"]);

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

    // Rate limit: 10 subscription creations per minute per user.
    // PayPal subscription creation is a real money path; even legitimate
    // usage shouldn't fire it more than once per checkout attempt.
    const limit = await checkRateLimit(supabase, {
      key: `paypal-create-sub:${user.id}`,
      maxRequests: 10,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests" }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(limit.retryAfter),
          },
        }
      );
    }

    let parsedBody: { planSlug?: unknown; billingCycle?: unknown };
    try {
      parsedBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planSlug = typeof parsedBody.planSlug === "string" ? parsedBody.planSlug : "";
    const billingCycle = typeof parsedBody.billingCycle === "string" ? parsedBody.billingCycle : "";

    if (!PLAN_SLUG_RE.test(planSlug) || !VALID_BILLING_CYCLES.has(billingCycle)) {
      return new Response(
        JSON.stringify({ error: "Invalid planSlug or billingCycle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    // Don't leak internal error details to the client — they're in Sentry.
    return new Response(
      JSON.stringify({ error: "Could not create PayPal subscription. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
