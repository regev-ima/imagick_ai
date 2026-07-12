import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAccessToken, getPayPalMode } from "../_shared/paypal.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { captureException } from "../_shared/sentry.ts";

// Admin plan-version lifecycle. The pricing model is IMMUTABLE VERSIONS:
// a published plan's terms are frozen the moment anyone can subscribe to it;
// every change is a NEW version row. Existing subscribers stay pinned to
// their row (and their PayPal billing plan) forever — a price change only
// affects new signups. This function is the only place that mutates the
// published-version lifecycle, so the invariants live here:
//
//   replace — the confirmed "edit": clone the CURRENT published version of a
//     family into version N+1 with the requested changes, retire the old row
//     (unpublish + move it to a versioned slug), and DEACTIVATE its PayPal
//     billing plans so no new subscription can ever be created on the old
//     price. PayPal keeps billing existing subscriptions on a deactivated
//     plan — exactly the grandfathering we want. The caller then runs
//     paypal-setup-plans to create billing plans for the new version.
//   retire  — unpublish a version + deactivate its PayPal plans (no clone).
//   publish — re-publish a hidden version (blocked if its family already has
//     a published version) + re-ACTIVATE its PayPal plans if mapped.
//
// All PayPal calls are per-mode (sandbox/live) and idempotent-ish: an
// already-inactive/active plan returns 422, which we treat as success.

