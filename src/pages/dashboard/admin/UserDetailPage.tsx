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
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link to="/dashboard/admin/users">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <Link to="/dashboard/admin" className="hover:text-foreground transition-colors shrink-0">Admin</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <Link to="/dashboard/admin/users" className="hover:text-foreground transition-colors shrink-0">Users</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="text-foreground font-medium truncate max-w-[160px] sm:max-w-[240px]">
          {isLoading ? <Skeleton className="h-4 w-32 inline-block" /> : data?.user?.email || "User"}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
          <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold truncate">
            {isLoading ? <Skeleton className="h-7 w-64" /> : data?.user?.email || "User Details"}
          </h1>
          {data?.user?.full_name && (
            <p className="text-sm sm:text-base text-muted-foreground mt-0.5">{data.user.full_name}</p>
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
              <InfoCard icon={Mail} label="Email" value={data.user.email} color="text-blue-400" bg="bg-blue-500/10" />
              <InfoCard icon={User} label="Name" value={data.user.full_name || "—"} color="text-violet-400" bg="bg-violet-500/10" />
              <InfoCard
                icon={Fingerprint}
                label="Auth Method"
                color="text-emerald-400"
                bg="bg-emerald-500/10"
                value={
                  <Badge variant={data.user.provider === "google" ? "default" : "outline"}>
                    {data.user.provider === "google" ? "Google" : "Email"}
                  </Badge>
                }
              />
              <InfoCard
                icon={Shield}
                label="Role"
                color="text-amber-400"
                bg="bg-amber-500/10"
                value={
                  <Badge
                    className={
                      data.user.role === "admin"
                        ? "bg-red-500/10 text-red-500 border-red-500/50"
                        : data.user.role === "moderator"
                        ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/50"
                        : ""
                    }
                    variant={!data.user.role ? "outline" : "default"}
                  >
                    {data.user.role || "User"}
                  </Badge>
                }
              />
              <InfoCard icon={Calendar} label="Signed Up" value={fmt(data.user.created_at)} color="text-cyan-400" bg="bg-cyan-500/10" />
              <InfoCard icon={Clock} label="Last Sign In" value={fmt(data.user.last_sign_in_at)} color="text-pink-400" bg="bg-pink-500/10" />
            </div>

            {data.subscription && (
              <Card className="glass-card border-border/50">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-sm">Subscription</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <InfoCard icon={CreditCard} label="Plan" value={data.subscription.plan_name} color="text-primary" bg="bg-primary/10" />
                    <InfoCard icon={Activity} label="Status" value={data.subscription.status} color="text-green-400" bg="bg-green-500/10" />
                    <InfoCard
                      icon={Zap}
                      label="Edits"
                      color="text-amber-400"
                      bg="bg-amber-500/10"
                      value={`${data.subscription.edits_remaining === -1 ? "Unlimited" : data.subscription.edits_remaining + " remaining"} (${data.subscription.edits_used} used)`}
                    />
                    <InfoCard
                      icon={HardDrive}
                      label="Storage"
                      color="text-sky-400"
                      bg="bg-sky-500/10"
                      value={`${data.subscription.storage_used_mb} MB`}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <StatCard label="Collections" value={data.galleries?.length || 0} icon={LayoutGrid} color="text-violet-400" bg="bg-violet-500/10" />
              <StatCard label="Images" value={data.images_count} icon={Image} color="text-blue-400" bg="bg-blue-500/10" />
              <StatCard label="Edits" value={data.edits_count} icon={Zap} color="text-amber-400" bg="bg-amber-500/10" />
            </div>
          </TabsContent>

          {/* === COLLECTIONS === */}
          <TabsContent value="collections">
            {data.galleries?.length === 0 ? (
              <EmptyState icon={LayoutGrid} message="No collections" />
            ) : (
              <div className="grid gap-5">
                {data.galleries?.map((g: any) => {
                  const statusColor =
                    g.status === "ready" ? "bg-green-500/10 text-green-500 border-green-500/50" :
                    g.status === "processing" || g.status === "culling" ? "bg-amber-500/10 text-amber-500 border-amber-500/50" :
                    g.status === "error" ? "bg-red-500/10 text-red-500 border-red-500/50" :
                    "";
                  const cullingDone = g.culling_status === "ready";

                  return (
                    <Card key={g.id} className="glass-card border-border/50 overflow-hidden">
                      <CardContent className="p-0">
                        {/* Top section: thumbnail + header */}
                        <div className="flex flex-col sm:flex-row">
                          {/* Thumbnail */}
                          <div className="h-32 sm:h-auto sm:w-32 md:w-40 shrink-0 bg-muted/20 relative">
                            {g.hero_image_url ? (
                              <img src={g.hero_image_url} alt={g.name} className="w-full h-full object-cover absolute inset-0" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center min-h-[120px] sm:min-h-[160px]">
                                <Image className="w-10 h-10 text-muted-foreground/20" />
                              </div>
                            )}
                          </div>

                          {/* Right content */}
                          <div className="flex-1 p-4 sm:p-5 min-w-0 space-y-3 sm:space-y-4">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="font-semibold truncate">{g.name}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Created {fmtDate(g.created_at)}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {(cullingDone || g.culling_status === "processing") && (
                                  <Badge
                                    className={cullingDone
                                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/50 text-xs gap-1"
                                      : "bg-amber-500/10 text-amber-500 border-amber-500/50 text-xs gap-1"
                                    }
                                  >
                                    <Scissors className="w-3 h-3" />
                                    {cullingDone ? "Culled" : "Culling..."}
                                  </Badge>
                                )}
                                <Badge className={statusColor} variant={statusColor ? "default" : "outline"}>{g.status}</Badge>
                              </div>
                            </div>

                            {/* Stats row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                              <div className="border rounded-lg p-2.5 text-center">
                                <Image className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                                <p className="text-lg font-bold leading-tight">{g.total_images || 0}</p>
                                <p className="text-[10px] text-muted-foreground">Images</p>
                              </div>
                              <div className="border rounded-lg p-2.5 text-center">
                                <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                                <p className="text-lg font-bold leading-tight">{g.edits_count || 0}</p>
                                <p className="text-[10px] text-muted-foreground">Edits</p>
                              </div>
                              <div className="border rounded-lg p-2.5 text-center">
                                <Layers className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                                <p className="text-lg font-bold leading-tight">{g.edits_spent || 0}</p>
                                <p className="text-[10px] text-muted-foreground">Credits</p>
                              </div>
                              <div className="border rounded-lg p-2.5 text-center">
                                <Sparkles className="w-4 h-4 text-violet-400 mx-auto mb-1" />
                                <p className="text-lg font-bold leading-tight">{g.styles_used?.length || 0}</p>
                                <p className="text-[10px] text-muted-foreground">Styles</p>
                              </div>
                            </div>

                            {/* Styles + Culling labels */}
                            {(g.styles_used?.length > 0 || (cullingDone && g.culling_labels?.length > 0)) && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {g.styles_used?.map((s: string) => (
                                  <Badge key={s} className="bg-violet-500/10 text-violet-400 border-violet-500/30 text-xs gap-1">
                                    <Palette className="w-3 h-3" />{s}
                                  </Badge>
                                ))}
                                {cullingDone && g.culling_labels?.map((l: string) => (
                                  <Badge key={l} variant="outline" className="text-xs gap-1">
                                    <Scissors className="w-3 h-3" />{l}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Timeline */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                              {g.first_upload_at && (
                                <span className="flex items-center gap-1.5">
                                  <Upload className="w-3.5 h-3.5 text-cyan-400" /> Uploaded {fmt(g.first_upload_at)}
                                </span>
                              )}
                              {g.first_edit_at && (
                                <span className="flex items-center gap-1.5">
                                  <Timer className="w-3.5 h-3.5 text-pink-400" /> First edit {fmt(g.first_edit_at)}
                                </span>
                              )}
                              {g.last_edit_at && g.first_edit_at && g.last_edit_at !== g.first_edit_at && (
                                <span className="flex items-center gap-1.5">
                                  <Timer className="w-3.5 h-3.5 text-orange-400" /> Last edit {fmt(g.last_edit_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* === USAGE & ACTIVITY === */}
          <TabsContent value="usage" className="space-y-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <StatCard label="Last Upload" value={fmt(data.last_upload_at)} icon={Calendar} color="text-cyan-400" bg="bg-cyan-500/10" isText />
              <StatCard label="Total Images" value={data.images_count} icon={Image} color="text-blue-400" bg="bg-blue-500/10" />
              <StatCard label="Total Edits" value={data.edits_count} icon={Palette} color="text-pink-400" bg="bg-pink-500/10" />
            </div>

            <Card className="glass-card border-border/50">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h4 className="font-semibold text-sm">Credit Usage History</h4>
                </div>
                {data.edit_logs?.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-2">No credit usage</p>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0"><Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.edit_logs?.map((log: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{log.action_type}</TableCell>
                          <TableCell>{log.edits_spent}</TableCell>
                          <TableCell>{fmtDate(log.created_at)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-[300px] truncate">
                            {log.description || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table></div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card border-border/50">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-green-400" />
                  <h4 className="font-semibold text-sm">Credit Grants</h4>
                </div>
                {!data.credit_grants || data.credit_grants.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-2">No credit grants</p>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0"><Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Initial</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.credit_grants.map((grant: any) => (
                        <TableRow key={grant.id}>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{grant.grant_type}</Badge>
                          </TableCell>
                          <TableCell>{grant.credits_initial}</TableCell>
                          <TableCell>{grant.credits_remaining}</TableCell>
                          <TableCell>
                            <Badge className={
                              grant.status === "active" ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" :
                              grant.status === "expired" ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" :
                              "bg-muted text-muted-foreground"
                            }>{grant.status}</Badge>
                          </TableCell>
                          <TableCell>{fmtDate(grant.expires_at)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                            {grant.reason || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table></div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === EMAILS === */}
          <TabsContent value="emails">
            {data.email_logs?.length === 0 ? (
              <EmptyState icon={Send} message="No emails sent" />
            ) : (
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.email_logs?.map((log: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.email_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] sm:max-w-[300px] truncate">{log.subject}</TableCell>
                      <TableCell>
                        <Badge
                          variant={log.status === "sent" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{fmtDate(log.created_at)}</TableCell>
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
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.styles?.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.status}</Badge>
                      </TableCell>
                      <TableCell>{fmtDate(s.created_at)}</TableCell>
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
                  <Card key={s.id} className="glass-card border-border/50">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold">{fmt(s.created_at)}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <InfoCard icon={s.device_type === "mobile" ? Smartphone : Laptop} label="Device" value={s.device_type || "—"} color="text-violet-400" bg="bg-violet-500/10" />
                        <InfoCard icon={Monitor} label="OS" value={s.os || "—"} color="text-blue-400" bg="bg-blue-500/10" />
                        <InfoCard icon={Globe} label="Browser" value={s.browser || "—"} color="text-emerald-400" bg="bg-emerald-500/10" />
                        <InfoCard icon={Wifi} label="IP" value={<span className="font-mono text-xs break-all">{s.ip_address || "—"}</span>} color="text-amber-400" bg="bg-amber-500/10" />
                        <InfoCard icon={Monitor} label="Resolution" value={s.screen_width && s.screen_height ? `${s.screen_width}x${s.screen_height}` : "—"} color="text-cyan-400" bg="bg-cyan-500/10" />
                        <InfoCard icon={SunMoon} label="Theme" value={s.color_scheme || "—"} color="text-pink-400" bg="bg-pink-500/10" />
                      </div>
                    </CardContent>
                  </Card>
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
                      <Card key={q.id} className="glass-card border-border/50">
                        <CardContent className="pt-4 pb-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`p-1.5 rounded-lg ${userAnswer ? "bg-primary/10" : "bg-muted"}`}>
                                <ClipboardList className={`w-4 h-4 ${userAnswer ? "text-primary" : "text-muted-foreground"}`} />
                              </div>
                              <p className="text-sm font-semibold">{q.title}</p>
                            </div>
                            {userAnswer ? (
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <span className="text-xs text-muted-foreground">{fmtDate(userAnswer.answered_at)}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <CircleDashed className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Not answered</span>
                              </div>
                            )}
                          </div>
                          {userAnswer ? (
                            <div className="flex flex-wrap gap-1.5 mt-1 pl-9">
                              {(Array.isArray(userAnswer.answer) ? userAnswer.answer : [userAnswer.answer]).map((ans: string, i: number) => {
                                const opt = options.find((o: any) => o.id === ans);
                                return (
                                  <Badge key={i} className="bg-primary/10 text-primary border-primary/30">
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
                        </CardContent>
                      </Card>
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
      <div className={`p-2 rounded-lg ${bg} shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg, isText }: { label: string; value: number | string; icon: LucideIcon; color: string; bg: string; isText?: boolean }) {
  return (
    <Card className="glass-card border-border/50">
      <CardContent className="pt-3 pb-3 sm:pt-5 sm:pb-4 flex flex-col items-center text-center gap-1.5 sm:gap-2 px-2 sm:px-4">
        <div className={`p-2 sm:p-2.5 rounded-xl ${bg}`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
        </div>
        <div className="min-w-0 w-full">
          <p className={`${isText ? "text-xs sm:text-sm truncate" : "text-xl sm:text-2xl"} font-bold`}>{value}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <div className="p-4 rounded-2xl bg-muted/50">
        <Icon className="w-8 h-8" />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
