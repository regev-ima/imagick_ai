import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOrder } from "../_shared/paypal.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { captureException } from "../_shared/sentry.ts";

const ADDON_PRICES: Record<string, { price: number; label: string }> = {
  extra_model: { price: 15, label: "Extra Custom AI Model" },
  extra_storage: { price: 5, label: "Extra 500GB Storage" },
  priority_processing: { price: 10, label: "Priority Processing" },
};

// Plan-specific model pricing: Studio gets $10 instead of $15
const MODEL_PRICE_BY_PLAN: Record<string, number> = {
  studio: 10,
};

// Bound the quantity a client may request. Without this, a malicious or
// buggy client could send a negative or unbounded value and influence the
// PayPal order amount.
const MIN_ADDON_QUANTITY = 1;
const MAX_ADDON_QUANTITY = 50;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const studioUrl = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");

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

    let body: { addonType?: string; quantity?: unknown; inline?: boolean };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { addonType, inline } = body;
    const rawQty = body.quantity ?? 1;
    const quantity = typeof rawQty === "number" ? rawQty : Number(rawQty);
    if (!Number.isInteger(quantity) || quantity < MIN_ADDON_QUANTITY || quantity > MAX_ADDON_QUANTITY) {
      return new Response(
        JSON.stringify({ error: `Quantity must be an integer between ${MIN_ADDON_QUANTITY} and ${MAX_ADDON_QUANTITY}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const addon = addonType ? ADDON_PRICES[addonType] : undefined;
    if (!addon) {
      return new Response(JSON.stringify({ error: "Invalid addon type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's plan for plan-specific pricing
    let unitPrice = addon.price;
    if (addonType === "extra_model") {
      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("plan:subscription_plans(slug)")
        .eq("user_id", user.id)
        .maybeSingle();
      const planSlug = (sub?.plan as any)?.slug;
      if (planSlug && MODEL_PRICE_BY_PLAN[planSlug]) {
        unitPrice = MODEL_PRICE_BY_PLAN[planSlug];
      }
    }

    const totalAmount = (unitPrice * quantity).toFixed(2);
    const description = `${quantity}x ${addon.label}`;

    // Inline mode: return config for client-side PayPal SDK buttons
    if (inline) {
      const mode = await (await import("../_shared/paypal.ts")).getPayPalMode();
      const prefix = mode === "live" ? "PAYPAL_LIVE" : "PAYPAL_SANDBOX";
      const clientId = Deno.env.get(`${prefix}_CLIENT_ID`) || Deno.env.get("PAYPAL_CLIENT_ID");
      return new Response(
        JSON.stringify({ clientId, amount: totalAmount, description, currency: "USD" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side order creation (for SDK createOrder callback)
    const result = await createOrder({
      amount: totalAmount,
      description,
      customId: JSON.stringify({ userId: user.id, addonType, quantity }),
      returnUrl: `${studioUrl}/dashboard/billing?addon=success&type=${addonType}&qty=${quantity}`,
      cancelUrl: `${studioUrl}/dashboard/billing?addon=cancelled`,
    });

    return new Response(
      JSON.stringify({ orderId: result.orderId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error creating addon order:", error);
    await captureException(error, {
      tags: { fn: "paypal-create-addon-order" },
      level: "error",
    });
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
