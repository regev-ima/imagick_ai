import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
  Users,
  RefreshCw,
  Eye,
  Trash2,
  Play,
  Mail,
  User,
  Clock,
  Send,
  MousePointerClick,
  FileDown,
  BookOpen,
  CalendarClock,
  Shield,
  Filter,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

type ImportJobRow = {
  id: string;
  file_name: string | null;
  file_type: string | null;
  source: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  imported_count: number;
  duplicates_count: number;
  invalid_count: number;
  registered_count: number;
  suppressed_count: number;
  created_at: string;
  completed_at: string | null;
};

type ParsedPreviewRow = Record<string, unknown>;

type ImportSummary = {
  processed: number;
  imported: number;
  duplicates: number;
  invalid: number;
  registered: number;
  suppressed: number;
  scheduled?: number;
};

type MappingState = {
  email: string;
  firstName: string;
  lastName: string;
  ip: string;
  timeZone: string;
  country: string;
  city: string;
};

type LeadListItem = {
  id: string;
  email_raw: string;
  email_normalized: string;
  first_name: string | null;
  last_name: string | null;
  source: string;
  status: string;
  suppression_reason: string | null;
  unsubscribed_at: string | null;
  created_at: string;
  import_job_id: string | null;
  import_file_name: string | null;
  import_source: string | null;
  imported_at: string | null;
  current_stage_kind: string;
  current_stage_label: string;
  current_stage_step: number | null;
  next_scheduled_at: string | null;
  last_sent_at: string | null;
  opened_count: number;
};