async function getApiBase(): Promise<string> {
  const mode = await getPayPalMode();
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

/** POST /v1/billing/plans/{id}/(de)activate. Returns true when the plan is in
 *  the desired state afterwards (422 = already there). */
async function setPayPalPlanState(paypalPlanId: string, active: boolean): Promise<boolean> {
  const token = await getAccessToken();
  const apiBase = await getApiBase();
  const res = await fetch(
    `${apiBase}/v1/billing/plans/${paypalPlanId}/${active ? "activate" : "deactivate"}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.ok || res.status === 204) return true;
  if (res.status === 422) return true; // already in the desired state
  console.error(`PayPal plan ${active ? "activate" : "deactivate"} failed:`, res.status, await res.text());
  return false;
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Columns cloned verbatim into a new version (everything except identity,
// versioning and timestamps — updates override on top).
const IDENTITY_KEYS = new Set(["id", "created_at", "updated_at", "slug", "family_slug", "version", "is_published"]);
// Fields the admin may change on a new version.
const EDITABLE_KEYS = new Set([
  "name", "description", "price_monthly", "price_yearly", "edits_included",
  "price_per_extra_edit", "max_styles", "max_storage_gb", "has_ai_culling",
  "has_team_access", "has_api_access", "has_priority_support",
  "has_full_style_library", "is_active", "sort_order", "features",
]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Admin only.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return json({ error: "Invalid token" }, 401);
    const { data: adminCheck } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!adminCheck) return json({ error: "Admin access required" }, 403);

    const body = await req.json();
    const action = body?.action as "replace" | "retire" | "publish";
    const planId = body?.planId as string;
    if (!planId || !["replace", "retire", "publish"].includes(action)) {
      return json({ error: "action ('replace'|'retire'|'publish') and planId are required" }, 400);
    }

    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans").select("*").eq("id", planId).single();
    if (planErr || !plan) return json({ error: "Plan not found" }, 404);

    const family: string = (plan as any).family_slug || plan.slug;
    const paypalMode = await getPayPalMode();
    const isSandbox = paypalMode === "sandbox";

    // The version's PayPal billing plans in the CURRENT mode.
    const loadMappings = async (id: string) => {
      const { data } = await supabase
        .from("paypal_plan_mapping")
        .select("paypal_plan_id, billing_cycle")
        .eq("plan_id", id)
        .eq("is_sandbox", isSandbox);
      return data ?? [];
    };

    if (action === "retire") {
      await supabase.from("subscription_plans")
        .update({ is_published: false } as never).eq("id", planId);
      const mappings = await loadMappings(planId);
      let deactivated = 0;
      for (const m of mappings) {
        if (await setPayPalPlanState(m.paypal_plan_id, false)) deactivated++;
      }
      return json({ success: true, action, deactivatedPayPalPlans: deactivated, totalMappings: mappings.length });
    }

    if (action === "publish") {
      // One published version per family — publishing a second would show two
      // prices for the same tier on the pricing page.
      const { data: sibling } = await supabase
        .from("subscription_plans")
        .select("id, name")
        .eq("family_slug" as never, family)
        .eq("is_published" as never, true)
        .neq("id", planId)
        .maybeSingle();
      if (sibling) {
        return json({
          error: `"${(sibling as any).name}" is already the published version of this tier — retire it first.`,
        }, 409);
      }
      await supabase.from("subscription_plans")
        .update({ is_published: true } as never).eq("id", planId);
      const mappings = await loadMappings(planId);
      let activated = 0;
      for (const m of mappings) {
        if (await setPayPalPlanState(m.paypal_plan_id, true)) activated++;
      }
      // No mappings on a paid plan → the caller should run paypal-setup-plans.
      const needsSync = mappings.length === 0 &&
        ((plan.price_monthly ?? 0) > 0 || (plan.price_yearly ?? 0) > 0);
      return json({ success: true, action, activatedPayPalPlans: activated, needsSync });
    }

    // ── action === "replace" ────────────────────────────────────────────────
    if ((plan as any).is_published === false) {
      return json({ error: "Only the currently-published version can be replaced. Publish it first, or create a brand-new plan." }, 400);
    }

    // Sanitize updates to the editable whitelist.
    const rawUpdates = (body?.updates ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawUpdates)) {
      if (EDITABLE_KEYS.has(k) && v !== undefined) updates[k] = v;
    }

    // Next version number in the family.
    const { data: familyRows } = await supabase
      .from("subscription_plans")
      .select("version, slug")
      .eq("family_slug" as never, family);
    const nextVersion = Math.max(0, ...((familyRows ?? []).map((r: any) => Number(r.version) || 0))) + 1;
    const takenSlugs = new Set(((familyRows ?? []) as any[]).map((r) => r.slug));

    // 1. Move the old row off the public slug (collision-safe suffix).
    const publicSlug = plan.slug;
    let legacySlug = `${family}-v${(plan as any).version ?? 1}`;
    let n = 2;
    while (takenSlugs.has(legacySlug)) legacySlug = `${family}-v${(plan as any).version ?? 1}-${n++}`;
    const { error: renameErr } = await supabase.from("subscription_plans")
      .update({ slug: legacySlug } as never).eq("id", planId);
    if (renameErr) return json({ error: `Failed to stage old version: ${renameErr.message}` }, 500);

    // 2. Insert the new version on the public slug.
    const clone: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(plan as Record<string, unknown>)) {
      if (!IDENTITY_KEYS.has(k)) clone[k] = v;
    }
    const { data: created, error: insertErr } = await supabase
      .from("subscription_plans")
      .insert({
        ...clone,
        ...updates,
        slug: publicSlug,
        family_slug: family,
        version: nextVersion,
        is_published: true,
      } as never)
      .select("id")
      .single();
    if (insertErr || !created) {
      // Roll the rename back so the old version stays live.
      await supabase.from("subscription_plans")
        .update({ slug: publicSlug } as never).eq("id", planId);
      return json({ error: `Failed to create the new version: ${insertErr?.message}` }, 500);
    }

    // 3. Retire the old version + kill its PayPal plans for new signups.
    await supabase.from("subscription_plans")
      .update({ is_published: false } as never).eq("id", planId);
    const mappings = await loadMappings(planId);
    let deactivated = 0;
    for (const m of mappings) {
      if (await setPayPalPlanState(m.paypal_plan_id, false)) deactivated++;
    }

    // The new version has no PayPal billing plans yet — the caller must run
    // paypal-setup-plans (it only creates what's missing, so it's safe).
    const needsSync = (Number(updates.price_monthly ?? plan.price_monthly) || 0) > 0 ||
      (Number(updates.price_yearly ?? plan.price_yearly) || 0) > 0;

    return json({
      success: true,
      action,
      newPlanId: (created as any).id,
      newVersion: nextVersion,
      retiredPlanId: planId,
      retiredSlug: legacySlug,
      deactivatedPayPalPlans: deactivated,
      totalMappings: mappings.length,
      needsSync,
    });
  } catch (err) {
    console.error("paypal-plan-version error:", err);
    await captureException(err, { tags: { fn: "paypal-plan-version" } });
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
