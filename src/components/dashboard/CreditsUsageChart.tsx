import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Zap, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreditsUsage } from "@/hooks/useCreditsUsage";

function buildLast30Days(dailyUsage: { date: string; edits: number }[]) {
  const result: { label: string; edits: number }[] = [];
  const usageMap: Record<string, number> = {};
  dailyUsage.forEach(({ date, edits }) => {
    usageMap[date] = edits;
  });

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().substring(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    result.push({ label, edits: usageMap[key] || 0 });
  }
  return result;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-card px-3 py-2 text-sm shadow-[var(--elevation-2)]">
      <p className="caption mb-1">{label}</p>
      <p className="font-display font-semibold text-accent">{payload[0].value} edits</p>
    </div>
  );
};

export default function CreditsUsageChart() {
  const { data, editsUsed, editsTotal, isUnlimited, periodStart, periodEnd } = useCreditsUsage();

  const chartData = useMemo(
    () => buildLast30Days(data?.dailyUsage || []),
    [data?.dailyUsage]
  );

  const hasActivity = chartData.some((d) => d.edits > 0);
  const periodLabel = periodStart
    ? `${new Date(periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(periodEnd || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "This billing period";

  return (
    <Card className="rounded-[--radius] border border-border bg-card shadow-none transition-colors">
      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-end justify-between">
          <div>
            <CardTitle className="caption flex items-center gap-1.5 normal-case">
              <Zap className="h-3 w-3 text-accent" />
              <span className="caption">Edits usage</span>
            </CardTitle>
            <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              {periodLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-semibold leading-none tracking-tight text-accent">
              {editsUsed}
            </p>
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              {isUnlimited ? "edits this period" : `of ${editsTotal} used`}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {hasActivity ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="editsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" opacity={0.6} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="edits"
                stroke="hsl(var(--accent))"
                strokeWidth={1.5}
                fill="url(#editsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[180px] flex-col items-center justify-center gap-2.5 text-muted-foreground">
            <Zap className="h-7 w-7 opacity-20" />
            <p className="caption">No edits used yet this period</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
