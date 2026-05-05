import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cancelSubscription } from "../_shared/paypal.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user
    const userClient = createClient(supabaseUrl, anonKey, {
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
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Delete all user data in order (respecting foreign keys)
    // 1. image_edits
    await adminClient.from("image_edits").delete().eq("user_id", userId);

    // 2. gallery_images (also triggers storage recalc)
    await adminClient.from("gallery_images").delete().eq("user_id", userId);

    // 3. gallery_invites (via gallery ownership)
    const { data: galleries } = await adminClient
      .from("galleries")
      .select("id")
      .eq("user_id", userId);

    if (galleries && galleries.length > 0) {
      const galleryIds = galleries.map((g: any) => g.id);
      await adminClient.from("gallery_invites").delete().in("gallery_id", galleryIds);
      await adminClient.from("client_interactions").delete().in("gallery_id", galleryIds);
    }

    // 4. galleries
    await adminClient.from("galleries").delete().eq("user_id", userId);

    // 5. styles
    await adminClient.from("styles").delete().eq("user_id", userId);

    // 6. Cancel PayPal subscription before deleting subscription data
    const { data: subscription } = await adminClient
      .from("user_subscriptions")
      .select("paypal_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (subscription?.paypal_subscription_id) {
      try {
        await cancelSubscription(subscription.paypal_subscription_id, "User deleted their account");
        console.log("PayPal subscription cancelled:", subscription.paypal_subscription_id);
      } catch (err) {
        console.warn("Failed to cancel PayPal subscription (may already be cancelled):", err);
      }
    }

    // 8. user_subscriptions
    await adminClient.from("user_subscriptions").delete().eq("user_id", userId);

    // 9. user_email_preferences
    await adminClient.from("user_email_preferences").delete().eq("user_id", userId);

    // 10. user_sessions
    await adminClient.from("user_sessions").delete().eq("user_id", userId);

    // 11. user_roles
    await adminClient.from("user_roles").delete().eq("user_id", userId);

    // 12. email_logs
    await adminClient.from("email_logs").delete().eq("user_id", userId);

    // 13. invoices
    await adminClient.from("invoices").delete().eq("user_id", userId);

    // 14. credit_grants
    await adminClient.from("credit_grants").delete().eq("user_id", userId);

    // 15. credit_usage_logs
    await adminClient.from("edit_usage_logs").delete().eq("user_id", userId);

    // 16. onboarding_answers
    await adminClient.from("onboarding_answers").delete().eq("user_id", userId);

    // 17. onboarding_skips
    await adminClient.from("onboarding_skips").delete().eq("user_id", userId);

    // 18. user_lifecycle_profiles
    await adminClient.from("user_lifecycle_profiles").delete().eq("user_id", userId);

    // 19. user_sequence_enrollments
    await adminClient.from("user_sequence_enrollments").delete().eq("user_id", userId);

    // 20. Delete storage files (gallery-images)
    try {
      const { data: files } = await adminClient.storage
        .from("gallery-images")
        .list(userId);
      if (files && files.length > 0) {
        const filePaths = files.map((f: any) => `${userId}/${f.name}`);
        await adminClient.storage.from("gallery-images").remove(filePaths);
      }
    } catch (err) {
      console.warn("Storage cleanup (gallery-images) partial:", err);
    }

    // 21. Delete storage files (invoices)
    try {
      const { data: invoiceFiles } = await adminClient.storage
        .from("invoices")
        .list(userId);
      if (invoiceFiles && invoiceFiles.length > 0) {
        const invoicePaths = invoiceFiles.map((f: any) => `${userId}/${f.name}`);
        await adminClient.storage.from("invoices").remove(invoicePaths);
      }
    } catch (err) {
      console.warn("Storage cleanup (invoices) partial:", err);
    }

    // 22. Delete auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete account. Some data was cleaned up." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-account error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
