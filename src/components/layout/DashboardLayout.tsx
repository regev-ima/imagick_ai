import { useState, useEffect, Suspense } from "react";
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
  ChevronLeft,
  LogOut,
  Plus,
  Shield,
  Loader2
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { BuildVersionBadge } from "@/components/layout/BuildVersionBadge";
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
  const [sidebarOpen, setSidebarOpen] = useState(!isGalleryEditor);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isImpersonating, targetUser, stopImpersonation, effectiveDisplayName, effectiveEmail } = useImpersonation();
  const { isAdmin } = useUserRole();
  const { currentPlan, editsUsed, editsTotal, editsRemaining, isUnlimited, storageUsedMb, maxStorageGb, isFreePlan } = useSubscription();
  const { theme } = useTheme();

  // Fetch custom logos from platform settings
  const { data: platformLogos } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value");
      if (error) throw error;
      return Object.fromEntries((data || []).map(r => [r.key, r.value]));
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const isDark = theme === "dark";
  const avatarUrl = user?.user_metadata?.avatar_url || "";
  
  // Use custom logos if available, fallback to defaults
  const imagickLogo = (isDark ? platformLogos?.logo_dark_full : platformLogos?.logo_light_full) || (isDark ? imagickLogoDark : imagickLogoLight);
  const imagickIcon = (isDark ? platformLogos?.logo_dark_icon : platformLogos?.logo_light_icon) || (isDark ? imagickIconDark : imagickIconLight);


  // Auto-collapse sidebar when entering gallery editor
  useEffect(() => {
    if (isGalleryEditor) {
      setSidebarOpen(false);
    }
  }, [isGalleryEditor]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const userInitials = effectiveDisplayName
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || effectiveEmail?.charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <motion.aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border/50 bg-sidebar transition-all duration-300 relative sticky top-0 h-screen overflow-visible z-40",
          sidebarOpen ? "w-64" : "w-20"
        )}
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 80 }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border/50">
          <Link to="/dashboard" className="flex items-center gap-3">
            <AnimatePresence mode="wait">
              {sidebarOpen ? (
                <motion.img
                  key="full-logo"
                  src={imagickLogo}
                  alt="Imagick.ai"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="h-8 object-contain"
                />
              ) : (
                <motion.img
                  key="icon-logo"
                  src={imagickIcon}
                  alt="Imagick.ai"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="w-10 h-10 object-contain flex-shrink-0"
                />
              )}
            </AnimatePresence>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn("flex-shrink-0", !sidebarOpen && "absolute -right-4 top-5 w-7 h-7 rounded-full bg-muted border border-border z-50")}
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform", !sidebarOpen && "rotate-180")} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <TooltipProvider delayDuration={0}>
            {navItems.filter(item => !item.adminOnly || isAdmin).map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
              
              const linkContent = (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                    isActive
                      ? "bg-primary/5 text-primary border-l-[3px] border-l-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="font-medium whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              );

              if (!sidebarOpen) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })}
          </TooltipProvider>
        </nav>

        {/* Credits Widget */}
        {sidebarOpen ? (
          <div className="px-4 py-3 border-t border-border/50 space-y-2.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Edits</span>
                <span className="font-medium text-foreground">
                  {isUnlimited ? "∞" : `${editsRemaining.toLocaleString()} / ${editsTotal.toLocaleString()}`}
                </span>
              </div>
              {!isUnlimited && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${editsTotal > 0 ? Math.min(100, (editsRemaining / editsTotal) * 100) : 0}%` }}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Storage</span>
                <span className="font-medium text-foreground">
                  {(storageUsedMb / 1024).toFixed(1)} GB / {maxStorageGb} GB
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${maxStorageGb > 0 ? Math.min(100, (storageUsedMb / 1024 / maxStorageGb) * 100) : 0}%` }}
                />
              </div>
            </div>
            {isFreePlan && (
              <Link to="/dashboard/billing" className="text-xs text-primary hover:underline">
                Upgrade
              </Link>
            )}
          </div>
        ) : (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center py-3 border-t border-border/50 cursor-default">
                  <svg width="28" height="28" viewBox="0 0 28 28" className="text-primary">
                    <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.15" />
                    <circle
                      cx="14" cy="14" r="12"
                      fill="none" stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 12}`}
                      strokeDashoffset={`${2 * Math.PI * 12 * (1 - (isUnlimited ? 1 : editsTotal > 0 ? editsRemaining / editsTotal : 0))}`}
                      transform="rotate(-90 14 14)"
                    />
                    {isUnlimited && (
                      <text x="14" y="14" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="12" fontWeight="bold">∞</text>
                    )}
                  </svg>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{isUnlimited ? "Unlimited edits" : `${editsRemaining.toLocaleString()} / ${editsTotal.toLocaleString()} edits`}</p>
                <p>{(storageUsedMb / 1024).toFixed(1)} / {maxStorageGb} GB storage</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* User Section */}
        <div className="p-4 border-t border-border/50">
          <TooltipProvider delayDuration={0}>
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {effectiveDisplayName || effectiveEmail?.split("@")[0] || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {isImpersonating ? "Admin Impersonation" : (currentPlan?.name || "Free Plan")}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={handleSignOut} aria-label="Sign out">
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign out</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handleSignOut} aria-label="Sign out">
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign out</TooltipContent>
                </Tooltip>
              </div>
            )}
          </TooltipProvider>
        </div>

        {/* Build fingerprint — confirms which deploy is live. */}
        <div className="px-2 pb-2">
          <BuildVersionBadge compact={!sidebarOpen} />
        </div>
      </motion.aside>

      {/* Mobile Menu Overlay */}
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

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-border/50 lg:hidden"
          >
            <div className="h-16 flex items-center justify-between px-4 border-b border-border/50">
              <Link to="/dashboard" className="flex items-center gap-3">
                <img
                  src={imagickLogo}
                  alt="Imagick.ai"
                  className="h-8 object-contain"
                />
              </Link>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <nav className="p-4 space-y-2">
              {navItems.filter(item => !item.adminOnly || isAdmin).map((item) => {
                const isActive = location.pathname === item.href ||
                  (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                      isActive
                        ? "bg-primary/5 text-primary border-l-[3px] border-l-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Credits Widget - Mobile */}
            <div className="px-4 py-3 border-t border-border/50 space-y-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Edits</span>
                  <span className="font-medium text-foreground">
                    {isUnlimited ? "∞" : `${editsRemaining.toLocaleString()} / ${editsTotal.toLocaleString()}`}
                  </span>
                </div>
                {!isUnlimited && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${editsTotal > 0 ? Math.min(100, (editsRemaining / editsTotal) * 100) : 0}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Storage</span>
                  <span className="font-medium text-foreground">
                    {(storageUsedMb / 1024).toFixed(1)} GB / {maxStorageGb} GB
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${maxStorageGb > 0 ? Math.min(100, (storageUsedMb / 1024 / maxStorageGb) * 100) : 0}%` }}
                  />
                </div>
              </div>
              {isFreePlan && (
                <Link to="/dashboard/billing" onClick={() => setMobileMenuOpen(false)} className="text-xs text-primary hover:underline">
                  Upgrade
                </Link>
              )}
            </div>

            {/* Sign out */}
            <div className="p-4 border-t border-border/50">
              <button
                onClick={() => { setMobileMenuOpen(false); handleSignOut(); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign out</span>
              </button>
            </div>

            {/* Build fingerprint */}
            <div className="px-4 pb-4">
              <BuildVersionBadge />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-border/50 flex items-center justify-between px-4 lg:px-6 glass-card sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="glow" size="icon" disabled={isImpersonating}>
                  <Plus className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={isImpersonating} onClick={() => navigate("/dashboard/galleries/new")}>
                  <Images className="w-4 h-4 mr-2" />
                  New Collection
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isImpersonating} onClick={() => navigate("/dashboard/styles/new")}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  New Style
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {isImpersonating && targetUser && (
          <div className="border-b border-amber-500/30 bg-amber-500/10">
            <div className="mx-auto w-full max-w-[1400px] px-4 lg:px-6 py-2 flex items-center justify-between gap-3">
              <p className="text-sm text-amber-500 truncate">
                Viewing account as <span className="font-semibold">{targetUser.fullName || targetUser.email}</span> ({targetUser.email})
              </p>
              <Button variant="outline" size="sm" onClick={stopImpersonation}>
                Exit Impersonation
              </Button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className={cn(
          "flex-1 overflow-auto",
          !isGalleryEditor && "mx-auto w-full max-w-[1400px]"
        )}>
          <Suspense fallback={
            <div className="flex items-center justify-center h-full min-h-[60vh]">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
