// @ts-nocheck — untyped Supabase client (no generated types in edge functions)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  clampToPreferredSendTime,
  DEFAULT_TIMEZONE,
  loadCountrySendHours,
  normalizeCountryCode,
  normalizeTimezone,
  pickPreferredHour,
} from "../_shared/lead-scheduling-utils.ts";

type LeadStatus = "active" | "converted" | "unsubscribed" | "suppressed" | "already_registered";
type EnrollmentStatus = "active" | "completed" | "cancelled" | "converted";
type StageKind =
  | "pending"
  | "processing"
  | "held"
  | "completed"
  | "cancelled"
  | "converted"
  | "unsubscribed"
  | "suppressed"
  | "already_registered"
  | "none";

interface ListLeadsFilters {
  status?: string;
  search?: string;
  importJobId?: string;
  dateFrom?: string;
  dateTo?: string;
  enrolled?: string; // "enrolled" | "not_enrolled"
  opens?: string; // "never_opened" | "opened"
}

interface ListLeadsPayload {
  action: "listLeads";
  page?: number;
  pageSize?: number;
  filters?: ListLeadsFilters;
}

interface GetLeadTimelinePayload {
  action: "getLeadTimeline";
  leadId?: string;
}

interface ListImportJobRowsPayload {
  action: "listImportJobRows";
  jobId?: string;
  page?: number;
  pageSize?: number;
}

interface DeleteLeadPayload {
  action: "deleteLead";
  leadId?: string;
}

interface GetLeadAnalyticsPayload {
  action: "getLeadAnalytics";
  dateFrom?: string;
  dateTo?: string;
  campaignId?: string;
}

interface ListLeadIdsPayload {
  action: "listLeadIds";
  limit?: number;
  filters?: ListLeadsFilters;
}

interface ReleaseLeadsPayload {
  action: "releaseLeads";
  leadIds: string[];
  campaignId?: string;
  label?: string;
}

interface ListReleasesPayload {
  action: "listReleases";
  page?: number;
  pageSize?: number;
}

interface GetReleaseDetailPayload {
  action: "getReleaseDetail";
  releaseId: string;
  page?: number;
  pageSize?: number;
}

type Payload =
  | ListLeadsPayload
  | ListLeadIdsPayload
  | GetLeadTimelinePayload
  | ListImportJobRowsPayload
  | DeleteLeadPayload
  | GetLeadAnalyticsPayload
  | ReleaseLeadsPayload
  | ListReleasesPayload
  | GetReleaseDetailPayload;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function startOfDayIso(dateStr: string) {
  return `${dateStr}T00:00:00.000Z`;
}

function endOfDayIso(dateStr: string) {
  return `${dateStr}T23:59:59.999Z`;
}

async function verifyAdmin(authHeader: string, supabaseUrl: string, anonKey: string, serviceRoleKey: string) {
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user?.id) return null;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const callerId = userData.user.id;
  const { data: role } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();

  if (!role) return null;
  return { adminClient, callerId };
}

function stageFromLeadState(params: {
  leadStatus: LeadStatus;
  enrollmentStatus?: EnrollmentStatus | null;
  nextPendingStep?: number | null;
  nextHeldStep?: number | null;
  hasProcessing: boolean;
}): { kind: StageKind; label: string; stepOrder: number | null } {
  if (params.leadStatus === "converted") return { kind: "converted", label: "Converted", stepOrder: null };
  if (params.leadStatus === "unsubscribed") return { kind: "unsubscribed", label: "Unsubscribed", stepOrder: null };
  if (params.leadStatus === "suppressed") return { kind: "suppressed", label: "Suppressed", stepOrder: null };
  if (params.leadStatus === "already_registered") {
    return { kind: "already_registered", label: "Already registered", stepOrder: null };
  }

  if (params.nextPendingStep != null) {
    return {
      kind: "pending",
      label: `Step ${params.nextPendingStep} pending`,
      stepOrder: params.nextPendingStep,
    };
  }

  if (params.hasProcessing) {
    return { kind: "processing", label: "Processing", stepOrder: null };
  }

  if (params.nextHeldStep != null) {
    return {
      kind: "held",
      label: `Step ${params.nextHeldStep} held`,
      stepOrder: params.nextHeldStep,
    };
  }

  if (params.enrollmentStatus === "completed") return { kind: "completed", label: "Completed", stepOrder: null };
  if (params.enrollmentStatus === "cancelled") return { kind: "cancelled", label: "Cancelled", stepOrder: null };
  if (params.enrollmentStatus === "converted") return { kind: "converted", label: "Converted", stepOrder: null };
  if (params.enrollmentStatus === "active") return { kind: "completed", label: "Completed", stepOrder: null };

  return { kind: "none", label: "Not enrolled", stepOrder: null };
}

async function fetchLeadIdsWithOpens(adminClient: any): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 0;
  while (true) {
    const { data: batch } = await adminClient
      .from("lead_scheduled_emails")
      .select("lead_id, opened_count")
      .gt("opened_count", 0)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!batch || batch.length === 0) break;
    for (const r of batch) if (r.lead_id) ids.add(r.lead_id);
    if (batch.length < 1000) break;
    page++;
  }
  return ids;
}

