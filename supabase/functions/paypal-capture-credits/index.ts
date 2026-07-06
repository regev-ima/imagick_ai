import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureOrder } from "../_shared/paypal.ts";
import { sendWhatsAppNotification } from "../_shared/whatsapp.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { captureException } from "../_shared/sentry.ts";

// Captures a one-time credit top-up order and credits the user's pool via
// grant_purchased_credits (a `purchased` credit_grant with NO expiry —
// paid credits never expire). Double-credit safe: the grant reason embeds
// the PayPal order id, and we skip if a grant for this order already exists.

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const { orderId } = await req.json();
    if (!orderId || typeof orderId !== "string") {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: if this order was already credited (double-click, retry
    // after a network error, PayPal ORDER_ALREADY_CAPTURED), return success
    // without granting again.
    const orderTag = `paypal_order:${orderId}`;
    const { data: existing } = await supabase
      .from("credit_grants")
      .select("id, credits_initial")
      .eq("user_id", user.id)
      .like("reason", `%${orderTag}%`)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ success: true, credits: existing.credits_initial, alreadyCredited: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Capture the payment.
    const capture = await captureOrder(orderId);
    const captureUnit = capture.purchase_units?.[0];
    const capturePayment = captureUnit?.payments?.captures?.[0];
    const captureId = capturePayment?.id;
    const capturedAmount = parseFloat(capturePayment?.amount?.value || "0");
    const customId = capturePayment?.custom_id || captureUnit?.custom_id;

    let credits = 0;
    let packId = "";
    let orderUserId = "";
    if (customId) {
      try {
        const parsed = JSON.parse(customId);
        credits = Number(parsed.credits) || 0;
        packId = String(parsed.packId || "");
        orderUserId = String(parsed.userId || "");
      } catch { /* validated below */ }
    }

    // The order must belong to the calling user and reference a real pack
    // whose SERVER price matches what PayPal actually captured — a client
    // cannot mint credits by tampering with the order.
    if (orderUserId && orderUserId !== user.id) {
      return new Response(JSON.stringify({ error: "Order does not belong to this user" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: packsRow } = await supabase
      .from("platform_settings").select("value").eq("key", "credit_packs").single();
    let packs: { id: string; credits: number; usd: number }[] = [
      { id: "pack_s", credits: 1000, usd: 9 },
      { id: "pack_m", credits: 5000, usd: 39 },
      { id: "pack_l", credits: 15000, usd: 99 },
    ];
    try {
      if (packsRow?.value) {
        const parsed = JSON.parse(packsRow.value as string);
        if (Array.isArray(parsed) && parsed.length) packs = parsed;
      }
    } catch { /* defaults */ }
    const pack = packs.find((p) => p.id === packId);
    if (!pack || credits !== pack.credits || Math.abs(capturedAmount - pack.usd) > 0.01) {
      console.error("Credits capture mismatch:", { packId, credits, capturedAmount, pack });
      return new Response(JSON.stringify({ error: "Order amount does not match a valid credit pack" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Grant the credits (purchased → no expiry) + invoice.
    const { error: grantErr } = await supabase.rpc("grant_purchased_credits", {
      p_user_id: user.id,
      p_amount: pack.credits,
      p_reason: `Credit pack ${pack.id} (${pack.credits.toLocaleString("en-US")} credits) · ${orderTag}`,
    });
    if (grantErr) {
      console.error("grant_purchased_credits failed:", grantErr);
      throw new Error("Payment captured but crediting failed — support has been notified.");
    }

    await supabase.from("invoices").insert({
      user_id: user.id,
      invoice_number: `INV-CREDITS-${Date.now()}`,
      type: "credits",
      description: `${pack.credits.toLocaleString("en-US")} Imagick credits`,
      amount: capturedAmount,
      status: "paid",
      paypal_transaction_id: captureId || orderId,
    });

    const userName = user.user_metadata?.full_name || user.email?.split("@")[0];
    sendWhatsAppNotification(
      `🪙 Credits Purchased\nUser: ${userName} (${user.email})\nPack: ${pack.credits.toLocaleString("en-US")} credits\nAmount: $${capturedAmount}`
    ).catch((err) => console.error("WhatsApp failed:", err));

    return new Response(JSON.stringify({ success: true, credits: pack.credits }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error capturing credits order:", error);
    await captureException(error, { tags: { fn: "paypal-capture-credits" }, level: "error" });
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
