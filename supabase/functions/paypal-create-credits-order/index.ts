import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOrder, getPayPalMode } from "../_shared/paypal.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { captureException } from "../_shared/sentry.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

// One-time credit top-up packs. The catalog lives in
// platform_settings.credit_packs (admin-tunable, no deploy needed);
// these are the fallback defaults if the key is missing. The SERVER
// price is always authoritative — the client only ever sends a packId.
const DEFAULT_PACKS: { id: string; credits: number; usd: number }[] = [
  { id: "pack_s", credits: 1000, usd: 9 },
  { id: "pack_m", credits: 5000, usd: 39 },
  { id: "pack_l", credits: 15000, usd: 99 },
];

export async function loadPacks(
  supabase: ReturnType<typeof createClient>,
): Promise<{ id: string; credits: number; usd: number }[]> {
  try {
    const { data } = await supabase
      .from("platform_settings").select("value").eq("key", "credit_packs").single();
    if (data?.value) {
      const parsed = JSON.parse(data.value as string);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.filter((p) =>
          p && typeof p.id === "string" &&
          Number.isFinite(p.credits) && p.credits > 0 &&
          Number.isFinite(p.usd) && p.usd > 0
        );
      }
    }
  } catch { /* fall back to defaults */ }
  return DEFAULT_PACKS;
}

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

    // Money path — same guard as the addon order flow.
    const limit = await checkRateLimit(supabase, {
      key: `paypal-credits-order:${user.id}`,
      maxRequests: 20,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(limit.retryAfter) },
      });
    }

    let body: { packId?: string; inline?: boolean };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const packs = await loadPacks(supabase);

    // No packId → return the catalog (used by the BuyCreditsModal to render).
    if (!body.packId) {
      return new Response(JSON.stringify({ packs }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pack = packs.find((p) => p.id === body.packId);
    if (!pack) {
      return new Response(JSON.stringify({ error: "Invalid credit pack" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalAmount = pack.usd.toFixed(2);
    const description = `${pack.credits.toLocaleString("en-US")} Imagick credits`;

    // Inline mode: config for the client-side PayPal SDK buttons.
    if (body.inline) {
      const mode = await getPayPalMode();
      const prefix = mode === "live" ? "PAYPAL_LIVE" : "PAYPAL_SANDBOX";
      const clientId = Deno.env.get(`${prefix}_CLIENT_ID`) || Deno.env.get("PAYPAL_CLIENT_ID");
      return new Response(
        JSON.stringify({ clientId, amount: totalAmount, description, currency: "USD", pack }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side order creation (SDK createOrder callback).
    const result = await createOrder({
      amount: totalAmount,
      description,
      customId: JSON.stringify({ userId: user.id, packId: pack.id, credits: pack.credits }),
      returnUrl: `${studioUrl}/dashboard/billing?credits=success&pack=${pack.id}`,
      cancelUrl: `${studioUrl}/dashboard/billing?credits=cancelled`,
    });

    return new Response(JSON.stringify({ orderId: result.orderId, pack }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error creating credits order:", error);
    await captureException(error, { tags: { fn: "paypal-create-credits-order" }, level: "error" });
    return new Response(
      JSON.stringify({ error: "Could not create credits order. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
