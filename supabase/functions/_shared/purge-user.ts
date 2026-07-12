// Shared, single-source-of-truth account purge. Deletes every trace of a user
// in FK-safe order, then the auth user and their storage. Used by:
//   - delete-account (user deletes themselves)
//   - admin-manage-user (admin deletes / cancels)
//   - billing-cron (auto-purge of accounts suspended 60+ days)
//
// IMPORTANT: it deliberately does NOT touch public.welcome_grant_claims — that
// ledger must outlive the account so a deleted user can't re-signup and farm
// the one-time welcome credits again.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cancelSubscription } from "./paypal.ts";

export async function purgeUser(
  adminClient: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  // 1. image_edits
  await adminClient.from("image_edits").delete().eq("user_id", userId);
  // 2. gallery_images
  await adminClient.from("gallery_images").delete().eq("user_id", userId);
  // 3. gallery_invites + client_interactions (via gallery ownership)
  const { data: galleries } = await adminClient
    .from("galleries")
    .select("id")
    .eq("user_id", userId);
  if (galleries && galleries.length > 0) {
    const galleryIds = galleries.map((g: { id: string }) => g.id);
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
      await cancelSubscription(subscription.paypal_subscription_id, "Account deleted");
    } catch (err) {
      console.warn("Failed to cancel PayPal subscription (may already be cancelled):", err);
    }
  }
  // 7. remaining user-scoped tables
  await adminClient.from("user_subscriptions").delete().eq("user_id", userId);
  await adminClient.from("user_email_preferences").delete().eq("user_id", userId);
  await adminClient.from("user_sessions").delete().eq("user_id", userId);
  await adminClient.from("user_roles").delete().eq("user_id", userId);
  await adminClient.from("email_logs").delete().eq("user_id", userId);
  await adminClient.from("invoices").delete().eq("user_id", userId);
  await adminClient.from("credit_grants").delete().eq("user_id", userId);
  await adminClient.from("edit_usage_logs").delete().eq("user_id", userId);
  await adminClient.from("onboarding_answers").delete().eq("user_id", userId);
  await adminClient.from("onboarding_skips").delete().eq("user_id", userId);
  await adminClient.from("user_lifecycle_profiles").delete().eq("user_id", userId);
  await adminClient.from("user_sequence_enrollments").delete().eq("user_id", userId);

  // 8. Storage (gallery-images)
  try {
    const { data: files } = await adminClient.storage.from("gallery-images").list(userId);
    if (files && files.length > 0) {
      await adminClient.storage
        .from("gallery-images")
        .remove(files.map((f: { name: string }) => `${userId}/${f.name}`));
    }
  } catch (err) {
    console.warn("Storage cleanup (gallery-images) partial:", err);
  }
  // 9. Storage (invoices)
  try {
    const { data: invoiceFiles } = await adminClient.storage.from("invoices").list(userId);
    if (invoiceFiles && invoiceFiles.length > 0) {
      await adminClient.storage
        .from("invoices")
        .remove(invoiceFiles.map((f: { name: string }) => `${userId}/${f.name}`));
    }
  } catch (err) {
    console.warn("Storage cleanup (invoices) partial:", err);
  }

  // 10. Delete auth user
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("Failed to delete auth user:", deleteError);
    return { ok: false, error: deleteError.message };
  }
  return { ok: true };
}
