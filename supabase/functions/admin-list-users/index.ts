import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: verify caller is admin ---
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

    // Verify JWT using anon client
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id as string;

    // Service role client for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Parse query params ---
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    // --- Single user detail mode ---
    if (userId) {
      const [
        { data: authUser },
        { data: roles },
        { data: subscription },
        { data: galleries },
        { count: imagesCount },
        { data: lastUploadData },
        { count: editsCount },
        { data: editLogs },
        { data: emailLogs },
        { data: styles },
        { data: sessions },
        { data: onboardingAnswers },
        { data: allQuestions },
        { data: creditGrants },
        { data: galleryEdits },
        { data: galleryUploadTimes },
        { data: galleryCreditLogs },
      ] = await Promise.all([
        adminClient.auth.admin.getUserById(userId),
        adminClient.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        adminClient
          .from("user_subscriptions")
          .select("*, plan:subscription_plans(name)")
          .eq("user_id", userId)
          .maybeSingle(),
        adminClient
          .from("galleries")
          .select("id, name, status, total_images, processed_images, created_at, hero_image_url, culling_status, culling_labels")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        adminClient
          .from("gallery_images")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
        adminClient
          .from("gallery_images")
          .select("created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1),
        adminClient
          .from("image_edits")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
        adminClient
          .from("edit_usage_logs")
          .select("action_type, edits_spent, created_at, description")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
        adminClient
          .from("email_logs")
          .select("email_type, subject, status, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
        adminClient
          .from("styles")
          .select("id, name, status, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        adminClient
          .from("user_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        adminClient
          .from("onboarding_answers")
          .select("question_id, answer, answered_at")
          .eq("user_id", userId),
        adminClient
          .from("onboarding_questions")
          .select("id, question_key, title, options, sort_order, is_active")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        adminClient
          .from("credit_grants")
          .select("id, grant_type, credits_initial, credits_remaining, status, reason, expires_at, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        // Per-gallery: edit count and distinct styles
        adminClient
          .from("image_edits")
          .select("gallery_id, style_name, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        // Per-gallery: first and last image upload times
        adminClient
          .from("gallery_images")
          .select("gallery_id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        // Per-gallery: credits spent
        adminClient
          .from("edit_usage_logs")
          .select("gallery_id, edits_spent")
          .eq("user_id", userId),
      ]);

      const au = authUser?.user;
      const provider =
        au?.app_metadata?.provider === "google"
          ? "google"
          : "email";

      const lastUpload = lastUploadData && lastUploadData.length > 0 ? lastUploadData[0].created_at : null;

      // Build per-gallery stats maps
      const galleryEditStats = new Map<string, { edits_count: number; styles: Set<string>; first_edit: string | null; last_edit: string | null }>();
      (galleryEdits || []).forEach((e: any) => {
        if (!e.gallery_id) return;
        const existing = galleryEditStats.get(e.gallery_id) || { edits_count: 0, styles: new Set(), first_edit: null, last_edit: null };
        existing.edits_count++;
        if (e.style_name) existing.styles.add(e.style_name);
        if (!existing.last_edit || e.created_at > existing.last_edit) existing.last_edit = e.created_at;
        if (!existing.first_edit || e.created_at < existing.first_edit) existing.first_edit = e.created_at;
        galleryEditStats.set(e.gallery_id, existing);
      });

      const galleryUploadStats = new Map<string, { first_upload: string | null; last_upload: string | null; count: number }>();
      (galleryUploadTimes || []).forEach((img: any) => {
        if (!img.gallery_id) return;
        const existing = galleryUploadStats.get(img.gallery_id) || { first_upload: null, last_upload: null, count: 0 };
        existing.count++;
        if (!existing.first_upload || img.created_at < existing.first_upload) existing.first_upload = img.created_at;
        if (!existing.last_upload || img.created_at > existing.last_upload) existing.last_upload = img.created_at;
        galleryUploadStats.set(img.gallery_id, existing);
      });

      const galleryCreditStats = new Map<string, number>();
      (galleryCreditLogs || []).forEach((l: any) => {
        if (!l.gallery_id) return;
        galleryCreditStats.set(l.gallery_id, (galleryCreditStats.get(l.gallery_id) || 0) + (l.edits_spent || 0));
      });

      // Enrich galleries with per-gallery stats
      const enrichedGalleries = (galleries || []).map((g: any) => {
        const editStats = galleryEditStats.get(g.id);
        const uploadStats = galleryUploadStats.get(g.id);
        const creditsSpent = galleryCreditStats.get(g.id) || 0;
        return {
          ...g,
          edits_count: editStats?.edits_count || 0,
          styles_used: editStats ? Array.from(editStats.styles) : [],
          first_edit_at: editStats?.first_edit || null,
          last_edit_at: editStats?.last_edit || null,
          first_upload_at: uploadStats?.first_upload || null,
          last_upload_at: uploadStats?.last_upload || null,
          images_uploaded: uploadStats?.count || 0,
          credits_spent: creditsSpent,
        };
      });

      return new Response(
        JSON.stringify({
          user: {
            id: au?.id,
            email: au?.email,
            provider,
            created_at: au?.created_at,
            last_sign_in_at: au?.last_sign_in_at,
            full_name: au?.user_metadata?.full_name || au?.user_metadata?.name || null,
            role: roles?.role || null,
          },
          subscription: subscription
            ? {
                plan_name: (subscription as any).plan?.name || "Free",
                status: subscription.status,
                edits_used: subscription.credits_used,
                edits_remaining: subscription.credits_remaining,
                storage_used_mb: subscription.storage_used_mb,
              }
            : null,
          galleries: enrichedGalleries,
          images_count: imagesCount || 0,
          edits_count: editsCount || 0,
          edit_logs: editLogs || [],
          email_logs: emailLogs || [],
          styles: styles || [],
          last_upload_at: lastUpload,
          sessions: sessions || [],
          onboarding: {
            all_questions: allQuestions || [],
            answers: onboardingAnswers || [],
          },
          credit_grants: creditGrants || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- List all users mode ---
    // Fetch all auth users (paginated, up to 1000)
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authError) {
      console.error("Error listing users:", authError);
      return new Response(JSON.stringify({ error: "Failed to list users" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authUsers = authData?.users || [];

    // Fetch all supplementary data in parallel
    const [
      { data: allRoles },
      { data: allSubs },
      { data: allGalleries },
      { data: allEditsRpc },
    ] = await Promise.all([
      adminClient.from("user_roles").select("user_id, role, can_view_analytics"),
      adminClient.from("user_subscriptions").select("user_id, status, billing_cycle, paypal_subscription_id, current_period_end, last_payment_at, cancel_at_period_end, plan:subscription_plans(name, slug, price_monthly, price_yearly)"),
      adminClient.from("galleries").select("user_id, total_images"),
      adminClient.rpc("get_edits_per_user"),
    ]);

    // Build lookup maps
    const rolesMap = new Map((allRoles || []).map((r: any) => [r.user_id, { role: r.role, can_view_analytics: r.can_view_analytics ?? false }]));
    const subsMap = new Map((allSubs || []).map((s: any) => [s.user_id, {
      plan_name: s.plan?.name || "Free",
      plan_slug: s.plan?.slug || "free",
      price_monthly: s.plan?.price_monthly || 0,
      price_yearly: s.plan?.price_yearly || 0,
      status: s.status,
      billing_cycle: s.billing_cycle,
      paypal_subscription_id: s.paypal_subscription_id,
      current_period_end: s.current_period_end,
      last_payment_at: s.last_payment_at,
      cancel_at_period_end: s.cancel_at_period_end,
    }]));

    // Galleries count + images count (sum of total_images per user)
    const galleriesCountMap = new Map<string, number>();
    const imagesCountMap = new Map<string, number>();
    (allGalleries || []).forEach((g: any) => {
      galleriesCountMap.set(g.user_id, (galleriesCountMap.get(g.user_id) || 0) + 1);
      imagesCountMap.set(g.user_id, (imagesCountMap.get(g.user_id) || 0) + (g.total_images || 0));
    });

    // Edits count from DB function
    const editsCountMap = new Map<string, number>();
    (allEditsRpc || []).forEach((e: any) => {
      editsCountMap.set(e.user_id, Number(e.edits_count) || 0);
    });

    const users = authUsers.map((u: any) => {
      const sub = subsMap.get(u.id) || null;
      return {
        id: u.id,
        email: u.email,
        provider: u.app_metadata?.provider === "google" ? "google" : "email",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
        role: rolesMap.get(u.id)?.role || null,
        can_view_analytics: rolesMap.get(u.id)?.can_view_analytics || false,
        plan_name: sub?.plan_name || "Free",
        plan_slug: sub?.plan_slug || "free",
        subscription_status: sub?.status || null,
        billing_cycle: sub?.billing_cycle || null,
        price_monthly: sub?.price_monthly || 0,
        price_yearly: sub?.price_yearly || 0,
        paypal_subscription_id: sub?.paypal_subscription_id || null,
        current_period_end: sub?.current_period_end || null,
        last_payment_at: sub?.last_payment_at || null,
        cancel_at_period_end: sub?.cancel_at_period_end || false,
        galleries_count: galleriesCountMap.get(u.id) || 0,
        images_count: imagesCountMap.get(u.id) || 0,
        edits_count: editsCountMap.get(u.id) || 0,
      };
    });

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-list-users error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
