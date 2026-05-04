/**
 * Shared PayPal API client utilities.
 * Handles OAuth2 token management, subscription creation/cancellation,
 * order creation/capture (for add-ons), and webhook signature verification.
 *
 * Supports sandbox/live mode toggle via the `paypal_mode` platform setting.
 * Credentials are read from environment variables:
 *   PAYPAL_SANDBOX_CLIENT_ID / PAYPAL_SANDBOX_CLIENT_SECRET / PAYPAL_SANDBOX_WEBHOOK_ID
 *   PAYPAL_LIVE_CLIENT_ID / PAYPAL_LIVE_CLIENT_SECRET / PAYPAL_LIVE_WEBHOOK_ID
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getEnv = (key: string) => Deno.env.get(key) || "";

// ─── PayPal Mode (sandbox / live) ──────────────────────────────────────────

let cachedMode: { mode: "sandbox" | "live"; expiresAt: number } | null = null;

export async function getPayPalMode(): Promise<"sandbox" | "live"> {
  if (cachedMode && Date.now() < cachedMode.expiresAt) {
    return cachedMode.mode;
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase env vars missing, defaulting to sandbox");
      return "sandbox";
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "paypal_mode")
      .maybeSingle();

    if (error || !data?.value) {
      console.warn("Could not read paypal_mode setting, defaulting to sandbox");
      cachedMode = { mode: "sandbox", expiresAt: Date.now() + 60_000 };
      return "sandbox";
    }

    const mode = JSON.parse(data.value) === "live" ? "live" : "sandbox";
    cachedMode = { mode, expiresAt: Date.now() + 60_000 };
    return mode;
  } catch (err) {
    console.error("Error reading paypal_mode:", err);
    return "sandbox";
  }
}

function getApiBase(mode: "sandbox" | "live"): string {
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function getCredentials(mode: "sandbox" | "live") {
  const prefix = mode === "live" ? "PAYPAL_LIVE" : "PAYPAL_SANDBOX";
  return {
    clientId: getEnv(`${prefix}_CLIENT_ID`) || getEnv("PAYPAL_CLIENT_ID"),
    clientSecret: getEnv(`${prefix}_CLIENT_SECRET`) || getEnv("PAYPAL_CLIENT_SECRET"),
    webhookId: getEnv(`${prefix}_WEBHOOK_ID`) || getEnv("PAYPAL_WEBHOOK_ID"),
  };
}

// ─── OAuth2 Access Token ────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number; mode: string } | null = null;

export async function getAccessToken(): Promise<string> {
  const mode = await getPayPalMode();

  // Return cached token if still valid (with 60s buffer) and same mode
  if (cachedToken && cachedToken.mode === mode && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const { clientId, clientSecret } = getCredentials(mode);

  if (!clientId || !clientSecret) {
    throw new Error(
      `PayPal ${mode} credentials not configured. Set PAYPAL_${mode.toUpperCase()}_CLIENT_ID and PAYPAL_${mode.toUpperCase()}_CLIENT_SECRET`
    );
  }

  const apiBase = getApiBase(mode);
  const res = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal OAuth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    mode,
  };
  return cachedToken.token;
}

// ─── Generic API Call ───────────────────────────────────────────────────────

async function paypalFetch(path: string, options: RequestInit = {}): Promise<any> {
  const mode = await getPayPalMode();
  const token = await getAccessToken();
  const apiBase = getApiBase(mode);

  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    console.error(`PayPal API error ${res.status} ${path}:`, json);
    throw new Error(`PayPal API error (${res.status}): ${json.message || json.error_description || text}`);
  }

  return json;
}

// ─── Webhook Signature Verification ─────────────────────────────────────────

export async function verifyWebhookSignature(
  headers: Headers,
  body: string,
): Promise<boolean> {
  const mode = await getPayPalMode();
  const { webhookId } = getCredentials(mode);

  if (!webhookId) {
    console.error(`PAYPAL_${mode.toUpperCase()}_WEBHOOK_ID not configured - rejecting webhook`);
    return false;
  }

  try {
    const token = await getAccessToken();
    const apiBase = getApiBase(mode);
    const verifyPayload = {
      auth_algo: headers.get("paypal-auth-algo") || "",
      cert_url: headers.get("paypal-cert-url") || "",
      transmission_id: headers.get("paypal-transmission-id") || "",
      transmission_sig: headers.get("paypal-transmission-sig") || "",
      transmission_time: headers.get("paypal-transmission-time") || "",
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    };

    const res = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(verifyPayload),
    });

    const result = await res.json();
    return result.verification_status === "SUCCESS";
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return false;
  }
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

export interface CreateSubscriptionOptions {
  paypalPlanId: string;
  subscriberEmail: string;
  returnUrl: string;
  cancelUrl: string;
  customId?: string; // our user_id for linking
}

export async function createSubscription(opts: CreateSubscriptionOptions): Promise<{
  subscriptionId: string;
  approvalUrl: string;
}> {
  const data = await paypalFetch("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: opts.paypalPlanId,
      subscriber: {
        email_address: opts.subscriberEmail,
      },
      custom_id: opts.customId,
      application_context: {
        brand_name: "Imagick",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: opts.returnUrl,
        cancel_url: opts.cancelUrl,
      },
    }),
  });

  const approvalLink = data.links?.find((l: any) => l.rel === "approve");
  if (!approvalLink) {
    throw new Error("No approval URL in PayPal response");
  }

  return {
    subscriptionId: data.id,
    approvalUrl: approvalLink.href,
  };
}

export async function cancelSubscription(subscriptionId: string, reason: string): Promise<void> {
  await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function getSubscriptionDetails(subscriptionId: string): Promise<any> {
  return paypalFetch(`/v1/billing/subscriptions/${subscriptionId}`);
}

// ─── Orders (for one-time payments like add-ons) ────────────────────────────

export interface CreateOrderOptions {
  amount: string; // e.g. "5.00"
  currency?: string;
  description: string;
  customId?: string;
  returnUrl: string;
  cancelUrl: string;
}

export async function createOrder(opts: CreateOrderOptions): Promise<{
  orderId: string;
  approvalUrl: string;
}> {
  const data = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: opts.currency || "USD",
            value: opts.amount,
          },
          description: opts.description,
          custom_id: opts.customId,
        },
      ],
      application_context: {
        brand_name: "Imagick",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: opts.returnUrl,
        cancel_url: opts.cancelUrl,
      },
    }),
  });

  const approvalLink = data.links?.find((l: any) => l.rel === "approve");
  if (!approvalLink) {
    throw new Error("No approval URL in PayPal order response");
  }

  return {
    orderId: data.id,
    approvalUrl: approvalLink.href,
  };
}

export async function captureOrder(orderId: string): Promise<any> {
  return paypalFetch(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
  });
}
