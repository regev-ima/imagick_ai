import type { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppNotification } from "./whatsapp.ts";

// Low-credit alerts (50% / 80% / exhausted) computed at the DEBIT choke point.
//
// Percentages are derived from edits_used (monotonic within a billing cycle,
// unaffected by grant credits inflating `remaining`), with the before-state
// reconstructed from the amount THIS debit spent — so a bulk culling charge of
// 300 credits crosses thresholds just like 300 single-edit debits would.
// 50/80 use floor (never fire early); "exhausted" fires only when the pool is
// actually empty. Each threshold fires once per crossing.
export async function checkCreditThresholds(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  spentNow: number,
): Promise<void> {
  try {
    if (spentNow <= 0) return;
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("edits_remaining, edits_used, subscription_plans!inner(edits_included)")
      .eq("user_id", userId)
      .single();
    const remaining = (sub as { edits_remaining?: number } | null)?.edits_remaining;
    const used = (sub as { edits_used?: number } | null)?.edits_used ?? 0;
    const included = (sub as { subscription_plans?: { edits_included?: number } } | null)
      ?.subscription_plans?.edits_included;

    if (remaining == null || remaining === -1) return; // unlimited
    if (typeof included !== "number" || included <= 0) return;

    const pctBefore = Math.min(100, Math.floor(((used - spentNow) / included) * 100));
    const pctNow = Math.min(100, Math.floor((used / included) * 100));
    // "Exhausted" = THIS debit emptied the pool (was >0 before, ≤0 now).
    const becameExhausted = remaining <= 0 && remaining + spentNow > 0;
    const crossed = becameExhausted
      ? 100
      : [50, 80].find((t) => pctBefore < t && pctNow >= t);
    if (!crossed) return;

    const emailType = crossed === 100 ? "edits_exhausted" : `credits_warning_${crossed}`;
    fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ type: emailType, userId, remaining }),
    }).catch((err) => console.error("Failed to trigger credit warning email:", err));

    if (crossed === 100) {
      const { data: userRecord } = await supabase.auth.admin.getUserById(userId);
      const userName = userRecord?.user?.user_metadata?.full_name ||
        userRecord?.user?.email?.split("@")[0] || "Unknown";
      sendWhatsAppNotification(
        `⚠️ Credits Exhausted\nUser: ${userName} (${userRecord?.user?.email})\nAll ${included.toLocaleString("en-US")} plan credits used.`,
      ).catch((err) => console.error("WhatsApp notification failed:", err));
    }
  } catch (err) {
    console.error("Failed to check credit thresholds:", err);
  }
}
