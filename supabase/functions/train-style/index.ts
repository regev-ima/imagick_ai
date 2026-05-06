import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import { styleTrainingStartedTemplate } from "../_shared/email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sendWhatsAppNotification } from "../_shared/whatsapp.ts";

const API_BASE_URL = "https://imagick-api-endpoint.rx8rq49b5c.workers.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth - support both user token and service role (for internal calls)
    const authHeader = req.headers.get("Authorization");
    let userId: string;
    let isServiceRole = false;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (authHeader?.replace("Bearer ", "") === serviceRoleKey) {
      // Internal call from gd-transfer webhook
      isServiceRole = true;
      const body = await req.clone().json();
      userId = body.userId;
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required for service role calls" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (authHeader?.startsWith("Bearer ")) {
      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id as string;
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { styleId, modelType, beforeDirs, afterDirs } = body;

    if (!styleId || !modelType || !beforeDirs?.length || !afterDirs?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields: styleId, modelType, beforeDirs, afterDirs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client for DB operations
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Get style name from DB
    const { data: style, error: styleError } = await adminSupabase
      .from("styles")
      .select("name, user_id")
      .eq("id", styleId)
      .single();

    if (styleError || !style) {
      return new Response(JSON.stringify({ error: "Style not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership (unless service role)
    if (!isServiceRole && style.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/train-webhook`;

    // Call the external training API
    const apiUsername = Deno.env.get("IMAGICK_API_USERNAME")!;
    const apiPassword = Deno.env.get("IMAGICK_API_PASSWORD")!;

    const uniqueModelId = `style_${styleId}_${crypto.randomUUID().slice(0, 8)}`;
    const trainPayload = {
      modelName: uniqueModelId,
      modelType: "event",
      beforeDirs: beforeDirs,
      afterDirs: afterDirs,
      callbackURL: webhookUrl,
      callbackArgs: { styleId, userId },
      callbackHeaders: {},
    };

    console.log("Sending train request:", JSON.stringify(trainPayload));

    const apiResponse = await fetch(`${API_BASE_URL}/at/train-model/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Username: apiUsername,
        Password: apiPassword,
      },
      body: JSON.stringify(trainPayload),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("Train API error:", errorText);

      await adminSupabase
        .from("styles")
        .update({ status: "error", error_details: [`API error: ${errorText}`] })
        .eq("id", styleId);

      return new Response(JSON.stringify({ error: "Training API failed", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update style status to training and save the model ID
    await adminSupabase
      .from("styles")
      .update({
        status: "training",
        training_start_date: new Date().toISOString(),
        style_id_external: uniqueModelId,
      })
      .eq("id", styleId);

    console.log(`Style ${styleId} training started`);

    // Send "training started" email (fire-and-forget)
    const ownerUserId = style.user_id as string;
    sendTrainingStartedEmail(adminSupabase, supabaseUrl, styleId, ownerUserId, style.name as string).catch(err =>
      console.error("sendTrainingStartedEmail error:", err)
    );

    // WhatsApp notification (fire-and-forget)
    (async () => {
      try {
        const { data: userRecord } = await adminSupabase.auth.admin.getUserById(ownerUserId);
        const email = userRecord?.user?.email || "unknown";
        const name = userRecord?.user?.user_metadata?.full_name || email;
        await sendWhatsAppNotification(
          `🎨 Style Training Started\nStyle: ${style.name}\nUser: ${name} (${email})`
        );
      } catch (e) { console.error("WhatsApp notify error:", e); }
    })();

    return new Response(JSON.stringify({ success: true, message: "Training started" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in train-style:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendTrainingStartedEmail(adminSupabase: any, supabaseUrl: string, styleId: string, userId: string, styleName: string) {
  const { data: userRecord } = await adminSupabase.auth.admin.getUserById(userId);
  if (!userRecord?.user?.email) return;

  const appUrl   = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");
  const styleUrl = `${appUrl}/dashboard/styles/${styleId}`;
  const template = styleTrainingStartedTemplate(styleName, styleUrl);

  await sendEmail({
    to:           userRecord.user.email,
    subject:      template.subject,
    html:         template.html,
    emailType:    "style_training_started",
    userId,
    metadata:     { styleId, styleName },
    supabaseAdmin: adminSupabase,
  });
}
