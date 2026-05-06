/**
 * process-journey — Customer Lifecycle Processor
 *
 * This edge function:
 * 1. Recomputes every user's conversion_score and lifecycle_stage
 * 2. Enrolls new users in the onboarding sequence
 * 3. Sends pending sequence emails (those with next_send_at <= NOW())
 * 4. Checks conditions before sending (e.g. skip if user already has a gallery)
 * 5. Adds unsubscribe links to every journey email
 *
 * Triggered hourly via pg_cron, or manually from admin UI.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
import { journeyEmailTemplate } from "../_shared/email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";

// ─── HMAC token generation for unsubscribe ───────────────────────────────────

async function generateUnsubscribeToken(userId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(userId));
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return btoa(JSON.stringify({ uid: userId, sig: hex }));
}

// ─── Scoring algorithm ────────────────────────────────────────────────────────

function computeScore(params: {
  daysSinceSignup: number;
  galleryCount: number;
  imagesProcessed: number;
  loginCount: number;
  budget?: string | null;
  teamSize?: string | null;
  isPaid: boolean;
}): number {
  if (params.isPaid) return 100;

  let score = 0;

  if (params.daysSinceSignup <= 7) score += 20;
  else if (params.daysSinceSignup <= 14) score += 12;
  else if (params.daysSinceSignup <= 30) score += 5;

  score += Math.min(params.galleryCount * 8, 25);

  if (params.imagesProcessed >= 500) score += 20;
  else if (params.imagesProcessed >= 100) score += 12;
  else if (params.imagesProcessed >= 10) score += 6;
  else if (params.imagesProcessed >= 1) score += 2;

  score += Math.min(params.loginCount * 3, 15);

  if (params.budget === "100+") score += 10;
  else if (params.budget === "50-100") score += 7;
  else if (params.budget === "20-50") score += 4;

  if (params.teamSize === "6-20" || params.teamSize === "20+") score += 5;
  else if (params.teamSize === "2-5") score += 3;

  return Math.min(Math.max(score, 0), 100);
}

// ─── Lifecycle stage rules ────────────────────────────────────────────────────

function computeStage(params: {
  score: number;
  galleryCount: number;
  imagesProcessed: number;
  loginCount: number;
  lastActiveAt: Date | null;
  isPaid: boolean;
  subscriptionStatus: string | null;
  questionnaireCompleted: boolean;
}): string {
  const now = new Date();
  const daysSinceActive = params.lastActiveAt
    ? (now.getTime() - params.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  if (params.isPaid) {
    if (params.subscriptionStatus === "active" || params.subscriptionStatus === "trial") {
      if (daysSinceActive >= 7) return "at_risk";
      return "paying";
    }
  }

  if (daysSinceActive >= 30) return "churned";
  if (params.score >= 60 && !params.isPaid && params.galleryCount >= 1) return "converting";
  if (params.galleryCount >= 3 || (params.loginCount >= 5 && params.galleryCount >= 1)) return "engaged";
  if (params.galleryCount >= 1 || params.imagesProcessed >= 1) return "exploring";
  if (params.questionnaireCompleted) return "onboarding";

  return "new";
}

// ─── Condition checker ───────────────────────────────────────────────────────

function shouldSkipStep(
  conditionCheck: string | null,
  galleryCount: number,
  imagesProcessed: number,
  isPaid: boolean,
  lastActiveAt: Date | null
): boolean {
  if (!conditionCheck) return false;

  switch (conditionCheck) {
    case "no_gallery":
      // Skip if user already has a gallery
      return galleryCount > 0;
    case "low_images":
      // Skip if user has 10+ images
      return imagesProcessed >= 10;
    case "free_plan":
      // Skip if user is already paid
      return isPaid;
    case "inactive": {
      // Skip if user was active in last 7 days
      if (!lastActiveAt) return false;
      const daysSince = (Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 7;
    }
    default:
      return false;
  }
}

// ─── Template variable substitution ──────────────────────────────────────────

function substituteTokens(
  html: string,
  vars: Record<string, string | number>
): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, String(value));
  }
  return result;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const studioUrl = (Deno.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");

  // Optional: verify admin JWT for manual triggers from the UI
  const authHeader = req.headers.get("Authorization");
  let callerIsAdmin = false;

  if (authHeader?.startsWith("Bearer ")) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (userData?.user?.id) {
      const callerId = userData.user.id as string;
      const { data: roleRow } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .maybeSingle();
      callerIsAdmin = !!roleRow;
    }
  }

  let body: { trigger?: string; userId?: string; batchSize?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine for cron triggers
  }

  const isCron = body.trigger === "cron";
  if (!isCron && !callerIsAdmin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const targetUserId = body.userId ?? null;
  const batchSize = body.batchSize ?? 200;

  const stats = { processed: 0, stageChanges: 0, enrolled: 0, emailsSent: 0, skipped: 0, errors: 0 };

  try {
    // ── 1. Load users to process ──────────────────────────────────────────────
    const usersResult = await adminClient.auth.admin.listUsers({ perPage: 1000 });

    const [galleriesResult, subscriptionsResult] = await Promise.all([
      adminClient.from("galleries").select("user_id, total_images"),
      adminClient
        .from("user_subscriptions")
        .select("user_id, status, plan_id, subscription_plans!inner(slug)"),
    ]);

    const allUsers = usersResult.data?.users ?? [];

    // Build lookup maps
    const galleryCounts: Record<string, number> = {};
    const imageTotals: Record<string, number> = {};
    for (const row of galleriesResult.data ?? []) {
      const uid = (row as any).user_id;
      galleryCounts[uid] = (galleryCounts[uid] ?? 0) + 1;
      imageTotals[uid] = (imageTotals[uid] ?? 0) + ((row as any).total_images ?? 0);
    }

    const subscriptionMap: Record<string, { status: string; isPaid: boolean }> = {};
    for (const row of subscriptionsResult.data ?? []) {
      const uid = (row as any).user_id;
      const planSlug = (row as any).subscription_plans?.slug ?? "";
      const isPaid = !["free", "pay_as_you_go", ""].includes(planSlug);
      subscriptionMap[uid] = { status: (row as any).status, isPaid };
    }

    // Load current lifecycle profiles
    const { data: existingProfiles } = await adminClient
      .from("user_lifecycle_profiles")
      .select("user_id, lifecycle_stage, login_count, last_active_at");

    const profileMap: Record<string, { stage: string; loginCount: number; lastActiveAt: string | null }> = {};
    for (const p of existingProfiles ?? []) {
      profileMap[p.user_id] = { stage: p.lifecycle_stage, loginCount: p.login_count ?? 0, lastActiveAt: p.last_active_at };
    }

    const usersToProcess = targetUserId
      ? allUsers.filter((u) => u.id === targetUserId)
      : allUsers;

    // ── 2. Compute and upsert lifecycle profiles ──────────────────────────────
    const now = new Date();
    const profileUpserts: any[] = [];

    for (const user of usersToProcess) {
      try {
        const uid = user.id;
        const createdAt = user.created_at ? new Date(user.created_at) : now;
        const daysSinceSignup = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        const galleryCount = galleryCounts[uid] ?? 0;
        const imagesProcessed = imageTotals[uid] ?? 0;
        const loginCount = profileMap[uid]?.loginCount ?? 0;
        const sub = subscriptionMap[uid];
        const isPaid = sub?.isPaid ?? false;
        const subscriptionStatus = sub?.status ?? null;
        const lastActiveAt = profileMap[uid]?.lastActiveAt ? new Date(profileMap[uid].lastActiveAt!) : null;

        const score = computeScore({
          daysSinceSignup,
          galleryCount,
          imagesProcessed,
          loginCount,
          isPaid,
        });

        const stage = computeStage({
          score,
          galleryCount,
          imagesProcessed,
          loginCount,
          lastActiveAt,
          isPaid,
          subscriptionStatus,
          questionnaireCompleted: false,
        });

        const prevStage = profileMap[uid]?.stage ?? "new";
        const stageChanged = stage !== prevStage;

        profileUpserts.push({
          user_id: uid,
          lifecycle_stage: stage,
          conversion_score: score,
          days_since_signup: daysSinceSignup,
          gallery_count: galleryCount,
          images_processed: imagesProcessed,
          is_paid: isPaid,
          previous_stage: stageChanged ? prevStage : undefined,
          stage_changed_at: stageChanged ? now.toISOString() : undefined,
          last_computed_at: now.toISOString(),
          updated_at: now.toISOString(),
        });

        if (stageChanged) stats.stageChanges++;
        stats.processed++;
      } catch (err) {
        console.error(`Error processing user ${user.id}:`, err);
        stats.errors++;
      }
    }

    if (profileUpserts.length > 0) {
      const { error: upsertErr } = await adminClient
        .from("user_lifecycle_profiles")
        .upsert(profileUpserts, { onConflict: "user_id" });
      if (upsertErr) {
        console.error("Profile upsert error:", upsertErr.message);
      }
    }

    // ── 3. Auto-enroll new users in the onboarding sequence ──────────────────
    const { data: onboardingSeq } = await adminClient
      .from("email_sequences")
      .select("id")
      .eq("trigger_value", "new")
      .eq("is_active", true)
      .maybeSingle();

    if (onboardingSeq) {
      const { data: firstStep } = await adminClient
        .from("email_sequence_steps")
        .select("delay_hours")
        .eq("sequence_id", onboardingSeq.id)
        .eq("step_order", 1)
        .maybeSingle();

      const delayHours = firstStep?.delay_hours ?? 24;

      // Find users created in the last 2 days who aren't enrolled yet
      const { data: existingEnrollments } = await adminClient
        .from("user_sequence_enrollments")
        .select("user_id")
        .eq("sequence_id", onboardingSeq.id);

      const enrolledSet = new Set((existingEnrollments ?? []).map((e: any) => e.user_id));

      const enrollmentInserts: any[] = [];
      for (const user of allUsers) {
        if (enrolledSet.has(user.id)) continue;
        const createdAt = user.created_at ? new Date(user.created_at) : null;
        if (!createdAt) continue;
        // Only auto-enroll users created in the last 30 days
        const daysSinceSignup = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceSignup > 30) continue;

        const nextSendAt = new Date(createdAt.getTime() + delayHours * 60 * 60 * 1000);
        enrollmentInserts.push({
          user_id: user.id,
          sequence_id: onboardingSeq.id,
          status: "active",
          current_step: 1,
          enrolled_at: createdAt.toISOString(),
          next_send_at: nextSendAt.toISOString(),
        });
      }

      if (enrollmentInserts.length > 0) {
        const { error: enrollErr } = await adminClient
          .from("user_sequence_enrollments")
          .upsert(enrollmentInserts, {
            onConflict: "user_id,sequence_id",
            ignoreDuplicates: true,
          });
        if (enrollErr) {
          console.error("Enrollment upsert error:", enrollErr.message);
        } else {
          stats.enrolled += enrollmentInserts.length;
        }
      }
    }

    // ── 4. Process pending emails ─────────────────────────────────────────────
    const { data: pendingEnrollments } = await adminClient
      .from("user_sequence_enrollments")
      .select(
        `id, user_id, sequence_id, current_step,
         email_sequence_steps!inner(id, step_order, delay_hours, subject, body_html, email_type, condition_check)`
      )
      .eq("status", "active")
      .lte("next_send_at", now.toISOString())
      .limit(batchSize);

    for (const enrollment of pendingEnrollments ?? []) {
      try {
        const step = (enrollment as any).email_sequence_steps;
        if (!step) continue;

        // Get user email
        const { data: authUserData } = await adminClient.auth.admin.getUserById(
          enrollment.user_id
        );
        const userEmail = authUserData?.user?.email;
        const userName =
          (authUserData?.user?.user_metadata as any)?.full_name ||
          userEmail?.split("@")[0] ||
          "there";

        if (!userEmail) continue;

        // Check journey_emails preference
        const { data: prefs } = await adminClient
          .from("user_email_preferences")
          .select("journey_emails")
          .eq("user_id", enrollment.user_id)
          .maybeSingle();

        if (prefs && prefs.journey_emails === false) {
          // User unsubscribed — cancel enrollment
          await adminClient
            .from("user_sequence_enrollments")
            .update({ status: "cancelled", cancelled_at: now.toISOString() })
            .eq("id", enrollment.id);
          stats.skipped++;
          continue;
        }

        // Load user's profile data for condition checks
        const profile = profileMap[enrollment.user_id];
        const galleryCount = galleryCounts[enrollment.user_id] ?? 0;
        const imagesProcessed = imageTotals[enrollment.user_id] ?? 0;
        const sub = subscriptionMap[enrollment.user_id];
        const isPaid = sub?.isPaid ?? false;
        const lastActiveAt = profile?.lastActiveAt ? new Date(profile.lastActiveAt) : null;

        // Check if condition is met — if not, skip this step
        if (shouldSkipStep(step.condition_check, galleryCount, imagesProcessed, isPaid, lastActiveAt)) {
          // User already completed the action — advance to next step
          const { data: nextStep } = await adminClient
            .from("email_sequence_steps")
            .select("step_order, delay_hours")
            .eq("sequence_id", enrollment.sequence_id)
            .eq("step_order", enrollment.current_step + 1)
            .maybeSingle();

          if (nextStep) {
            const nextSendAt = new Date(
              now.getTime() + (nextStep.delay_hours ?? 0) * 60 * 60 * 1000
            );
            await adminClient
              .from("user_sequence_enrollments")
              .update({
                current_step: enrollment.current_step + 1,
                next_send_at: nextSendAt.toISOString(),
              })
              .eq("id", enrollment.id);
          } else {
            await adminClient
              .from("user_sequence_enrollments")
              .update({ status: "completed", completed_at: now.toISOString() })
              .eq("id", enrollment.id);
          }
          stats.skipped++;
          continue;
        }

        // Generate unsubscribe token and URL
        const unsubToken = await generateUnsubscribeToken(enrollment.user_id, serviceRoleKey);
        const unsubscribeUrl = `${studioUrl}/unsubscribe?token=${encodeURIComponent(unsubToken)}`;

        // Substitute template tokens
        const tokens: Record<string, string | number> = {
          first_name: userName,
          email: userEmail,
          gallery_count: galleryCount,
          conversion_score: profile ? 0 : 0,
          lifecycle_stage: profile?.stage ?? "",
          studio_url: studioUrl,
          unsubscribe_url: unsubscribeUrl,
        };

        const bodyHtml = substituteTokens(step.body_html, tokens);
        const subject = substituteTokens(step.subject, tokens);

        // Wrap in branded template with unsubscribe footer
        const template = journeyEmailTemplate(subject, bodyHtml, unsubscribeUrl);

        const result = await sendEmail({
          to: userEmail,
          subject: template.subject,
          html: template.html,
          emailType: step.email_type ?? "journey_email",
          userId: enrollment.user_id,
          metadata: {
            sequence_id: enrollment.sequence_id,
            step_order: enrollment.current_step,
            enrollment_id: enrollment.id,
          },
          supabaseAdmin: adminClient,
        });

        if (result.success && !result.skipped) stats.emailsSent++;

        // Advance to next step or mark complete
        const { data: nextStep } = await adminClient
          .from("email_sequence_steps")
          .select("step_order, delay_hours")
          .eq("sequence_id", enrollment.sequence_id)
          .eq("step_order", enrollment.current_step + 1)
          .maybeSingle();

        if (nextStep) {
          const nextSendAt = new Date(
            now.getTime() + (nextStep.delay_hours ?? 0) * 60 * 60 * 1000
          );
          await adminClient
            .from("user_sequence_enrollments")
            .update({
              current_step: enrollment.current_step + 1,
              next_send_at: nextSendAt.toISOString(),
            })
            .eq("id", enrollment.id);
        } else {
          await adminClient
            .from("user_sequence_enrollments")
            .update({ status: "completed", completed_at: now.toISOString() })
            .eq("id", enrollment.id);
        }
      } catch (err) {
        console.error(`Error processing enrollment ${enrollment.id}:`, err);
        stats.errors++;
      }
    }

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-journey fatal error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
