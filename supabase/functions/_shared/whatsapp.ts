/**
 * Shared helper to send WhatsApp messages via Green API.
 * Sends to all recipients configured in platform_settings (key: whatsapp_recipients).
 * Falls back to GREEN_API_CHAT_ID secret if no DB recipients found.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Recipient {
  name: string;
  chatId: string;
}

async function getRecipients(): Promise<string[]> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", "whatsapp_recipients")
      .single();

    if (data?.value) {
      const recipients: Recipient[] = JSON.parse(data.value);
      if (recipients.length > 0) {
        return recipients.map((r) => r.chatId);
      }
    }
  } catch (err) {
    console.warn("Failed to fetch WhatsApp recipients from DB:", err);
  }

  // Fallback to env secret
  const chatId = Deno.env.get("GREEN_API_CHAT_ID");
  return chatId ? [chatId] : [];
}

export async function sendWhatsAppNotification(message: string): Promise<void> {
  const instanceId = Deno.env.get("GREEN_API_INSTANCE_ID");
  const token = Deno.env.get("GREEN_API_TOKEN");

  if (!instanceId || !token) {
    console.warn("Green API credentials not configured, skipping WhatsApp notification");
    return;
  }

  const chatIds = await getRecipients();
  if (chatIds.length === 0) {
    console.warn("No WhatsApp recipients configured, skipping notification");
    return;
  }

  const url = `https://api.greenapi.com/waInstance${instanceId}/sendMessage/${token}`;

  for (const chatId of chatIds) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message }),
      });
      if (!res.ok) {
        console.error(`Green API error for ${chatId}:`, res.status, await res.text());
      }
    } catch (err) {
      console.error(`WhatsApp notification failed for ${chatId}:`, err);
    }
  }
}
