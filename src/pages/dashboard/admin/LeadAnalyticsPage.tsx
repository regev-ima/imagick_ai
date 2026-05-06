import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 1000) / 10}%`;
}

type AnalyticsBreakdownRow = {
  step_order: number;
  variant: string;
  sent: number;
  opens: number;
  open_rate: number;
  conversions: number;
  conversion_rate: number;
};

type AnalyticsPayload = {
  overall: {
    sent: number;
    opens: number;
    open_rate: number;
    conversions: number;
    conversion_rate: number;
  };
  breakdown: AnalyticsBreakdownRow[];
};

export default function LeadAnalyticsPage() {
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateInput(d);
  }, []);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["lead-analytics", dateFrom, dateTo],
    queryFn: async () => {
      const { data: response, error } = await supabase.functions.invoke("admin-lead-observability", {
        body: {
          action: "getLeadAnalytics",
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
      if (error) {
        throw new Error(error.message || "Failed to load analytics");
      }
      if (!response?.success) {
        throw new Error(response?.error || "Failed to load analytics");
      }
      return response.data as AnalyticsPayload;
    },
  });

  const overall = data?.overall ?? {
    sent: 0,
    opens: 0,
    open_rate: 0,
    conversions: 0,
    conversion_rate: 0,
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lead Analytics</h1>
        <p className="text-muted-foreground mt-1">Open and conversion performance by step and variant.</p>
      </div>

      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by send date (UTC).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "7 days", days: 7 },
              { label: "30 days", days: 30 },
              { label: "90 days", days: 90 },
            ].map(({ label, days }) => {
              const from = formatDateInput(new Date(Date.now() - days * 86400000));
              const isActive = dateFrom === from && dateTo === "";
              return (
                <Button
                  key={label}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setDateFrom(from); setDateTo(""); }}
                >
                  {label}
                </Button>
              );
            })}
            {(() => {
              const now = new Date();
              const thisMonthFrom = formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
              const isThisMonth = dateFrom === thisMonthFrom && dateTo === "";
              return (
                <Button
                  variant={isThisMonth ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setDateFrom(thisMonthFrom); setDateTo(""); }}
                >
                  This month
                </Button>
              );
            })()}
            {(() => {
              const now = new Date();
              const lastMonthFrom = formatDateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1));
              const lastMonthTo = formatDateInput(new Date(now.getFullYear(), now.getMonth(), 0));
              const isLastMonth = dateFrom === lastMonthFrom && dateTo === lastMonthTo;
              return (
                <Button
                  variant={isLastMonth ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setDateFrom(lastMonthFrom); setDateTo(lastMonthTo); }}
                >
                  Last month
                </Button>
              );
            })()}
            <Button
              variant={dateFrom === "" && dateTo === "" ? "default" : "outline"}
              size="sm"
              onClick={() => { setDateFrom(""); setDateTo(""); }}
            >
              All time
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date from</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date to</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sent</p>
            <p className="text-2xl font-semibold">{overall.sent}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Open rate</p>
            <p className="text-2xl font-semibold">{formatPercent(overall.open_rate)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Conversions</p>
            <p className="text-2xl font-semibold">{overall.conversions}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Conversion rate</p>
            <p className="text-2xl font-semibold">{formatPercent(overall.conversion_rate)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle>Performance by Step</CardTitle>
          <CardDescription>Variant-level open and conversion rates.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Opens</TableHead>
                <TableHead>Open rate</TableHead>
                <TableHead>Conversions</TableHead>
                <TableHead>Conv. rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.breakdown?.map((row) => (
                <TableRow key={`${row.step_order}-${row.variant}`}>
                  <TableCell>{row.step_order}</TableCell>
                  <TableCell>
                    <Badge variant={row.variant === "B" ? "secondary" : "outline"}>{row.variant}</Badge>
                  </TableCell>
                  <TableCell>{row.sent}</TableCell>
                  <TableCell>{row.opens}</TableCell>
                  <TableCell>{formatPercent(row.open_rate)}</TableCell>
                  <TableCell>{row.conversions}</TableCell>
                  <TableCell>{formatPercent(row.conversion_rate)}</TableCell>
                </TableRow>
              ))}
              {!isLoading && (!data?.breakdown || data.breakdown.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No analytics data for the selected range.
                  </TableCell>
                </TableRow>
              )}
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Loading analytics…
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