type LeadTimelineResponse = {
  lead: {
    id: string;
    email_raw: string;
    email_normalized: string;
    first_name: string | null;
    last_name: string | null;
    status: string;
    source: string;
    created_at: string;
    unsubscribed_at: string | null;
    suppression_reason: string | null;
  };
  importEvents: Array<{
    id: string;
    import_job_id: string;
    row_number: number;
    email_raw: string | null;
    email_normalized: string | null;
    result: string;
    reason: string | null;
    created_at: string;
    job: {
      id: string;
      file_name: string | null;
      source: string;
      created_at: string;
    } | null;
  }>;
  enrollments: Array<{
    id: string;
    campaign_id: string;
    campaign_name: string | null;
    status: string;
    enrolled_at: string;
    last_sent_step: number | null;
    cancelled_at: string | null;
    completed_at: string | null;
  }>;
  scheduledEmails: Array<{
    id: string;
    enrollment_id: string;
    step_order: number;
    subject_snapshot: string;
    sender_profile: string;
    is_reply: boolean;
    scheduled_at: string;
    status: string;
    sent_at: string | null;
    attempt_count: number;
    last_error: string | null;
    resend_message_id: string | null;
    opened_count: number;
    opened_first_at: string | null;
  }>;
  openEvents: Array<{
    id: string;
    scheduled_email_id: string;
    opened_at: string;
    ip_address: string | null;
    user_agent: string | null;
    device_type: string | null;
  }>;
  emailLogs: Array<{
    id: string;
    email_type: string;
    subject: string;
    status: string;
    resend_message_id: string | null;
    error_message: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>;
};

type JobRowsResponse = {
  rows: Array<{
    id: string;
    row_number: number;
    email_raw: string | null;
    email_normalized: string | null;
    first_name: string | null;
    last_name: string | null;
    lead_id: string | null;
    result: string;
    reason: string | null;
    created_at: string;
    lead: {
      id: string;
      email_raw: string;
      email_normalized: string;
      status: string;
      unsubscribed_at: string | null;
      suppression_reason: string | null;
    } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
};

type ObservabilityEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function guessHeader(headers: string[], candidates: string[]): string {
  const normalizedMap = new Map(headers.map((header) => [normalizeHeader(header), header]));
  for (const candidate of candidates) {
    const exact = normalizedMap.get(candidate);
    if (exact) return exact;
  }

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (candidates.some((candidate) => normalized.includes(candidate))) {
      return header;
    }
  }
  return "";
}

async function parseSheet(file: File): Promise<{ headers: string[]; rows: ParsedPreviewRow[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return { headers: [], rows: [] };

  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<ParsedPreviewRow>(sheet, { defval: "" });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatLeadName(lead: Pick<LeadListItem, "first_name" | "last_name">) {
  const name = `${lead.first_name || ""} ${lead.last_name || ""}`.trim();
  return name || "—";
}

async function invokeObservability<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-lead-observability", { body });
  if (error) {
    throw new Error(error.message || "Observability request failed");
  }
  const envelope = data as ObservabilityEnvelope<T>;
  if (!envelope?.success) {
    throw new Error(envelope?.error || "Observability request failed");
  }
  return envelope.data;
}

export default function LeadImportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"upload" | "jobs" | "leads" | "releases">("upload");

  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedPreviewRow[]>([]);
  const [mapping, setMapping] = useState<MappingState>({
    email: "",
    firstName: "",
    lastName: "",
    ip: "",
    timeZone: "",
    country: "",
    city: "",
  });
  const [sourceLabel, setSourceLabel] = useState("bubble_io_export");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);
  const [jobs, setJobs] = useState<ImportJobRow[]>([]);

  const [leadPage, setLeadPage] = useState(0);
  const [leadPageSize] = useState(50);
  const [allLeadRows, setAllLeadRows] = useState<LeadListItem[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatus, setLeadStatus] = useState("all");
  const [leadImportJobFilter, setLeadImportJobFilter] = useState("all");
  const [leadDateFrom, setLeadDateFrom] = useState("");
  const [leadDateTo, setLeadDateTo] = useState("");
  const [leadEnrolled, setLeadEnrolled] = useState("all");
  const [leadOpens, setLeadOpens] = useState("all");
  const [selectCount, setSelectCount] = useState("400");

  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null);
  const [selectedJobForRows, setSelectedJobForRows] = useState<string | null>(null);
  const [jobRowsPage, setJobRowsPage] = useState(0);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [confirmDeleteJobId, setConfirmDeleteJobId] = useState<string | null>(null);
  const [releasingJobId, setReleasingJobId] = useState<string | null>(null);
  const [confirmReleaseJobId, setConfirmReleaseJobId] = useState<string | null>(null);
  const [releaseBatchSize, setReleaseBatchSize] = useState<string>("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkDeletingLeads, setBulkDeletingLeads] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [bulkDeletingJobs, setBulkDeletingJobs] = useState(false);

  // Release state
  const [releasingLeads, setReleasingLeads] = useState(false);
  const [releaseLabel, setReleaseLabel] = useState("");
  const [releasePage, setReleasePage] = useState(0);
  const [expandedReleaseId, setExpandedReleaseId] = useState<string | null>(null);
  const [releaseDetailPage, setReleaseDetailPage] = useState(0);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);
  const mappingReady = Boolean(mapping.email);
  const progressPercent = progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;

  const loadJobs = async () => {
    const { data, error } = await supabase
      .from("lead_import_jobs")
      .select(
        "id, file_name, file_type, source, status, total_rows, processed_rows, imported_count, duplicates_count, invalid_count, registered_count, suppressed_count, created_at, completed_at",
      )
      .order("created_at", { ascending: false })
      .limit(30);

    if (!error) {
      setJobs((data || []) as ImportJobRow[]);
    }
  };

  useEffect(() => {
    void loadJobs();
    // We intentionally load baseline admin data once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    data: leadsData,
    isLoading: leadsLoading,
    isFetching: leadsFetching,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: [
      "admin-lead-observability-list",
      leadPage,
      leadPageSize,
      leadSearch,
      leadStatus,
      leadImportJobFilter,
      leadDateFrom,
      leadDateTo,
      leadEnrolled,
      leadOpens,
    ],
    queryFn: async () =>
      invokeObservability<{
        leads: LeadListItem[];
        total: number;
        page: number;
        pageSize: number;
      }>({
        action: "listLeads",
        page: leadPage,
        pageSize: leadPageSize,
        filters: {
          search: leadSearch || undefined,
          status: leadStatus,
          importJobId: leadImportJobFilter === "all" ? undefined : leadImportJobFilter,
          dateFrom: leadDateFrom || undefined,
          dateTo: leadDateTo || undefined,
          enrolled: leadEnrolled === "all" ? undefined : leadEnrolled,
          opens: leadOpens === "all" ? undefined : leadOpens,
        },
      }),
    enabled: activeTab === "leads",
    placeholderData: (prev) => prev,
  });

  const {
    data: timelineData,
    isLoading: timelineLoading,
    refetch: refetchTimeline,
  } = useQuery({
    queryKey: ["admin-lead-observability-timeline", timelineLeadId],
    queryFn: async () => {
      if (!timelineLeadId) throw new Error("Missing lead id");
      return invokeObservability<LeadTimelineResponse>({
        action: "getLeadTimeline",
        leadId: timelineLeadId,
      });
    },
    enabled: Boolean(timelineLeadId),
  });

  const {
    data: importJobRowsData,
    isLoading: importRowsLoading,
    refetch: refetchImportRows,
  } = useQuery({
    queryKey: ["admin-lead-observability-import-job-rows", selectedJobForRows, jobRowsPage],
    queryFn: async () => {
      if (!selectedJobForRows) throw new Error("Missing job id");
      return invokeObservability<JobRowsResponse>({
        action: "listImportJobRows",
        jobId: selectedJobForRows,
        page: jobRowsPage,
        pageSize: 120,
      });
    },
    enabled: Boolean(selectedJobForRows),
  });

  const totalLeads = leadsData?.total ?? 0;

  // Accumulate leads for infinite scroll
  useEffect(() => {
    if (!leadsData?.leads) return;
    if (leadPage === 0) {
      setAllLeadRows(leadsData.leads);
    } else {
      setAllLeadRows((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        const newLeads = leadsData.leads.filter((l) => !existingIds.has(l.id));
        return [...prev, ...newLeads];
      });
    }
  }, [leadsData, leadPage]);

  // Reset accumulated leads when filters change
  const filterKey = `${leadSearch}|${leadStatus}|${leadImportJobFilter}|${leadDateFrom}|${leadDateTo}|${leadEnrolled}|${leadOpens}`;
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      setAllLeadRows([]);
      setLeadPage(0);
    }
  }, [filterKey]);

  const leadRows = allLeadRows;
  const hasMoreLeads = leadRows.length < totalLeads;

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current || !hasMoreLeads || leadsFetching) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreLeads && !leadsFetching) {
          setLeadPage((p) => p + 1);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMoreLeads, leadsFetching]);

  const refetchLeadsFromStart = useCallback(() => {
    setAllLeadRows([]);
    setLeadPage(0);
    void refetchLeads();
  }, [refetchLeads]);

  const importRows = importJobRowsData?.rows ?? [];
  const importRowsTotal = importJobRowsData?.total ?? 0;
  const importRowsPageSize = importJobRowsData?.pageSize ?? 120;
  const importRowsTotalPages = Math.max(1, Math.ceil(importRowsTotal / importRowsPageSize));

  // Releases queries
  type ReleaseRow = {
    id: string;
    campaign_id: string;
    campaign_name: string;
    label: string | null;
    lead_count: number;
    created_at: string;
    stats: { total: number; sent: number; pending: number; opened: number; converted: number };
  };
  type ReleaseDetailLead = {
    lead_id: string;
    email: string;
    name: string;
    status: string;
    enrolled_at: string;
    emails_sent: number;
    emails_opened: number;
  };

  const {
    data: releasesData,
    isLoading: releasesLoading,
    refetch: refetchReleases,
  } = useQuery({
    queryKey: ["admin-releases", releasePage],
    queryFn: () =>
      invokeObservability<{ releases: ReleaseRow[]; total: number; page: number; pageSize: number }>({
        action: "listReleases",
        page: releasePage,
        pageSize: 20,
      }),
    enabled: activeTab === "releases",
  });

  const {
    data: releaseDetailData,
    isLoading: releaseDetailLoading,
    refetch: refetchReleaseDetail,
  } = useQuery({
    queryKey: ["admin-release-detail", expandedReleaseId, releaseDetailPage],
    queryFn: () =>
      invokeObservability<{ release: ReleaseRow; leads: ReleaseDetailLead[]; total: number; page: number; pageSize: number }>({
        action: "getReleaseDetail",
        releaseId: expandedReleaseId!,
        page: releaseDetailPage,
        pageSize: 25,
      }),
    enabled: Boolean(expandedReleaseId),
  });

  const releases = releasesData?.releases ?? [];
  const releasesTotal = releasesData?.total ?? 0;
  const releasesTotalPages = Math.max(1, Math.ceil(releasesTotal / 20));

  const handleReleaseLeads = async () => {
    if (!selectedLeadIds.size) return;
    setShowReleaseDialog(false);
    setReleasingLeads(true);
    try {
      const allIds = [...selectedLeadIds];
      const BATCH = 400;
      let totalEnrolled = 0;
      let totalScheduled = 0;
      let totalSkipped = 0;
      for (let i = 0; i < allIds.length; i += BATCH) {
        const batch = allIds.slice(i, i + BATCH);
        const result = await invokeObservability<{ releaseId: string; enrolledCount: number; scheduledEmails: number; skippedAlreadyEnrolled: number }>({
          action: "releaseLeads",
          leadIds: batch,
          label: releaseLabel || undefined,
        });
        totalEnrolled += result.enrolledCount;
        totalScheduled += result.scheduledEmails;
        totalSkipped += result.skippedAlreadyEnrolled;
      }
      toast.success(`Released ${totalEnrolled} leads (${totalScheduled} emails scheduled)${totalSkipped > 0 ? `. ${totalSkipped} already enrolled.` : ""}`);
      setSelectedLeadIds(new Set());
      setReleaseLabel("");
      void refetchLeadsFromStart();
      void refetchReleases();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to release leads");
    } finally {
      setReleasingLeads(false);
    }
  };

  const handleDeleteImportJob = async (jobId: string) => {
    setDeletingJobId(jobId);
    setConfirmDeleteJobId(null);
    try {
      const result = await invokeObservability<{ jobId: string; deletedLeads: number; deletedRows: number }>({
        action: "deleteImportJob",
        jobId,
      });
      toast.success(`Deleted import job: ${result.deletedLeads} leads and ${result.deletedRows} rows removed.`);
      void loadJobs();
      void refetchLeadsFromStart();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete import job");
    } finally {
      setDeletingJobId(null);
    }
  };

  const handleReleaseImportJob = async (jobId: string) => {
    setReleasingJobId(jobId);
    setConfirmReleaseJobId(null);
    try {
      const limit = releaseBatchSize === "all" ? 0 : Number(releaseBatchSize);
      const result = await invokeObservability<{
        jobId: string;
        releasedEmails: number;
        releasedLeads: number;
        remainingHeldLeads: number;
      }>({
        action: "releaseImportJob",
        jobId,
        limit,
      });
      const msg = result.remainingHeldLeads > 0
        ? `Released ${result.releasedLeads} leads (${result.releasedEmails} emails). ${result.remainingHeldLeads} leads still held.`
        : `Released ${result.releasedLeads} leads (${result.releasedEmails} emails).`;
      toast.success(msg);
      void loadJobs();
      void refetchLeadsFromStart();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to release import job");
    } finally {
      setReleasingJobId(null);
      setReleaseBatchSize("all");
    }
  };

  const handleBulkDeleteLeads = async () => {
    if (!selectedLeadIds.size) return;
    const confirmed = window.confirm(
      `Delete ${selectedLeadIds.size} selected lead(s)?\n\nThis will remove all their campaign emails and records.`,
    );
    if (!confirmed) return;

    setBulkDeletingLeads(true);
    try {
      const result = await invokeObservability<{ deletedLeads: number }>({
        action: "bulkDeleteLeads",
        leadIds: [...selectedLeadIds],
      });
      toast.success(`Deleted ${result.deletedLeads} leads.`);
      setSelectedLeadIds(new Set());
      void refetchLeadsFromStart();
      void loadJobs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete leads");
    } finally {
      setBulkDeletingLeads(false);
    }
  };

  const handleBulkDeleteImportJobs = async () => {
    if (!selectedJobIds.size) return;
    const confirmed = window.confirm(
      `Delete ${selectedJobIds.size} selected import job(s)?\n\nThis will remove all leads, emails, and records from these imports.`,
    );
    if (!confirmed) return;

    setBulkDeletingJobs(true);
    try {
      const result = await invokeObservability<{ deletedJobs: number; deletedLeads: number; deletedRows: number }>({
        action: "bulkDeleteImportJobs",
        jobIds: [...selectedJobIds],
      });
      toast.success(`Deleted ${result.deletedJobs} jobs, ${result.deletedLeads} leads, ${result.deletedRows} rows.`);
      setSelectedJobIds(new Set());
      void loadJobs();
      void refetchLeadsFromStart();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete import jobs");
    } finally {
      setBulkDeletingJobs(false);
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleAllLeads = () => {
    if (selectedLeadIds.size === leadRows.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leadRows.map((l) => l.id)));
    }
  };

  const [selectingAll, setSelectingAll] = useState(false);

  const selectAllFiltered = async (count?: number) => {
    const limit = count || Number(selectCount) || 400;
    setSelectingAll(true);
    try {
      const result = await invokeObservability<{ ids: string[]; total: number }>({
        action: "listLeadIds",
        limit,
        filters: {
          search: leadSearch || undefined,
          status: leadStatus,
          importJobId: leadImportJobFilter === "all" ? undefined : leadImportJobFilter,
          dateFrom: leadDateFrom || undefined,
          dateTo: leadDateTo || undefined,
          enrolled: leadEnrolled === "all" ? undefined : leadEnrolled,
          opens: leadOpens === "all" ? undefined : leadOpens,
        },
      });
      setSelectedLeadIds(new Set(result.ids));
      toast.success(`Selected ${result.total} leads`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to select leads");
    } finally {
      setSelectingAll(false);
    }
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const toggleAllJobs = () => {
    if (selectedJobIds.size === jobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(jobs.map((j) => j.id)));
    }
  };

  const handleFileChange = async (nextFile: File | null) => {
    setFile(nextFile);
    setRows([]);
    setHeaders([]);
    setProgress({ processed: 0, total: 0 });
    setLastSummary(null);

    if (!nextFile) return;

    try {
      const parsed = await parseSheet(nextFile);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping({
        email: guessHeader(parsed.headers, ["email", "e-mail", "mail"]),
        firstName: guessHeader(parsed.headers, ["first_name", "firstname", "first name", "name"]),
        lastName: guessHeader(parsed.headers, ["last_name", "lastname", "last name", "surname", "family"]),
        ip: guessHeader(parsed.headers, ["ip_address", "ip address", "client_ip", "client ip"]),
        timeZone: guessHeader(parsed.headers, ["time_zone", "timezone", "time zone", "tz"]),
        country: guessHeader(parsed.headers, ["country", "country_name", "country code", "country_code"]),
        city: guessHeader(parsed.headers, ["city", "town", "municipality"]),
      });
    } catch {
      toast.error("Failed to parse file");
      setFile(null);
    }
  };

  const runImport = async () => {
    if (!mapping.email) {
      toast.error("Please map the email field");
      return;
    }
    if (!rows.length) {
      toast.error("No rows to import");
      return;
    }

    setImporting(true);
    setProgress({ processed: 0, total: rows.length });
    setLastSummary(null);

    try {
      const preparedRows = rows
        .map((row, idx) => ({
          rowNumber: idx + 1,
          email: String(row[mapping.email] ?? "").trim(),
          firstName: mapping.firstName ? String(row[mapping.firstName] ?? "").trim() : "",
          lastName: mapping.lastName ? String(row[mapping.lastName] ?? "").trim() : "",
          ip: mapping.ip ? String(row[mapping.ip] ?? "").trim() : "",
          timeZone: mapping.timeZone ? String(row[mapping.timeZone] ?? "").trim() : "",
          country: mapping.country ? String(row[mapping.country] ?? "").trim() : "",
          city: mapping.city ? String(row[mapping.city] ?? "").trim() : "",
        }))
        .filter((row) => row.email || row.firstName || row.lastName || row.ip || row.timeZone || row.country || row.city);

      if (!preparedRows.length) {
        toast.error("File does not contain importable rows");
        setImporting(false);
        return;
      }

      const { data: startResult, error: startError } = await supabase.functions.invoke("admin-import-leads-chunk", {
        body: {
          mode: "start",
          fileName: file?.name ?? "import",
          fileType: file?.type ?? "unknown",
          source: sourceLabel || "manual_upload",
          totalRows: preparedRows.length,
          mapping,
        },
      });
      if (startError || !startResult?.jobId) {
        throw new Error(startError?.message || "Failed to start import job");
      }

      const jobId = startResult.jobId as string;
      const summary: ImportSummary = {
        processed: 0,
        imported: 0,
        duplicates: 0,
        invalid: 0,
        registered: 0,
        suppressed: 0,
      };

      const chunks = chunk(preparedRows, 500);
      for (let i = 0; i < chunks.length; i++) {
        const currentChunk = chunks[i];
        const { data, error } = await supabase.functions.invoke("admin-import-leads-chunk", {
          body: {
            mode: "chunk",
            jobId,
            rows: currentChunk,
          },
        });
        if (error) {
          throw new Error(error.message || `Chunk ${i + 1} failed`);
        }

        summary.processed += data?.summary?.processed ?? 0;
        summary.imported += data?.summary?.imported ?? 0;
        summary.duplicates += data?.summary?.duplicates ?? 0;
        summary.invalid += data?.summary?.invalid ?? 0;
        summary.registered += data?.summary?.registered ?? 0;
        summary.suppressed += data?.summary?.suppressed ?? 0;

        setProgress((prev) => ({
          ...prev,
          processed: Math.min(preparedRows.length, prev.processed + currentChunk.length),
        }));
      }

      const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke("admin-finalize-lead-import", {
        body: {
          jobId,
        },
      });
      if (finalizeError) {
        throw new Error(finalizeError.message || "Failed to finalize import");
      }

      summary.scheduled = finalizeData?.summary?.scheduledEmails ?? 0;
      setLastSummary(summary);
      toast.success("Lead import completed successfully");
      await loadJobs();
      await refetchLeadsFromStart();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const deleteLead = async (lead: LeadListItem) => {
    const email = lead.email_raw || lead.email_normalized;
    const confirmed = window.confirm(
      `Delete this lead?\n\n${email}\n\nThis will remove future lead campaign records for this contact.`,
    );
    if (!confirmed) return;

    setDeletingLeadId(lead.id);
    try {
      await invokeObservability<{ deleted: boolean; leadId: string; email: string }>({
        action: "deleteLead",
        leadId: lead.id,
      });

      if (timelineLeadId === lead.id) {
        setTimelineLeadId(null);
      }

      toast.success(`Lead deleted: ${email}`);
      await refetchLeadsFromStart();
      await loadJobs();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to delete lead");
    } finally {
      setDeletingLeadId(null);
    }
  };

  return (
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-6">
      <div>
        <span className="caption">Admin · Lead generation</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Lead Imports</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          Admin-only lead center: import files, review import jobs, and monitor lead campaign progress.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "upload" | "jobs" | "leads")}
        className="space-y-4"
      >
        <TabsList className="grid grid-cols-4 w-full max-w-[640px]">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-2">
            <Database className="w-4 h-4" />
            Imports
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2">
            <Users className="w-4 h-4" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="releases" className="gap-2">
            <Play className="w-4 h-4" />
            Releases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <div className="glass-card overflow-hidden rounded-[--radius]">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
              <span className="aura-microlabel flex items-center gap-2">
                <Upload className="h-3.5 w-3.5" />
                Upload + Mapping
              </span>
              <span className="caption">CSV / XLSX</span>
            </div>
            <div className="space-y-5 p-4">
              <p className="font-sans text-sm text-muted-foreground">
                Choose columns for email, first name, last name, IP, time zone, country, city.
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="aura-microlabel">Source label</Label>
                  <Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="bubble_io_export" />
                </div>
                <div className="space-y-2">
                  <Label className="aura-microlabel">File</Label>
                  <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
                </div>
              </div>

              {file && (
                <div className="flex items-center gap-3 rounded-[--radius] border border-border bg-surface-2 p-3">
                  <FileSpreadsheet className="w-4 h-4 text-accent" />
                  <div className="text-sm">
                    <div className="font-medium text-foreground">{file.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{rows.length} parsed rows</div>
                  </div>
                </div>
              )}

              {headers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="aura-microlabel">Email column *</Label>
                    <Select value={mapping.email} onValueChange={(value) => setMapping((prev) => ({ ...prev, email: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select email column" />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="aura-microlabel">First name column</Label>
                    <Select
                      value={mapping.firstName || "__none__"}
                      onValueChange={(value) =>
                        setMapping((prev) => ({
                          ...prev,
                          firstName: value === "__none__" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not mapped</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="aura-microlabel">Last name column</Label>
                    <Select
                      value={mapping.lastName || "__none__"}
                      onValueChange={(value) =>
                        setMapping((prev) => ({
                          ...prev,
                          lastName: value === "__none__" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not mapped</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="aura-microlabel">IP column</Label>
                    <Select
                      value={mapping.ip || "__none__"}
                      onValueChange={(value) =>
                        setMapping((prev) => ({
                          ...prev,
                          ip: value === "__none__" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not mapped</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="aura-microlabel">Time zone column</Label>
                    <Select
                      value={mapping.timeZone || "__none__"}
                      onValueChange={(value) =>
                        setMapping((prev) => ({
                          ...prev,
                          timeZone: value === "__none__" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not mapped</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="aura-microlabel">Country column</Label>
                    <Select
                      value={mapping.country || "__none__"}
                      onValueChange={(value) =>
                        setMapping((prev) => ({
                          ...prev,
                          country: value === "__none__" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not mapped</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="aura-microlabel">City column</Label>
                    <Select
                      value={mapping.city || "__none__"}
                      onValueChange={(value) =>
                        setMapping((prev) => ({
                          ...prev,
                          city: value === "__none__" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not mapped</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {previewRows.length > 0 && (
                <div className="space-y-2">
                  <Label className="aura-microlabel">Preview (first 5 rows)</Label>
                  <div className="overflow-x-auto rounded-[--radius] border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {headers.slice(0, 6).map((header) => (
                            <TableHead key={header} className="caption">{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((row, idx) => (
                          <TableRow key={idx}>
                            {headers.slice(0, 6).map((header) => (
                              <TableCell key={header} className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                                {String(row[header] ?? "")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Importing {progress.processed} / {progress.total}
                    </span>
                    <span className="folio text-foreground">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} />
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button onClick={runImport} disabled={importing || !mappingReady || rows.length === 0 || !user}>
                  {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Start Import
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null);
                    setRows([]);
                    setHeaders([]);
                    setLastSummary(null);
                  }}
                  disabled={importing}
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {lastSummary && (
            <div className="glass-card overflow-hidden rounded-[--radius]">
              <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                <span className="aura-microlabel flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />
                  Import Summary
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 p-4 text-sm">
                {[
                  { label: "Processed", value: lastSummary.processed },
                  { label: "Imported", value: lastSummary.imported },
                  { label: "Duplicates", value: lastSummary.duplicates },
                  { label: "Invalid", value: lastSummary.invalid },
                  { label: "Registered", value: lastSummary.registered },
                  { label: "Suppressed", value: lastSummary.suppressed },
                  { label: "Scheduled", value: lastSummary.scheduled ?? 0 },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="caption">{item.label}</p>
                    <p className="folio mt-1 text-lg text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs">
          <div className="glass-card overflow-hidden rounded-[--radius]">
            <div className="flex flex-row items-center justify-between gap-3 border-b border-border bg-background/40 px-4 py-2.5">
              <span className="aura-microlabel flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5" />
                Import Jobs
              </span>
              <div className="flex items-center gap-2">
                {selectedJobIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={bulkDeletingJobs}
                    onClick={handleBulkDeleteImportJobs}
                  >
                    {bulkDeletingJobs ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                    Delete {selectedJobIds.size}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => loadJobs()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={jobs.length > 0 && selectedJobIds.size === jobs.length}
                        onCheckedChange={toggleAllJobs}
                      />
                    </TableHead>
                    <TableHead className="caption">File / Source</TableHead>
                    <TableHead className="caption">Status</TableHead>
                    <TableHead className="caption">Total</TableHead>
                    <TableHead className="caption">Counts</TableHead>
                    <TableHead className="caption text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedJobIds.has(job.id)}
                          onCheckedChange={() => toggleJobSelection(job.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium truncate max-w-[200px] text-sm text-foreground">{job.file_name || "Unknown file"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{job.source || "manual_upload"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{formatDateTime(job.created_at)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={job.status === "completed" ? "secondary" : "outline"}>{job.status}</Badge>
                      </TableCell>
                      <TableCell className="folio text-foreground">{job.total_rows}</TableCell>
                      <TableCell className="font-mono text-xs leading-relaxed">
                        <span title="Imported">{job.imported_count} imp</span>
                        {job.duplicates_count > 0 && <span className="text-muted-foreground"> · {job.duplicates_count} dup</span>}
                        {job.registered_count > 0 && <span className="text-muted-foreground"> · {job.registered_count} reg</span>}
                        {job.invalid_count > 0 && <span className="text-muted-foreground"> · {job.invalid_count} inv</span>}
                        {job.suppressed_count > 0 && <span className="text-muted-foreground"> · {job.suppressed_count} sup</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setJobRowsPage(0);
                              setSelectedJobForRows(job.id);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Rows
                          </Button>
                          {confirmReleaseJobId === job.id ? (
                            <div className="flex items-center gap-1">
                              <Select value={releaseBatchSize} onValueChange={setReleaseBatchSize}>
                                <SelectTrigger className="h-8 w-[100px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="50">50 leads</SelectItem>
                                  <SelectItem value="100">100 leads</SelectItem>
                                  <SelectItem value="200">200 leads</SelectItem>
                                  <SelectItem value="500">500 leads</SelectItem>
                                  <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="default"
                                disabled={releasingJobId === job.id}
                                onClick={() => handleReleaseImportJob(job.id)}
                              >
                                {releasingJobId === job.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "Go"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setConfirmReleaseJobId(null);
                                  setReleaseBatchSize("all");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            job.status === "completed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-secondary hover:text-secondary"
                                onClick={() => setConfirmReleaseJobId(job.id)}
                                disabled={!!releasingJobId}
                                title="Release held emails for delivery"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Release
                              </Button>
                            )
                          )}
                          {confirmDeleteJobId === job.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={deletingJobId === job.id}
                                onClick={() => handleDeleteImportJob(job.id)}
                              >
                                {deletingJobId === job.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "Confirm"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setConfirmDeleteJobId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setConfirmDeleteJobId(job.id)}
                              disabled={!!deletingJobId}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {jobs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                        No import jobs yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          <div className="glass-card overflow-hidden rounded-[--radius]">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
              <span className="aura-microlabel flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                Leads Filters
              </span>
              <span className="caption">Status · stage · source</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
              <Input
                placeholder="Search email or name..."
                value={leadSearch}
                onChange={(e) => {
                  setLeadPage(0);
                  setLeadSearch(e.target.value);
                }}
              />
              <Select
                value={leadStatus}
                onValueChange={(value) => {
                  setLeadPage(0);
                  setLeadStatus(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                  <SelectItem value="suppressed">Suppressed</SelectItem>
                  <SelectItem value="already_registered">Already registered</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={leadEnrolled}
                onValueChange={(value) => {
                  setLeadPage(0);
                  setLeadEnrolled(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Enrollment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All leads</SelectItem>
                  <SelectItem value="not_enrolled">Not enrolled</SelectItem>
                  <SelectItem value="enrolled">Enrolled</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={leadOpens}
                onValueChange={(value) => {
                  setLeadPage(0);
                  setLeadOpens(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All opens</SelectItem>
                  <SelectItem value="never_opened">Never opened</SelectItem>
                  <SelectItem value="opened">Opened</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={leadImportJobFilter}
                onValueChange={(value) => {
                  setLeadPage(0);
                  setLeadImportJobFilter(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Import job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All import jobs</SelectItem>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {(job.file_name || "Unknown file").slice(0, 52)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={leadDateFrom}
                onChange={(e) => {
                  setLeadPage(0);
                  setLeadDateFrom(e.target.value);
                }}
              />
              <Input
                type="date"
                value={leadDateTo}
                onChange={(e) => {
                  setLeadPage(0);
                  setLeadDateTo(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="glass-card overflow-hidden rounded-[--radius]">
            <div className="flex flex-row items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
              <span className="aura-microlabel">Leads · {totalLeads.toLocaleString()}</span>
              <div className="flex items-center gap-2">
                {selectedLeadIds.size > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={releasingLeads}
                    onClick={() => setShowReleaseDialog(true)}
                  >
                    {releasingLeads ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                    Release {selectedLeadIds.size}
                  </Button>
                )}
                {selectedLeadIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={bulkDeletingLeads}
                    onClick={handleBulkDeleteLeads}
                  >
                    {bulkDeletingLeads ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                    Delete {selectedLeadIds.size}
                  </Button>
                )}
                {selectedLeadIds.size > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedLeadIds(new Set())}>
                    Deselect All
                  </Button>
                )}
                <div className="flex items-center gap-1">
                  <Select value={selectCount} onValueChange={setSelectCount}>
                    <SelectTrigger className="h-8 w-[90px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[50, 100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n.toLocaleString()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectingAll || totalLeads === 0}
                    onClick={() => selectAllFiltered()}
                  >
                    {selectingAll ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                    Select
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={refetchLeadsFromStart} disabled={leadsFetching}>
                  {leadsFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Refresh
                </Button>
              </div>
            </div>
            <div>
              {leadsLoading && leadRows.length === 0 ? (
                <div className="py-14 flex items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading leads...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={leadRows.length > 0 && selectedLeadIds.size === leadRows.length}
                          onCheckedChange={toggleAllLeads}
                        />
                      </TableHead>
                      <TableHead className="caption w-10 text-center">#</TableHead>
                      <TableHead className="caption">Email / Name</TableHead>
                      <TableHead className="caption">Import</TableHead>
                      <TableHead className="caption">Status</TableHead>
                      <TableHead className="caption">Current Stage</TableHead>
                      <TableHead className="caption">Next Send</TableHead>
                      <TableHead className="caption">Last Sent</TableHead>
                      <TableHead className="caption">Opens</TableHead>
                      <TableHead className="caption">Unsubscribed</TableHead>
                      <TableHead className="caption text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadRows.map((lead, idx) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-foreground/[0.03]"
                        onClick={() => setTimelineLeadId(lead.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedLeadIds.has(lead.id)}
                            onCheckedChange={() => toggleLeadSelection(lead.id)}
                          />
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium truncate max-w-[260px] text-foreground">{lead.email_raw || lead.email_normalized}</div>
                          <div className="text-xs text-muted-foreground">{formatLeadName(lead)}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="max-w-[220px] truncate text-foreground">{lead.import_file_name || "—"}</div>
                          <div className="font-mono text-muted-foreground">{lead.import_source || lead.source || "—"}</div>
                          <div className="font-mono text-muted-foreground">{formatDateTime(lead.imported_at || lead.created_at)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={lead.status === "active" ? "default" : "secondary"}>{lead.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {lead.current_stage_label}
                          {lead.current_stage_step ? <span className="text-muted-foreground"> (#{lead.current_stage_step})</span> : null}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{formatDateTime(lead.next_scheduled_at)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{formatDateTime(lead.last_sent_at)}</TableCell>
                        <TableCell className="folio text-foreground">{lead.opened_count}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{formatDateTime(lead.unsubscribed_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={deletingLeadId === lead.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void deleteLead(lead);
                            }}
                          >
                            {deletingLeadId === lead.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {leadRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          No leads found for current filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Infinite scroll sentinel */}
          {hasMoreLeads && (
            <div ref={sentinelRef} className="flex items-center justify-center py-6 text-muted-foreground gap-2">
              {leadsFetching && <Loader2 className="w-4 h-4 animate-spin" />}
              <span className="text-sm">{leadsFetching ? "Loading more..." : `Showing ${leadRows.length} of ${totalLeads}`}</span>
            </div>
          )}
          {!hasMoreLeads && totalLeads > 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              Showing all {totalLeads} leads
            </div>
          )}
        </TabsContent>

        {/* Releases Tab */}
        <TabsContent value="releases" className="space-y-4">
          <div className="glass-card overflow-hidden rounded-[--radius]">
            <div className="flex flex-row items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
              <span className="aura-microlabel flex items-center gap-2">
                <Play className="h-3.5 w-3.5 text-secondary" />
                Release Batches
              </span>
              <Button variant="outline" size="sm" onClick={() => refetchReleases()} disabled={releasesLoading}>
                {releasesLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh
              </Button>
            </div>
            <div className="p-4">
              {releasesLoading ? (
                <div className="py-14 flex items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading releases...
                </div>
              ) : releases.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Play className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p>No releases yet.</p>
                  <p className="text-sm mt-1">Go to the Leads tab, select leads, and click Release.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {releases.map((rel) => {
                    const stats = rel.stats ?? { total: 0, sent: 0, pending: 0, opened: 0, converted: 0 };
                    const openRate = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0;
                    const convRate = rel.lead_count > 0 ? Math.round((stats.converted / rel.lead_count) * 100) : 0;
                    return (
                      <div
                        key={rel.id}
                        className="cursor-pointer rounded-[--radius] border border-border bg-surface-2 p-4 transition-colors hover:bg-surface-3"
                        onClick={() => {
                          setExpandedReleaseId(expandedReleaseId === rel.id ? null : rel.id);
                          setReleaseDetailPage(0);
                        }}
                      >
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground">{rel.label || "Release"}</span>
                              <Badge variant="outline" className="text-xs">{rel.campaign_name}</Badge>
                            </div>
                            <p className="font-mono text-xs text-muted-foreground mt-0.5">
                              {formatDateTime(rel.created_at)} · {rel.lead_count} leads
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-center">
                            <div>
                              <p className="folio text-lg text-foreground">{stats.sent}</p>
                              <p className="caption">Sent</p>
                            </div>
                            <div>
                              <p className="folio text-lg text-foreground">{stats.pending}</p>
                              <p className="caption">Pending</p>
                            </div>
                            <div>
                              <p
                                className="folio text-lg"
                                style={{ color: `hsl(${openRate > 20 ? "var(--secondary)" : openRate > 10 ? "var(--rating)" : "var(--muted-foreground)"})` }}
                              >
                                {openRate}%
                              </p>
                              <p className="caption">Open Rate</p>
                            </div>
                            <div>
                              <p
                                className="folio text-lg"
                                style={{ color: `hsl(${convRate > 5 ? "var(--secondary)" : convRate > 0 ? "var(--rating)" : "var(--muted-foreground)"})` }}
                              >
                                {convRate}%
                              </p>
                              <p className="caption">Converted</p>
                            </div>
                          </div>
                        </div>

                        {expandedReleaseId === rel.id && (
                          <div className="mt-4 border-t border-border pt-4" onClick={(e) => e.stopPropagation()}>
                            {releaseDetailLoading ? (
                              <div className="py-6 flex items-center justify-center text-muted-foreground gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading leads...
                              </div>
                            ) : (
                              <>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="caption">Email</TableHead>
                                      <TableHead className="caption">Status</TableHead>
                                      <TableHead className="caption">Enrolled</TableHead>
                                      <TableHead className="caption">Sent</TableHead>
                                      <TableHead className="caption">Opened</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(releaseDetailData?.leads ?? []).map((lead) => (
                                      <TableRow key={lead.lead_id}>
                                        <TableCell>
                                          <div className="text-sm font-medium text-foreground">{lead.email}</div>
                                          <div className="text-xs text-muted-foreground">{lead.name}</div>
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant={lead.status === "active" ? "default" : "secondary"}>{lead.status}</Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{formatDateTime(lead.enrolled_at)}</TableCell>
                                        <TableCell className="folio text-foreground">{lead.emails_sent}</TableCell>
                                        <TableCell className="folio text-foreground">{lead.emails_opened}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                                {releaseDetailData && releaseDetailData.total > 25 && (
                                  <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                                    <span>Page {releaseDetailPage + 1} of {Math.ceil(releaseDetailData.total / 25)}</span>
                                    <div className="flex gap-1">
                                      <Button variant="outline" size="sm" disabled={releaseDetailPage === 0} onClick={() => setReleaseDetailPage((p) => p - 1)}>Prev</Button>
                                      <Button variant="outline" size="sm" disabled={releaseDetailPage >= Math.ceil(releaseDetailData.total / 25) - 1} onClick={() => setReleaseDetailPage((p) => p + 1)}>Next</Button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {releasesTotal > 20 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Page {releasePage + 1} of {releasesTotalPages}</span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" disabled={releasePage === 0} onClick={() => setReleasePage((p) => p - 1)}>Prev</Button>
                        <Button variant="outline" size="sm" disabled={releasePage >= releasesTotalPages - 1} onClick={() => setReleasePage((p) => p + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Release Confirmation Dialog */}
      <AlertDialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-[--radius] border border-secondary/30 bg-secondary/10">
                <Play className="w-5 h-5 text-secondary" />
              </div>
              Release {selectedLeadIds.size} Leads
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                This will enroll {selectedLeadIds.size} lead(s) into the email campaign and schedule all campaign emails for delivery.
              </span>
              <label className="block">
                <span className="text-xs font-medium text-foreground">Label (optional)</span>
                <Input
                  className="mt-1"
                  placeholder="e.g. Batch #3 — new template"
                  value={releaseLabel}
                  onChange={(e) => setReleaseLabel(e.target.value)}
                />
              </label>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReleaseLeads}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              <Play className="w-4 h-4 mr-1" />
              Release
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet
        open={Boolean(selectedJobForRows)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJobForRows(null);
            setJobRowsPage(0);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-auto">
          <SheetHeader>
            <SheetTitle>Import Job Rows</SheetTitle>
            <SheetDescription>Row-level dedupe/import outcomes for the selected import job.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => refetchImportRows()} disabled={importRowsLoading}>
                {importRowsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh
              </Button>
            </div>
            <div className="overflow-hidden rounded-[--radius] border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="caption">Row</TableHead>
                    <TableHead className="caption">Email</TableHead>
                    <TableHead className="caption">Result</TableHead>
                    <TableHead className="caption">Reason</TableHead>
                    <TableHead className="caption">Lead Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="folio text-foreground">{row.row_number}</TableCell>
                      <TableCell className="max-w-[260px] truncate font-mono text-xs text-foreground">{row.email_raw || row.email_normalized || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.result}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">{row.reason || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.lead?.status || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {importRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No rows found for this import job.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {importRowsTotal > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {jobRowsPage * importRowsPageSize + 1}-{Math.min((jobRowsPage + 1) * importRowsPageSize, importRowsTotal)} of{" "}
                  {importRowsTotal}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={jobRowsPage === 0}
                    onClick={() => setJobRowsPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={jobRowsPage >= importRowsTotalPages - 1}
                    onClick={() => setJobRowsPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(timelineLeadId)}
        onOpenChange={(open) => {
          if (!open) setTimelineLeadId(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-[--radius] border border-primary/30 bg-primary/10">
                <User className="w-5 h-5 text-primary" />
              </div>
              Lead Timeline
            </SheetTitle>
            <SheetDescription>Import origin, campaign steps, unsubscribe state, opens, and email logs.</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-5">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => refetchTimeline()} disabled={timelineLoading}>
                {timelineLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh
              </Button>
            </div>

            {timelineLoading ? (
              <div className="py-14 flex items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading timeline...
              </div>
            ) : timelineData ? (
              <>
                {/* Lead Overview — card grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="glass-card flex items-start gap-3 rounded-[--radius] p-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[--radius] border border-border bg-primary/10"><Mail className="w-4 h-4 text-primary" /></div>
                    <div className="min-w-0">
                      <p className="caption">Email</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{timelineData.lead.email_raw || timelineData.lead.email_normalized}</p>
                    </div>
                  </div>
                  <div className="glass-card flex items-start gap-3 rounded-[--radius] p-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[--radius] border border-border bg-accent/10"><User className="w-4 h-4 text-accent" /></div>
                    <div className="min-w-0">
                      <p className="caption">Name</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{`${timelineData.lead.first_name || ""} ${timelineData.lead.last_name || ""}`.trim() || "—"}</p>
                    </div>
                  </div>
                  <div className="glass-card flex items-start gap-3 rounded-[--radius] p-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[--radius] border border-border bg-secondary/10"><Shield className="w-4 h-4 text-secondary" /></div>
                    <div className="min-w-0">
                      <p className="caption">Status</p>
                      <Badge variant={timelineData.lead.status === "active" ? "default" : "secondary"} className="mt-0.5">{timelineData.lead.status}</Badge>
                    </div>
                  </div>
                  <div className="glass-card flex items-start gap-3 rounded-[--radius] p-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[--radius] border border-border bg-muted"><Clock className="w-4 h-4 text-muted-foreground" /></div>
                    <div className="min-w-0">
                      <p className="caption">Unsubscribed</p>
                      <p className="mt-0.5 font-mono text-xs text-foreground">{formatDateTime(timelineData.lead.unsubscribed_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Import Events */}
                <div className="glass-card overflow-hidden rounded-[--radius]">
                  <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                    <span className="aura-microlabel flex items-center gap-2">
                      <FileDown className="h-3.5 w-3.5" />
                      Import Events
                    </span>
                  </div>
                  <div className="space-y-2 p-4">
                    {timelineData.importEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No import events found.</p>
                    ) : (
                      timelineData.importEvents.map((event) => (
                        <div key={event.id} className="flex items-center gap-3 rounded-[--radius] border border-border bg-surface-2 p-3">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[--radius] border border-border bg-accent/10"><FileSpreadsheet className="w-3.5 h-3.5 text-accent" /></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate text-foreground">{event.job?.file_name || "—"}</p>
                            <p className="font-mono text-xs text-muted-foreground">{event.job?.source || "—"} · {formatDateTime(event.created_at)}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0">{event.result}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Enrollments */}
                <div className="glass-card overflow-hidden rounded-[--radius]">
                  <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                    <span className="aura-microlabel flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5" />
                      Enrollments
                    </span>
                  </div>
                  <div className="space-y-2 p-4">
                    {timelineData.enrollments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No enrollments found.</p>
                    ) : (
                      timelineData.enrollments.map((enrollment) => (
                        <div key={enrollment.id} className="flex items-center gap-3 rounded-[--radius] border border-border bg-surface-2 p-3">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[--radius] border border-border bg-primary/10"><Send className="w-3.5 h-3.5 text-primary" /></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate text-foreground">{enrollment.campaign_name || enrollment.campaign_id}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              Enrolled {formatDateTime(enrollment.enrolled_at)}
                              {enrollment.last_sent_step ? ` · Last step: ${enrollment.last_sent_step}` : ""}
                            </p>
                          </div>
                          <Badge
                            variant={enrollment.status === "active" ? "default" : "secondary"}
                            className="shrink-0"
                          >
                            {enrollment.status}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Scheduled Emails — visual step cards */}
                <div className="glass-card overflow-hidden rounded-[--radius]">
                  <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                    <span className="aura-microlabel flex items-center gap-2">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Scheduled Emails
                    </span>
                  </div>
                  <div className="space-y-2 p-4">
                    {timelineData.scheduledEmails.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No scheduled emails found.</p>
                    ) : (
                      timelineData.scheduledEmails.map((item) => {
                        const statusColor =
                          item.status === "sent" ? "border-secondary/40 bg-secondary/15 text-secondary" :
                          item.status === "held" ? "border-[hsl(var(--rating))]/40 bg-[hsl(var(--rating))]/15 text-[hsl(var(--rating))]" :
                          item.status === "pending" ? "border-primary/40 bg-primary/15 text-primary" :
                          item.status === "failed" ? "border-destructive/40 bg-destructive/15 text-destructive" : "";
                        return (
                          <div key={item.id} className="rounded-[--radius] border border-border bg-surface-2 p-3">
                            <div className="flex items-center gap-3">
                              <div className="folio grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm text-primary">
                                {item.step_order}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className={statusColor}>{item.status}</Badge>
                                  <span className="font-mono text-xs text-muted-foreground">{item.sender_profile}</span>
                                </div>
                                <p className="font-mono text-xs text-muted-foreground mt-1">
                                  Scheduled: {formatDateTime(item.scheduled_at)}
                                  {item.sent_at ? ` · Sent: ${formatDateTime(item.sent_at)}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                                {item.opened_count > 0 && (
                                  <span className="flex items-center gap-1 text-secondary">
                                    <MousePointerClick className="w-3.5 h-3.5" /> {item.opened_count}
                                  </span>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                                  <Link to={`/dashboard/admin/email-logs?leadId=${timelineData.lead.id}&scheduledEmailId=${item.id}`}>
                                    Logs
                                  </Link>
                                </Button>
                              </div>
                            </div>
                            {item.last_error && (
                              <div className="mt-2 truncate rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                                {item.last_error}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Open Events */}
                <div className="glass-card overflow-hidden rounded-[--radius]">
                  <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                    <span className="aura-microlabel flex items-center gap-2">
                      <MousePointerClick className="h-3.5 w-3.5" />
                      Open Events
                    </span>
                  </div>
                  <div className="space-y-2 p-4">
                    {timelineData.openEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No open events yet.</p>
                    ) : (
                      timelineData.openEvents.map((event) => (
                        <div key={event.id} className="flex items-center gap-3 rounded-[--radius] border border-border bg-surface-2 p-3">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[--radius] border border-border bg-secondary/10"><Eye className="w-3.5 h-3.5 text-secondary" /></div>
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs text-foreground">{formatDateTime(event.opened_at)}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {event.ip_address || "—"} · {event.device_type || "Unknown device"}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="glass-card overflow-hidden rounded-[--radius]">
                  <div className="flex flex-row items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                    <span className="aura-microlabel">Email Logs</span>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/dashboard/admin/email-logs?leadId=${timelineData.lead.id}`}>Open Email Logs</Link>
                    </Button>
                  </div>
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="caption">Time</TableHead>
                          <TableHead className="caption">Type</TableHead>
                          <TableHead className="caption">Subject</TableHead>
                          <TableHead className="caption">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {timelineData.emailLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{formatDateTime(log.created_at)}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{log.email_type}</TableCell>
                            <TableCell className="max-w-[340px] truncate text-sm">{log.subject}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{log.status}</TableCell>
                          </TableRow>
                        ))}
                        {timelineData.emailLogs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                              No email logs found for this lead.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-muted-foreground">No timeline data found.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
