// @ts-nocheck — untyped Supabase client (no generated types in edge functions)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";
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

type ClaimedRow = {
  id: string;
  enrollment_id: string;
  lead_id: string;
  campaign_id: string;
  step_order: number;
  subject_snapshot: string;
  body_snapshot: string;
  sender_profile: "sapir" | "contact";
  is_reply: boolean;
  open_token: string;
  attempt_count: number;
};

type LeadRow = {
  id: string;
  email_normalized: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  timezone: string | null;
  country_code: string | null;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type CampaignWindow = {
  id: string;
  send_window_start: number;
  send_window_end: number;
};

const DEFAULT_TIMEZONE = "Asia/Jerusalem";
const DEFAULT_SEND_HOUR = 10;

function backoffMinutes(attemptNumber: number): number {
  return Math.min(5 * 2 ** Math.max(attemptNumber - 1, 0), 240);
}

function getZonedParts(date: Date, timezone: string): ZonedParts {
  try {
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour),
      minute: Number(map.minute),
      second: Number(map.second),
    };
  } catch {
    if (timezone === DEFAULT_TIMEZONE) {
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
      };
    }
    return getZonedParts(date, DEFAULT_TIMEZONE);
  }
}

function compareLocalParts(a: ZonedParts, b: ZonedParts): number {
  const toValue = (p: ZonedParts) =>
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return toValue(a) - toValue(b);
}

function zonedToUtc(target: ZonedParts, timezone: string): Date {
  let guess = new Date(
    Date.UTC(
      target.year,
      target.month - 1,
      target.day,
      target.hour,
      target.minute,
      target.second,
    ),
  );

  for (let i = 0; i < 4; i++) {
    const actual = getZonedParts(guess, timezone);
    const diffMs = compareLocalParts(target, actual);
    if (Math.abs(diffMs) < 1000) break;
    guess = new Date(guess.getTime() + diffMs);
  }

  return guess;
}

function addOneDay(parts: ZonedParts): ZonedParts {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  d.setUTCDate(d.getUTCDate() + 1);
  return {
    ...parts,
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function isSaturday(parts: ZonedParts): boolean {
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return weekday === 6;
}

function clampToPreferredSendTime(
  inputUtc: Date,
  timezone: string,
  windowStartHour: number,
  windowEndHour: number,
  preferredHour: number,
): Date {
  const local = getZonedParts(inputUtc, timezone);
  const safePreferred = Number.isFinite(preferredHour) ? preferredHour : DEFAULT_SEND_HOUR;
  const baseHour =
    safePreferred >= windowStartHour && safePreferred < windowEndHour ? safePreferred : windowStartHour;

  let target: ZonedParts = {
    ...local,
    hour: baseHour,
    minute: 0,
    second: 0,
  };

  if (compareLocalParts(target, local) <= 0) {
    const next = addOneDay(local);
    target = {
      ...next,
      hour: baseHour,
      minute: 0,
      second: 0,
    };
  }

  if (isSaturday(target)) {
    const next = addOneDay(target);
    target = {
      ...next,
      hour: baseHour,
      minute: 0,
      second: 0,
    };
  }

  return zonedToUtc(target, timezone);
}

function normalizeTimezone(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : DEFAULT_TIMEZONE;
}

function normalizeCountryCode(value: string | null | undefined): string {
  return value?.trim()?.toUpperCase() || "unknown";
}

function pickPreferredHour(countryCode: string, overrides: Record<string, number>): number {
  const mapped = overrides[countryCode];
  if (Number.isFinite(mapped) && mapped >= 0 && mapped <= 23) {
    return mapped;
  }
  return DEFAULT_SEND_HOUR;
}

async function loadCountrySendHours(adminClient: ReturnType<typeof createClient>) {
  const { data } = await adminClient
    .from("platform_settings")
    .select("key, value")
    .eq("key", "lead_country_send_hours")
    .maybeSingle();

  if (!data?.value) return {} as Record<string, number>;
  try {
    const parsed = JSON.parse(data.value);
    if (!parsed || typeof parsed !== "object") return {} as Record<string, number>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const hour = Number(value);
      if (!Number.isFinite(hour)) continue;
      const code = key.trim().toUpperCase();
      if (!code) continue;
      out[code] = Math.max(0, Math.min(23, hour));
    }
    return out;
  } catch {
    return {} as Record<string, number>;
  }
}

async function verifyAdmin(authHeader: string, supabaseUrl: string, anonKey: string, serviceRoleKey: string) {
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user?.id) return null;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const callerId = userData.user.id as string;
  const { data: role } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();

  return role ? { callerId } : null;
}

