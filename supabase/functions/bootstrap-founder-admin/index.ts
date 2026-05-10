/**
 * One-shot self-bootstrap for the founder's admin role.
 *
 * Runs entirely server-side: the caller's identity comes from the
 * Authorization JWT (Supabase Auth, can't be spoofed). We compare
 * `auth.users.email` against the constant `FOUNDER_EMAIL` and only
 * insert the admin row if it matches. Anyone else hitting this
 * endpoint gets 403, regardless of what their JWT claims.
 *
 * Why this exists: the user_roles row for contact@imagick.ai went
 * missing in production. PR #78 added a migration to restore it, but
 * if the supabase-deploy workflow didn't run (missing secret, paused
 * deploy, etc.) the role stays missing — and the founder can't reach
 * the admin panel even to fix it manually. This function lets them
 * self-bootstrap from the browser without touching the dashboard.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FOUNDER_EMAIL = "contact@imagick.ai";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller using the user-scoped client
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return json(401, { error: "Unauthorized" });
    }

    const callerEmail = (userData.user.email ?? "").toLowerCase().trim();
    if (callerEmail !== FOUNDER_EMAIL) {
      return json(403, {
        error: "Forbidden",
        message: "This bootstrap endpoint is reserved for the founder account.",
      });
    }

    // Use service role to bypass RLS for the admin-row write
    const admin = createClient(supabaseUrl, serviceKey);
    const { error: insertErr } = await admin
      .from("user_roles")
      .upsert(
        {
          user_id: userData.user.id,
          role: "admin",
          can_view_analytics: true,
        },
        { onConflict: "user_id,role" },
      );
    if (insertErr) {
      console.error("Insert admin row failed:", insertErr);
      return json(500, { error: "DB write failed", details: insertErr.message });
    }

    return json(200, {
      success: true,
      userId: userData.user.id,
      role: "admin",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("bootstrap-founder-admin error:", err);
    return json(500, { error: message });
  }
});
