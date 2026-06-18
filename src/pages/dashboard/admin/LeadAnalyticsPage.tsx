import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, BarChart3, Filter } from "lucide-react";

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
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-6">
      <div>
        <span className="caption">Admin · Lead generation</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Lead Analytics</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          Open and conversion performance by step and variant.
        </p>
      </div>

      <div className="glass-card overflow-hidden rounded-[--radius]">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <span className="aura-microlabel flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </span>
          <span className="caption">Send date · UTC</span>
        </div>
        <div className="space-y-4 p-4">
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
              <Label className="aura-microlabel">Date from</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="aura-microlabel">Date to</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Sent", value: overall.sent.toLocaleString(), tone: "var(--primary)" },
          { label: "Open rate", value: formatPercent(overall.open_rate), tone: "var(--secondary)" },
          { label: "Conversions", value: overall.conversions.toLocaleString(), tone: "var(--accent)" },
          { label: "Conversion rate", value: formatPercent(overall.conversion_rate), tone: "var(--secondary)" },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card rounded-[--radius]">
            <CardContent className="p-4">
              <p className="caption">{stat.label}</p>
              <p className="folio mt-2 text-2xl leading-none text-foreground" style={{ color: `hsl(${stat.tone})` }}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="glass-card overflow-hidden rounded-[--radius]">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <span className="aura-microlabel flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" />
            Performance by step
          </span>
          <span className="caption">Variant-level rates</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="caption">Step</TableHead>
                <TableHead className="caption">Variant</TableHead>
                <TableHead className="caption">Sent</TableHead>
                <TableHead className="caption">Opens</TableHead>
                <TableHead className="caption">Open rate</TableHead>
                <TableHead className="caption">Conversions</TableHead>
                <TableHead className="caption">Conv. rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.breakdown?.map((row) => (
                <TableRow key={`${row.step_order}-${row.variant}`}>
                  <TableCell className="folio text-foreground">{row.step_order}</TableCell>
                  <TableCell>
                    <Badge variant={row.variant === "B" ? "secondary" : "outline"}>{row.variant}</Badge>
                  </TableCell>
                  <TableCell className="folio text-foreground">{row.sent}</TableCell>
                  <TableCell className="folio text-foreground">{row.opens}</TableCell>
                  <TableCell className="folio text-foreground">{formatPercent(row.open_rate)}</TableCell>
                  <TableCell className="folio text-foreground">{row.conversions}</TableCell>
                  <TableCell className="folio text-foreground">{formatPercent(row.conversion_rate)}</TableCell>
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
      </div>
    </div>
  );
}
