import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { purgeUser } from "../_shared/purge-user.ts";

// Admin-only user management. One authenticated entry point for the actions the
// admin panel exposes on a user: grant credits, grant extra models, edit
// account details (name / email / role), suspend / unsuspend, and delete.
// Everything runs as the service role AFTER verifying the caller is an admin.

type Action =
  | "grant_credits"
  | "grant_models"
  | "edit_details"
  | "suspend"
  | "unsuspend"
  | "delete";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller and that they are an admin.
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: caller, error: callerErr } = await anonClient.auth.getUser();
    if (callerErr || !caller?.user?.id) return json({ error: "Unauthorized" }, 401);
    const callerId = caller.user.id as string;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleCheck } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleCheck) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;
    const userId = body.userId as string;
    if (!action || !userId) return json({ error: "Missing action or userId" }, 400);

    // Never let an admin lock themselves out or self-destruct.
    if (callerId === userId && (action === "suspend" || action === "delete")) {
      return json({ error: "You can't suspend or delete your own account here." }, 400);
    }

    switch (action) {
      case "grant_credits": {
        const amount = Math.floor(Number(body.amount));
        if (!Number.isFinite(amount) || amount <= 0) return json({ error: "amount must be a positive integer" }, 400);
        const reason = (body.reason as string | undefined)?.slice(0, 500) || "Admin grant";

        const { error: grantErr } = await admin.from("credit_grants").insert({
          user_id: userId,
          grant_type: "gift",
          credits_initial: amount,
          credits_remaining: amount,
          granted_by: callerId,
          reason,
          expires_at: null,
        });
        if (grantErr) throw grantErr;

        // Mirror grant_purchased_credits: add to the live balance (unless unlimited).
        const { data: sub } = await admin
          .from("user_subscriptions")
          .select("edits_remaining")
          .eq("user_id", userId)
          .maybeSingle();
        if (sub && sub.edits_remaining !== -1) {
          await admin
            .from("user_subscriptions")
            .update({ edits_remaining: (sub.edits_remaining ?? 0) + amount, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
        }
        return json({ ok: true, granted: amount });
      }

      case "grant_models": {
        const quantity = Math.floor(Number(body.quantity));
        if (!Number.isFinite(quantity) || quantity <= 0) return json({ error: "quantity must be a positive integer" }, 400);
        const { error } = await admin.from("user_addons").insert({
          user_id: userId,
          addon_type: "extra_model",
          quantity,
          status: "active",
        });
        if (error) throw error;
        return json({ ok: true, extra_models: quantity });
      }

      case "edit_details": {
        const fullName = body.full_name as string | undefined;
        const email = body.email as string | undefined;
        const role = body.role as string | undefined; // 'user' | 'moderator' | 'admin'

        const authUpdates: Record<string, unknown> = {};
        if (typeof fullName === "string") {
          const { data: cur } = await admin.auth.admin.getUserById(userId);
          authUpdates.user_metadata = { ...(cur?.user?.user_metadata ?? {}), full_name: fullName.trim() };
        }
        if (typeof email === "string" && email.trim()) {
          authUpdates.email = email.trim().toLowerCase();
          authUpdates.email_confirm = true; // admin override, no re-confirmation
        }
        if (Object.keys(authUpdates).length > 0) {
          const { error: authErr } = await admin.auth.admin.updateUserById(userId, authUpdates);
          if (authErr) throw authErr;
        }

        if (typeof role === "string") {
          if (!["user", "moderator", "admin"].includes(role)) return json({ error: "invalid role" }, 400);
          // 'user' = no elevated role row; moderator/admin = a single role row.
          await admin.from("user_roles").delete().eq("user_id", userId);
          if (role !== "user") {
            const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role });
            if (roleErr) throw roleErr;
          }
        }
        return json({ ok: true });
      }

      case "suspend": {
        // Ban at the auth layer (blocks login) + mark the subscription so the
        // app's isSuspended gate and the 60-day purge job both see it.
        const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: "876600h", // ~100y; lifted on unsuspend
        });
        if (banErr) throw banErr;
        await admin
          .from("user_subscriptions")
          .update({ status: "suspended", suspended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        return json({ ok: true, status: "suspended" });
      }

      case "unsuspend": {
        const { error: unbanErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
        if (unbanErr) throw unbanErr;
        await admin
          .from("user_subscriptions")
          .update({ status: "active", suspended_at: null, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        return json({ ok: true, status: "active" });
      }

      case "delete": {
        const res = await purgeUser(admin, userId);
        if (!res.ok) return json({ error: res.error || "Failed to delete account" }, 500);
        return json({ ok: true, deleted: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("admin-manage-user error:", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});
