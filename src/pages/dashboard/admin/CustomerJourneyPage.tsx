import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, Search, ArrowLeft, AlertTriangle, Users, UserCheck, RefreshCw,
  Clock, Mail, CheckCircle, XCircle, Ban,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | null; color: string }> = {
  new:        { label: "New",        variant: "outline",     color: "text-muted-foreground" },
  onboarding: { label: "Onboarding", variant: "secondary",   color: "text-accent" },
  exploring:  { label: "Exploring",  variant: "secondary",   color: "text-accent" },
  engaged:    { label: "Engaged",    variant: "secondary",   color: "text-secondary" },
  converting: { label: "Converting", variant: "default",     color: "text-[hsl(var(--rating))]" },
  paying:     { label: "Paying",     variant: "default",     color: "text-primary" },
  at_risk:    { label: "At Risk",    variant: "destructive", color: "text-[hsl(var(--rating))]" },
  churned:    { label: "Churned",    variant: "destructive", color: "text-destructive" },
};

const STAGE_OPTIONS = ["all", ...Object.keys(STAGE_CONFIG)];

const ENROLLMENT_STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  active:    { label: "Pending",   icon: Clock,       color: "text-[hsl(var(--rating))]" },
  completed: { label: "Completed", icon: CheckCircle, color: "text-secondary" },
  cancelled: { label: "Cancelled", icon: Ban,         color: "text-muted-foreground" },
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LifecycleProfile {
  user_id: string;
  lifecycle_stage: string;
  conversion_score: number;
  gallery_count: number;
  images_processed: number;
  login_count: number;
  last_active_at: string | null;
  is_paid: boolean;
  last_computed_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  user_metadata?: { full_name?: string };
  created_at: string;
}

interface Enrollment {
  id: string;
  user_id: string;
  sequence_id: string;
  status: string;
  current_step: number;
  enrolled_at: string;
  next_send_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-secondary" : score >= 40 ? "bg-[hsl(var(--rating))]" : "bg-muted-foreground";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="folio text-xs text-muted-foreground">{score}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomerJourneyPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const navigate = useNavigate();

