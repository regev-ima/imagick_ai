// Admin-only: (re)run the post-training SOURCE-edit for every eligible style
// that hasn't had it done yet. For large source sets a RANDOM 500 is edited
// (see autoProcessStyleSource). Runs in the background and sends a WhatsApp
// summary when the whole sweep is dispatched. Source edits go out as
// service-role calls, so they are NOT charged to any customer's credits — only
// the editing engine's own compute is used.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { autoProcessStyleSource } from "../_shared/style-source.ts";
import { sendWhatsAppNotification } from "../_shared/whatsapp.ts";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // --- Auth: caller must be an admin ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleCheck) return json({ error: "Forbidden" }, 403);

    // Eligible = trained + has an engine model. autoProcessStyleSource is
    // idempotent (skips images already edited), so re-running is safe.
    const { data: styles } = await adminClient
      .from("styles")
      .select("id, name")
      .eq("status", "ready")
      .not("style_id_external", "is", null)
      .order("created_at", { ascending: true });

    const list = (styles ?? []) as { id: string; name: string }[];
    if (list.length === 0) {
      return json({ started: false, count: 0, message: "No eligible styles" });
    }

    // Heavy work (materialize galleries + dispatch per style) runs in the
    // background so the HTTP response returns immediately; the WhatsApp summary
    // is the completion signal.
    const run = async () => {
      let dispatched = 0;
      let sampled = 0;
      let alreadyDone = 0;
      let noSource = 0;
      let errored = 0;
      let totalImages = 0;

      for (const s of list) {
        try {
          const r = await autoProcessStyleSource(adminClient, supabaseUrl, serviceRoleKey, s.id);
          if (r.status === "dispatched" || r.status === "dispatched_sampled") {
            dispatched++;
            totalImages += r.dispatched;
            if (r.status === "dispatched_sampled") sampled++;
          } else if (r.status === "already_done") {
            alreadyDone++;
          } else if (r.status === "no_editable_source" || r.status === "no_gallery") {
            noSource++;
          } else {
            errored++;
          }
        } catch (err) {
          errored++;
          console.error(`backfill: style ${s.id} failed`, err);
        }
      }

      const msg =
        `🎨 Source-edit backfill complete\n` +
        `Styles scanned: ${list.length}\n` +
        `Dispatched: ${dispatched}${sampled ? ` (${sampled} sampled to 500)` : ""}\n` +
        `Already done: ${alreadyDone}\n` +
        `No editable source: ${noSource}\n` +
        (errored ? `Errors: ${errored}\n` : "") +
        `Total source photos sent to editing: ${totalImages}`;
      try {
        await sendWhatsAppNotification(msg);
      } catch (err) {
        console.error("backfill: WhatsApp summary failed", err);
      }
      console.log("backfill: done", { dispatched, sampled, alreadyDone, noSource, errored, totalImages });
    };

    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(run());
    } else {
      // Fallback (local/dev): fire and forget.
      run();
    }

    return json({ started: true, count: list.length });
  } catch (err) {
    console.error("admin-backfill-source-edits error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
