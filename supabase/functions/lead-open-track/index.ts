import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const pixelBytes = Uint8Array.from(
  atob("R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs="),
  (c) => c.charCodeAt(0),
);

function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("android") || ua.includes("mobile")) return "mobile";
  if (ua.includes("ipad") || ua.includes("tablet")) return "tablet";
  if (ua.includes("macintosh") || ua.includes("windows") || ua.includes("linux")) return "desktop";
  return "unknown";
}

function extractIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
}

function pixelResponse() {
  return new Response(pixelBytes, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, authorization, apikey",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, authorization, apikey",
      },
    });
  }

  if (req.method !== "GET") {
    return pixelResponse();
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return pixelResponse();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: scheduled } = await adminClient
      .from("lead_scheduled_emails")
      .select("id, lead_id, opened_count, opened_first_at")
      .eq("open_token", token)
      .maybeSingle();

    if (!scheduled?.id) return pixelResponse();

    const now = new Date().toISOString();
    const userAgent = req.headers.get("user-agent") ?? "";

    await adminClient.from("lead_email_opens").insert({
      scheduled_email_id: scheduled.id,
      lead_id: scheduled.lead_id,
      opened_at: now,
      ip_address: extractIp(req),
      user_agent: userAgent || null,
      device_type: detectDevice(userAgent),
    });

    await adminClient
      .from("lead_scheduled_emails")
      .update({
        opened_count: (scheduled.opened_count ?? 0) + 1,
        opened_first_at: scheduled.opened_first_at || now,
        updated_at: now,
      })
      .eq("id", scheduled.id);

    return pixelResponse();
  } catch (err) {
    console.error("lead-open-track error:", err);
    return pixelResponse();
  }
});
