import { useState, useMemo } from "react";
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
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    if (cancelling) return <Badge variant="outline" className="border-yellow-500/50 text-yellow-500">Cancelling</Badge>;
    if (status === "active") return <Badge variant="outline" className="border-green-500/50 text-green-500">Active</Badge>;
    if (status === "suspended") return <Badge variant="outline" className="border-destructive/50 text-destructive">Suspended</Badge>;
    return <Badge variant="outline">{status || "—"}</Badge>;
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-3xl font-bold">
          <span className="text-gradient-primary">Subscribers</span> Management
        </h1>
        <p className="text-muted-foreground mt-1">View and manage all paying subscribers</p>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <Card className="glass-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paying Subscribers</p>
                <p className="text-2xl font-bold">{totalPaid}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">MRR</p>
                <p className="text-2xl font-bold">${mrr.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-green-500/10">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">By Plan</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {Object.entries(byPlan).map(([name, count]) => (
                    <Badge key={name} variant="secondary" className="text-xs">{name}: {count}</Badge>
                  ))}
                  {Object.keys(byPlan).length === 0 && <span className="text-muted-foreground text-sm">—</span>}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-secondary/10">
                <TrendingUp className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cancelling</p>
                <p className="text-2xl font-bold">{cancelling}</p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
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
        <Card className="glass-card border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Last Payment</TableHead>
                  <TableHead>PayPal ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No subscribers found</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{u.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{u.plan_name}</Badge>
                      </TableCell>
                      <TableCell>{statusBadge(u.subscription_status, u.cancel_at_period_end)}</TableCell>
                      <TableCell className="capitalize text-sm">{u.billing_cycle || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">
                        ${u.billing_cycle === "yearly" ? u.price_yearly : u.price_monthly}/{u.billing_cycle === "yearly" ? "yr" : "mo"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.current_period_end ? format(new Date(u.current_period_end), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.last_payment_at ? format(new Date(u.last_payment_at), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        {u.paypal_subscription_id ? (
                          <a
                            href={`https://www.sandbox.paypal.com/billing/subscriptions/${u.paypal_subscription_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {u.paypal_subscription_id.slice(0, 12)}…
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
