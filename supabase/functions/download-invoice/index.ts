/**
 * download-invoice — Securely serves invoice HTML via platform URL.
 *
 * Self-healing: if the HTML file doesn't exist in storage, generates it on-the-fly.
 * Authenticates the user via JWT and verifies ownership.
 *
 * Input (POST): { invoiceId }
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id as string;

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoiceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for DB/storage access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice — verify ownership
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check ownership or admin
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (invoice.user_id !== userId && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Always generate fresh HTML from the latest template
    const { data: userRecord } = await supabase.auth.admin.getUserById(invoice.user_id);
    const user = userRecord?.user;
    const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Customer";
    const userEmail = user?.email || "";

    const invoiceHtml = generateInvoiceHtml({
      invoiceNumber: invoice.invoice_number,
      date: new Date(invoice.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      customerName: userName,
      customerEmail: userEmail,
      description: invoice.description,
      amount: Number(invoice.amount),
      status: invoice.status,
      paypalTransactionId: invoice.paypal_transaction_id,
    });

    // Return HTML content directly
    return new Response(invoiceHtml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${invoice.invoice_number}.html"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error downloading invoice:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
