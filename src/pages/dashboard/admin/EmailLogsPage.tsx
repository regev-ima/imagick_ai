import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Mail, CheckCircle2, XCircle, SkipForward, Search, RefreshCw, ArrowLeft, Info, Copy, Check, Calendar, RotateCcw, Loader2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Error details popup ────────────────────────────────────────────────────
function ErrorDetailsDialog({ errorMessage }: { errorMessage: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  let formatted = errorMessage;
  try {
    formatted = JSON.stringify(JSON.parse(errorMessage), null, 2);
  } catch {
    // not JSON — show as-is
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="ml-1 inline-flex items-center text-destructive hover:text-destructive/80 transition-colors"
        title="View error details"
      >
        <Info className="w-3 h-3" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-4 h-4" />
              Error Details
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <pre className="surface-2 rounded-[--radius] p-4 text-xs overflow-auto max-h-96 whitespace-pre-wrap break-all font-mono text-foreground">
              {formatted}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2 h-7 gap-1.5 text-xs"
              onClick={handleCopy}
            >
              {copied ? <Check className="w-3 h-3 text-secondary" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  welcome_email:            "Welcome",
  gallery_upload_complete:  "Upload Complete",
  gallery_images_ready:     "Editing Complete",
  style_training_started:   "Training Started",
  style_ready:              "Style Ready",
  re_edit_submitted:        "Re-edit Started",
  re_edit_complete:         "Re-edit Complete",
  gallery_shared:           "Gallery Shared",
  gallery_shared_client:    "Gallery Invite (Client)",
  subscription_change:      "Plan/Credits Update",
  password_reset:           "Password Reset",
  lead_campaign:            "Lead Campaign",
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; classes: string }> = {
  sent:    { label: "Sent",    icon: <CheckCircle2 className="w-3 h-3" />, classes: "bg-secondary/10 text-secondary border-secondary/30" },
  failed:  { label: "Failed",  icon: <XCircle      className="w-3 h-3" />, classes: "bg-destructive/10 text-destructive border-destructive/30" },
  skipped: { label: "Skipped", icon: <SkipForward  className="w-3 h-3" />, classes: "bg-muted text-muted-foreground border-border" },
};

const PAGE_SIZE = 50;

export default function EmailLogsPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [search, setSearch]       = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [page, setPage]           = useState(0);
  const [allLogs, setAllLogs]     = useState<any[]>([]);
  const [retrying, setRetrying]   = useState(false);
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const [retryPreviewCount, setRetryPreviewCount] = useState<number | null>(null);
  const [retryingSingle, setRetryingSingle] = useState<string | null>(null);
  const [errorSummaryExpanded, setErrorSummaryExpanded] = useState(false);
  const leadIdFilter = searchParams.get("leadId")?.trim() ?? "";
  const scheduledEmailIdFilter = searchParams.get("scheduledEmailId")?.trim() ?? "";
  const hasMetadataFilters = Boolean(leadIdFilter || scheduledEmailIdFilter);

  // Date presets + month options
  const datePresets: { value: string; label: string }[] = useMemo(() => {
    const presets = [
      { value: "today", label: "Today" },
      { value: "7d", label: "Last 7 days" },
      { value: "this_month", label: "This month" },
      { value: "30d", label: "Last 30 days" },
      { value: "60d", label: "Last 60 days" },
      { value: "90d", label: "Last 90 days" },
    ];
    // Add last 12 months
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `month:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      presets.push({ value, label });
    }
    presets.push({ value: "custom", label: "Custom range…" });
    presets.push({ value: "all", label: "All time" });
    return presets;
  }, []);

  const dateRange = useMemo((): { start?: string; end?: string } => {
    const now = new Date();
    if (dateFilter === "all") return {};
    if (dateFilter === "today") {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: s.toISOString() };
    }
    if (dateFilter === "7d") return { start: new Date(Date.now() - 7 * 86400000).toISOString() };
    if (dateFilter === "this_month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s.toISOString() };
    }
    if (dateFilter === "30d") return { start: new Date(Date.now() - 30 * 86400000).toISOString() };
    if (dateFilter === "60d") return { start: new Date(Date.now() - 60 * 86400000).toISOString() };
    if (dateFilter === "90d") return { start: new Date(Date.now() - 90 * 86400000).toISOString() };
    if (dateFilter.startsWith("month:")) {
      const [y, m] = dateFilter.slice(6).split("-").map(Number);
      return { start: new Date(y, m - 1, 1).toISOString(), end: new Date(y, m, 1).toISOString() };
    }
    if (dateFilter === "custom") {
      const r: { start?: string; end?: string } = {};
      if (customFrom) r.start = new Date(customFrom + "T00:00:00").toISOString();
      if (customTo) r.end = new Date(customTo + "T23:59:59.999").toISOString();
      return r;
    }
    return {};
  }, [dateFilter, customFrom, customTo]);

  const periodLabel = datePresets.find((p) => p.value === dateFilter)?.label ?? dateFilter;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-email-logs", page, typeFilter, statusFilter, dateFilter, customFrom, customTo, search, leadIdFilter, scheduledEmailIdFilter],
    queryFn: async () => {
      let query = supabase
        .from("email_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (typeFilter !== "all") query = query.eq("email_type", typeFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (leadIdFilter) query = query.contains("metadata", { lead_id: leadIdFilter });
      if (scheduledEmailIdFilter) query = query.contains("metadata", { scheduled_email_id: scheduledEmailIdFilter });

      if (dateRange.start) query = query.gte("created_at", dateRange.start);
      if (dateRange.end) query = query.lt("created_at", dateRange.end);

      if (search.trim()) {
        const escaped = search.trim().replace(/[%_]/g, "");
        query = query.or(`recipient_email.ilike.%${escaped}%,subject.ilike.%${escaped}%`);
      }

      const { data, error, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { logs: data ?? [], total: count ?? 0 };
    },
  });

  const totalLogs = data?.total ?? 0;

  // Accumulate logs for infinite scroll
  useEffect(() => {
    if (!data?.logs) return;
    if (page === 0) {
      setAllLogs(data.logs);
    } else {
      setAllLogs((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        const newLogs = data.logs.filter((l: any) => !existingIds.has(l.id));
        return [...prev, ...newLogs];
      });
    }
  }, [data, page]);

  // Reset accumulated logs when filters change
  const filterKey = `${typeFilter}|${statusFilter}|${dateFilter}|${customFrom}|${customTo}|${search}|${leadIdFilter}|${scheduledEmailIdFilter}`;
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      setAllLogs([]);
      setPage(0);
    }
  }, [filterKey]);

  const hasMore = allLogs.length < totalLogs;

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isFetching) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isFetching) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isFetching]);

  const refetchFromStart = useCallback(() => {
    setAllLogs([]);
    setPage(0);
    setTimeout(() => refetch(), 0);
  }, [refetch]);

  const allTypes = Object.keys(EMAIL_TYPE_LABELS);

  // Summary counts — reactive to date filter (using exact count queries to avoid 1000-row limit)
  const { data: summaryData } = useQuery({
    queryKey: ["admin-email-summary", dateFilter, customFrom, customTo],
    queryFn: async () => {
      const applyDateFilter = (q: any) => {
        if (dateRange.start) q = q.gte("created_at", dateRange.start);
        if (dateRange.end) q = q.lt("created_at", dateRange.end);
        return q;
      };

      const countQuery = (status: string, emailType?: string) => {
        let q = supabase.from("email_logs").select("id", { count: "exact", head: true }).eq("status", status);
        if (emailType === "lead_campaign") q = q.eq("email_type", "lead_campaign");
        else if (emailType === "system") q = q.neq("email_type", "lead_campaign");
        return applyDateFilter(q);
      };

      const [sent, failed, skipped, mSent, mFailed, sSent, sFailed] = await Promise.all([
        countQuery("sent"),
        countQuery("failed"),
        countQuery("skipped"),
        countQuery("sent", "lead_campaign"),
        countQuery("failed", "lead_campaign"),
        countQuery("sent", "system"),
        countQuery("failed", "system"),
      ]);

      return {
        sent:    sent.count ?? 0,
        failed:  failed.count ?? 0,
        skipped: skipped.count ?? 0,
        marketing: { sent: mSent.count ?? 0, failed: mFailed.count ?? 0 },
        system:    { sent: sSent.count ?? 0, failed: sFailed.count ?? 0 },
      };
    },
  });

  // Error summary query — aggregates error messages for failed emails (paginated to avoid 1000-row limit)
  const { data: errorSummary } = useQuery({
    queryKey: ["admin-email-error-summary", dateFilter, customFrom, customTo, typeFilter],
    queryFn: async () => {
      const buildQuery = (offset: number, limit: number) => {
        let q = supabase
          .from("email_logs")
          .select("error_message")
          .eq("status", "failed")
          .not("error_message", "is", null);
        if (typeFilter !== "all") q = q.eq("email_type", typeFilter);
        if (dateRange.start) q = q.gte("created_at", dateRange.start);
        if (dateRange.end) q = q.lt("created_at", dateRange.end);
        return q.range(offset, offset + limit - 1);
      };

      const allRows: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      while (true) {
        const { data } = await buildQuery(offset, batchSize);
        if (!data?.length) break;
        allRows.push(...data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }

      if (!allRows.length) return [];

      const counts = new Map<string, number>();
      for (const row of allRows) {
        const msg = row.error_message ?? "Unknown error";
        counts.set(msg, (counts.get(msg) ?? 0) + 1);
      }

      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([message, count]) => ({ message, count }));
    },
    enabled: (summaryData?.failed ?? 0) > 0,
  });

  const retryFilterParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (dateRange.start) params.dateFrom = dateRange.start;
    if (dateRange.end) params.dateTo = dateRange.end;
    if (typeFilter !== "all") params.emailType = typeFilter;
    return params;
  }, [dateRange, typeFilter]);

  const handleRetryClick = async () => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-lead-observability", {
        body: { action: "retryFailedEmails", ...retryFilterParams, dryRun: true },
      });
      if (error) throw error;
      setRetryPreviewCount(data?.count ?? 0);
      setRetryDialogOpen(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  const handleRetryConfirm = async () => {
    setRetryDialogOpen(false);
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-lead-observability", {
        body: { action: "retryFailedEmails", ...retryFilterParams },
      });
      if (error) throw error;
      toast({
        title: "Retry queued",
        description: `${data?.retriedCount ?? 0} failed emails reset to pending.`,
      });
      refetchFromStart();
    } catch (err: any) {
      toast({ title: "Retry failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  const handleRetrySingle = async (scheduledEmailId: string) => {
    setRetryingSingle(scheduledEmailId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-lead-observability", {
        body: { action: "retryFailedEmails", scheduledEmailIds: [scheduledEmailId] },
      });
      if (error) throw error;
      toast({
        title: "Email re-queued",
        description: data?.retriedCount ? "Email reset to pending." : "No matching failed email found.",
      });
      refetchFromStart();
    } catch (err: any) {
      toast({ title: "Retry failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setRetryingSingle(null);
    }
  };

  return (
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <Button variant="ghost" size="icon" asChild className="w-8 h-8">
            <Link to="/dashboard/admin" aria-label="Back to admin"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <span className="caption">Delivery via Resend</span>
            <h1 className="text-3xl font-semibold tracking-tight">Email Logs</h1>
          </div>
        </div>
        <p className="text-muted-foreground pl-11">
          All transactional emails sent from Imagick.ai via Resend.
        </p>
      </motion.div>

      {hasMetadataFilters && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card rounded-[--radius] border-border">
            <CardContent className="pt-4 flex flex-wrap items-center gap-2">
              {leadIdFilter && <Badge variant="secondary">Lead: {leadIdFilter}</Badge>}
              {scheduledEmailIdFilter && <Badge variant="secondary">Scheduled Email: {scheduledEmailIdFilter}</Badge>}
              <Button variant="ghost" size="sm" asChild className="ml-auto">
                <Link to="/dashboard/admin/email-logs">Clear context filters</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Summary cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        {/* Totals */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: `Sent (${periodLabel})`,    value: summaryData?.sent    ?? "–", color: "text-secondary" },
            { label: `Failed (${periodLabel})`,  value: summaryData?.failed  ?? "–", color: "text-destructive" },
            { label: `Skipped (${periodLabel})`, value: summaryData?.skipped ?? "–", color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="glass-card rounded-[--radius] border-border">
              <CardContent className="pt-4 pb-4">
                <p className={cn("folio text-2xl", color)}>{value}</p>
                <p className="caption mt-1">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Marketing vs System split */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="glass-card rounded-[--radius] border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-[--radius] bg-accent/10"><Mail className="w-3.5 h-3.5 text-accent" /></div>
                <span className="text-sm font-medium">Marketing (Lead Campaign)</span>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <p className="folio text-xl text-secondary">{summaryData?.marketing?.sent ?? "–"}</p>
                  <p className="caption mt-0.5">Sent</p>
                </div>
                <div>
                  <p className="folio text-xl text-destructive">{summaryData?.marketing?.failed ?? "–"}</p>
                  <p className="caption mt-0.5">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card rounded-[--radius] border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-[--radius] bg-primary/10"><Mail className="w-3.5 h-3.5 text-primary" /></div>
                <span className="text-sm font-medium">System (Transactional)</span>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <p className="folio text-xl text-secondary">{summaryData?.system?.sent ?? "–"}</p>
                  <p className="caption mt-0.5">Sent</p>
                </div>
                <div>
                  <p className="folio text-xl text-destructive">{summaryData?.system?.failed ?? "–"}</p>
                  <p className="caption mt-0.5">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Summary */}
        {errorSummary && errorSummary.length > 0 && (
          <Card className="glass-card rounded-[--radius] border-destructive/20 bg-destructive/5">
            <CardContent className="pt-4 pb-4">
              <button
                onClick={() => setErrorSummaryExpanded((v) => !v)}
                className="flex items-center gap-2 w-full text-left"
              >
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  Top Failure Reasons ({errorSummary.reduce((s, e) => s + e.count, 0)} errors)
                </span>
                {errorSummaryExpanded
                  ? <ChevronUp className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
                  : <ChevronDown className="w-3.5 h-3.5 ml-auto text-muted-foreground" />}
              </button>
              {errorSummaryExpanded && (
                <div className="mt-3 space-y-2">
                  {errorSummary.map((err, i) => {
                    let display = err.message;
                    try { display = JSON.parse(err.message)?.message ?? err.message; } catch {}
                    return (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <Badge variant="outline" className="shrink-0 text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                          {err.count}x
                        </Badge>
                        <span className="text-muted-foreground break-all line-clamp-2">{display}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-wrap gap-3"
      >
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or subject…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {allTypes.map((t) => (
              <SelectItem key={t} value={t}>{EMAIL_TYPE_LABELS[t] || t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {datePresets.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dateFilter === "custom" && (
          <>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); setPage(0); }}
              className="w-36"
              placeholder="From"
            />
            <Input
              type="date"
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setPage(0); }}
              className="w-36"
              placeholder="To"
            />
          </>
        )}

        <Button variant="outline" size="icon" onClick={refetchFromStart} disabled={isFetching} aria-label="Refresh from start">
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRetryClick}
          disabled={retrying}
          className="gap-1.5 text-[hsl(var(--rating))] border-[hsl(var(--rating))]/30 hover:bg-[hsl(var(--rating))]/10"
        >
          {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Retry Failed
        </Button>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="glass-card overflow-hidden rounded-[--radius] border-border p-0">
          <CardHeader className="border-b border-border bg-background/40 px-4 py-2.5">
            <CardTitle className="aura-microlabel flex items-center gap-2 text-muted-foreground">
              <Mail className="w-3.5 h-3.5" />
              <span className="folio">{totalLogs.toLocaleString()}</span> total logs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && page === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : allLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Mail className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No email logs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="caption text-left px-4 py-3">Date</th>
                      <th className="caption text-left px-4 py-3">Type</th>
                      <th className="caption text-left px-4 py-3">Recipient</th>
                      <th className="caption text-left px-4 py-3 hidden md:table-cell">Subject</th>
                      <th className="caption text-left px-4 py-3">Status</th>
                      <th className="caption text-left px-4 py-3 hidden lg:table-cell">Resend ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allLogs.map((log, i) => {
                      const statusCfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.sent;
                      const date = new Date(log.created_at);
                      return (
                        <tr
                          key={log.id}
                          className={cn(
                            "border-b border-border hover:bg-foreground/[0.03] transition-colors",
                            i % 2 === 0 ? "" : "bg-foreground/[0.015]"
                          )}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                            <div>{date.toLocaleDateString()}</div>
                            <div>{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium">
                              {EMAIL_TYPE_LABELS[log.email_type] || log.email_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">{log.recipient_email}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                            {log.subject}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={cn("gap-1 text-[10px] px-1.5 py-0.5", statusCfg.classes)}
                              >
                                {statusCfg.icon}
                                {statusCfg.label}
                              </Badge>
                              {log.error_message && (
                                <ErrorDetailsDialog errorMessage={log.error_message} />
                              )}
                              {log.status === "failed" && log.metadata?.scheduled_email_id && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRetrySingle(log.metadata.scheduled_email_id); }}
                                  disabled={retryingSingle === log.metadata.scheduled_email_id}
                                  className="ml-1 inline-flex items-center text-[hsl(var(--rating))] hover:opacity-80 transition-opacity disabled:opacity-50"
                                  title="Retry this email"
                                >
                                  {retryingSingle === log.metadata.scheduled_email_id
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <RotateCcw className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono hidden lg:table-cell">
                            {log.resend_message_id ? (
                              <span title={log.resend_message_id}>
                                {log.resend_message_id.slice(0, 16)}…
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-6 text-muted-foreground gap-2">
          {isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
          <span className="text-sm">{isFetching ? "Loading more..." : `Showing ${allLogs.length} of ${totalLogs}`}</span>
        </div>
      )}

      {/* Retry confirmation dialog */}
      <AlertDialog open={retryDialogOpen} onOpenChange={setRetryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry failed emails?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will reset <strong>{retryPreviewCount}</strong> failed email{retryPreviewCount !== 1 ? "s" : ""} back to pending.
                  They will be re-sent on the next queue cycle.
                </p>
                {(dateFilter !== "all" || typeFilter !== "all") && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {dateFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        {periodLabel}
                      </Badge>
                    )}
                    {typeFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        {EMAIL_TYPE_LABELS[typeFilter] ?? typeFilter}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetryConfirm} className="bg-[hsl(var(--rating))] text-background hover:opacity-90">
              Retry {retryPreviewCount} email{retryPreviewCount !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
