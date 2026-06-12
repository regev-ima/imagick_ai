import { useState, Suspense, type CSSProperties } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Images,
  Sparkles,
  CreditCard,
  Settings,
  Menu,
  X,
  LogOut,
  Plus,
  Shield,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/hooks/useSubscription";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { BuildVersionBadge } from "@/components/layout/BuildVersionBadge";
import { Orb } from "@/components/aura/Orb";
import { AuraCommand, openAuraCommand } from "@/components/aura/AuraCommand";
import imagickLogoDark from "@/assets/imagick-logo.png";
import imagickIconDark from "@/assets/imagick-icon.png";
import imagickLogoLight from "@/assets/imagick-logo-light.png";
import imagickIconLight from "@/assets/imagick-icon-light.png";

const navItems: { icon: any; label: string; href: string; adminOnly?: boolean }[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Images, label: "Collections", href: "/dashboard/galleries" },
  { icon: Sparkles, label: "AI Styles", href: "/dashboard/styles" },
  { icon: CreditCard, label: "Billing", href: "/dashboard/billing" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
  { icon: Shield, label: "Admin", href: "/dashboard/admin", adminOnly: true },
];

export default function DashboardLayout() {
  const location = useLocation();
  const isGalleryEditor = /^\/dashboard\/galleries\/[^/]+$/.test(location.pathname) && location.pathname !== "/dashboard/galleries/new";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isImpersonating, targetUser, stopImpersonation, effectiveDisplayName, effectiveEmail } = useImpersonation();
  const { isAdmin } = useUserRole();
  const { currentPlan, editsTotal, editsRemaining, isUnlimited, storageUsedMb, maxStorageGb, isFreePlan } = useSubscription();
  const { theme } = useTheme();

  const { data: platformLogos } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_settings").select("key, value");
      if (error) throw error;
      return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const isDark = theme === "dark";
  const avatarUrl = user?.user_metadata?.avatar_url || "";
  const imagickLogo = (isDark ? platformLogos?.logo_dark_full : platformLogos?.logo_light_full) || (isDark ? imagickLogoDark : imagickLogoLight);
  const imagickIcon = (isDark ? platformLogos?.logo_dark_icon : platformLogos?.logo_light_icon) || (isDark ? imagickIconDark : imagickIconLight);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const userInitials =
    effectiveDisplayName
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase() || effectiveEmail?.charAt(0).toUpperCase() || "U";

  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin);
  const isItemActive = (href: string) =>
    location.pathname === href || (href !== "/dashboard" && location.pathname.startsWith(href));
  const editsPct = isUnlimited ? 100 : editsTotal > 0 ? (editsRemaining / editsTotal) * 100 : 0;

  return (
    <div className="relative h-screen overflow-hidden bg-background">
      <AuraCommand />
      {/* ── Desktop floating pill rail ─────────────────────────────── */}
      <TooltipProvider delayDuration={0}>
        <aside className="fixed left-3 top-1/2 z-40 hidden -translate-y-1/2 lg:flex">
          <div className="flex max-h-[calc(100vh-1.5rem)] flex-col items-center gap-1.5 rounded-[28px] border border-border/60 bg-sidebar/80 px-2 py-3 backdrop-blur-xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_30px_70px_-30px_hsl(var(--background))]">
            {/* Brand */}
            <Link to="/dashboard" className="mb-1 grid h-11 w-11 place-items-center rounded-2xl transition-colors hover:bg-sidebar-accent" aria-label="Dashboard home">
              <img src={imagickIcon} alt="Imagick.ai" className="h-7 w-7 object-contain" />
            </Link>

            {/* Nav */}
            {visibleNav.map((item) => {
              const active = isItemActive(item.href);
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.href}
                      aria-label={item.label}
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-2xl transition-[background-color,color,box-shadow] duration-200",
                        active
                          ? "bg-primary/15 text-primary shadow-[0_0_22px_-6px_hsl(var(--glow-primary)/0.8)]"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}

            <div className="my-1 h-px w-6 bg-border/70" />

            {/* Credits gauge → billing */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/dashboard/billing" className="relative grid h-11 w-11 place-items-center" aria-label="Billing and credits">
                  <div className="absolute inset-0.5 aura-gauge" style={{ "--gauge": Math.round(editsPct) } as CSSProperties} />
                  <span className="font-mono text-[9px] text-primary">{isUnlimited ? "∞" : Math.round(editsPct)}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{isUnlimited ? "Unlimited edits" : `${editsRemaining.toLocaleString()} / ${editsTotal.toLocaleString()} edits`}</p>
                <p>{(storageUsedMb / 1024).toFixed(1)} / {maxStorageGb} GB storage</p>
                {isFreePlan && <p className="text-primary">Tap to upgrade</p>}
              </TooltipContent>
            </Tooltip>

            {/* Avatar + account menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="mt-1 rounded-full ring-offset-2 ring-offset-sidebar transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Account">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="bg-[image:var(--gradient-primary)] text-sm font-semibold text-white">{userInitials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-medium">{effectiveDisplayName || effectiveEmail?.split("@")[0] || "User"}</p>
                  <p className="truncate text-xs text-muted-foreground">{isImpersonating ? "Admin Impersonation" : currentPlan?.name || "Free Plan"}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1">
                  <BuildVersionBadge />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      </TooltipProvider>

      {/* ── Mobile overlay + sheet ─────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border/50 bg-sidebar/95 backdrop-blur-xl lg:hidden"
          >
            <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3">
                <img src={imagickLogo} alt="Imagick.ai" className="h-8 object-contain" />
              </Link>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="space-y-1.5 p-4">
              {visibleNav.map((item) => {
                const active = isItemActive(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-full px-3.5 py-2.5 transition-all",
                      active
                        ? "bg-primary/10 text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_0_24px_-8px_hsl(var(--glow-primary)/0.6)]"
                        : "text-sidebar-foreground hover:bg-sidebar-accent",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Credits — mobile */}
            <div className="space-y-2.5 border-t border-border/50 px-4 py-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Edits</span>
                  <span className="font-medium text-foreground">{isUnlimited ? "∞" : `${editsRemaining.toLocaleString()} / ${editsTotal.toLocaleString()}`}</span>
                </div>
                {!isUnlimited && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[image:var(--gradient-primary)] shadow-[0_0_10px_hsl(var(--glow-primary)/0.5)]" style={{ width: `${editsTotal > 0 ? Math.min(100, (editsRemaining / editsTotal) * 100) : 0}%` }} />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Storage</span>
                  <span className="font-medium text-foreground">{(storageUsedMb / 1024).toFixed(1)} GB / {maxStorageGb} GB</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[image:var(--gradient-primary)] shadow-[0_0_10px_hsl(var(--glow-primary)/0.5)]" style={{ width: `${maxStorageGb > 0 ? Math.min(100, (storageUsedMb / 1024 / maxStorageGb) * 100) : 0}%` }} />
                </div>
              </div>
              {isFreePlan && (
                <Link to="/dashboard/billing" onClick={() => setMobileMenuOpen(false)} className="text-xs text-primary hover:underline">
                  Upgrade
                </Link>
              )}
            </div>

            <div className="border-t border-border/50 p-4">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-sidebar-foreground transition-all hover:bg-sidebar-accent"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Sign out</span>
              </button>
            </div>

            <div className="px-4 pb-4">
              <BuildVersionBadge />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main column — full-bleed; the top bar and background span
          edge to edge, the rail floats over the left, and only the inner
          content is inset to clear it. ─────────────────────────────── */}
      <div className="flex h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 px-4 glass-card lg:pl-[92px] lg:pr-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openAuraCommand()}
              className="aura-chip hidden sm:inline-flex cursor-pointer transition-[border-color,color] duration-150 hover:border-primary/50 hover:text-foreground"
              aria-label="Open Aura command palette"
            >
              <Orb className="h-4 w-4" /> Ask Aura
              <kbd className="ml-1 font-mono text-[9px] opacity-70">⌘K</kbd>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="glow" size="icon" disabled={isImpersonating}>
                  <Plus className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={isImpersonating} onClick={() => navigate("/dashboard/galleries/new")}>
                  <Images className="mr-2 h-4 w-4" />
                  New Collection
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isImpersonating} onClick={() => navigate("/dashboard/styles/new")}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  New Style
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {isImpersonating && targetUser && (
          <div className="border-b border-amber-500/30 bg-amber-500/10">
            <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-2 lg:pl-[92px] lg:pr-6">
              <p className="truncate text-sm text-amber-500">
                Viewing account as <span className="font-semibold">{targetUser.fullName || targetUser.email}</span> ({targetUser.email})
              </p>
              <Button variant="outline" size="sm" onClick={stopImpersonation}>
                Exit Impersonation
              </Button>
            </div>
          </div>
        )}

        {/* Gallery editor keeps overflow-hidden so it can manage its own
            internal scroll; other pages scroll inside <main>. */}
        <main className={cn("flex-1", isGalleryEditor ? "overflow-hidden" : "overflow-auto lg:pl-[76px]")}>
          <Suspense
            fallback={
              <div className="flex h-full min-h-[60vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            }
          >
            {isGalleryEditor ? (
              <Outlet />
            ) : (
              <div className="mx-auto w-full max-w-[1600px]">
                <Outlet />
              </div>
            )}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
