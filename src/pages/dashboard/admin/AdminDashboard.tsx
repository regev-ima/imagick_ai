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
  Settings2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Section {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

interface AdminGroup {
  title: string;
  icon: LucideIcon;
  color: string;
  sections: Section[];
}

const adminGroups: AdminGroup[] = [
  {
    title: "People & Access",
    icon: Users,
    color: "from-primary to-primary/70",
    sections: [
      { title: "Users", description: "Manage users, roles and permissions", icon: Users, href: "/dashboard/admin/users" },
      { title: "Subscription Plans", description: "Manage pricing and plan features", icon: CreditCard, href: "/dashboard/admin/plans" },
      { title: "Subscribers", description: "Paying subscribers, MRR, and subscription details", icon: DollarSign, href: "/dashboard/admin/subscribers" },
    ],
  },
  {
    title: "Content & Product",
    icon: Sparkles,
    color: "from-primary to-accent",
    sections: [
      { title: "Styles & Showcase", description: "Manage styles, presets, and before/after previews", icon: Sparkles, href: "/dashboard/admin/styles" },
      { title: "Galleries", description: "View and manage all galleries", icon: Images, href: "/dashboard/admin/galleries" },
      { title: "Branding", description: "Customize platform logos and identity", icon: Paintbrush, href: "/dashboard/admin/branding" },
    ],
  },
  {
    title: "Communications",
    icon: Mail,
    color: "from-secondary to-secondary/70",
    sections: [
      { title: "Email Logs", description: "Sent emails, delivery status, and Resend IDs", icon: Mail, href: "/dashboard/admin/email-logs" },
      { title: "Email Templates", description: "Preview and send test emails for all template types", icon: Mail, href: "/dashboard/admin/email-templates" },
      { title: "Notifications", description: "Manage WhatsApp notification recipients", icon: Bell, href: "/dashboard/admin/notifications" },
      { title: "Email Sequences", description: "Automated lifecycle email campaigns", icon: MailOpen, href: "/dashboard/admin/email-sequences" },
      { title: "Customer Journey", description: "Lifecycle stages, conversion scores, and segments", icon: TrendingUp, href: "/dashboard/admin/customer-journey" },
    ],
  },
  {
    title: "Lead Generation",
    icon: Megaphone,
    color: "from-amber-500 to-orange-600",
    sections: [
      { title: "Lead Imports", description: "Upload CSV/XLSX, map fields, dedupe, and enroll", icon: UserPlus2, href: "/dashboard/admin/lead-imports" },
      { title: "Lead Campaigns", description: "Default campaign, send window, and step timeline", icon: Workflow, href: "/dashboard/admin/lead-campaigns" },
      { title: "Lead Templates", description: "Preview and test emails for all campaign steps", icon: MailCheck, href: "/dashboard/admin/lead-templates" },
      { title: "Lead Analytics", description: "Open rates and conversions by step and variant", icon: Activity, href: "/dashboard/admin/lead-analytics" },
    ],
  },
  {
    title: "Settings & Insights",
    icon: Settings2,
    color: "from-blue-500 to-blue-600",
    sections: [
      { title: "Onboarding Insights", description: "Questionnaire responses and segment data", icon: BarChart3, href: "/dashboard/admin/onboarding-insights" },
      { title: "PayPal Settings", description: "Toggle sandbox/live and manage billing plans", icon: Wallet, href: "/dashboard/admin/paypal" },
    ],
  },
];

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [galleriesResult, stylesResult, subscriptionsResult] = await Promise.all([
        supabase.from("galleries").select("id", { count: "exact", head: true }),
        supabase.from("styles").select("id", { count: "exact", head: true }),
        supabase.from("user_subscriptions").select("id", { count: "exact", head: true }),
      ]);

      return {
        totalGalleries: galleriesResult.count || 0,
        totalStyles: stylesResult.count || 0,
        activeSubscriptions: subscriptionsResult.count || 0,
      };
    },
  });

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Admin <span className="text-gradient-primary">Dashboard</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your platform settings, users, and content
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Galleries</p>
                <p className="text-2xl font-bold">{stats?.totalGalleries || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <Images className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Styles</p>
                <p className="text-2xl font-bold">{stats?.totalStyles || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary/10">
                <Sparkles className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                <p className="text-2xl font-bold">{stats?.activeSubscriptions || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <Activity className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold">$0</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary/10">
                <DollarSign className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grouped Admin Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {adminGroups.map((group, groupIndex) => (
          <motion.div
            key={group.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIndex * 0.08, duration: 0.35 }}
          >
            <Card className="glass-card border-border/50 hover:border-primary/20 transition-all duration-300 h-full">
              <CardContent className="pt-6">
                {/* Group header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${group.color}`}>
                    <group.icon className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="font-semibold text-base">{group.title}</h2>
                </div>

                {/* Section links */}
                <div className="space-y-0.5">
                  {group.sections.map((section) => (
                    <Link
                      key={section.href}
                      to={section.href}
                      className="group/link flex items-center gap-3 px-3 py-2.5 -mx-1 rounded-lg hover:bg-muted/60 transition-colors"
                    >
                      <section.icon className="w-4 h-4 text-muted-foreground shrink-0 group-hover/link:text-primary transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{section.title}</p>
                        <p className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">{section.description}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover/link:text-muted-foreground shrink-0 -translate-x-1 group-hover/link:translate-x-0 transition-all" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
