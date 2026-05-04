/**
 * track-session — saves device/session info and sends WhatsApp notification for new users.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppNotification } from "../_shared/whatsapp.ts";
import { sendEmail } from "../_shared/email-sender.ts";
import { welcomeEmailTemplate } from "../_shared/email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const userEmail = userData.user.email as string;
    const userName = (userData.user.user_metadata as any)?.full_name || userEmail?.split("@")[0] || "Unknown";

    const body = await req.json();
    const { device_type, browser, os, screen_width, screen_height, color_scheme, user_agent } = body;

    // Extract IP from headers
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || "unknown";

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Save session to DB
    await adminClient.from("user_sessions").insert({
      user_id: userId,
      device_type,
      browser,
      os,
      ip_address: ip,
      screen_width,
      screen_height,
      color_scheme,
      user_agent,
    });

    // Update lifecycle profile: increment login count and last active timestamp
    try { await adminClient.rpc("increment_lifecycle_login", { p_user_id: userId }); } catch (_) {}

    // Check if this is a new user (created within last 5 minutes)
    const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
    const createdAt = authUser?.user?.created_at;
    const isNewUser = createdAt && (Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000);

    if (isNewUser) {
      const provider = authUser?.user?.app_metadata?.provider === "google" ? "Google" : "Email";
      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      const message = `🆕 New User Signup\nName: ${userName}\nEmail: ${userEmail}\nAuth: ${provider}\nDate: ${dateStr}\nDevice: ${device_type || "unknown"} / ${os || "unknown"}\nBrowser: ${browser || "unknown"}\nIP: ${ip}\nResolution: ${screen_width || "?"}x${screen_height || "?"}\nTheme: ${color_scheme || "unknown"}`;

      // Fire-and-forget WhatsApp
      sendWhatsAppNotification(message).catch(() => {});

      // Send welcome email
      const template = welcomeEmailTemplate(userName);
      sendEmail({
        to: userEmail,
        subject: template.subject,
        html: template.html,
        emailType: "welcome_email",
        userId,
        metadata: { triggered_by: "track-session", provider },
        supabaseAdmin: adminClient,
      }).catch((err) => console.error("Welcome email error:", err));
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("track-session error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