async function handleListLeads(
  adminClient: ReturnType<typeof createClient>,
  payload: ListLeadsPayload,
) {
  const page = clamp(Number(payload.page ?? 0), 0, 100000);
  const pageSize = clamp(Number(payload.pageSize ?? 25), 1, 100);
  const filters = payload.filters ?? {};
  const search = filters.search?.trim() ?? "";

  let query = adminClient
    .from("lead_contacts")
    .select(
      "id, email_raw, email_normalized, first_name, last_name, source, status, suppression_reason, unsubscribed_at, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (search) {
    const escaped = search.replace(/[%_]/g, "");
    query = query.or(
      `email_raw.ilike.%${escaped}%,email_normalized.ilike.%${escaped}%,first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%`,
    );
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", startOfDayIso(filters.dateFrom));
  }
  if (filters.dateTo) {
    query = query.lte("created_at", endOfDayIso(filters.dateTo));
  }

  if (filters.enrolled === "not_enrolled" || filters.enrolled === "enrolled") {
    const allEnrolled: string[] = [];
    let enrollPage = 0;
    while (true) {
      const { data: batch } = await adminClient
        .from("lead_enrollments")
        .select("lead_id")
        .eq("status", "active")
        .range(enrollPage * 1000, (enrollPage + 1) * 1000 - 1);
      if (!batch || batch.length === 0) break;
      allEnrolled.push(...batch.map((r) => r.lead_id).filter(Boolean));
      if (batch.length < 1000) break;
      enrollPage++;
    }
    const enrolledIds = [...new Set(allEnrolled)] as string[];
    if (filters.enrolled === "enrolled") {
      if (!enrolledIds.length) {
        return json({ success: true, data: { leads: [], total: 0, page, pageSize } });
      }
      query = query.in("id", enrolledIds);
    } else if (enrolledIds.length) {
      // "not_enrolled": use PostgREST not.in filter
      query = query.filter("id", "not.in", `(${enrolledIds.join(",")})`);
    }
  }

  if (filters.importJobId) {
    const { data: jobRows, error: rowsError } = await adminClient
      .from("lead_import_job_rows")
      .select("lead_id")
      .eq("import_job_id", filters.importJobId)
      .not("lead_id", "is", null);
    if (rowsError) {
      return json({ error: rowsError.message }, 500);
    }
    const leadIds = [...new Set((jobRows ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
    if (!leadIds.length) {
      return json({
        success: true,
        data: {
          leads: [],
          total: 0,
          page,
          pageSize,
        },
      });
    }
    query = query.in("id", leadIds);
  }

  if (filters.opens === "never_opened" || filters.opens === "opened") {
    const openedLeadIds = await fetchLeadIdsWithOpens(adminClient);
    const openedArr = [...openedLeadIds];
    if (filters.opens === "opened") {
      if (!openedArr.length) return json({ success: true, data: { leads: [], total: 0, page, pageSize } });
      query = query.in("id", openedArr);
    } else if (openedArr.length) {
      query = query.filter("id", "not.in", `(${openedArr.join(",")})`);
    }
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data: leadsRaw, error, count } = await query.range(from, to);

  if (error) return json({ error: error.message }, 500);

  const leads = leadsRaw ?? [];
  const leadIds = leads.map((lead) => lead.id);

  if (!leadIds.length) {
    return json({
      success: true,
      data: {
        leads: [],
        total: count ?? 0,
        page,
        pageSize,
      },
    });
  }

  const [importRowsRes, enrollmentsRes, scheduledRes] = await Promise.all([
    adminClient
      .from("lead_import_job_rows")
      .select("id, import_job_id, lead_id, result, reason, row_number, created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: true }),
    adminClient
      .from("lead_enrollments")
      .select("id, lead_id, campaign_id, status, enrolled_at, updated_at")
      .in("lead_id", leadIds)
      .order("enrolled_at", { ascending: false }),
    adminClient
      .from("lead_scheduled_emails")
      .select("id, lead_id, step_order, status, scheduled_at, sent_at, opened_count")
      .in("lead_id", leadIds)
      .order("scheduled_at", { ascending: true }),
  ]);

  if (importRowsRes.error) return json({ error: importRowsRes.error.message }, 500);
  if (enrollmentsRes.error) return json({ error: enrollmentsRes.error.message }, 500);
  if (scheduledRes.error) return json({ error: scheduledRes.error.message }, 500);

  const importRows = importRowsRes.data ?? [];
  const importJobIds = [...new Set(importRows.map((row) => row.import_job_id).filter(Boolean))] as string[];
  const { data: importJobs, error: jobsError } = importJobIds.length
    ? await adminClient
        .from("lead_import_jobs")
        .select("id, file_name, source, created_at")
        .in("id", importJobIds)
    : { data: [], error: null };

  if (jobsError) return json({ error: jobsError.message }, 500);
  const jobsById = new Map((importJobs ?? []).map((job) => [job.id, job]));

  const firstImportEventByLead = new Map<string, (typeof importRows)[number]>();
  for (const row of importRows) {
    if (!row.lead_id) continue;
    if (!firstImportEventByLead.has(row.lead_id)) {
      firstImportEventByLead.set(row.lead_id, row);
    }
  }

  const enrollmentsByLead = new Map<string, (typeof enrollmentsRes.data)[number]>();
  for (const enrollment of enrollmentsRes.data ?? []) {
    if (!enrollmentsByLead.has(enrollment.lead_id)) {
      enrollmentsByLead.set(enrollment.lead_id, enrollment);
    }
  }

  const scheduledByLead = new Map<string, (typeof scheduledRes.data)>();
  for (const row of scheduledRes.data ?? []) {
    const existing = scheduledByLead.get(row.lead_id) ?? [];
    existing.push(row);
    scheduledByLead.set(row.lead_id, existing);
  }

  const enriched = leads.map((lead) => {
    const leadImport = firstImportEventByLead.get(lead.id);
    const importJob = leadImport ? jobsById.get(leadImport.import_job_id) : null;
    const enrollment = enrollmentsByLead.get(lead.id);
    const scheduledRows = scheduledByLead.get(lead.id) ?? [];

    let nextPending: (typeof scheduledRows)[number] | null = null;
    let nextHeld: (typeof scheduledRows)[number] | null = null;
    let lastSent: (typeof scheduledRows)[number] | null = null;
    let openedCount = 0;
    let hasProcessing = false;

    for (const row of scheduledRows) {
      openedCount += row.opened_count ?? 0;
      if (row.status === "processing") hasProcessing = true;
      if (row.status === "pending" && !nextPending) nextPending = row;
      if (row.status === "held" && !nextHeld) nextHeld = row;
      if (row.sent_at) {
        if (!lastSent || new Date(row.sent_at).getTime() > new Date(lastSent.sent_at || 0).getTime()) {
          lastSent = row;
        }
      }
    }

    const stage = stageFromLeadState({
      leadStatus: lead.status as LeadStatus,
      enrollmentStatus: (enrollment?.status as EnrollmentStatus | undefined) ?? null,
      nextPendingStep: nextPending?.step_order ?? null,
      nextHeldStep: nextHeld?.step_order ?? null,
      hasProcessing,
    });

    return {
      id: lead.id,
      email_raw: lead.email_raw,
      email_normalized: lead.email_normalized,
      first_name: lead.first_name,
      last_name: lead.last_name,
      source: lead.source,
      status: lead.status,
      suppression_reason: lead.suppression_reason,
      unsubscribed_at: lead.unsubscribed_at,
      created_at: lead.created_at,
      import_job_id: leadImport?.import_job_id ?? null,
      import_file_name: importJob?.file_name ?? null,
      import_source: importJob?.source ?? null,
      imported_at: leadImport?.created_at ?? null,
      current_stage_kind: stage.kind,
      current_stage_label: stage.label,
      current_stage_step: stage.stepOrder,
      next_scheduled_at: nextPending?.scheduled_at ?? null,
      last_sent_at: lastSent?.sent_at ?? null,
      opened_count: openedCount,
    };
  });

  return json({
    success: true,
    data: {
      leads: enriched,
      total: count ?? 0,
      page,
      pageSize,
    },
  });
}

async function handleListLeadIds(
  adminClient: ReturnType<typeof createClient>,
  payload: ListLeadIdsPayload,
) {
  const maxLimit = 5000;
  const limit = clamp(Number(payload.limit ?? 400), 1, maxLimit);
  const filters = payload.filters ?? {};
  const search = filters.search?.trim() ?? "";

  let query = adminClient
    .from("lead_contacts")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (search) {
    const escaped = search.replace(/[%_]/g, "");
    query = query.or(
      `email_raw.ilike.%${escaped}%,email_normalized.ilike.%${escaped}%,first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%`,
    );
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", startOfDayIso(filters.dateFrom));
  }
  if (filters.dateTo) {
    query = query.lte("created_at", endOfDayIso(filters.dateTo));
  }

  if (filters.enrolled === "not_enrolled" || filters.enrolled === "enrolled") {
    const allEnrolled: string[] = [];
    let ep = 0;
    while (true) {
      const { data: batch } = await adminClient
        .from("lead_enrollments")
        .select("lead_id")
        .eq("status", "active")
        .range(ep * 1000, (ep + 1) * 1000 - 1);
      if (!batch || batch.length === 0) break;
      allEnrolled.push(...batch.map((r) => r.lead_id).filter(Boolean));
      if (batch.length < 1000) break;
      ep++;
    }
    const enrolledIds = [...new Set(allEnrolled)] as string[];
    if (filters.enrolled === "enrolled") {
      if (!enrolledIds.length) return json({ success: true, data: { ids: [], total: 0 } });
      query = query.in("id", enrolledIds);
    } else if (enrolledIds.length) {
      query = query.filter("id", "not.in", `(${enrolledIds.join(",")})`);
    }
  }

  if (filters.importJobId) {
    const { data: jobRows, error: rowsError } = await adminClient
      .from("lead_import_job_rows")
      .select("lead_id")
      .eq("import_job_id", filters.importJobId)
      .not("lead_id", "is", null);
    if (rowsError) return json({ error: rowsError.message }, 500);
    const leadIds = [...new Set((jobRows ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
    if (!leadIds.length) return json({ success: true, data: { ids: [], total: 0 } });
    query = query.in("id", leadIds);
  }

  if (filters.opens === "never_opened" || filters.opens === "opened") {
    const openedLeadIds = await fetchLeadIdsWithOpens(adminClient);
    const openedArr = [...openedLeadIds];
    if (filters.opens === "opened") {
      if (!openedArr.length) return json({ success: true, data: { ids: [], total: 0 } });
      query = query.in("id", openedArr);
    } else if (openedArr.length) {
      query = query.filter("id", "not.in", `(${openedArr.join(",")})`);
    }
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  return json({
    success: true,
    data: {
      ids: (data ?? []).map((r) => r.id),
      total: (data ?? []).length,
    },
  });
}

async function handleGetLeadTimeline(
  adminClient: ReturnType<typeof createClient>,
  payload: GetLeadTimelinePayload,
) {
  const leadId = payload.leadId;
  if (!leadId) return json({ error: "leadId is required" }, 400);

  const { data: lead, error: leadError } = await adminClient
    .from("lead_contacts")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) return json({ error: leadError.message }, 500);
  if (!lead) return json({ error: "Lead not found" }, 404);

  const [importEventsRes, enrollmentsRes, scheduledRes, opensRes] = await Promise.all([
    adminClient
      .from("lead_import_job_rows")
      .select("id, import_job_id, row_number, email_raw, email_normalized, result, reason, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true }),
    adminClient
      .from("lead_enrollments")
      .select("id, lead_id, campaign_id, status, enrolled_at, last_sent_step, cancelled_at, completed_at, updated_at")
      .eq("lead_id", leadId)
      .order("enrolled_at", { ascending: false }),
    adminClient
      .from("lead_scheduled_emails")
      .select(
        "id, enrollment_id, lead_id, campaign_id, campaign_step_id, step_order, subject_snapshot, sender_profile, is_reply, scheduled_at, status, sent_at, attempt_count, last_error, resend_message_id, opened_count, opened_first_at, created_at",
      )
      .eq("lead_id", leadId)
      .order("step_order", { ascending: true }),
    adminClient
      .from("lead_email_opens")
      .select("id, scheduled_email_id, opened_at, ip_address, user_agent, device_type")
      .eq("lead_id", leadId)
      .order("opened_at", { ascending: false })
      .limit(500),
  ]);

  if (importEventsRes.error) return json({ error: importEventsRes.error.message }, 500);
  if (enrollmentsRes.error) return json({ error: enrollmentsRes.error.message }, 500);
  if (scheduledRes.error) return json({ error: scheduledRes.error.message }, 500);
  if (opensRes.error) return json({ error: opensRes.error.message }, 500);

  const importEvents = importEventsRes.data ?? [];
  const importJobIds = [...new Set(importEvents.map((event) => event.import_job_id).filter(Boolean))] as string[];
  const { data: importJobs } = importJobIds.length
    ? await adminClient
        .from("lead_import_jobs")
        .select("id, file_name, source, created_at")
        .in("id", importJobIds)
    : { data: [] as { id: string; file_name: string | null; source: string; created_at: string }[] };
  const importJobsById = new Map((importJobs ?? []).map((job) => [job.id, job]));

  const enrollments = enrollmentsRes.data ?? [];
  const campaignIds = [...new Set(enrollments.map((item) => item.campaign_id).filter(Boolean))] as string[];
  const { data: campaigns } = campaignIds.length
    ? await adminClient.from("lead_campaigns").select("id, name").in("id", campaignIds)
    : { data: [] as { id: string; name: string }[] };
  const campaignById = new Map((campaigns ?? []).map((campaign) => [campaign.id, campaign]));

  const scheduledEmails = scheduledRes.data ?? [];

  const { data: emailLogs } = await adminClient
    .from("email_logs")
    .select("id, email_type, subject, status, resend_message_id, error_message, created_at, metadata")
    .contains("metadata", { lead_id: leadId })
    .order("created_at", { ascending: false })
    .limit(500);

  return json({
    success: true,
    data: {
      lead,
      importEvents: importEvents.map((event) => ({
        ...event,
        job: importJobsById.get(event.import_job_id) ?? null,
      })),
      enrollments: enrollments.map((item) => ({
        ...item,
        campaign_name: campaignById.get(item.campaign_id)?.name ?? null,
      })),
      scheduledEmails,
      openEvents: opensRes.data ?? [],
      emailLogs: emailLogs ?? [],
    },
  });
}

async function handleListImportJobRows(
  adminClient: ReturnType<typeof createClient>,
  payload: ListImportJobRowsPayload,
) {
  const jobId = payload.jobId;
  if (!jobId) return json({ error: "jobId is required" }, 400);

  const page = clamp(Number(payload.page ?? 0), 0, 100000);
  const pageSize = clamp(Number(payload.pageSize ?? 100), 1, 500);
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data: rows, error, count } = await adminClient
    .from("lead_import_job_rows")
    .select(
      "id, import_job_id, row_number, email_raw, email_normalized, first_name, last_name, lead_id, result, reason, created_at",
      { count: "exact" },
    )
    .eq("import_job_id", jobId)
    .order("row_number", { ascending: true })
    .range(from, to);

  if (error) return json({ error: error.message }, 500);

  const leadIds = [...new Set((rows ?? []).map((row) => row.lead_id).filter(Boolean))] as string[];
  const { data: leads } = leadIds.length
    ? await adminClient
        .from("lead_contacts")
        .select("id, email_raw, email_normalized, status, unsubscribed_at, suppression_reason")
        .in("id", leadIds)
    : {
        data: [] as {
          id: string;
          email_raw: string;
          email_normalized: string;
          status: string;
          unsubscribed_at: string | null;
          suppression_reason: string | null;
        }[],
      };

  const leadById = new Map((leads ?? []).map((lead) => [lead.id, lead]));

  return json({
    success: true,
    data: {
      rows: (rows ?? []).map((row) => ({
        ...row,
        lead: row.lead_id ? leadById.get(row.lead_id) ?? null : null,
      })),
      total: count ?? 0,
      page,
      pageSize,
    },
  });
}

async function handleGetLeadAnalytics(
  adminClient: ReturnType<typeof createClient>,
  payload: GetLeadAnalyticsPayload,
) {
  // Paginate to avoid Supabase 1000-row default limit
  const rows: any[] = [];
  let page = 0;
  const batchSize = 1000;
  while (true) {
    let q = adminClient
      .from("lead_scheduled_emails")
      .select("id, lead_id, step_order, variant, sent_at, opened_first_at, campaign_id")
      .not("sent_at", "is", null);
    if (payload.dateFrom) q = q.gte("sent_at", startOfDayIso(payload.dateFrom));
    if (payload.dateTo) q = q.lte("sent_at", endOfDayIso(payload.dateTo));
    if (payload.campaignId) q = q.eq("campaign_id", payload.campaignId);
    const { data, error } = await q.range(page * batchSize, (page + 1) * batchSize - 1);
    if (error) return json({ error: error.message }, 500);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < batchSize) break;
    page++;
  }
  const breakdown = new Map<
    string,
    { step_order: number; variant: string; sent: number; opens: number; conversions: number }
  >();

  const sentByLead = new Map<
    string,
    Array<{ sent_at: string; step_order: number; variant: string }>
  >();

  let totalSent = 0;
  let totalOpens = 0;

  for (const row of rows) {
    const variant = (row.variant || "A") as string;
    const key = `${row.step_order}:${variant}`;
    const entry =
      breakdown.get(key) ??
      { step_order: row.step_order, variant, sent: 0, opens: 0, conversions: 0 };
    entry.sent += 1;
    if (row.opened_first_at) {
      entry.opens += 1;
      totalOpens += 1;
    }
    breakdown.set(key, entry);
    totalSent += 1;

    if (!row.lead_id || !row.sent_at) continue;
    const list = sentByLead.get(row.lead_id) ?? [];
    list.push({ sent_at: row.sent_at, step_order: row.step_order, variant });
    sentByLead.set(row.lead_id, list);
  }

  // Paginate conversions query
  const convertedRows: any[] = [];
  let convPage = 0;
  while (true) {
    let q = adminClient
      .from("lead_contacts")
      .select("id, converted_at")
      .not("converted_at", "is", null);
    if (payload.dateFrom) q = q.gte("converted_at", startOfDayIso(payload.dateFrom));
    if (payload.dateTo) q = q.lte("converted_at", endOfDayIso(payload.dateTo));
    const { data, error } = await q.range(convPage * batchSize, (convPage + 1) * batchSize - 1);
    if (error) return json({ error: error.message }, 500);
    if (!data || data.length === 0) break;
    convertedRows.push(...data);
    if (data.length < batchSize) break;
    convPage++;
  }

  let totalConversions = 0;
  for (const lead of convertedRows ?? []) {
    if (!lead.id || !lead.converted_at) continue;
    const list = sentByLead.get(lead.id);
    if (!list || list.length === 0) continue;

    list.sort((a, b) => a.sent_at.localeCompare(b.sent_at));
    const convertedAtMs = Date.parse(lead.converted_at);
    if (!Number.isFinite(convertedAtMs)) continue;

    let attributed: { sent_at: string; step_order: number; variant: string } | null = null;
    for (let i = list.length - 1; i >= 0; i--) {
      const sentAtMs = Date.parse(list[i].sent_at);
      if (!Number.isFinite(sentAtMs)) continue;
      if (sentAtMs <= convertedAtMs) {
        attributed = list[i];
        break;
      }
    }

    if (!attributed) continue;
    const key = `${attributed.step_order}:${attributed.variant}`;
    const entry = breakdown.get(key);
    if (entry) {
      entry.conversions += 1;
      breakdown.set(key, entry);
    }
    totalConversions += 1;
  }

  const breakdownRows = [...breakdown.values()]
    .map((row) => ({
      ...row,
      open_rate: row.sent ? row.opens / row.sent : 0,
      conversion_rate: row.sent ? row.conversions / row.sent : 0,
    }))
    .sort((a, b) =>
      a.step_order === b.step_order ? a.variant.localeCompare(b.variant) : a.step_order - b.step_order,
    );

  return json({
    success: true,
    data: {
      overall: {
        sent: totalSent,
        opens: totalOpens,
        open_rate: totalSent ? totalOpens / totalSent : 0,
        conversions: totalConversions,
        conversion_rate: totalSent ? totalConversions / totalSent : 0,
      },
      breakdown: breakdownRows,
    },
  });
}

async function fetchAllPages(
  adminClient: any,
  table: string,
  column: string,
  value: string,
  selectCols: string,
  batchSize = 1000,
) {
  const allRows: Record<string, unknown>[] = [];
  let page = 0;
  while (true) {
    const from = page * batchSize;
    const to = from + batchSize - 1;
    const { data, error } = await adminClient
      .from(table)
      .select(selectCols)
      .eq(column, value)
      .range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < batchSize) break;
    page++;
  }
  return allRows;
}

async function handleDeleteImportJob(
  adminClient: any,
  payload: { action: string; jobId?: string },
) {
  const jobId = payload.jobId;
  if (!jobId) return json({ error: "jobId is required" }, 400);

  const { data: job, error: jobError } = await adminClient
    .from("lead_import_jobs")
    .select("id, file_name")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) return json({ error: jobError.message }, 500);
  if (!job) return json({ error: "Import job not found" }, 404);

  // Fetch all job rows with pagination to get lead IDs
  const allJobRows = await fetchAllPages(adminClient, "lead_import_job_rows", "import_job_id", jobId, "lead_id, result");
  const leadIds = [...new Set(
    allJobRows
      .filter((r) => r.lead_id)
      .map((r) => r.lead_id as string)
  )];

  // Detach job rows from leads first (FK constraint: lead_import_job_rows.lead_id → lead_contacts.id)
  let deletedRows = 0;
  while (true) {
    const { data: batch } = await adminClient
      .from("lead_import_job_rows")
      .select("id")
      .eq("import_job_id", jobId)
      .limit(1000);
    if (!batch || batch.length === 0) break;
    const ids = batch.map((r: { id: string }) => r.id);
    const { error: delErr } = await adminClient.from("lead_import_job_rows").delete().in("id", ids);
    if (delErr) return json({ error: delErr.message }, 500);
    deletedRows += ids.length;
    if (batch.length < 1000) break;
  }

  let deletedLeads = 0;

  // Delete related data for each lead in chunks of 500
  const CHUNK = 500;
  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const chunk = leadIds.slice(i, i + CHUNK);

    // Delete open events
    const { error: e1 } = await adminClient.from("lead_email_opens").delete().in("lead_id", chunk);
    if (e1) return json({ error: e1.message }, 500);

    // Delete scheduled emails
    const { error: e2 } = await adminClient.from("lead_scheduled_emails").delete().in("lead_id", chunk);
    if (e2) return json({ error: e2.message }, 500);

    // Delete enrollments
    const { error: e3 } = await adminClient.from("lead_enrollments").delete().in("lead_id", chunk);
    if (e3) return json({ error: e3.message }, 500);

    // Delete lead contacts
    const { error: e4 } = await adminClient.from("lead_contacts").delete().in("id", chunk);
    if (e4) return json({ error: e4.message }, 500);

    deletedLeads += chunk.length;
  }

  // Delete the job itself
  const { error: jobDelError } = await adminClient.from("lead_import_jobs").delete().eq("id", jobId);
  if (jobDelError) return json({ error: jobDelError.message }, 500);

  return json({
    success: true,
    data: {
      jobId,
      fileName: job.file_name,
      deletedLeads,
      deletedRows,
    },
  });
}

async function handleReleaseImportJob(
  adminClient: any,
  payload: { action: string; jobId?: string; limit?: number },
) {
  const jobId = payload.jobId;
  if (!jobId) return json({ error: "jobId is required" }, 400);

  // limit = max number of LEADS to release (0 or undefined = all)
  const leadLimit = Number(payload.limit) > 0 ? Number(payload.limit) : 0;

  const { data: job, error: jobError } = await adminClient
    .from("lead_import_jobs")
    .select("id, selected_campaign_id")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) return json({ error: jobError.message }, 500);
  if (!job) return json({ error: "Import job not found" }, 404);
  if (!job.selected_campaign_id) return json({ error: "No campaign linked to this import job" }, 400);

  const { data: campaign, error: campaignError } = await adminClient
    .from("lead_campaigns")
    .select("id, timezone, send_window_start, send_window_end")
    .eq("id", job.selected_campaign_id)
    .maybeSingle();
  if (campaignError) return json({ error: campaignError.message }, 500);
  if (!campaign) return json({ error: "Campaign not found" }, 404);

  const { data: stepsData, error: stepsError } = await adminClient
    .from("lead_campaign_steps")
    .select("id, step_order, delay_hours")
    .eq("campaign_id", campaign.id)
    .order("step_order", { ascending: true });
  if (stepsError) return json({ error: stepsError.message }, 500);

  const steps = stepsData ?? [];
  const cumulativeDelayByStepId = new Map<string, number>();
  let cumulative = 0;
  for (const step of steps) {
    cumulative += step.delay_hours;
    cumulativeDelayByStepId.set(step.id, cumulative);
  }

  const countrySendHours = await loadCountrySendHours(adminClient);

  const allJobRows = await fetchAllPages(adminClient, "lead_import_job_rows", "import_job_id", jobId, "lead_id, result");
  let leadIds = [...new Set(
    allJobRows
      .filter((r) => r.lead_id)
      .map((r) => r.lead_id as string)
  )];

  if (!leadIds.length) {
    return json({ success: true, data: { jobId, releasedEmails: 0, releasedLeads: 0, remainingHeldLeads: 0 } });
  }

  // Find which leads actually have held emails, then apply the limit
  const CHUNK = 500;
  const leadsWithHeld: string[] = [];

  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const chunk = leadIds.slice(i, i + CHUNK);
    const { data: heldLeadRows } = await adminClient
      .from("lead_scheduled_emails")
      .select("lead_id")
      .in("lead_id", chunk)
      .eq("status", "held");

    const uniqueInChunk = [...new Set((heldLeadRows ?? []).map((r: any) => r.lead_id as string))];
    leadsWithHeld.push(...uniqueInChunk);
  }

  const totalHeldLeads = leadsWithHeld.length;
  const leadsToRelease = leadLimit > 0 ? leadsWithHeld.slice(0, leadLimit) : leadsWithHeld;
  const remainingHeldLeads = totalHeldLeads - leadsToRelease.length;

  if (!leadsToRelease.length) {
    return json({ success: true, data: { jobId, releasedEmails: 0, releasedLeads: 0, remainingHeldLeads: 0 } });
  }

  let releasedEmails = 0;
  let releasedLeads = 0;
  const now = new Date();

  for (let i = 0; i < leadsToRelease.length; i += CHUNK) {
    const chunk = leadsToRelease.slice(i, i + CHUNK);

    const { data: enrollments } = await adminClient
      .from("lead_enrollments")
      .select("id, lead_id")
      .eq("campaign_id", campaign.id)
      .in("lead_id", chunk);

    const enrollmentIds = (enrollments ?? []).map((e: any) => e.id);
    if (!enrollmentIds.length) continue;

    const enrollmentLeadMap = new Map<string, string>();
    for (const e of enrollments ?? []) {
      enrollmentLeadMap.set(e.id, e.lead_id);
    }

    const { data: leads } = await adminClient
      .from("lead_contacts")
      .select("id, timezone, country_code")
      .in("id", chunk);
    const leadMeta = new Map<string, { timezone: string; countryCode: string }>();
    for (const lead of leads ?? []) {
      leadMeta.set(lead.id, {
        timezone: normalizeTimezone(lead.timezone),
        countryCode: normalizeCountryCode(lead.country_code),
      });
    }

    const { data: heldEmails } = await adminClient
      .from("lead_scheduled_emails")
      .select("id, enrollment_id, campaign_step_id, lead_id")
      .in("enrollment_id", enrollmentIds)
      .eq("status", "held");

    if (!heldEmails?.length) continue;

    const releasedLeadIds = new Set<string>();
    for (const email of heldEmails) {
      const leadId = email.lead_id || enrollmentLeadMap.get(email.enrollment_id);
      const info = leadMeta.get(leadId) ?? { timezone: DEFAULT_TIMEZONE, countryCode: "unknown" };
      const cumulativeDelay = cumulativeDelayByStepId.get(email.campaign_step_id) ?? 0;
      const rawDate = new Date(now.getTime() + cumulativeDelay * 60 * 60 * 1000);
      const preferredHour = pickPreferredHour(info.countryCode, countrySendHours);
      const scheduledAt = clampToPreferredSendTime(
        rawDate,
        info.timezone,
        campaign.send_window_start,
        campaign.send_window_end,
        preferredHour,
      );

      const { error: updateError } = await adminClient
        .from("lead_scheduled_emails")
        .update({
          status: "pending",
          scheduled_at: scheduledAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", email.id)
        .eq("status", "held");

      if (!updateError) {
        releasedEmails++;
        if (leadId) releasedLeadIds.add(leadId);
      }
    }
    releasedLeads += releasedLeadIds.size;
  }

  return json({
    success: true,
    data: {
      jobId,
      releasedEmails,
      releasedLeads,
      remainingHeldLeads,
    },
  });
}

async function handleDeleteLead(
  adminClient: ReturnType<typeof createClient>,
  payload: DeleteLeadPayload,
) {
  const leadId = payload.leadId;
  if (!leadId) return json({ error: "leadId is required" }, 400);

  const { data: lead, error: leadError } = await adminClient
    .from("lead_contacts")
    .select("id, email_raw, email_normalized")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) return json({ error: leadError.message }, 500);
  if (!lead) return json({ error: "Lead not found" }, 404);

  // Keep import row history but detach it from the deleted lead.
  const { error: detachRowsError } = await adminClient
    .from("lead_import_job_rows")
    .update({ lead_id: null })
    .eq("lead_id", leadId);
  if (detachRowsError) return json({ error: detachRowsError.message }, 500);

  const { error: opensError } = await adminClient.from("lead_email_opens").delete().eq("lead_id", leadId);
  if (opensError) return json({ error: opensError.message }, 500);

  const { error: scheduledError } = await adminClient.from("lead_scheduled_emails").delete().eq("lead_id", leadId);
  if (scheduledError) return json({ error: scheduledError.message }, 500);

  const { error: enrollmentError } = await adminClient.from("lead_enrollments").delete().eq("lead_id", leadId);
  if (enrollmentError) return json({ error: enrollmentError.message }, 500);

  const { error: deleteLeadError } = await adminClient.from("lead_contacts").delete().eq("id", leadId);
  if (deleteLeadError) return json({ error: deleteLeadError.message }, 500);

  return json({
    success: true,
    data: {
      leadId,
      email: lead.email_raw || lead.email_normalized,
      deleted: true,
    },
  });
}

async function handleBulkDeleteLeads(
  adminClient: ReturnType<typeof createClient>,
  payload: { action: string; leadIds?: string[] },
) {
  const leadIds = payload.leadIds;
  if (!leadIds?.length) return json({ error: "leadIds is required (array)" }, 400);
  if (leadIds.length > 500) return json({ error: "Maximum 500 leads per batch" }, 400);

  let deletedCount = 0;
  const CHUNK = 100;

  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const chunk = leadIds.slice(i, i + CHUNK);

    // Detach import rows
    await adminClient
      .from("lead_import_job_rows")
      .update({ lead_id: null })
      .in("lead_id", chunk);

    // Delete open events
    await adminClient.from("lead_email_opens").delete().in("lead_id", chunk);

    // Delete scheduled emails
    await adminClient.from("lead_scheduled_emails").delete().in("lead_id", chunk);

    // Delete enrollments
    await adminClient.from("lead_enrollments").delete().in("lead_id", chunk);

    // Delete lead contacts
    const { error } = await adminClient.from("lead_contacts").delete().in("id", chunk);
    if (error) return json({ error: error.message }, 500);

    deletedCount += chunk.length;
  }

  return json({
    success: true,
    data: { deletedLeads: deletedCount },
  });
}

async function handleBulkDeleteImportJobs(
  adminClient: any,
  payload: { action: string; jobIds?: string[] },
) {
  const jobIds = payload.jobIds;
  if (!jobIds?.length) return json({ error: "jobIds is required (array)" }, 400);
  if (jobIds.length > 50) return json({ error: "Maximum 50 jobs per batch" }, 400);

  let totalDeletedLeads = 0;
  let totalDeletedRows = 0;

  for (const jobId of jobIds) {
    const { data: job } = await adminClient
      .from("lead_import_jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) continue;

    const allJobRows = await fetchAllPages(adminClient, "lead_import_job_rows", "import_job_id", jobId, "lead_id, result");
    const leadIds = [...new Set(
      allJobRows.filter((r) => r.lead_id).map((r) => r.lead_id as string)
    )];

    // Delete job rows first (FK constraint: lead_import_job_rows.lead_id → lead_contacts.id)
    while (true) {
      const { data: batch } = await adminClient
        .from("lead_import_job_rows")
        .select("id")
        .eq("import_job_id", jobId)
        .limit(1000);
      if (!batch || batch.length === 0) break;
      const ids = batch.map((r: { id: string }) => r.id);
      await adminClient.from("lead_import_job_rows").delete().in("id", ids);
      totalDeletedRows += ids.length;
      if (batch.length < 1000) break;
    }

    const CHUNK = 500;
    for (let i = 0; i < leadIds.length; i += CHUNK) {
      const chunk = leadIds.slice(i, i + CHUNK);
      await adminClient.from("lead_email_opens").delete().in("lead_id", chunk);
      await adminClient.from("lead_scheduled_emails").delete().in("lead_id", chunk);
      await adminClient.from("lead_enrollments").delete().in("lead_id", chunk);
      await adminClient.from("lead_contacts").delete().in("id", chunk);
      totalDeletedLeads += chunk.length;
    }

    await adminClient.from("lead_import_jobs").delete().eq("id", jobId);
  }

  return json({
    success: true,
    data: {
      deletedJobs: jobIds.length,
      deletedLeads: totalDeletedLeads,
      deletedRows: totalDeletedRows,
    },
  });
}

async function handleReleaseLeads(
  adminClient: ReturnType<typeof createClient>,
  payload: ReleaseLeadsPayload,
  callerId: string,
) {
  const leadIds = payload.leadIds;
  if (!leadIds?.length) return json({ error: "leadIds is required (array)" }, 400);
  if (leadIds.length > 500) return json({ error: "Maximum 500 leads per batch" }, 400);

  // Resolve campaign
  let campaignId = payload.campaignId;
  if (!campaignId) {
    const { data: defaultCampaign, error: dcErr } = await adminClient
      .from("lead_campaigns")
      .select("id")
      .eq("is_default", true)
      .maybeSingle();
    if (dcErr) return json({ error: dcErr.message }, 500);
    if (!defaultCampaign) return json({ error: "No default campaign found" }, 400);
    campaignId = defaultCampaign.id;
  }

  // Fetch campaign
  const { data: campaign, error: campaignError } = await adminClient
    .from("lead_campaigns")
    .select("id, timezone, send_window_start, send_window_end")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignError) return json({ error: campaignError.message }, 500);
  if (!campaign) return json({ error: "Campaign not found" }, 404);

  // Fetch campaign steps
  const { data: stepsData, error: stepsError } = await adminClient
    .from("lead_campaign_steps")
    .select("id, step_order, delay_hours")
    .eq("campaign_id", campaign.id)
    .order("step_order", { ascending: true });
  if (stepsError) return json({ error: stepsError.message }, 500);
  const steps = stepsData ?? [];
  if (!steps.length) return json({ error: "Campaign has no steps" }, 400);

  const cumulativeDelayByStep: { stepId: string; stepOrder: number; cumulativeDelay: number }[] = [];
  let cumulative = 0;
  for (const step of steps) {
    cumulative += step.delay_hours;
    cumulativeDelayByStep.push({ stepId: step.id, stepOrder: step.step_order, cumulativeDelay: cumulative });
  }

  // Fetch lead_contacts for given IDs in chunks, filter to active
  const LOOKUP_CHUNK = 200;
  const activeLeads: { id: string; timezone: string; country_code: string }[] = [];
  for (let i = 0; i < leadIds.length; i += LOOKUP_CHUNK) {
    const chunk = leadIds.slice(i, i + LOOKUP_CHUNK);
    const { data, error } = await adminClient
      .from("lead_contacts")
      .select("id, timezone, country_code")
      .in("id", chunk)
      .eq("status", "active");
    if (error) return json({ error: error.message }, 500);
    activeLeads.push(...(data ?? []));
  }

  if (!activeLeads.length) {
    return json({
      success: true,
      data: { releaseId: null, enrolledCount: 0, scheduledEmails: 0, skippedAlreadyEnrolled: 0 },
    });
  }

  const activeLeadIds = activeLeads.map((l) => l.id);

  // Check for existing active enrollments in same campaign — skip those
  const alreadyEnrolledSet = new Set<string>();
  for (let i = 0; i < activeLeadIds.length; i += LOOKUP_CHUNK) {
    const chunk = activeLeadIds.slice(i, i + LOOKUP_CHUNK);
    const { data, error } = await adminClient
      .from("lead_enrollments")
      .select("lead_id")
      .eq("campaign_id", campaign.id)
      .eq("status", "active")
      .in("lead_id", chunk);
    if (error) return json({ error: error.message }, 500);
    for (const row of data ?? []) {
      alreadyEnrolledSet.add(row.lead_id);
    }
  }

  const leadsToEnroll = activeLeads.filter((l) => !alreadyEnrolledSet.has(l.id));
  const skippedAlreadyEnrolled = activeLeads.length - leadsToEnroll.length;

  if (!leadsToEnroll.length) {
    return json({
      success: true,
      data: { releaseId: null, enrolledCount: 0, scheduledEmails: 0, skippedAlreadyEnrolled },
    });
  }

  // Create lead_releases row
  const { data: release, error: releaseError } = await adminClient
    .from("lead_releases")
    .insert({
      campaign_id: campaign.id,
      created_by: callerId,
      label: payload.label || null,
      lead_count: leadsToEnroll.length,
    })
    .select("id")
    .single();
  if (releaseError) return json({ error: releaseError.message }, 500);
  const releaseId = release.id;

  // Create enrollments in chunks
  const INSERT_CHUNK = 2000;
  const enrollmentMap = new Map<string, string>(); // lead_id -> enrollment_id
  for (let i = 0; i < leadsToEnroll.length; i += INSERT_CHUNK) {
    const chunk = leadsToEnroll.slice(i, i + INSERT_CHUNK);
    const rows = chunk.map((lead) => ({
      lead_id: lead.id,
      campaign_id: campaign.id,
      status: "active",
      release_id: releaseId,
    }));
    const { data: inserted, error } = await adminClient
      .from("lead_enrollments")
      .insert(rows)
      .select("id, lead_id");
    if (error) return json({ error: error.message }, 500);
    for (const row of inserted ?? []) {
      enrollmentMap.set(row.lead_id, row.id);
    }
  }

  // Schedule emails
  const countrySendHours = await loadCountrySendHours(adminClient);
  const now = new Date();
  const leadMetaMap = new Map<string, { timezone: string; countryCode: string }>();
  for (const lead of leadsToEnroll) {
    leadMetaMap.set(lead.id, {
      timezone: normalizeTimezone(lead.timezone),
      countryCode: normalizeCountryCode(lead.country_code),
    });
  }

  const emailRows: Record<string, unknown>[] = [];
  for (const lead of leadsToEnroll) {
    const enrollmentId = enrollmentMap.get(lead.id);
    if (!enrollmentId) continue;
    const meta = leadMetaMap.get(lead.id)!;
    const preferredHour = pickPreferredHour(meta.countryCode, countrySendHours);

    for (const stepInfo of cumulativeDelayByStep) {
      const rawDate = new Date(now.getTime() + stepInfo.cumulativeDelay * 60 * 60 * 1000);
      const scheduledAt = clampToPreferredSendTime(
        rawDate,
        meta.timezone,
        campaign.send_window_start,
        campaign.send_window_end,
        preferredHour,
      );
      emailRows.push({
        enrollment_id: enrollmentId,
        lead_id: lead.id,
        campaign_id: campaign.id,
        campaign_step_id: stepInfo.stepId,
        step_order: stepInfo.stepOrder,
        scheduled_at: scheduledAt.toISOString(),
        status: "pending",
        release_id: releaseId,
      });
    }
  }

  let scheduledEmailCount = 0;
  for (let i = 0; i < emailRows.length; i += INSERT_CHUNK) {
    const chunk = emailRows.slice(i, i + INSERT_CHUNK);
    const { error } = await adminClient.from("lead_scheduled_emails").insert(chunk);
    if (error) return json({ error: error.message }, 500);
    scheduledEmailCount += chunk.length;
  }

  return json({
    success: true,
    data: {
      releaseId,
      enrolledCount: leadsToEnroll.length,
      scheduledEmails: scheduledEmailCount,
      skippedAlreadyEnrolled,
    },
  });
}

async function handleListReleases(
  adminClient: ReturnType<typeof createClient>,
  payload: ListReleasesPayload,
) {
  const page = clamp(Number(payload.page ?? 0), 0, 100000);
  const pageSize = clamp(Number(payload.pageSize ?? 25), 1, 100);
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data: releases, error, count } = await adminClient
    .from("lead_releases")
    .select("id, campaign_id, created_by, label, lead_count, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return json({ error: error.message }, 500);

  const rows = releases ?? [];
  if (!rows.length) {
    return json({ success: true, data: { releases: [], total: count ?? 0, page, pageSize } });
  }

  const releaseIds = rows.map((r: any) => r.id);
  const campaignIds = [...new Set(rows.map((r: any) => r.campaign_id).filter(Boolean))] as string[];

  // Fetch campaign names
  const { data: campaigns } = campaignIds.length
    ? await adminClient.from("lead_campaigns").select("id, name").in("id", campaignIds)
    : { data: [] as { id: string; name: string }[] };
  const campaignById = new Map((campaigns ?? []).map((c: any) => [c.id, c]));

  // Fetch email stats per release
  const LOOKUP_CHUNK = 200;
  const emailStatsByRelease = new Map<string, { total: number; sent: number; pending: number; opened: number }>();
  for (let i = 0; i < releaseIds.length; i += LOOKUP_CHUNK) {
    const chunk = releaseIds.slice(i, i + LOOKUP_CHUNK);
    const { data: emails, error: emailsErr } = await adminClient
      .from("lead_scheduled_emails")
      .select("release_id, status, opened_count")
      .in("release_id", chunk);
    if (emailsErr) return json({ error: emailsErr.message }, 500);
    for (const email of emails ?? []) {
      const stats = emailStatsByRelease.get(email.release_id) ?? { total: 0, sent: 0, pending: 0, opened: 0 };
      stats.total += 1;
      if (email.status === "sent") stats.sent += 1;
      if (email.status === "pending") stats.pending += 1;
      if ((email.opened_count ?? 0) > 0) stats.opened += 1;
      emailStatsByRelease.set(email.release_id, stats);
    }
  }

  // Fetch conversion counts per release
  const conversionsByRelease = new Map<string, number>();
  for (let i = 0; i < releaseIds.length; i += LOOKUP_CHUNK) {
    const chunk = releaseIds.slice(i, i + LOOKUP_CHUNK);
    const { data: enrollments, error: enrErr } = await adminClient
      .from("lead_enrollments")
      .select("release_id, lead_id")
      .in("release_id", chunk);
    if (enrErr) return json({ error: enrErr.message }, 500);

    if (enrollments?.length) {
      const leadIdsByRelease = new Map<string, string[]>();
      for (const e of enrollments) {
        const list = leadIdsByRelease.get(e.release_id) ?? [];
        list.push(e.lead_id);
        leadIdsByRelease.set(e.release_id, list);
      }

      const allLeadIds = [...new Set(enrollments.map((e: any) => e.lead_id))];
      const convertedSet = new Set<string>();
      for (let j = 0; j < allLeadIds.length; j += LOOKUP_CHUNK) {
        const leadChunk = allLeadIds.slice(j, j + LOOKUP_CHUNK);
        const { data: converted } = await adminClient
          .from("lead_contacts")
          .select("id")
          .in("id", leadChunk)
          .eq("status", "converted");
        for (const c of converted ?? []) {
          convertedSet.add(c.id);
        }
      }

      for (const [rid, lids] of leadIdsByRelease) {
        const convCount = lids.filter((lid) => convertedSet.has(lid)).length;
        conversionsByRelease.set(rid, (conversionsByRelease.get(rid) ?? 0) + convCount);
      }
    }
  }

  const enriched = rows.map((r: any) => {
    const emailStats = emailStatsByRelease.get(r.id) ?? { total: 0, sent: 0, pending: 0, opened: 0 };
    return {
      ...r,
      campaign_name: campaignById.get(r.campaign_id)?.name ?? null,
      email_total: emailStats.total,
      email_sent: emailStats.sent,
      email_pending: emailStats.pending,
      email_opened: emailStats.opened,
      conversions: conversionsByRelease.get(r.id) ?? 0,
    };
  });

  return json({
    success: true,
    data: {
      releases: enriched,
      total: count ?? 0,
      page,
      pageSize,
    },
  });
}

async function handleGetReleaseDetail(
  adminClient: ReturnType<typeof createClient>,
  payload: GetReleaseDetailPayload,
) {
  const releaseId = payload.releaseId;
  if (!releaseId) return json({ error: "releaseId is required" }, 400);

  const page = clamp(Number(payload.page ?? 0), 0, 100000);
  const pageSize = clamp(Number(payload.pageSize ?? 25), 1, 100);

  // Fetch release row
  const { data: release, error: releaseError } = await adminClient
    .from("lead_releases")
    .select("id, campaign_id, created_by, label, lead_count, created_at")
    .eq("id", releaseId)
    .maybeSingle();
  if (releaseError) return json({ error: releaseError.message }, 500);
  if (!release) return json({ error: "Release not found" }, 404);

  // Fetch campaign name
  const { data: campaign } = await adminClient
    .from("lead_campaigns")
    .select("id, name")
    .eq("id", release.campaign_id)
    .maybeSingle();

  // Paginated enrollments
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data: enrollments, error: enrError, count } = await adminClient
    .from("lead_enrollments")
    .select("id, lead_id, status, enrolled_at, updated_at", { count: "exact" })
    .eq("release_id", releaseId)
    .order("enrolled_at", { ascending: false })
    .range(from, to);
  if (enrError) return json({ error: enrError.message }, 500);

  const enrRows = enrollments ?? [];
  if (!enrRows.length) {
    return json({
      success: true,
      data: {
        release: { ...release, campaign_name: campaign?.name ?? null },
        leads: [],
        total: count ?? 0,
        page,
        pageSize,
      },
    });
  }

  // Fetch lead contact info
  const leadIds = enrRows.map((e: any) => e.lead_id);
  const LOOKUP_CHUNK = 200;
  const leadMap = new Map<string, any>();
  for (let i = 0; i < leadIds.length; i += LOOKUP_CHUNK) {
    const chunk = leadIds.slice(i, i + LOOKUP_CHUNK);
    const { data: leads } = await adminClient
      .from("lead_contacts")
      .select("id, email_raw, email_normalized, first_name, last_name, status")
      .in("id", chunk);
    for (const lead of leads ?? []) {
      leadMap.set(lead.id, lead);
    }
  }

  // Fetch scheduled email stats per lead for this release
  const emailStatsByLead = new Map<string, { total: number; sent: number; pending: number; opened: number }>();
  for (let i = 0; i < leadIds.length; i += LOOKUP_CHUNK) {
    const chunk = leadIds.slice(i, i + LOOKUP_CHUNK);
    const { data: emails } = await adminClient
      .from("lead_scheduled_emails")
      .select("lead_id, status, opened_count")
      .eq("release_id", releaseId)
      .in("lead_id", chunk);
    for (const email of emails ?? []) {
      const stats = emailStatsByLead.get(email.lead_id) ?? { total: 0, sent: 0, pending: 0, opened: 0 };
      stats.total += 1;
      if (email.status === "sent") stats.sent += 1;
      if (email.status === "pending") stats.pending += 1;
      if ((email.opened_count ?? 0) > 0) stats.opened += 1;
      emailStatsByLead.set(email.lead_id, stats);
    }
  }

  const enrichedLeads = enrRows.map((enr: any) => {
    const lead = leadMap.get(enr.lead_id) ?? {};
    const emailStats = emailStatsByLead.get(enr.lead_id) ?? { total: 0, sent: 0, pending: 0, opened: 0 };
    return {
      enrollment_id: enr.id,
      lead_id: enr.lead_id,
      enrollment_status: enr.status,
      enrolled_at: enr.enrolled_at,
      email_raw: lead.email_raw ?? null,
      email_normalized: lead.email_normalized ?? null,
      first_name: lead.first_name ?? null,
      last_name: lead.last_name ?? null,
      lead_status: lead.status ?? null,
      email_total: emailStats.total,
      email_sent: emailStats.sent,
      email_pending: emailStats.pending,
      email_opened: emailStats.opened,
    };
  });

  return json({
    success: true,
    data: {
      release: { ...release, campaign_name: campaign?.name ?? null },
      leads: enrichedLeads,
      total: count ?? 0,
      page,
      pageSize,
    },
  });
}

