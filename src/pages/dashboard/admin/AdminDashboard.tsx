import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  CreditCard,
  Sparkles,
  Images,
  ArrowRight,
  DollarSign,
  Activity,
  Paintbrush,
  Mail,
  Bell,
  TrendingUp,
  MailOpen,
  BarChart3,
  Wallet,
  UserPlus2,
  MailCheck,
  Workflow,
  type LucideIcon,
  Megaphone,
  TrendingDown,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { subDays } from "date-fns";

interface Section {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

interface AdminGroup {
  title: string;
  icon: LucideIcon;
  sections: Section[];
}

const adminGroups: AdminGroup[] = [
  {
    title: "People & Billing",
    icon: Users,
    sections: [
      { title: "Users", description: "Manage users, roles and permissions", icon: Users, href: "/dashboard/admin/users" },
      { title: "Subscribers", description: "Paying subscribers, MRR, and subscription details", icon: DollarSign, href: "/dashboard/admin/subscribers" },
      { title: "Subscription Plans", description: "Manage pricing and plan features", icon: CreditCard, href: "/dashboard/admin/plans" },
      { title: "PayPal Settings", description: "Toggle sandbox/live and manage billing plans", icon: Wallet, href: "/dashboard/admin/paypal" },
    ],
  },
  {
    title: "Content",
    icon: Sparkles,
    sections: [
      { title: "Styles & Showcase", description: "Manage styles, presets, and before/after previews", icon: Sparkles, href: "/dashboard/admin/styles" },
      { title: "Galleries", description: "View and manage all galleries", icon: Images, href: "/dashboard/admin/galleries" },
      { title: "Branding", description: "Customize platform logos and identity", icon: Paintbrush, href: "/dashboard/admin/branding" },
      { title: "AI Culling", description: "Vision model + grouping time-gate for AI culling", icon: Sparkles, href: "/dashboard/admin/culling" },
    ],
  },
  {
    title: "Email & Notifications",
    icon: Mail,
    sections: [
      { title: "Email Logs", description: "Sent emails, delivery status, and Resend IDs", icon: Mail, href: "/dashboard/admin/email-logs" },
      { title: "Email Templates", description: "Preview and send test emails for all template types", icon: MailCheck, href: "/dashboard/admin/email-templates" },
      { title: "Email Sequences", description: "Automated lifecycle email campaigns", icon: MailOpen, href: "/dashboard/admin/email-sequences" },
      { title: "Notifications", description: "Manage WhatsApp notification recipients", icon: Bell, href: "/dashboard/admin/notifications" },
    ],
  },
  {
    title: "Lead Generation",
    icon: Megaphone,
    sections: [
      { title: "Lead Imports", description: "Upload CSV/XLSX, map fields, dedupe, and enroll", icon: UserPlus2, href: "/dashboard/admin/lead-imports" },
      { title: "Lead Campaigns", description: "Default campaign, send window, and step timeline", icon: Workflow, href: "/dashboard/admin/lead-campaigns" },
      { title: "Lead Templates", description: "Preview and test emails for all campaign steps", icon: MailCheck, href: "/dashboard/admin/lead-templates" },
      { title: "Lead Analytics", description: "Open rates and conversions by step and variant", icon: Activity, href: "/dashboard/admin/lead-analytics" },
    ],
  },
  {
    title: "Insights",
    icon: BarChart3,
    sections: [
      { title: "Customer Journey", description: "Lifecycle stages, conversion scores, and segments", icon: TrendingUp, href: "/dashboard/admin/customer-journey" },
      { title: "Onboarding Insights", description: "Questionnaire responses and segment data", icon: Activity, href: "/dashboard/admin/onboarding-insights" },
    ],
  },
];

/** The AI mark — a 4-point sparkle. Tinted via currentColor. */
function Sparkle({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden style={{ display: "block" }}>
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Mono-headed stat panel — a Lightroom info cell. */
function StatPanel({
  label,
  value,
  hint,
  icon: Icon,
  tone = "muted",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: "muted" | "primary" | "secondary" | "destructive";
}) {
  const toneClass =
    tone === "secondary"
      ? "text-secondary"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "primary"
          ? "text-accent"
          : "text-muted-foreground";
  return (
    <div className="glass-card overflow-hidden rounded-[--radius]">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-3 py-2">
        <span className="aura-microlabel">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
      </div>
      <div className="px-4 py-3.5">
        <p className="folio text-3xl leading-none text-foreground">{value}</p>
        {hint && <p className="mt-2 font-mono text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

type PeriodKey = "today" | "7d" | "30d" | "90d" | "custom";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "custom", label: "Custom" },
];

/** Resolve a period choice into a [from, to) window + a human label. */
function resolveRange(
  period: PeriodKey,
  customFrom: string,
  customTo: string,
): { from: Date | null; to: Date | null; label: string; valid: boolean } {
  const now = new Date();
  if (period === "custom") {
    if (!customFrom || !customTo) return { from: null, to: null, label: "Custom range", valid: false };
    const from = new Date(`${customFrom}T00:00:00`);
    const to = new Date(`${customTo}T23:59:59`);
    return { from, to, label: `${customFrom} → ${customTo}`, valid: to > from };
  }
  if (period === "today") {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from, to: now, label: "Today", valid: true };
  }
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return { from: subDays(now, days), to: now, label: `Last ${days} days`, valid: true };
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { from, to, label: periodLabel, valid } = resolveRange(period, customFrom, customTo);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [galleriesResult, stylesResult, kpiResult] = await Promise.all([
        supabase.from("galleries").select("id", { count: "exact", head: true }),
        supabase.from("styles").select("id", { count: "exact", head: true }),
        supabase.rpc("get_admin_kpi_overview"),
      ]);

      const kpi = (kpiResult.data ?? null) as {
        active_subscribers: number;
        mrr_usd: number | string;
        cancellations_30d: number;
        churn_pct_30d: number | string;
        edits_today: number;
        edits_7d: number;
        edits_30d: number;
        signups_7d: number;
        signups_30d: number;
      } | null;

      return {
        totalGalleries: galleriesResult.count || 0,
        totalStyles: stylesResult.count || 0,
        activeSubscriptions: kpi?.active_subscribers ?? 0,
        mrrUsd: Number(kpi?.mrr_usd ?? 0),
        churnPct30d: Number(kpi?.churn_pct_30d ?? 0),
        cancellations30d: kpi?.cancellations_30d ?? 0,
        editsToday: kpi?.edits_today ?? 0,
        edits7d: kpi?.edits_7d ?? 0,
        edits30d: kpi?.edits_30d ?? 0,
        signups7d: kpi?.signups_7d ?? 0,
        signups30d: kpi?.signups_30d ?? 0,
      };
    },
  });

