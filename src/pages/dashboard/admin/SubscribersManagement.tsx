import { useState, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoading } from "@/components/admin/AdminLoading";

interface SubscriberUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  plan_name: string;
  plan_slug: string;
  subscription_status: string | null;
  billing_cycle: string | null;
  price_monthly: number;
  price_yearly: number;
  paypal_subscription_id: string | null;
  current_period_end: string | null;
  last_payment_at: string | null;
  cancel_at_period_end: boolean;
  galleries_count: number;
  images_count: number;
  edits_count: number;
}

export default function SubscribersManagement() {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cycleFilter, setCycleFilter] = useState("all");

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ["admin-users-subscribers"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("admin-list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      return (res.data?.users || []) as SubscriberUser[];
    },
  });

  // Only paid subscribers
  const subscribers = useMemo(() => {
    return allUsers.filter(
      (u) => u.plan_slug && u.plan_slug !== "free"
    );
  }, [allUsers]);

  const filtered = useMemo(() => {
    return subscribers.filter((u) => {
      if (search && !u.email.toLowerCase().includes(search.toLowerCase()) && !(u.full_name || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (planFilter !== "all" && u.plan_slug !== planFilter) return false;
      if (statusFilter !== "all" && u.subscription_status !== statusFilter) return false;
      if (cycleFilter !== "all" && u.billing_cycle !== cycleFilter) return false;
      return true;
    });
  }, [subscribers, search, planFilter, statusFilter, cycleFilter]);

  // Stats
  const totalPaid = subscribers.length;
  const mrr = subscribers.reduce((sum, u) => {
    if (u.subscription_status !== "active") return sum;
    if (u.billing_cycle === "yearly") return sum + (u.price_yearly / 12);
    return sum + u.price_monthly;
  }, 0);
  const byPlan = subscribers.reduce((acc, u) => {
    acc[u.plan_name] = (acc[u.plan_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const cancelling = subscribers.filter((u) => u.cancel_at_period_end).length;

  const statusBadge = (status: string | null, cancelling: boolean) => {
    if (cancelling)
      return (
        <Badge variant="outline" className="border-[hsl(var(--rating))]/40 text-[hsl(var(--rating))]">
          Cancelling
        </Badge>
      );
    if (status === "active") return <Badge variant="secondary">Active</Badge>;
    if (status === "suspended") return <Badge variant="destructive">Suspended</Badge>;
    return <Badge variant="outline">{status || "—"}</Badge>;
  };

  const stats: {
    label: string;
    icon: typeof Users;
    tone: string;
    render: () => ReactNode;
  }[] = [
    {
      label: "Paying Subscribers",
      icon: Users,
      tone: "var(--primary)",
      render: () => <p className="folio text-3xl leading-none text-foreground">{totalPaid}</p>,
    },
    {
      label: "MRR",
      icon: DollarSign,
      tone: "var(--secondary)",
      render: () => <p className="folio text-3xl leading-none text-foreground">${mrr.toFixed(2)}</p>,
    },
    {
      label: "By Plan",
      icon: TrendingUp,
      tone: "var(--accent)",
      render: () => (
        <div className="mt-1 flex flex-wrap gap-2">
          {Object.entries(byPlan).map(([name, count]) => (
            <Badge key={name} variant="secondary" className="text-xs">{name}: {count}</Badge>
          ))}
          {Object.keys(byPlan).length === 0 && <span className="text-muted-foreground text-sm">—</span>}
        </div>
      ),
    },
    {
      label: "Cancelling",
      icon: AlertTriangle,
      tone: "var(--rating)",
      render: () => <p className="folio text-3xl leading-none text-foreground">{cancelling}</p>,
    },
  ];

  return (
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <span className="caption">Admin · Billing</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Subscribers Management</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">View and manage all paying subscribers</p>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        {stats.map((stat) => (
          <Card key={stat.label} className="glass-card rounded-[--radius]">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="caption">{stat.label}</p>
                  <div className="mt-2">{stat.render()}</div>
                </div>
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[--radius] border border-border"
                  style={{ backgroundColor: `hsl(${stat.tone} / 0.1)` }}
                >
                  <stat.icon className="w-5 h-5" style={{ color: `hsl(${stat.tone})` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div
        className="flex flex-wrap gap-3 items-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="studio">Studio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cycleFilter} onValueChange={setCycleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Cycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cycles</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        <div className="glass-card overflow-hidden rounded-[--radius]">
          {isLoading ? (
            <AdminLoading rows={8} label="Loading subscribers" />
          ) : filtered.length === 0 ? (
            <AdminEmptyState
              icon={Users}
              title="No subscribers yet"
              hint={search || planFilter !== "all" || statusFilter !== "all" || cycleFilter !== "all" ? "Try adjusting your search or filters." : "Paid subscribers will appear here."}
            />
          ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="caption">User</TableHead>
                <TableHead className="caption">Plan</TableHead>
                <TableHead className="caption">Status</TableHead>
                <TableHead className="caption">Cycle</TableHead>
                <TableHead className="caption">Amount</TableHead>
                <TableHead className="caption">Period End</TableHead>
                <TableHead className="caption">Last Payment</TableHead>
                <TableHead className="caption">PayPal ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-foreground">{u.full_name || "—"}</p>
                        <p className="font-mono text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.plan_name}</Badge>
                    </TableCell>
                    <TableCell>{statusBadge(u.subscription_status, u.cancel_at_period_end)}</TableCell>
                    <TableCell className="capitalize text-sm">{u.billing_cycle || "—"}</TableCell>
                    <TableCell className="folio text-sm text-foreground">
                      ${u.billing_cycle === "yearly" ? u.price_yearly : u.price_monthly}/{u.billing_cycle === "yearly" ? "yr" : "mo"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {u.current_period_end ? format(new Date(u.current_period_end), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {u.last_payment_at ? format(new Date(u.last_payment_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {u.paypal_subscription_id ? (
                        <a
                          href={`https://www.sandbox.paypal.com/billing/subscriptions/${u.paypal_subscription_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {u.paypal_subscription_id.slice(0, 12)}…
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
