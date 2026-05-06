import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureOrder } from "../_shared/paypal.ts";
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
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Capture payment
    const capture = await captureOrder(orderId);
    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const customId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id
      || capture.purchase_units?.[0]?.custom_id;

    let addonType = "extra_model";
    let quantity = 1;

    if (customId) {
      try {
        const parsed = JSON.parse(customId);
        addonType = parsed.addonType || addonType;
        quantity = parsed.quantity || quantity;
      } catch { /* use defaults */ }
    }

    // Create invoice
    const invoiceNumber = `INV-ADDON-${Date.now()}`;
    const amount = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || "0";

    const invoiceType = addonType === "extra_model" ? "addon_model" : addonType === "priority_processing" ? "addon_priority" : "addon_storage";
    const addonDescriptions: Record<string, string> = {
      extra_model: "Extra Custom Style Slot",
      extra_storage: "Extra 500GB Storage",
      priority_processing: "Priority Processing",
    };

    const { data: invoice } = await supabase.from("invoices").insert({
      user_id: user.id,
      invoice_number: invoiceNumber,
      type: invoiceType,
      description: `${quantity}x ${addonDescriptions[addonType] || addonType}`,
      amount: parseFloat(amount),
      status: "paid",
      paypal_transaction_id: captureId || orderId,
    }).select("id").single();

    // Create addon record
    await supabase.from("user_addons").insert({
      user_id: user.id,
      addon_type: addonType,
      quantity,
      paypal_order_id: orderId,
      invoice_id: invoice?.id,
      status: "active",
    });

    // WhatsApp notification
    const userName = user.user_metadata?.full_name || user.email?.split("@")[0];
    const whatsAppLabels: Record<string, string> = {
      extra_model: "Extra Style Slot",
      extra_storage: "Extra 500GB Storage",
      priority_processing: "Priority Processing",
    };
    const addonLabel = whatsAppLabels[addonType] || addonType;
    sendWhatsAppNotification(
      `🛒 Add-on Purchased\nUser: ${userName} (${user.email})\nAdd-on: ${quantity}x ${addonLabel}\nAmount: $${amount}`
    ).catch(err => console.error("WhatsApp failed:", err));

    return new Response(
      JSON.stringify({ success: true, addonType, quantity }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error capturing addon:", error);
    await captureException(error, {
      tags: { fn: "paypal-capture-addon" },
      level: "error",
    });
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