  // Time-bound KPIs for the selected period (snapshot KPIs above stay "now").
  // Falls back to the fixed-window overview if the range RPC isn't deployed yet.
  const { data: range } = useQuery({
    queryKey: ["admin-kpi-range", from?.toISOString(), to?.toISOString()],
    enabled: valid && !!from && !!to,
    retry: false,
    queryFn: async () => {
      // get_admin_kpi_range isn't in the generated DB types yet, so call
      // through a narrowed cast (via unknown — no `any`).
      const rpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>;
      const { data, error } = await rpc("get_admin_kpi_range", {
        p_from: from!.toISOString(),
        p_to: to!.toISOString(),
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as { signups: number; edits: number; cancellations: number; churn_pct: number } | null;
    },
  });

  const days = from && to ? Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000)) : 1;
  const rSignups = range?.signups ?? stats?.signups7d ?? 0;
  const rEdits = range?.edits ?? stats?.edits7d ?? 0;
  const rChurn = Number(range?.churn_pct ?? stats?.churnPct30d ?? 0);
  const rCancellations = range?.cancellations ?? stats?.cancellations30d ?? 0;

  const formatUsd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-full bg-background p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1320px] space-y-6">
        {/* Masthead */}
        <header>
          <div className="flex items-center justify-between gap-4 pb-3">
            <span className="caption">Admin · Control room</span>
            <span className="caption flex items-center gap-1.5 text-foreground">
              <Sparkle size={12} className="text-accent" />
              Imagick.ai
            </span>
          </div>
          <hr className="aura-hairline" />
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your platform settings, users, and content</p>

          {/* Period filter — drives the time-bound KPIs (edits / signups / churn) */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="aura-microlabel mr-1">Period</span>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                aria-pressed={period === p.key}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors",
                  period === p.key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
            {period === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  aria-label="From date"
                  className="rounded-[--radius] border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus-visible:border-primary focus-visible:outline-none"
                />
                <span className="text-muted-foreground">→</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  aria-label="To date"
                  className="rounded-[--radius] border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus-visible:border-primary focus-visible:outline-none"
                />
              </div>
            )}
          </div>
        </header>

        {/* KPI row 1 — revenue & subscriber health */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <StatPanel
            label="MRR"
            value={formatUsd(stats?.mrrUsd ?? 0)}
            hint="Annual subs normalised to monthly"
            icon={DollarSign}
            tone="secondary"
          />
          <StatPanel
            label="Active subscribers"
            value={stats?.activeSubscriptions ?? 0}
            hint="Paying, status=active"
            icon={Activity}
            tone="primary"
          />
          <StatPanel
            label="Churn"
            value={`${rChurn.toFixed(1)}%`}
            hint={`${rCancellations} cancellations · ${periodLabel}`}
            icon={TrendingDown}
            tone="destructive"
          />
          <StatPanel
            label="New signups"
            value={rSignups}
            hint={periodLabel}
            icon={UserPlus2}
            tone="primary"
          />
        </div>

        {/* KPI row 2 — usage volume */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <StatPanel
            label="Edits"
            value={rEdits}
            hint={periodLabel}
            icon={Zap}
            tone="secondary"
          />
          <StatPanel
            label="Edits / day (avg)"
            value={Math.round(rEdits / days)}
            hint={`${rEdits} total · ${periodLabel}`}
            icon={TrendingUp}
            tone="primary"
          />
          <StatPanel
            label="Total galleries"
            value={stats?.totalGalleries ?? 0}
            icon={Images}
            tone="primary"
          />
          <StatPanel
            label="Total styles"
            value={stats?.totalStyles ?? 0}
            icon={Sparkles}
            tone="secondary"
          />
        </div>

        {/* Grouped Admin Sections */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {adminGroups.map((group, groupIndex) => (
            <motion.div
              key={group.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIndex * 0.06, duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <div className="glass-card h-full overflow-hidden rounded-[--radius]">
                {/* Group header — mono module title bar */}
                <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                  <group.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="aura-microlabel">{group.title}</span>
                </div>

                {/* Section links */}
                <ul className="divide-y divide-border">
                  {group.sections.map((section) => (
                    <li key={section.href}>
                      <Link
                        to={section.href}
                        className="group/link flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
                      >
                        <section.icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover/link:text-accent" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight transition-colors group-hover/link:text-accent">{section.title}</p>
                          <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">{section.description}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-muted-foreground/0 transition-all group-hover/link:translate-x-0 group-hover/link:text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
