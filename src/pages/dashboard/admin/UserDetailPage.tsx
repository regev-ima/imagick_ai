import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  User,
  Mail,
  Calendar,
  Shield,
  CreditCard,
  HardDrive,
  Image,
  Palette,
  Activity,
  Smartphone,
  Laptop,
  Globe,
  Wifi,
  Monitor,
  SunMoon,
  ClipboardList,
  CheckCircle2,
  CircleDashed,
  ArrowLeft,
  ChevronRight,
  Eye,
  LayoutGrid,
  Zap,
  Send,
  Sparkles,
  Clock,
  Fingerprint,
  Scissors,
  Upload,
  Timer,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-list-users?userId=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch user details");
      return res.json();
    },
  });

  const fmt = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy HH:mm") : "—");
  const fmtDate = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");

  return (
    <div className="min-h-full space-y-5 bg-background p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 overflow-x-auto text-sm text-muted-foreground">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link to="/dashboard/admin/users" aria-label="Back to users">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <Link to="/dashboard/admin" className="shrink-0 transition-colors hover:text-foreground">Admin</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <Link to="/dashboard/admin/users" className="shrink-0 transition-colors hover:text-foreground">Users</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="max-w-[160px] truncate font-medium text-foreground sm:max-w-[240px]">
          {isLoading ? <Skeleton className="inline-block h-4 w-32" /> : data?.user?.email || "User"}
        </span>
      </div>

      {/* Header */}
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 sm:h-12 sm:w-12">
          <User className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight sm:text-2xl">
            {isLoading ? <Skeleton className="h-7 w-64" /> : data?.user?.email || "User Details"}
          </h1>
          {data?.user?.full_name && (
            <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">{data.user.full_name}</p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-muted-foreground text-center py-8">Failed to load user data</p>
      ) : (
        <Tabs defaultValue="overview">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
            <TabsList className="w-max sm:w-auto">
              <TabsTrigger value="overview" className="gap-1.5"><Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Overview</span><span className="sm:hidden">Info</span></TabsTrigger>
              <TabsTrigger value="collections" className="gap-1.5"><LayoutGrid className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Collections</span></TabsTrigger>
              <TabsTrigger value="usage" className="gap-1.5"><Zap className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Usage</span></TabsTrigger>
              <TabsTrigger value="emails" className="gap-1.5"><Send className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Emails</span></TabsTrigger>
              <TabsTrigger value="styles" className="gap-1.5"><Sparkles className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Styles</span></TabsTrigger>
              <TabsTrigger value="sessions" className="gap-1.5"><Monitor className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sessions</span></TabsTrigger>
              <TabsTrigger value="onboarding" className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Onboarding</span></TabsTrigger>
            </TabsList>
          </div>

          {/* === OVERVIEW === */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <InfoCard icon={Mail} label="Email" value={data.user.email} color="" bg="" />
              <InfoCard icon={User} label="Name" value={data.user.full_name || "—"} color="" bg="" />
              <InfoCard
                icon={Fingerprint}
                label="Auth Method"
                color=""
                bg=""
                value={
                  <Badge variant={data.user.provider === "google" ? "default" : "outline"}>
                    {data.user.provider === "google" ? "Google" : "Email"}
                  </Badge>
                }
              />
              <InfoCard
                icon={Shield}
                label="Role"
                color=""
                bg=""
                value={
                  <Badge
                    className={
                      data.user.role === "moderator"
                        ? "border-[hsl(var(--rating)/0.4)] bg-[hsl(var(--rating)/0.15)] text-[hsl(var(--rating))]"
                        : ""
                    }
                    variant={!data.user.role ? "outline" : data.user.role === "admin" ? "destructive" : "default"}
                  >
                    {data.user.role || "User"}
                  </Badge>
                }
              />
              <InfoCard icon={Calendar} label="Signed Up" value={fmt(data.user.created_at)} color="" bg="" />
              <InfoCard icon={Clock} label="Last Sign In" value={fmt(data.user.last_sign_in_at)} color="" bg="" />
            </div>

            {data.subscription && (
              <div className="glass-card overflow-hidden rounded-[--radius]">
                <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="aura-microlabel">Subscription</span>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                    <InfoCard icon={CreditCard} label="Plan" value={data.subscription.plan_name} color="" bg="" />
                    <InfoCard icon={Activity} label="Status" value={data.subscription.status} color="" bg="" />
                    <InfoCard
                      icon={Zap}
                      label="Edits"
                      color=""
                      bg=""
                      value={`${data.subscription.edits_remaining === -1 ? "Unlimited" : data.subscription.edits_remaining + " remaining"} (${data.subscription.edits_used} used)`}
                    />
                    <InfoCard
                      icon={HardDrive}
                      label="Storage"
                      color=""
                      bg=""
                      value={`${data.subscription.storage_used_mb} MB`}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <StatCard label="Collections" value={data.galleries?.length || 0} icon={LayoutGrid} color="" bg="" />
              <StatCard label="Images" value={data.images_count} icon={Image} color="" bg="" />
              <StatCard label="Edits" value={data.edits_count} icon={Zap} color="" bg="" />
            </div>
          </TabsContent>

          {/* === COLLECTIONS === */}
          <TabsContent value="collections">
            {data.galleries?.length === 0 ? (
              <EmptyState icon={LayoutGrid} message="No collections" />
            ) : (
              <div className="grid gap-5">
                {data.galleries?.map((g: any) => {
                  const statusVariant: "secondary" | "destructive" | "outline" | "rating" =
                    g.status === "ready" ? "secondary" :
                    g.status === "processing" || g.status === "culling" ? "rating" :
                    g.status === "error" ? "destructive" :
                    "outline";
                  const cullingDone = g.culling_status === "ready";

                  return (
                    <div key={g.id} className="glass-card overflow-hidden rounded-[--radius]">
                      {/* Top section: thumbnail + header */}
                      <div className="flex flex-col sm:flex-row">
                        {/* Thumbnail */}
                        <div className="relative h-32 shrink-0 bg-muted plate-keyline sm:h-auto sm:w-32 md:w-40">
                          {g.hero_image_url ? (
                            <img src={g.hero_image_url} alt={g.name} className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <div className="flex min-h-[120px] w-full items-center justify-center sm:min-h-[160px]">
                              <Image className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>

                        {/* Right content */}
                        <div className="min-w-0 flex-1 space-y-3 p-4 sm:space-y-4 sm:p-5">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate font-semibold">{g.name}</h3>
                              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">Created {fmtDate(g.created_at)}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {(cullingDone || g.culling_status === "processing") && (
                                <Badge
                                  variant={cullingDone ? "secondary" : "outline"}
                                  className={cullingDone
                                    ? "gap-1 text-xs"
                                    : "gap-1 border-[hsl(var(--rating)/0.4)] bg-[hsl(var(--rating)/0.15)] text-[hsl(var(--rating))] text-xs"
                                  }
                                >
                                  <Scissors className="w-3 h-3" />
                                  {cullingDone ? "Culled" : "Culling..."}
                                </Badge>
                              )}
                              {statusVariant === "rating" ? (
                                <Badge className="border-[hsl(var(--rating)/0.4)] bg-[hsl(var(--rating)/0.15)] text-[hsl(var(--rating))]">{g.status}</Badge>
                              ) : (
                                <Badge variant={statusVariant}>{g.status}</Badge>
                              )}
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                            <div className="rounded-[--radius] border border-border bg-popover p-2.5 text-center">
                              <Image className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                              <p className="folio text-lg leading-tight">{g.total_images || 0}</p>
                              <p className="aura-microlabel">Images</p>
                            </div>
                            <div className="rounded-[--radius] border border-border bg-popover p-2.5 text-center">
                              <Zap className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                              <p className="folio text-lg leading-tight">{g.edits_count || 0}</p>
                              <p className="aura-microlabel">Edits</p>
                            </div>
                            <div className="rounded-[--radius] border border-border bg-popover p-2.5 text-center">
                              <Layers className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                              <p className="folio text-lg leading-tight">{g.edits_spent || 0}</p>
                              <p className="aura-microlabel">Credits</p>
                            </div>
                            <div className="rounded-[--radius] border border-border bg-popover p-2.5 text-center">
                              <Sparkles className="mx-auto mb-1 h-4 w-4 text-accent" />
                              <p className="folio text-lg leading-tight">{g.styles_used?.length || 0}</p>
                              <p className="aura-microlabel">Styles</p>
                            </div>
                          </div>

                          {/* Styles + Culling labels */}
                          {(g.styles_used?.length > 0 || (cullingDone && g.culling_labels?.length > 0)) && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {g.styles_used?.map((s: string) => (
                                <Badge key={s} variant="default" className="gap-1 text-xs">
                                  <Palette className="w-3 h-3" />{s}
                                </Badge>
                              ))}
                              {cullingDone && g.culling_labels?.map((l: string) => (
                                <Badge key={l} variant="outline" className="gap-1 text-xs">
                                  <Scissors className="w-3 h-3" />{l}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Timeline */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
                            {g.first_upload_at && (
                              <span className="flex items-center gap-1.5">
                                <Upload className="h-3.5 w-3.5 text-muted-foreground" /> Uploaded {fmt(g.first_upload_at)}
                              </span>
                            )}
                            {g.first_edit_at && (
                              <span className="flex items-center gap-1.5">
                                <Timer className="h-3.5 w-3.5 text-muted-foreground" /> First edit {fmt(g.first_edit_at)}
                              </span>
                            )}
                            {g.last_edit_at && g.first_edit_at && g.last_edit_at !== g.first_edit_at && (
                              <span className="flex items-center gap-1.5">
                                <Timer className="h-3.5 w-3.5 text-muted-foreground" /> Last edit {fmt(g.last_edit_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* === USAGE & ACTIVITY === */}
          <TabsContent value="usage" className="space-y-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <StatCard label="Last Upload" value={fmt(data.last_upload_at)} icon={Calendar} color="" bg="" isText />
              <StatCard label="Total Images" value={data.images_count} icon={Image} color="" bg="" />
              <StatCard label="Total Edits" value={data.edits_count} icon={Palette} color="" bg="" />
            </div>

            <div className="glass-card overflow-hidden rounded-[--radius]">
              <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="aura-microlabel">Credit Usage History</span>
              </div>
              <div className="p-4">
                {data.edit_logs?.length === 0 ? (
                  <p className="caption py-2">No credit usage</p>
                ) : (
                  <div className="-mx-4 overflow-x-auto sm:mx-0"><Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="aura-microlabel">Action</TableHead>
                        <TableHead className="aura-microlabel">Credits</TableHead>
                        <TableHead className="aura-microlabel">Date</TableHead>
                        <TableHead className="aura-microlabel">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.edit_logs?.map((log: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{log.action_type}</TableCell>
                          <TableCell className="folio">{log.edits_spent}</TableCell>
                          <TableCell className="folio text-muted-foreground">{fmtDate(log.created_at)}</TableCell>
                          <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">
                            {log.description || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table></div>
                )}
              </div>
            </div>

            <div className="glass-card overflow-hidden rounded-[--radius]">
              <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="aura-microlabel">Credit Grants</span>
              </div>
              <div className="p-4">
                {!data.credit_grants || data.credit_grants.length === 0 ? (
                  <p className="caption py-2">No credit grants</p>
                ) : (
                  <div className="-mx-4 overflow-x-auto sm:mx-0"><Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="aura-microlabel">Type</TableHead>
                        <TableHead className="aura-microlabel">Initial</TableHead>
                        <TableHead className="aura-microlabel">Remaining</TableHead>
                        <TableHead className="aura-microlabel">Status</TableHead>
                        <TableHead className="aura-microlabel">Expires</TableHead>
                        <TableHead className="aura-microlabel">Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.credit_grants.map((grant: any) => (
                        <TableRow key={grant.id}>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{grant.grant_type}</Badge>
                          </TableCell>
                          <TableCell className="folio">{grant.credits_initial}</TableCell>
                          <TableCell className="folio">{grant.credits_remaining}</TableCell>
                          <TableCell>
                            <Badge variant={
                              grant.status === "active" ? "secondary" :
                              grant.status === "expired" ? "destructive" :
                              "outline"
                            }>{grant.status}</Badge>
                          </TableCell>
                          <TableCell className="folio">{fmtDate(grant.expires_at)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {grant.reason || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table></div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* === EMAILS === */}
          <TabsContent value="emails">
            {data.email_logs?.length === 0 ? (
              <EmptyState icon={Send} message="No emails sent" />
            ) : (
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"><Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="aura-microlabel">Type</TableHead>
                    <TableHead className="aura-microlabel">Subject</TableHead>
                    <TableHead className="aura-microlabel">Status</TableHead>
                    <TableHead className="aura-microlabel">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.email_logs?.map((log: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.email_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate sm:max-w-[300px]">{log.subject}</TableCell>
                      <TableCell>
                        <Badge
                          variant={log.status === "sent" ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="folio text-muted-foreground">{fmtDate(log.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            )}
          </TabsContent>

          {/* === STYLES === */}
          <TabsContent value="styles">
            {data.styles?.length === 0 ? (
              <EmptyState icon={Sparkles} message="No styles created" />
            ) : (
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"><Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="aura-microlabel">Name</TableHead>
                    <TableHead className="aura-microlabel">Status</TableHead>
                    <TableHead className="aura-microlabel">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.styles?.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.status}</Badge>
                      </TableCell>
                      <TableCell className="folio text-muted-foreground">{fmtDate(s.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            )}
          </TabsContent>

          {/* === SESSIONS === */}
          <TabsContent value="sessions">
            {data.sessions?.length === 0 ? (
              <EmptyState icon={Monitor} message="No sessions recorded" />
            ) : (
              <div className="grid gap-4">
                {data.sessions?.map((s: any) => (
                  <div key={s.id} className="glass-card overflow-hidden rounded-[--radius]">
                    <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="aura-microlabel">{fmt(s.created_at)}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3">
                      <InfoCard icon={s.device_type === "mobile" ? Smartphone : Laptop} label="Device" value={s.device_type || "—"} color="" bg="" />
                      <InfoCard icon={Monitor} label="OS" value={s.os || "—"} color="" bg="" />
                      <InfoCard icon={Globe} label="Browser" value={s.browser || "—"} color="" bg="" />
                      <InfoCard icon={Wifi} label="IP" value={<span className="break-all font-mono text-xs">{s.ip_address || "—"}</span>} color="" bg="" />
                      <InfoCard icon={Monitor} label="Resolution" value={s.screen_width && s.screen_height ? `${s.screen_width}x${s.screen_height}` : "—"} color="" bg="" />
                      <InfoCard icon={SunMoon} label="Theme" value={s.color_scheme || "—"} color="" bg="" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* === ONBOARDING === */}
          <TabsContent value="onboarding">
            {(() => {
              const allQ = data.onboarding?.all_questions || [];
              const answers = data.onboarding?.answers || [];
              type OnboardingAnswer = { question_id: string; answer: any; answered_at: string };
              const answersMap: Record<string, OnboardingAnswer> = {};
              answers.forEach((a: OnboardingAnswer) => { answersMap[a.question_id] = a; });

              if (allQ.length === 0) {
                return <EmptyState icon={ClipboardList} message="No onboarding questions configured" />;
              }

              return (
                <div className="space-y-3">
                  {allQ.map((q: any) => {
                    const userAnswer = answersMap[q.id];
                    const options = Array.isArray(q.options) ? q.options : [];

                    return (
                      <div key={q.id} className="glass-card space-y-2 rounded-[--radius] p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`rounded-[--radius] p-1.5 ${userAnswer ? "bg-primary/10" : "border border-border bg-popover"}`}>
                              <ClipboardList className={`h-4 w-4 ${userAnswer ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                            <p className="text-sm font-semibold">{q.title}</p>
                          </div>
                          {userAnswer ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-secondary" />
                              <span className="font-mono text-[11px] text-muted-foreground">{fmtDate(userAnswer.answered_at)}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <CircleDashed className="h-4 w-4 text-muted-foreground" />
                              <span className="caption">Not answered</span>
                            </div>
                          )}
                        </div>
                        {userAnswer ? (
                          <div className="mt-1 flex flex-wrap gap-1.5 pl-9">
                            {(Array.isArray(userAnswer.answer) ? userAnswer.answer : [userAnswer.answer]).map((ans: string, i: number) => {
                              const opt = options.find((o: any) => o.id === ans);
                              return (
                                <Badge key={i} variant="default">
                                  {opt?.label || ans}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="pl-9">
                            <Badge variant="outline" className="text-muted-foreground">Not answered</Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 rounded-[--radius] border border-border bg-popover p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="aura-microlabel">{label}</p>
        <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg, isText }: { label: string; value: number | string; icon: LucideIcon; color: string; bg: string; isText?: boolean }) {
  return (
    <div className="glass-card overflow-hidden rounded-[--radius]">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-3 py-2">
        <span className="aura-microlabel truncate">{label}</span>
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>
      <div className="px-3 py-3 text-center sm:text-left">
        <p className={`folio ${isText ? "truncate text-xs sm:text-sm" : "text-2xl sm:text-3xl"} text-foreground`}>{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="folio text-xs">{value}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <div className="rounded-[--radius] border border-border bg-popover p-4">
        <Icon className="w-8 h-8" />
      </div>
      <p className="caption">{message}</p>
    </div>
  );
}