async function handleRetryFailedEmails(
  adminClient: any,
  payload: { month?: string; dateFrom?: string; dateTo?: string; emailType?: string; scheduledEmailIds?: string[]; dryRun?: boolean },
) {
  const now = new Date().toISOString();
  const { month, dateFrom, dateTo, emailType, scheduledEmailIds, dryRun } = payload;

  let targetIds: string[] = [];

  if (scheduledEmailIds?.length) {
    // Per-email retry: use provided IDs directly
    const { data, error } = await adminClient
      .from("lead_scheduled_emails")
      .select("id, enrollment_id")
      .in("id", scheduledEmailIds)
      .eq("status", "failed");
    if (error) return json({ error: error.message }, 500);
    targetIds = (data ?? []).map((r: any) => r.id);
  } else if (month || dateFrom || dateTo || emailType) {
    // Filter-aware retry: find matching email_logs first, then bridge to lead_scheduled_emails
    let logQuery = adminClient
      .from("email_logs")
      .select("metadata")
      .eq("status", "failed");

    if (emailType) logQuery = logQuery.eq("email_type", emailType);
    if (dateFrom) logQuery = logQuery.gte("created_at", dateFrom);
    if (dateTo) logQuery = logQuery.lt("created_at", dateTo);
    if (month && !dateFrom && !dateTo) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString();
      const end = new Date(y, m, 1).toISOString();
      logQuery = logQuery.gte("created_at", start).lt("created_at", end);
    }

    const { data: logs, error: logErr } = await logQuery;
    if (logErr) return json({ error: logErr.message }, 500);

    const scheduledIds = (logs ?? [])
      .map((l: any) => l.metadata?.scheduled_email_id)
      .filter(Boolean);
    const uniqueIds = [...new Set(scheduledIds)] as string[];
    if (!uniqueIds.length) return json({ success: true, retriedCount: 0, ...(dryRun ? { count: 0 } : {}) });

    // Verify they're actually failed in lead_scheduled_emails
    const { data, error } = await adminClient
      .from("lead_scheduled_emails")
      .select("id, enrollment_id")
      .in("id", uniqueIds)
      .eq("status", "failed");
    if (error) return json({ error: error.message }, 500);
    targetIds = (data ?? []).map((r: any) => r.id);
  } else {
    // No filters: all failed (original behavior)
    const { data, error } = await adminClient
      .from("lead_scheduled_emails")
      .select("id, enrollment_id")
      .eq("status", "failed");
    if (error) return json({ error: error.message }, 500);
    targetIds = (data ?? []).map((r: any) => r.id);
  }

  if (!targetIds.length) return json({ success: true, retriedCount: 0, ...(dryRun ? { count: 0 } : {}) });

  // Dry run: return count only
  if (dryRun) return json({ success: true, count: targetIds.length });

  // Fetch enrollment_ids for the targeted emails
  const { data: targetRows } = await adminClient
    .from("lead_scheduled_emails")
    .select("id, enrollment_id")
    .in("id", targetIds);
  const enrollmentIds = [...new Set((targetRows ?? []).map((r: any) => r.enrollment_id))];

  // Reset to pending
  const { error: updateError } = await adminClient
    .from("lead_scheduled_emails")
    .update({
      status: "pending",
      attempt_count: 0,
      last_error: "Manual retry — reset by admin",
      scheduled_at: now,
      updated_at: now,
    })
    .in("id", targetIds);

  if (updateError) return json({ error: updateError.message }, 500);

  // Reactivate enrollments that were cancelled due to failures
  if (enrollmentIds.length) {
    await adminClient
      .from("lead_enrollments")
      .update({
        status: "active",
        cancelled_at: null,
        updated_at: now,
      })
      .in("id", enrollmentIds)
      .eq("status", "cancelled");
  }

  return json({ success: true, retriedCount: targetIds.length });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const verified = await verifyAdmin(authHeader, supabaseUrl, anonKey, serviceRoleKey);
    if (!verified) return json({ error: "Forbidden" }, 403);

    const payload = (await req.json().catch(() => ({}))) as Payload;
    const { adminClient } = verified;

    if (payload.action === "listLeads") {
      return await handleListLeads(adminClient, payload);
    }
    if (payload.action === "listLeadIds") {
      return await handleListLeadIds(adminClient, payload as ListLeadIdsPayload);
    }
    if (payload.action === "getLeadTimeline") {
      return await handleGetLeadTimeline(adminClient, payload);
    }
    if (payload.action === "listImportJobRows") {
      return await handleListImportJobRows(adminClient, payload);
    }
    if (payload.action === "deleteLead") {
      return await handleDeleteLead(adminClient, payload);
    }
    if (payload.action === "getLeadAnalytics") {
      return await handleGetLeadAnalytics(adminClient, payload);
    }
    if (payload.action === "deleteImportJob") {
      return await handleDeleteImportJob(adminClient, payload as { action: string; jobId?: string });
    }
    if (payload.action === "releaseImportJob") {
      return await handleReleaseImportJob(adminClient, payload as { action: string; jobId?: string; limit?: number });
    }
    if (payload.action === "bulkDeleteLeads") {
      return await handleBulkDeleteLeads(adminClient, payload as { action: string; leadIds?: string[] });
    }
    if (payload.action === "bulkDeleteImportJobs") {
      return await handleBulkDeleteImportJobs(adminClient, payload as { action: string; jobIds?: string[] });
    }
    if (payload.action === "releaseLeads") {
      return await handleReleaseLeads(adminClient, payload as ReleaseLeadsPayload, verified.callerId);
    }
    if (payload.action === "listReleases") {
      return await handleListReleases(adminClient, payload as ListReleasesPayload);
    }
    if (payload.action === "getReleaseDetail") {
      return await handleGetReleaseDetail(adminClient, payload as GetReleaseDetailPayload);
    }
    if (payload.action === "retryFailedEmails") {
      return await handleRetryFailedEmails(adminClient, payload as any);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("admin-lead-observability error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg || "Internal server error" }, 500);
  }
});
