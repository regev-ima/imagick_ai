// @ts-nocheck — untyped Supabase client (no generated types in edge functions)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type CampaignRow = {
  id: string;
  is_active: boolean;
};

type LeadRow = {
  id: string;
  status: string;
};

async function verifyAdmin(authHeader: string, supabaseUrl: string, anonKey: string, serviceRoleKey: string) {
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user?.id) return null;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const callerId = userData.user.id;
  const { data: role } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();

  if (!role) return null;
  return { adminClient, callerId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const verified = await verifyAdmin(authHeader, supabaseUrl, anonKey, serviceRoleKey);
    if (!verified) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { adminClient } = verified;
    const body = await req.json().catch(() => ({}));
    const jobId = body.jobId as string | undefined;
    const overrideCampaignId = body.campaignId as string | undefined;

    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobError } = await adminClient
      .from("lead_import_jobs")
      .select("id, selected_campaign_id, status")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Import job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const campaignId = overrideCampaignId ?? job.selected_campaign_id;
    let campaign: CampaignRow | null = null;

    if (campaignId) {
      const { data } = await adminClient
        .from("lead_campaigns")
        .select("id, is_active")
        .eq("id", campaignId)
        .maybeSingle();
      campaign = data as CampaignRow | null;
    }

    if (!campaign) {
      const { data } = await adminClient
        .from("lead_campaigns")
        .select("id, is_active")
        .eq("is_default", true)
        .maybeSingle();
      campaign = data as CampaignRow | null;
    }

    if (!campaign || !campaign.is_active) {
      return new Response(JSON.stringify({ error: "No active campaign found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read job rows to determine eligible leads
    const { data: jobRows, error: rowsError } = await adminClient
      .from("lead_import_job_rows")
      .select("lead_id, result")
      .eq("import_job_id", jobId)
      .in("result", ["new_lead", "existing_lead"]);

    if (rowsError) {
      return new Response(JSON.stringify({ error: rowsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadIds = [...new Set((jobRows ?? []).map((r: any) => r.lead_id).filter(Boolean))] as string[];

    let activeLeadCount = 0;
    if (leadIds.length) {
      const { data: leadsData } = await adminClient
        .from("lead_contacts")
        .select("id, status")
        .in("id", leadIds);

      const leads = (leadsData ?? []) as LeadRow[];
      activeLeadCount = leads.filter((l) => l.status === "active").length;
    }

    // Mark job as completed
    await adminClient
      .from("lead_import_jobs")
      .update({
        status: "completed",
        selected_campaign_id: campaign.id,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          eligibleLeads: leadIds.length,
          activeLeads: activeLeadCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("admin-finalize-lead-import error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