async function cancelLeadFutureEmails(
  adminClient: ReturnType<typeof createClient>,
  leadId: string,
  reason: string,
) {
  const now = new Date().toISOString();
  await adminClient
    .from("lead_scheduled_emails")
    .update({
      status: "cancelled",
      last_error: reason,
      updated_at: now,
    })
    .eq("lead_id", leadId)
    .in("status", ["pending", "processing", "held"]);
}

async function isLeadEmailsPaused(adminClient: ReturnType<typeof createClient>): Promise<boolean> {
  const { data } = await adminClient
    .from("platform_settings")
    .select("value")
    .eq("key", "lead_emails_paused")
    .maybeSingle();

  const raw = typeof data?.value === "string" ? data.value.trim().toLowerCase() : "";
  return raw === "true" || raw === "1" || raw === "yes";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const studioUrl = (Deno.env.get("STUDIO_URL") || "https://studio.imagick.ai").replace(/\/+$/, "");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const leadLogoUrl = await resolveLeadBrandLogoUrl(adminClient);
    const leadSignatureLogoUrl = await resolveLeadSignatureLogoUrl(adminClient);
    const authHeader = req.headers.get("Authorization") ?? "";

    let body: { trigger?: string; batchSize?: number } = {};
    try {
      body = await req.json();
    } catch {
      // empty body is valid
    }

    const isCronTrigger = body.trigger === "cron";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
    const serviceRoleAuthorized = bearerToken === serviceRoleKey;
    // For cron triggers: pg_cron runs inside Supabase infrastructure and verify_jwt is false,
    // so we trust the trigger payload. The anon key env var doesn't match the full JWT token.
    const anonKeyAuthorized = bearerToken === anonKey;

    let adminAuthorized = false;
    if (!serviceRoleAuthorized && !anonKeyAuthorized && authHeader.startsWith("Bearer ")) {
      const verified = await verifyAdmin(authHeader, supabaseUrl, anonKey, serviceRoleKey);
      adminAuthorized = !!verified;
    }

    // pg_cron sends the anon key JWT as bearer token, but the SUPABASE_ANON_KEY env var
    // contains a different (shorter) value. Since verify_jwt=false and pg_cron runs internally,
    // trust any request with trigger:"cron" that has a bearer token present.
    const cronAuthorized = isCronTrigger && !!bearerToken;

    if (isCronTrigger && !serviceRoleAuthorized && !anonKeyAuthorized && !cronAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isCronTrigger && !serviceRoleAuthorized && !adminAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const batchSize = Math.max(1, Math.min(100, Number(body.batchSize ?? 20)));
    const nowIso = new Date().toISOString();
    const staleIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    await adminClient
      .from("lead_scheduled_emails")
      .update({
        status: "pending",
        last_error: "Recovered from stale processing lock",
        updated_at: nowIso,
      })
      .eq("status", "processing")
      .lt("updated_at", staleIso);

    const paused = await isLeadEmailsPaused(adminClient);
    if (paused) {
      return new Response(
        JSON.stringify({
          success: true,
          stats: { paused: true, claimed: 0, sent: 0, failed: 0, retried: 0, cancelled: 0, skipped: 0 },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stats = {
      claimed: 0,
      sent: 0,
      failed: 0,
      retried: 0,
      cancelled: 0,
      skipped: 0,
    };

    const { data: claimedData, error: claimError } = await adminClient.rpc("claim_pending_lead_emails", {
      p_limit: batchSize,
    });

    if (claimError) {
      return new Response(JSON.stringify({ error: claimError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claimedRows = (claimedData ?? []) as ClaimedRow[];
    stats.claimed = claimedRows.length;

    if (!claimedRows.length) {
      return new Response(JSON.stringify({ success: true, stats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadIds = [...new Set(claimedRows.map((row) => row.lead_id))];
    const enrollmentIds = [...new Set(claimedRows.map((row) => row.enrollment_id))];

    const { data: leadsData } = await adminClient
      .from("lead_contacts")
      .select("id, email_normalized, first_name, last_name, status, timezone, country_code")
      .in("id", leadIds);

    const leads = (leadsData ?? []) as LeadRow[];
    const leadById = new Map<string, LeadRow>(leads.map((lead) => [lead.id, lead]));
    const emailsToCheck = [...new Set(leads.map((l) => l.email_normalized).filter(Boolean))];

    const campaignIds = [...new Set(claimedRows.map((row) => row.campaign_id))];
    const { data: campaignsData } = campaignIds.length
      ? await adminClient
          .from("lead_campaigns")
          .select("id, send_window_start, send_window_end")
          .in("id", campaignIds)
      : { data: [] as CampaignWindow[] };
    const campaignById = new Map<string, CampaignWindow>(
      (campaignsData ?? []).map((row) => [row.id, row as CampaignWindow]),
    );

    const countrySendHours = await loadCountrySendHours(adminClient);

    const registeredSet = new Set<string>();
    if (emailsToCheck.length > 0) {
      const { data: registeredRows } = await adminClient.rpc("lookup_registered_emails", {
        p_emails: emailsToCheck,
      });
      for (const row of registeredRows ?? []) {
        if (row?.email_normalized) {
          registeredSet.add(row.email_normalized);
        }
      }
    }

    const completedCandidates = new Set<string>();

    for (const row of claimedRows) {
      const lead = leadById.get(row.lead_id);
      const now = new Date();
      const nowIso = now.toISOString();

      if (!lead || !lead.email_normalized) {
        await adminClient
          .from("lead_scheduled_emails")
          .update({
            status: "cancelled",
            last_error: "Lead not found",
            updated_at: nowIso,
          })
          .eq("id", row.id);
        stats.cancelled++;
        continue;
      }

      if (registeredSet.has(lead.email_normalized)) {
        await adminClient
          .from("lead_contacts")
          .update({
            status: "already_registered",
            suppression_reason: "already_registered_detected_in_queue",
            updated_at: nowIso,
          })
          .eq("id", lead.id)
          .neq("status", "converted");

        await cancelLeadFutureEmails(adminClient, lead.id, "Lead became registered");
        await adminClient
          .from("lead_enrollments")
          .update({
            status: "cancelled",
            cancelled_at: nowIso,
            updated_at: nowIso,
          })
          .eq("lead_id", lead.id)
          .eq("status", "active");
        stats.cancelled++;
        continue;
      }

      if (lead.status !== "active") {
        await adminClient
          .from("lead_scheduled_emails")
          .update({
            status: "cancelled",
            last_error: `Lead status is ${lead.status}`,
            updated_at: nowIso,
          })
          .eq("id", row.id);

        await adminClient
          .from("lead_enrollments")
          .update({
            status: "cancelled",
            cancelled_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", row.enrollment_id)
          .eq("status", "active");

        stats.cancelled++;
        continue;
      }

      // Dedup: skip if same lead+campaign+step was already sent (prevents duplicate on retry)
      const { data: alreadySent } = await adminClient
        .from("lead_scheduled_emails")
        .select("id")
        .eq("lead_id", row.lead_id)
        .eq("campaign_id", row.campaign_id)
        .eq("step_order", row.step_order)
        .eq("status", "sent")
        .neq("id", row.id)
        .limit(1);
      if (alreadySent && alreadySent.length > 0) {
        await adminClient
          .from("lead_scheduled_emails")
          .update({
            status: "skipped",
            last_error: "Duplicate — same step already sent to this lead",
            updated_at: nowIso,
          })
          .eq("id", row.id);
        stats.skipped++;
        continue;
      }

      // Also check email_logs for a successful send to same email with same scheduled_email_id
      const { data: alreadyLogged } = await adminClient
        .from("email_logs")
        .select("id")
        .eq("recipient_email", lead.email_normalized)
        .eq("email_type", "lead_campaign")
        .eq("status", "sent")
        .contains("metadata", { scheduled_email_id: row.id })
        .limit(1);
      if (alreadyLogged && alreadyLogged.length > 0) {
        await adminClient
          .from("lead_scheduled_emails")
          .update({
            status: "skipped",
            last_error: "Duplicate — email already delivered per email_logs",
            updated_at: nowIso,
          })
          .eq("id", row.id);
        stats.skipped++;
        continue;
      }

      const leadTimezone = normalizeTimezone(lead.timezone);
      const localParts = getZonedParts(now, leadTimezone);
      if (isSaturday(localParts)) {
        const campaign = campaignById.get(row.campaign_id);
        const windowStart = campaign?.send_window_start ?? 9;
        const windowEnd = campaign?.send_window_end ?? 20;
        const preferredHour = pickPreferredHour(normalizeCountryCode(lead.country_code), countrySendHours);
        const rescheduledAt = clampToPreferredSendTime(now, leadTimezone, windowStart, windowEnd, preferredHour);

        await adminClient
          .from("lead_scheduled_emails")
          .update({
            status: "pending",
            scheduled_at: rescheduledAt.toISOString(),
            last_error: "Saturday blackout",
            updated_at: nowIso,
          })
          .eq("id", row.id);
        stats.skipped++;
        continue;
      }

      try {
        const unsubscribeUrl = `${studioUrl}/unsubscribe?token=${encodeURIComponent(row.open_token)}&kind=lead`;
        const openPixelUrl = `${supabaseUrl}/functions/v1/lead-open-track?token=${encodeURIComponent(row.open_token)}`;
        const tokenVars = normalizeLeadTokens({
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email_normalized,
          studio_url: studioUrl,
          unsubscribe_url: unsubscribeUrl,
        });
        const bodyCore = substituteLeadTokens(row.body_snapshot, tokenVars);

        const subject = renderLeadSubject(row.subject_snapshot, tokenVars, row.is_reply);
        const sender = resolveLeadSender(row.sender_profile);
        const bodyHtml = renderLeadCampaignEmail({
          senderProfile: row.sender_profile,
          subject,
          bodyHtml: bodyCore,
          unsubscribeUrl,
          studioUrl,
          logoUrl: leadLogoUrl,
          signatureLogoUrl: leadSignatureLogoUrl,
          openPixelUrl,
        });

        const result = await sendEmail({
          to: lead.email_normalized,
          subject,
          html: bodyHtml,
          emailType: "lead_campaign",
          metadata: {
            lead_id: lead.id,
            campaign_id: row.campaign_id,
            scheduled_email_id: row.id,
            sender_profile: row.sender_profile,
            step_order: row.step_order,
            enrollment_id: row.enrollment_id,
          },
          fromEmail: sender.fromEmail,
          fromName: sender.fromName,
          replyTo: sender.replyTo,
          supabaseAdmin: adminClient,
        });

        if (result.success && !result.skipped) {
          await adminClient
            .from("lead_scheduled_emails")
            .update({
              status: "sent",
              sent_at: nowIso,
              attempt_count: (row.attempt_count ?? 0) + 1,
              resend_message_id: result.messageId ?? null,
              last_error: null,
              updated_at: nowIso,
            })
            .eq("id", row.id);

          await adminClient
            .from("lead_enrollments")
            .update({
              last_sent_step: row.step_order,
              updated_at: nowIso,
            })
            .eq("id", row.enrollment_id)
            .eq("status", "active");

          completedCandidates.add(row.enrollment_id);
          stats.sent++;
          continue;
        }

        if (result.skipped) {
          await adminClient
            .from("lead_scheduled_emails")
            .update({
              status: "skipped",
              attempt_count: (row.attempt_count ?? 0) + 1,
              last_error: "Skipped by sender",
              updated_at: nowIso,
            })
            .eq("id", row.id);
          completedCandidates.add(row.enrollment_id);
          stats.skipped++;
          continue;
        }

        const nextAttempt = (row.attempt_count ?? 0) + 1;
        if (nextAttempt >= 4) {
          await adminClient
            .from("lead_scheduled_emails")
            .update({
              status: "failed",
              attempt_count: nextAttempt,
              last_error: result.error ?? "Send failed",
              updated_at: nowIso,
            })
            .eq("id", row.id);
          completedCandidates.add(row.enrollment_id);
          stats.failed++;
        } else {
          const backoff = backoffMinutes(nextAttempt);
          const retryAt = new Date(Date.now() + backoff * 60 * 1000).toISOString();
          await adminClient
            .from("lead_scheduled_emails")
            .update({
              status: "pending",
              attempt_count: nextAttempt,
              last_error: result.error ?? "Send failed, retry scheduled",
              scheduled_at: retryAt,
              updated_at: nowIso,
            })
            .eq("id", row.id);
          stats.retried++;
        }
      } catch (err) {
        const nextAttempt = (row.attempt_count ?? 0) + 1;
        const nowError = new Date().toISOString();
        if (nextAttempt >= 4) {
          await adminClient
            .from("lead_scheduled_emails")
            .update({
              status: "failed",
              attempt_count: nextAttempt,
              last_error: err instanceof Error ? err.message : String(err),
              updated_at: nowError,
            })
            .eq("id", row.id);
          completedCandidates.add(row.enrollment_id);
          stats.failed++;
        } else {
          const retryAt = new Date(Date.now() + backoffMinutes(nextAttempt) * 60 * 1000).toISOString();
          await adminClient
            .from("lead_scheduled_emails")
            .update({
              status: "pending",
              attempt_count: nextAttempt,
              last_error: err instanceof Error ? err.message : String(err),
              scheduled_at: retryAt,
              updated_at: nowError,
            })
            .eq("id", row.id);
          stats.retried++;
        }
      }
    }

    if (completedCandidates.size > 0) {
      const candidateIds = [...completedCandidates];
      const { data: pendingRows } = await adminClient
        .from("lead_scheduled_emails")
        .select("enrollment_id")
        .in("enrollment_id", candidateIds)
        .in("status", ["pending", "processing"]);

      const blocked = new Set((pendingRows ?? []).map((row: { enrollment_id: string }) => row.enrollment_id));
      const toComplete = candidateIds.filter((id) => !blocked.has(id));

      if (toComplete.length > 0) {
        await adminClient
          .from("lead_enrollments")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .in("id", toComplete)
          .eq("status", "active");
      }
    }

    const { data: failedRows } = await adminClient
      .from("lead_scheduled_emails")
      .select("enrollment_id")
      .in("enrollment_id", enrollmentIds)
      .eq("status", "failed");

    const failedEnrollmentIds = [
      ...new Set((failedRows ?? []).map((row: { enrollment_id: string }) => row.enrollment_id)),
    ];
    if (failedEnrollmentIds.length > 0) {
      await adminClient
        .from("lead_enrollments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", failedEnrollmentIds)
        .eq("status", "active");
    }

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-lead-email-queue error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
