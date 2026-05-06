// @ts-nocheck — untyped Supabase client (no generated types in edge functions)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import {
  welcomeEmailTemplate,
  galleryUploadCompleteTemplate,
  galleryImagesReadyTemplate,
  styleTrainingStartedTemplate,
  styleReadyTemplate,
  reEditSubmittedTemplate,
  reEditCompleteTemplate,
  gallerySharedConfirmTemplate,
  galleryClientInviteTemplate,
  subscriptionChangeTemplate,
  cullingReadyTemplate,
  passwordResetTemplate,
  googleAccountTemplate,
  gdImportStartedTemplate,
  gdImportCompleteTemplate,
  journeyFirstGalleryTemplate,
  journeySocialProofTemplate,
  journeyUploadMoreTemplate,
  journeyUpgradeTemplate,
  journeyReEngagementTemplate,
  subscriptionActivatedTemplate,
  subscriptionCancelledTemplate,
  subscriptionExpiredTemplate,
  paymentFailedTemplate,
  editsWarningTemplate,
  editsExhaustedTemplate,
  addonPurchasedTemplate,
  downgradeScheduledTemplate,
  invoiceEmailTemplate,
} from "../_shared/email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  normalizeLeadTokens,
  renderLeadCampaignEmail,
  renderLeadSubject,
  resolveLeadBrandLogoUrl,
  resolveLeadSignatureLogoUrl,
  resolveLeadSender,
  substituteLeadTokens,
} from "../_shared/lead-email-renderer.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin check
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { templateKey, recipientEmail, previewOnly, leadCampaignId, variant } = await req.json();

    if (!templateKey) {
      return new Response(JSON.stringify({ error: "templateKey is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studioUrl = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");
    const leadLogoUrl = await resolveLeadBrandLogoUrl(supabaseAdmin);
    const leadSignatureLogoUrl = await resolveLeadSignatureLogoUrl(supabaseAdmin);
    const sampleUrl = `${studioUrl}/dashboard`;

    // Generate template
    const templates: Record<string, () => { subject: string; html: string }> = {
      welcome: () => welcomeEmailTemplate("Test User"),
      gallery_upload_complete: () => galleryUploadCompleteTemplate("My Gallery", 150, `${sampleUrl}/galleries/test`),
      gallery_images_ready: () => galleryImagesReadyTemplate("My Gallery", 150, `${sampleUrl}/galleries/test`),
      style_training_started: () => styleTrainingStartedTemplate("My Style", `${sampleUrl}/styles/test`),
      style_ready: () => styleReadyTemplate("My Style", `${sampleUrl}/styles/test`),
      re_edit_submitted: () => reEditSubmittedTemplate("My Gallery", 50, ["Style A"], `${sampleUrl}/galleries/test`),
      re_edit_complete: () => reEditCompleteTemplate("My Gallery", 50, `${sampleUrl}/galleries/test`),
      gallery_shared: () => gallerySharedConfirmTemplate("My Gallery", "client@test.com", `${sampleUrl}/galleries/test`),
      gallery_client_invite: () => galleryClientInviteTemplate("Client", "Photographer", "My Gallery", `${sampleUrl}/gallery/test`, "ABC123"),
      subscription_change: () => subscriptionChangeTemplate("Pro", "upgrade", undefined, `${sampleUrl}/billing`),
      subscription_activated: () => subscriptionActivatedTemplate("Pro", "monthly", "April 1, 2026", `${sampleUrl}/billing`),
      subscription_cancelled: () => subscriptionCancelledTemplate("Pro", "2026-04-01", `${sampleUrl}/billing`),
      subscription_expired: () => subscriptionExpiredTemplate("Pro", `${sampleUrl}/billing`),
      payment_failed: () => paymentFailedTemplate("Pro", `${sampleUrl}/billing`),
      edits_warning: () => editsWarningTemplate(500, `${sampleUrl}/billing`),
      edits_exhausted: () => editsExhaustedTemplate(`${sampleUrl}/billing`),
      addon_purchased: () => addonPurchasedTemplate("Extra Custom Style Slot", 1, "5.00", `${sampleUrl}/billing`),
      downgrade_scheduled: () => downgradeScheduledTemplate("Pro", "Starter", "2026-04-01", `${sampleUrl}/billing`),
      invoice: () => invoiceEmailTemplate("INV-12345", "Pro Plan - Monthly", 19, `${sampleUrl}/invoices/test`),
      culling_ready: () => cullingReadyTemplate("My Gallery", 500, 120, `${sampleUrl}/galleries/test`),
      password_reset: () => passwordResetTemplate(`${studioUrl}/reset-password?token=test`),
      google_account: () => googleAccountTemplate(studioUrl),
      gd_import_started: () => gdImportStartedTemplate("My Gallery", 250, `${sampleUrl}/galleries/test`),
      gd_import_complete: () => gdImportCompleteTemplate("My Gallery", 250, `${sampleUrl}/galleries/test`),
      journey_first_gallery: () => journeyFirstGalleryTemplate(studioUrl),
      journey_social_proof: () => journeySocialProofTemplate(studioUrl),
      journey_upload_more: () => journeyUploadMoreTemplate(studioUrl),
      journey_upgrade: () => journeyUpgradeTemplate(studioUrl),
      journey_reengagement: () => journeyReEngagementTemplate(studioUrl),
    };

    let subject = "";
    let html = "";
    let senderProfile: "sapir" | "contact" | null = null;

    const generator = templates[templateKey];
    if (generator) {
      const rendered = generator();
      subject = rendered.subject;
      html = rendered.html;
    } else if (typeof templateKey === "string" && templateKey.startsWith("lead_campaign_step_")) {
      const stepOrder = Number(templateKey.replace("lead_campaign_step_", ""));
      if (!Number.isFinite(stepOrder) || stepOrder < 1) {
        return new Response(JSON.stringify({ error: `Unknown template: ${templateKey}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let campaignId = leadCampaignId as string | undefined;
      if (!campaignId) {
        const { data: defaultCampaign } = await supabaseAdmin
          .from("lead_campaigns")
          .select("id")
          .eq("is_default", true)
          .maybeSingle();
        campaignId = defaultCampaign?.id;
      }

      if (!campaignId) {
        return new Response(JSON.stringify({ error: "No lead campaign available" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: step } = await supabaseAdmin
        .from("lead_campaign_steps")
        .select("subject, body_html, sender_profile, is_reply, variant_b_subject, variant_b_body_html, ab_enabled")
        .eq("campaign_id", campaignId)
        .eq("step_order", stepOrder)
        .maybeSingle();

      if (!step) {
        return new Response(JSON.stringify({ error: `Lead step ${stepOrder} not found` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      senderProfile = step.sender_profile === "sapir" ? "sapir" : "contact";
      const wantsVariantB = variant === "B";
      const hasVariantB =
        (step.variant_b_subject && step.variant_b_subject.trim()) ||
        (step.variant_b_body_html && step.variant_b_body_html.trim());
      const useVariantB = wantsVariantB && step.ab_enabled && hasVariantB;
      const subjectTemplate = useVariantB && step.variant_b_subject?.trim() ? step.variant_b_subject : step.subject;
      const bodyTemplate = useVariantB && step.variant_b_body_html?.trim() ? step.variant_b_body_html : step.body_html;
      const unsubUrl = `${studioUrl}/unsubscribe?token=test-token&kind=lead`;
      const tokenVars = normalizeLeadTokens({
        first_name: "Test",
        last_name: "User",
        email: recipientEmail || user.email || "test@example.com",
        studio_url: studioUrl,
        unsubscribe_url: unsubUrl,
      });
      subject = renderLeadSubject(subjectTemplate || "", tokenVars, !!step.is_reply);
      const bodyCore = substituteLeadTokens(bodyTemplate || "", tokenVars);
      html = renderLeadCampaignEmail({
        senderProfile,
        subject,
        bodyHtml: bodyCore,
        unsubscribeUrl: unsubUrl,
        studioUrl,
        logoUrl: leadLogoUrl,
        signatureLogoUrl: leadSignatureLogoUrl,
      });
    } else {
      return new Response(JSON.stringify({ error: `Unknown template: ${templateKey}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Preview only — return HTML without sending
    if (previewOnly) {
      return new Response(JSON.stringify({ subject, html }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send the email
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "recipientEmail is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sender = senderProfile ? resolveLeadSender(senderProfile) : null;
    const result = await sendEmail({
      to: recipientEmail,
      subject: `[TEST] ${subject}`,
      html,
      emailType: senderProfile ? "lead_campaign" : "test_email",
      userId: user.id,
      metadata: {
        templateKey,
        test: true,
        sender_profile: senderProfile,
        variant: variant === "B" ? "B" : "A",
      },
      fromEmail: sender?.fromEmail,
      fromName: sender?.fromName,
      replyTo: sender?.replyTo,
      supabaseAdmin,
    });

    return new Response(JSON.stringify({ ...result, subject, html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("send-test-email error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
