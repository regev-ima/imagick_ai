import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const baseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...baseHeaders, "Content-Type": "application/json" },
  });
}

type ActionType = "validate" | "unsubscribe";

async function parseInput(req: Request): Promise<{ token: string | null; action: ActionType }> {
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  const queryAction = url.searchParams.get("action");

  let body: Record<string, unknown> | null = null;
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = null;
    }
  }

  const token = queryToken || (typeof body?.token === "string" ? body.token : null);
  const rawAction = queryAction || (typeof body?.action === "string" ? body.action : "");
  const action: ActionType = rawAction === "validate" ? "validate" : "unsubscribe";

  return { token, action };
}

async function lookupLeadByToken(
  adminClient: any,
  token: string,
): Promise<{ leadId: string; scheduledEmailId: string } | null> {
  const { data: scheduled } = await adminClient
    .from("lead_scheduled_emails")
    .select("id, lead_id")
    .eq("open_token", token)
    .maybeSingle();

  if (!scheduled?.lead_id || !scheduled?.id) {
    return null;
  }
  return {
    leadId: scheduled.lead_id,
    scheduledEmailId: scheduled.id,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: baseHeaders });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return json({ success: false, code: "method_not_allowed", message: "Method not allowed" }, 405);
  }

  try {
    const { token, action } = await parseInput(req);
    if (!token) {
      return json({ success: false, code: "missing_token", message: "Missing token" }, 400);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const matched = await lookupLeadByToken(adminClient, token);
    if (!matched) {
      return json({ success: false, code: "invalid_token", message: "Invalid or expired token" }, 404);
    }

    if (action === "validate") {
      return json({ success: true, code: "valid_token", message: "Token is valid" });
    }

    const now = new Date().toISOString();

    await adminClient
      .from("lead_contacts")
      .update({
        status: "unsubscribed",
        unsubscribed_at: now,
        suppression_reason: "lead_unsubscribe",
        updated_at: now,
      })
      .eq("id", matched.leadId)
      .neq("status", "converted");

    await adminClient
      .from("lead_enrollments")
      .update({
        status: "cancelled",
        cancelled_at: now,
        updated_at: now,
      })
      .eq("lead_id", matched.leadId)
      .eq("status", "active");

    await adminClient
      .from("lead_scheduled_emails")
      .update({
        status: "cancelled",
        last_error: "Lead unsubscribed",
        updated_at: now,
      })
      .eq("lead_id", matched.leadId)
      .in("status", ["pending", "processing"]);

    return json({ success: true, code: "unsubscribed", message: "You are unsubscribed" });
  } catch (err) {
    console.error("lead-unsubscribe error:", err);
    return json({ success: false, code: "internal_error", message: "Internal server error" }, 500);
  }
});
