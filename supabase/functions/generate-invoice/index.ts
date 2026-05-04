/**
 * generate-invoice — Generates HTML invoice and stores in Supabase storage.
 *
 * Called internally after payment capture. Generates a branded HTML invoice
 * and stores it as a file in Supabase storage.
 *
 * Input: { invoiceId }
 * Requires service role (internal call).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateInvoiceHtml } from "../_shared/invoice-template.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[generate-invoice] Processing request...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invoiceId } = await req.json();
    console.log("[generate-invoice] Invoice ID:", invoiceId);

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoiceId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invError || !invoice) {
      console.error("[generate-invoice] Invoice not found:", invError);
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userRecord } = await supabase.auth.admin.getUserById(invoice.user_id);
    const user = userRecord?.user;
    const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Customer";
    const userEmail = user?.email || "";

    console.log("[generate-invoice] Generating HTML for:", invoice.invoice_number);

    const invoiceHtml = generateInvoiceHtml({
      invoiceNumber: invoice.invoice_number,
      date: new Date(invoice.created_at).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      }),
      customerName: userName,
      customerEmail: userEmail,
      description: invoice.description,
      amount: Number(invoice.amount),
      status: invoice.status,
      paypalTransactionId: invoice.paypal_transaction_id,
    });

    const storagePath = `${invoice.user_id}/${invoice.invoice_number}.html`;
    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(storagePath, new TextEncoder().encode(invoiceHtml), {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("[generate-invoice] Upload failed:", uploadError);
    } else {
      console.log("[generate-invoice] Uploaded to:", storagePath);
    }

    await supabase
      .from("invoices")
      .update({ pdf_storage_path: storagePath })
      .eq("id", invoiceId);

    return new Response(
      JSON.stringify({ success: true, storagePath }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[generate-invoice] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