  // Load lifecycle profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-lifecycle-profiles"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("user_lifecycle_profiles" as any)
          .select("*")
          .order("conversion_score", { ascending: false });
        if (error) return [] as LifecycleProfile[];
        return (data ?? []) as unknown as LifecycleProfile[];
      } catch {
        return [] as LifecycleProfile[];
      }
    },
  });

  // Load users via admin edge function
  const { data: adminUsers, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-list-users");
      if (error) throw error;
      return (data?.users ?? []) as AdminUser[];
    },
  });

  // Load enrollments
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["admin-enrollments"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("user_sequence_enrollments" as any)
          .select("*")
          .order("next_send_at", { ascending: true });
        if (error) return [] as Enrollment[];
        return (data ?? []) as unknown as Enrollment[];
      } catch {
        return [] as Enrollment[];
      }
    },
  });

  // Load sequence steps for step labels
  const { data: sequenceSteps } = useQuery({
    queryKey: ["admin-sequence-steps"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("email_sequence_steps" as any)
          .select("sequence_id, step_order, subject, email_type")
          .order("step_order", { ascending: true });
        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
    },
  });

  // Merge profiles with user info
  const userMap = new Map((adminUsers ?? []).map((u) => [u.id, u]));

  const rows = (profiles ?? [])
    .map((p) => ({ ...p, user: userMap.get(p.user_id) }))
    .filter((r) => {
      if (stageFilter !== "all" && r.lifecycle_stage !== stageFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const email = r.user?.email?.toLowerCase() ?? "";
        const name = (r.user?.user_metadata?.full_name ?? "").toLowerCase();
        if (!email.includes(q) && !name.includes(q)) return false;
      }
      return true;
    });

  // Stats
  const atRiskCount = (profiles ?? []).filter((p) => p.lifecycle_stage === "at_risk").length;
  const payingCount = (profiles ?? []).filter((p) => p.lifecycle_stage === "paying").length;
  const activeEnrollments = (enrollments ?? []).filter((e: any) => e.status === "active").length;

  // Get step info by sequence_id + step_order
  const getStepLabel = (sequenceId: string, stepOrder: number) => {
    const step = (sequenceSteps ?? []).find(
      (s: any) => s.sequence_id === sequenceId && s.step_order === stepOrder
    );
    return step ? (step as any).subject : `Step ${stepOrder}`;
  };

  const isLoading = profilesLoading || usersLoading;

  return (
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/admin"><ArrowLeft className="w-4 h-4 mr-1" />Admin</Link>
          </Button>
          <div>
            <span className="caption">Lifecycle</span>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-accent" />Customer Journey
            </h1>
            <p className="text-sm text-muted-foreground">Lifecycle stages, conversion scores & automated emails</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs border-border text-muted-foreground">
          <Clock className="w-3 h-3" />
          Automated — runs every hour
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Tracked", value: profiles?.length ?? 0, icon: Users, color: "text-foreground", bg: "bg-muted" },
          { label: "Paying Customers", value: payingCount, icon: UserCheck, color: "text-primary", bg: "bg-primary/10" },
          { label: "At Risk", value: atRiskCount, icon: AlertTriangle, color: "text-[hsl(var(--rating))]", bg: "bg-[hsl(var(--rating))]/10" },
          { label: "Pending Emails", value: activeEnrollments, icon: Mail, color: "text-accent", bg: "bg-accent/10" },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="glass-card rounded-[--radius] border-border">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="caption">{label}</p>
                    <p className={`folio text-3xl mt-1 ${color}`}>{value}</p>
                  </div>
                  <div className={`p-3 rounded-[--radius] ${bg}`}><Icon className={`w-5 h-5 ${color}`} /></div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="emails">Email Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="glass-card overflow-hidden rounded-[--radius] border-border p-0">
            <CardHeader className="border-b border-border bg-background/40 p-3">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search by email or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter stage" /></SelectTrigger>
                  <SelectContent>
                    {STAGE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s === "all" ? "All Stages" : STAGE_CONFIG[s]?.label ?? s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="caption">User</TableHead>
                      <TableHead className="caption">Stage</TableHead>
                      <TableHead className="caption">Score</TableHead>
                      <TableHead className="caption">Galleries</TableHead>
                      <TableHead className="caption">Last Active</TableHead>
                      <TableHead className="caption">Plan</TableHead>
                      <TableHead className="caption text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                    ) : rows.map((row) => {
                      const stageConf = STAGE_CONFIG[row.lifecycle_stage] ?? { label: row.lifecycle_stage, variant: "outline" as const };
                      return (
                        <TableRow key={row.user_id} className="border-border">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{row.user?.user_metadata?.full_name ?? "—"}</span>
                              <span className="text-xs text-muted-foreground">{row.user?.email ?? row.user_id}</span>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant={stageConf.variant as any} className={cn(stageConf.variant === "outline" && "border-border text-muted-foreground")}>{stageConf.label}</Badge></TableCell>
                          <TableCell><ScoreBar score={row.conversion_score} /></TableCell>
                          <TableCell><span className="folio text-sm">{row.gallery_count}</span></TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {row.last_active_at ? formatDistanceToNow(new Date(row.last_active_at), { addSuffix: true }) : "Never"}
                            </span>
                          </TableCell>
                          <TableCell><Badge variant={row.is_paid ? "default" : "outline"} className={cn(!row.is_paid && "border-border text-muted-foreground")}>{row.is_paid ? "Paid" : "Free"}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/admin/users/${row.user_id}`)}>View</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails">
          <Card className="glass-card overflow-hidden rounded-[--radius] border-border p-0">
            <CardContent className="p-0">
              {enrollmentsLoading ? (
                <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (enrollments ?? []).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No enrollments yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="caption">User</TableHead>
                      <TableHead className="caption">Current Step</TableHead>
                      <TableHead className="caption">Status</TableHead>
                      <TableHead className="caption">Next Send</TableHead>
                      <TableHead className="caption">Enrolled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(enrollments ?? []).map((enrollment: any) => {
                      const user = userMap.get(enrollment.user_id);
                      const statusConf = ENROLLMENT_STATUS_CONFIG[enrollment.status] ?? { label: enrollment.status, icon: Clock, color: "text-muted-foreground" };
                      const StatusIcon = statusConf.icon;
                      return (
                        <TableRow key={enrollment.id} className="border-border">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{user?.user_metadata?.full_name ?? "—"}</span>
                              <span className="text-xs text-muted-foreground">{user?.email ?? enrollment.user_id}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{getStepLabel(enrollment.sequence_id, enrollment.current_step)}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 border-border ${statusConf.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusConf.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {enrollment.status === "active" && enrollment.next_send_at
                                ? format(new Date(enrollment.next_send_at), "dd/MM/yyyy HH:mm")
                                : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(enrollment.enrolled_at), { addSuffix: true })}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
