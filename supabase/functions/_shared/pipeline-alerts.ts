/**
 * Admin alerting for pipeline faults — one choke point so every failure path
 * (stall, watchdog death, provider outage, low provider balance) notifies the
 * same way: WhatsApp to the configured admin recipients (platform_settings.
 * whatsapp_recipients, same channel as style-training notifications) + Sentry
 * (which already relays to Telegram via sentry-telegram-relay).
 *
 * Alerts are best-effort and never throw — a broken notifier must not break
 * the pipeline or the watchdog.
 */
import { sendWhatsAppNotification } from "./whatsapp.ts";
import { captureException } from "./sentry.ts";

export async function alertAdminsPipeline(
  title: string,
  details: Record<string, unknown>,
): Promise<void> {
  const lines = Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `• ${k}: ${String(v).slice(0, 300)}`);
  const message = `🚨 Imagick pipeline alert\n${title}\n${lines.join("\n")}`;

  try {
    await sendWhatsAppNotification(message);
  } catch (e) {
    console.error("pipeline alert: WhatsApp failed:", e);
  }
  try {
    await captureException(new Error(`pipeline alert: ${title}`), {
      tags: { fn: "pipeline-alert" },
      extra: details,
    });
  } catch (e) {
    console.error("pipeline alert: Sentry failed:", e);
  }
}
