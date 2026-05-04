import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type LeadRowInput = {
  rowNumber?: number;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  ip?: string | null;
  timeZone?: string | null;
  country?: string | null;
  city?: string | null;
};

type GeoResult = {
  countryCode: string | null;
  countryName: string | null;
  timezone: string | null;
  provider: string;
};

const DEFAULT_TIMEZONE = "Asia/Jerusalem";
const GEOIP_PROVIDER = "ipapi.co";

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const value = email.trim().toLowerCase();
  return value.length ? value : null;
}

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.trim();
  if (!clean) return null;
  if (clean.includes(":") && clean.includes(".")) {
    const [ip] = clean.split(":");
    return ip?.trim() || null;
  }
  return clean;
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseCountry(value: string | null): { name: string | null; code: string | null } {
  if (!value) return { name: null, code: null };
  const trimmed = value.trim();
  if (!trimmed) return { name: null, code: null };
  const isCode = /^[a-zA-Z]{2}$/.test(trimmed);
  return { name: trimmed, code: isCode ? trimmed.toUpperCase() : null };
}

function isValidEmail(email: string | null): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function fetchGeoIp(ip: string): Promise<GeoResult | null> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "ImagickLeadGeoIP/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error) return null;
    return {
      countryCode: typeof data?.country === "string" ? data.country : null,
      countryName: typeof data?.country_name === "string" ? data.country_name : null,
      timezone: typeof data?.timezone === "string" ? data.timezone : null,
      provider: GEOIP_PROVIDER,
    };
  } catch {
    return null;
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

  if (!role) return null;
  return { adminClient, callerId };
}

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const verified = await verifyAdmin(authHeader, supabaseUrl, anonKey, serviceRoleKey);
    if (!verified) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { adminClient, callerId } = verified;
    const body = await req.json();
    const mode = body.mode as "start" | "chunk";

    if (mode === "start") {
      const {
        fileName,
        fileType,
        source,
        totalRows = 0,
        mapping = {},
        campaignId = null,
      } = body;

      const { data, error } = await adminClient
        .from("lead_import_jobs")
        .insert({
          created_by: callerId,
          file_name: fileName ?? null,
          file_type: fileType ?? null,
          source: source ?? "manual_upload",
          selected_campaign_id: campaignId,
          mapping,
          total_rows: totalRows,
          status: "processing",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: error?.message || "Failed to create import job" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, jobId: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode !== "chunk") {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobId = body.jobId as string;
    const rows = (body.rows ?? []) as LeadRowInput[];

    if (!jobId || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "jobId and rows are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobError } = await adminClient
      .from("lead_import_jobs")
      .select("id, processed_rows, imported_count, duplicates_count, invalid_count, registered_count, suppressed_count")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Import job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedCandidates: string[] = [];
    const rowPrepared = rows.map((row, idx) => {
      const normalized = normalizeEmail(row.email);
      const ip = normalizeIp(row.ip);
      const timeZone = normalizeOptional(row.timeZone);
      const countryRaw = normalizeOptional(row.country);
      const parsedCountry = parseCountry(countryRaw);
      const city = normalizeOptional(row.city);
      if (normalized) normalizedCandidates.push(normalized);
      return {
        rowNumber: row.rowNumber ?? (job.processed_rows + idx + 1),
        emailRaw: row.email ?? null,
        emailNormalized: normalized,
        firstName: row.firstName?.trim() || null,
        lastName: row.lastName?.trim() || null,
        ipAddress: ip,
        timeZone,
        countryName: parsedCountry.name,
        countryCode: parsedCountry.code,
        city,
      };
    });

    const uniqueEmails = [...new Set(normalizedCandidates)];
    const alreadySeenInJob = new Set<string>();

    if (uniqueEmails.length > 0) {
      const { data: previousRows } = await adminClient
        .from("lead_import_job_rows")
        .select("email_normalized")
        .eq("import_job_id", jobId)
        .in("email_normalized", uniqueEmails)
        .not("email_normalized", "is", null);

      for (const item of previousRows ?? []) {
        if (item?.email_normalized) alreadySeenInJob.add(item.email_normalized);
      }
    }

    const authSet = new Set<string>();
    if (uniqueEmails.length > 0) {
      const { data: registered } = await adminClient.rpc("lookup_registered_emails", {
        p_emails: uniqueEmails,
      });
      for (const item of registered ?? []) {
        if (item?.email_normalized) authSet.add(item.email_normalized);
      }
    }

    const { data: existingLeads } = uniqueEmails.length
      ? await adminClient
          .from("lead_contacts")
          .select("id, email_normalized, status, timezone, country_code, country_name, ip_address")
          .in("email_normalized", uniqueEmails)
      : {
          data: [] as {
            id: string;
            email_normalized: string;
            status: string;
            timezone?: string | null;
            country_code?: string | null;
            country_name?: string | null;
            ip_address?: string | null;
          }[],
        };

    const leadMap = new Map<
      string,
      {
        id: string;
        status: string;
        timezone: string | null;
        country_code: string | null;
        country_name: string | null;
        ip_address: string | null;
      }
    >();
    for (const lead of existingLeads ?? []) {
      leadMap.set(lead.email_normalized, {
        id: lead.id,
        status: lead.status,
        timezone: lead.timezone ?? null,
        country_code: lead.country_code ?? null,
        country_name: lead.country_name ?? null,
        ip_address: lead.ip_address ?? null,
      });
    }

    const seenChunk = new Set<string>();
    const rowLogs: {
      import_job_id: string;
      row_number: number;
      email_raw: string | null;
      email_normalized: string | null;
      first_name: string | null;
      last_name: string | null;
      lead_id: string | null;
      result: string;
      reason: string | null;
    }[] = [];

    let processedCount = 0;
    let importedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let registeredCount = 0;
    let suppressedCount = 0;

    const uniqueIps = [...new Set(rowPrepared.map((row) => row.ipAddress).filter(Boolean))] as string[];
    const geoByIp = new Map<string, GeoResult | null>();
    if (uniqueIps.length > 0) {
      const { data: cached } = await adminClient
        .from("lead_geoip_cache")
        .select("ip_address, country_code, country_name, timezone, provider")
        .in("ip_address", uniqueIps);

      for (const row of cached ?? []) {
        geoByIp.set(row.ip_address, {
          countryCode: row.country_code ?? null,
          countryName: row.country_name ?? null,
          timezone: row.timezone ?? null,
          provider: row.provider ?? GEOIP_PROVIDER,
        });
      }

      const missingIps = uniqueIps.filter((ip) => !geoByIp.has(ip));
      const newlyCached: {
        ip_address: string;
        country_code: string | null;
        country_name: string | null;
        timezone: string | null;
        provider: string;
        looked_up_at: string;
      }[] = [];

      for (const ip of missingIps) {
        const result = await fetchGeoIp(ip);
        if (result) {
          geoByIp.set(ip, result);
          newlyCached.push({
            ip_address: ip,
            country_code: result.countryCode,
            country_name: result.countryName,
            timezone: result.timezone,
            provider: result.provider,
            looked_up_at: new Date().toISOString(),
          });
        } else {
          geoByIp.set(ip, null);
        }
      }

      if (newlyCached.length > 0) {
        await adminClient.from("lead_geoip_cache").upsert(newlyCached, { onConflict: "ip_address" });
      }
    }

    for (const row of rowPrepared) {
      processedCount++;

      const geo = row.ipAddress ? geoByIp.get(row.ipAddress) ?? null : null;
      const geoTimezone = geo?.timezone ?? null;
      const geoCountryCode = geo?.countryCode ?? null;
      const geoCountryName = geo?.countryName ?? null;
      const geoProvider = geo?.provider || (row.ipAddress ? GEOIP_PROVIDER : null);
      const geoLookedUpAt = row.ipAddress ? new Date().toISOString() : null;

      const insertTimezone = row.timeZone ?? geoTimezone ?? DEFAULT_TIMEZONE;
      const insertCountryName = row.countryName ?? geoCountryName ?? null;
      const insertCountryCode = row.countryName ? row.countryCode ?? null : geoCountryCode ?? "unknown";
      const insertCity = row.city ?? null;

      if (!isValidEmail(row.emailNormalized)) {
        invalidCount++;
        rowLogs.push({
          import_job_id: jobId,
          row_number: row.rowNumber,
          email_raw: row.emailRaw,
          email_normalized: row.emailNormalized,
          first_name: row.firstName,
          last_name: row.lastName,
          lead_id: null,
          result: "invalid_email",
          reason: "Invalid email format",
        });
        continue;
      }

      const emailNormalized = row.emailNormalized!;
      if (seenChunk.has(emailNormalized) || alreadySeenInJob.has(emailNormalized)) {
        duplicateCount++;
        rowLogs.push({
          import_job_id: jobId,
          row_number: row.rowNumber,
          email_raw: row.emailRaw,
          email_normalized: emailNormalized,
          first_name: row.firstName,
          last_name: row.lastName,
          lead_id: null,
          result: "duplicate_in_file",
          reason: "Duplicate email in uploaded file",
        });
        continue;
      }
      seenChunk.add(emailNormalized);
      alreadySeenInJob.add(emailNormalized);

      if (authSet.has(emailNormalized)) {
        registeredCount++;
        let lead = leadMap.get(emailNormalized);
        if (!lead) {
          const { data: inserted } = await adminClient
            .from("lead_contacts")
            .insert({
              email_raw: row.emailRaw ?? emailNormalized,
              email_normalized: emailNormalized,
              first_name: row.firstName,
              last_name: row.lastName,
              source: "import_registered",
              status: "already_registered",
              suppression_reason: "already_registered",
              ip_address: row.ipAddress,
              country_code: insertCountryCode,
              country_name: insertCountryName,
              timezone: insertTimezone,
              city: insertCity,
              geoip_provider: geoProvider,
              geoip_looked_up_at: geoLookedUpAt,
            })
            .select("id, status")
            .single();
          if (inserted) {
            lead = {
              id: inserted.id,
              status: inserted.status,
              timezone: insertTimezone,
              country_code: insertCountryCode,
              country_name: insertCountryName,
              ip_address: row.ipAddress,
            };
            leadMap.set(emailNormalized, lead);
          }
        }

        rowLogs.push({
          import_job_id: jobId,
          row_number: row.rowNumber,
          email_raw: row.emailRaw,
          email_normalized: emailNormalized,
          first_name: row.firstName,
          last_name: row.lastName,
          lead_id: lead?.id ?? null,
          result: "already_registered",
          reason: "Email already exists in auth.users",
        });
        continue;
      }

      const existing = leadMap.get(emailNormalized);
      if (existing) {
        if (existing.status === "unsubscribed" || existing.status === "suppressed") {
          suppressedCount++;
          rowLogs.push({
            import_job_id: jobId,
            row_number: row.rowNumber,
            email_raw: row.emailRaw,
            email_normalized: emailNormalized,
            first_name: row.firstName,
            last_name: row.lastName,
            lead_id: existing.id,
            result: "suppressed",
            reason: `Lead status is ${existing.status}`,
          });
          continue;
        }

        if (existing.status === "converted" || existing.status === "already_registered") {
          registeredCount++;
          rowLogs.push({
            import_job_id: jobId,
            row_number: row.rowNumber,
            email_raw: row.emailRaw,
            email_normalized: emailNormalized,
            first_name: row.firstName,
            last_name: row.lastName,
            lead_id: existing.id,
            result: "already_registered",
            reason: `Lead status is ${existing.status}`,
          });
          continue;
        }

        importedCount++;
        rowLogs.push({
          import_job_id: jobId,
          row_number: row.rowNumber,
          email_raw: row.emailRaw,
          email_normalized: emailNormalized,
          first_name: row.firstName,
          last_name: row.lastName,
          lead_id: existing.id,
          result: "existing_lead",
          reason: null,
        });

        const hasIp = Boolean(row.ipAddress);
        const hasFileTimezone = Boolean(row.timeZone);
        const hasFileCountry = Boolean(row.countryName);
        const hasFileCity = Boolean(row.city);
        if (hasIp || hasFileTimezone || hasFileCountry || hasFileCity) {
          const updatePayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };
          if (hasIp) {
            updatePayload.ip_address = row.ipAddress;
            updatePayload.geoip_provider = geoProvider;
            updatePayload.geoip_looked_up_at = geoLookedUpAt;
          }
          if (hasFileTimezone) {
            updatePayload.timezone = row.timeZone;
          } else if (hasIp && geoTimezone) {
            updatePayload.timezone = geoTimezone;
          }
          if (hasFileCountry) {
            updatePayload.country_name = row.countryName;
            if (row.countryCode) {
              updatePayload.country_code = row.countryCode;
            }
          } else if (hasIp) {
            if (geoCountryName) updatePayload.country_name = geoCountryName;
            if (geoCountryCode) updatePayload.country_code = geoCountryCode;
          }
          if (hasFileCity) {
            updatePayload.city = row.city;
          }

          await adminClient.from("lead_contacts").update(updatePayload).eq("id", existing.id);
        }
        continue;
      }

      const { data: newLead, error: leadInsertError } = await adminClient
        .from("lead_contacts")
        .insert({
          email_raw: row.emailRaw ?? emailNormalized,
          email_normalized: emailNormalized,
          first_name: row.firstName,
          last_name: row.lastName,
          source: "import",
          status: "active",
          ip_address: row.ipAddress,
          country_code: insertCountryCode,
          country_name: insertCountryName,
          timezone: insertTimezone,
          city: insertCity,
          geoip_provider: geoProvider,
          geoip_looked_up_at: geoLookedUpAt,
        })
        .select("id, status")
        .single();

      if (leadInsertError || !newLead) {
        suppressedCount++;
        rowLogs.push({
          import_job_id: jobId,
          row_number: row.rowNumber,
          email_raw: row.emailRaw,
          email_normalized: emailNormalized,
          first_name: row.firstName,
          last_name: row.lastName,
          lead_id: null,
          result: "suppressed",
          reason: leadInsertError?.message || "Failed to insert lead",
        });
        continue;
      }

      leadMap.set(emailNormalized, {
        id: newLead.id,
        status: newLead.status,
        timezone: insertTimezone,
        country_code: insertCountryCode,
        country_name: insertCountryName,
        ip_address: row.ipAddress,
      });
      importedCount++;
      rowLogs.push({
        import_job_id: jobId,
        row_number: row.rowNumber,
        email_raw: row.emailRaw,
        email_normalized: emailNormalized,
        first_name: row.firstName,
        last_name: row.lastName,
        lead_id: newLead.id,
        result: "new_lead",
        reason: null,
      });
    }

    if (rowLogs.length > 0) {
      const { error: rowsError } = await adminClient.from("lead_import_job_rows").insert(rowLogs);
      if (rowsError) {
        return new Response(JSON.stringify({ error: rowsError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: latestJob, error: latestJobError } = await adminClient
      .from("lead_import_jobs")
      .select("processed_rows, imported_count, duplicates_count, invalid_count, registered_count, suppressed_count")
      .eq("id", jobId)
      .single();

    if (latestJobError || !latestJob) {
      return new Response(JSON.stringify({ error: latestJobError?.message || "Failed to load import counters" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await adminClient
      .from("lead_import_jobs")
      .update({
        processed_rows: latestJob.processed_rows + processedCount,
        imported_count: latestJob.imported_count + importedCount,
        duplicates_count: latestJob.duplicates_count + duplicateCount,
        invalid_count: latestJob.invalid_count + invalidCount,
        registered_count: latestJob.registered_count + registeredCount,
        suppressed_count: latestJob.suppressed_count + suppressedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          processed: processedCount,
          imported: importedCount,
          duplicates: duplicateCount,
          invalid: invalidCount,
          registered: registeredCount,
          suppressed: suppressedCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("admin-import-leads-chunk error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
