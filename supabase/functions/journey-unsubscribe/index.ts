/**
 * journey-unsubscribe — Handles unsubscribe requests from journey emails.
 *
 * Accepts a signed token, verifies it, sets journey_emails = false,
 * and cancels all active enrollments.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ActionType = "validate" | "unsubscribe";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

async function verifyToken(
  token: string,
  secret: string
): Promise<string | null> {
  try {
    const decoded = JSON.parse(atob(token));
    const { uid, sig } = decoded;
    if (!uid || !sig) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(uid));
    const expectedHex = Array.from(new Uint8Array(expected))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (sig !== expectedHex) return null;
    return uid;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (!["GET", "POST"].includes(req.method)) {
    return json({ success: false, code: "method_not_allowed", message: "Method not allowed" }, 405);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { token, action } = await parseInput(req);

    if (!token) {
      return json({ success: false, code: "missing_token", message: "Missing token" }, 400);
    }

    const userId = await verifyToken(token, serviceRoleKey);
    if (!userId) {
      return json({ success: false, code: "invalid_token", message: "Invalid or expired token" }, 400);
    }

    if (action === "validate") {
      return json({ success: true, code: "valid_token", message: "Token is valid" });
    }

    // 1. Update user_email_preferences — set journey_emails to false
    const { data: existingPrefs } = await adminClient
      .from("user_email_preferences")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingPrefs) {
      await adminClient
        .from("user_email_preferences")
        .update({ journey_emails: false, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    } else {
      await adminClient
        .from("user_email_preferences")
        .insert({ user_id: userId, journey_emails: false });
    }

    // 2. Cancel all active enrollments
    await adminClient
      .from("user_sequence_enrollments")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "active");

    return json({ success: true, code: "unsubscribed", message: "You are unsubscribed" });
  } catch (err) {
    console.error("journey-unsubscribe error:", err);
    return json({ success: false, code: "internal_error", message: "Internal error" }, 500);
  }
});
