import { useState, useRef, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  User,
  Lock,
  Bell,
  Palette,
  Trash2,
  Camera,
  Save,
  Eye,
  EyeOff,
  Shield,
  LogOut,
  Moon,
  Sun,
  Loader2,
  Settings,
  Upload,
  Sparkles,
  RefreshCw,
  CreditCard,
  Image,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useEffectiveUser } from "@/hooks/useImpersonation";
import { useTheme } from "@/components/theme/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tab = "profile" | "security" | "notifications" | "account";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile",       label: "Profile",       icon: User },
  { id: "security",      label: "Security",      icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account",       label: "Account",       icon: Settings },
];

// LIGHTROOM motion — calm, responsive fades/slides. No bounce, no float.
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

/**
 * The AI mark — a 4-point sparkle (the logo star). Royal blue by default.
 * Copied from the approved DashboardHome reference; tinted via currentColor
 * so it inherits text-primary / text-accent tokens.
 */
function Sparkle({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** A Lightroom-style tonal panel — hairline border, soft shadow. */
function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("glass-card overflow-hidden rounded-[--radius]", className)}>{children}</div>
  );
}

/** Mono section header — like a Lightroom module title bar. */
function PanelHeader({
  icon,
  label,
  trailing,
  tone = "muted",
}: {
  icon?: ReactNode;
  label: string;
  trailing?: ReactNode;
  tone?: "muted" | "ai" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b px-4 py-2.5",
        tone === "ai"
          ? "border-border bg-primary/[0.08] text-accent"
          : tone === "danger"
            ? "border-destructive/30 bg-destructive/[0.08] text-destructive"
            : "border-border bg-background/40 text-muted-foreground",
      )}
    >
      <span
        className="aura-microlabel flex items-center gap-2"
        style={tone === "muted" ? undefined : { color: "inherit" }}
      >
        {icon}
        {label}
      </span>
      {trailing}
    </div>
  );
}

/** A hairline-divided settings row — mono-less, label + control. */
function SettingRow({
  icon,
  title,
  desc,
  control,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  control: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-foreground/[0.02]",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-tight text-foreground">{title}</p>
          {desc && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { effectiveUserId, effectiveDisplayName, effectiveEmail, isImpersonating } = useEffectiveUser();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const isDarkMode = theme === "dark";

  const handleThemeChange = (dark: boolean) => {
    setTheme(dark ? "dark" : "light");
  };

  // Form states
  const [displayName, setDisplayName] = useState(effectiveDisplayName || "");
  const email = effectiveEmail || "";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Email notification preferences
  const defaultPrefs = {
    welcome_email:           true,
    gallery_upload_complete:  true,
    gallery_images_ready:     true,
    style_training_started:   true,
    style_ready:              true,
    re_edit_submitted:        true,
    re_edit_complete:         true,
    gallery_shared:           true,
    subscription_change:      true,
  };
  const [emailPrefs, setEmailPrefs] = useState(defaultPrefs);
  const [prefsLoading, setPrefsLoading] = useState(true);

  useEffect(() => {
    setDisplayName(effectiveDisplayName || "");
    setAvatarUrl(isImpersonating ? "" : (user?.user_metadata?.avatar_url || ""));
  }, [effectiveDisplayName, isImpersonating, user?.user_metadata?.avatar_url]);

  useEffect(() => {
    if (!effectiveUserId) return;
    supabase
      .from("user_email_preferences")
      .select("*")
      .eq("user_id", effectiveUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEmailPrefs({
            welcome_email:           data.welcome_email           ?? true,
            gallery_upload_complete:  data.gallery_upload_complete  ?? true,
            gallery_images_ready:     data.gallery_images_ready     ?? true,
            style_training_started:   data.style_training_started   ?? true,
            style_ready:              data.style_ready              ?? true,
            re_edit_submitted:        data.re_edit_submitted        ?? true,
            re_edit_complete:         data.re_edit_complete         ?? true,
            gallery_shared:           data.gallery_shared           ?? true,
            subscription_change:      data.subscription_change      ?? true,
          });
        }
        setPrefsLoading(false);
      });
  }, [effectiveUserId]);

  const handlePrefToggle = async (key: keyof typeof defaultPrefs, value: boolean) => {
    if (isImpersonating) {
      toast.info("Notification changes are disabled while impersonating");
      return;
    }
    setEmailPrefs(prev => ({ ...prev, [key]: value }));
    await supabase
      .from("user_email_preferences")
      .upsert({ user_id: user!.id, [key]: value, updated_at: new Date().toISOString() });
  };

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isImpersonating) {
      toast.info("Profile edits are disabled while impersonating");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user?.id) { toast.error("Please sign in to upload a photo"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be less than 2MB"); return; }

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("gallery-images")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("gallery-images")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });
      if (updateError) throw updateError;

      await supabase.auth.refreshSession();
      setAvatarUrl(publicUrl);
      toast.success("Profile photo updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload photo");
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveProfile = async () => {
    if (isImpersonating) {
      toast.info("Profile edits are disabled while impersonating");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } });
      if (error) throw error;
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (isImpersonating) {
      toast.info("Password changes are disabled while impersonating");
      return;
    }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setIsSaving(false);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);

  // ── Delete-account confirmation gate ──────────────────────────────────────
  // The destructive action stays disabled until the user types their exact
  // account email (case-insensitive, trimmed). Typing the word DELETE is an
  // accepted fallback. The typed value is reset whenever the dialog closes.
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const normalizedConfirm = deleteConfirmInput.trim().toLowerCase();
  const deleteConfirmed =
    normalizedConfirm.length > 0 &&
    (normalizedConfirm === (email || "").trim().toLowerCase() || normalizedConfirm === "delete");

  const handleDeleteDialogOpenChange = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) setDeleteConfirmInput("");
  };

  const handleDeleteAccount = async () => {
    if (isImpersonating) {
      toast.info("Account deletion is disabled while impersonating");
      return;
    }
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      toast.success("Account deleted successfully");
      await signOut();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const userInitials = displayName
    ? displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase()
    : email?.charAt(0).toUpperCase() || "U";

  // ── Notification items with icons ─────────────────────────────────────────
  const notificationGroups = [
    {
      title: "Collections",
      icon: Image,
      color: "text-muted-foreground",
      items: [
        { key: "gallery_upload_complete" as const, label: "Upload complete",  desc: "When all your photos have been uploaded successfully", icon: Upload },
        { key: "gallery_images_ready"   as const, label: "Editing complete", desc: "When the AI finishes editing all images in a collection", icon: Wand2 },
        { key: "re_edit_complete"       as const, label: "Re-edit complete", desc: "When re-edited images are ready to review", icon: RefreshCw },
      ],
    },
    {
      title: "AI Styles",
      icon: Sparkles,
      color: "text-muted-foreground",
      items: [
        { key: "style_training_started" as const, label: "Training started", desc: "When a new style begins training", icon: Sparkles },
        { key: "style_ready"            as const, label: "Style ready",      desc: "When your style finishes training and is ready to use", icon: Palette },
      ],
    },
    {
      title: "Account",
      icon: CreditCard,
      color: "text-muted-foreground",
      items: [
        { key: "subscription_change" as const, label: "Plan & billing updates", desc: "When your plan changes or credits are added", icon: CreditCard },
      ],
    },
  ];

  // ── Tab content renderers ────────────────────────────────────────────────

  const renderProfile = () => (
    <div className="space-y-6">
      {/* Identity */}
      <Panel>
        <PanelHeader icon={<User className="h-3.5 w-3.5" />} label="Profile — identity" />
        <div className="p-5 sm:p-6">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="group relative">
              <Avatar className="h-20 w-20 plate-keyline ring-1 ring-border ring-offset-2 ring-offset-background">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-primary text-xl text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={handlePhotoClick}
                disabled={isUploadingPhoto}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
              >
                {isUploadingPhoto ? <Loader2 className="h-5 w-5 animate-spin text-foreground" /> : <Camera className="h-5 w-5 text-foreground" />}
              </button>
            </div>
            <div className="space-y-1.5">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif"
                onChange={handlePhotoChange} className="hidden" />
              <Button variant="outline" size="sm" className="gap-2"
                onClick={handlePhotoClick} disabled={isUploadingPhoto}>
                {isUploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {isUploadingPhoto ? "Uploading..." : "Change Photo"}
              </Button>
              <p className="font-mono text-[11px] text-muted-foreground">JPG, PNG or GIF · Max 2MB</p>
            </div>
          </div>

          <hr className="aura-hairline my-6" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="aura-microlabel">Display Name</Label>
              <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name" className="bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="aura-microlabel">Email Address</Label>
              <Input id="email" type="email" value={email} disabled
                className="bg-background border-border opacity-60" />
              <p className="font-mono text-[11px] text-muted-foreground">Contact support to change email</p>
            </div>
          </div>

          <div className="mt-6">
            <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Panel>

      {/* Appearance */}
      <Panel>
        <PanelHeader icon={<Palette className="h-3.5 w-3.5" />} label="Profile — appearance" />
        <SettingRow
          icon={isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          title="Theme"
          desc="The studio is dark-first. Switch to daylight for soft proofing."
          control={
            <div className="flex items-center gap-1 rounded-[--radius] border border-border bg-background p-1">
              <button
                onClick={() => handleThemeChange(false)}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-3.5 py-1.5 text-sm font-medium transition-colors",
                  !isDarkMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sun className="h-4 w-4" />
                Light
              </button>
              <button
                onClick={() => handleThemeChange(true)}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-3.5 py-1.5 text-sm font-medium transition-colors",
                  isDarkMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Moon className="h-4 w-4" />
                Dark
              </button>
            </div>
          }
        />
      </Panel>
    </div>
  );

  const renderSecurity = () => (
    <Panel>
      <PanelHeader icon={<Lock className="h-3.5 w-3.5" />} label="Security — password" />
      <div className="p-5 sm:p-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="current-password" className="aura-microlabel">Current Password</Label>
            <div className="relative">
              <Input id="current-password" type={showCurrentPassword ? "text" : "password"}
                value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password" className="bg-background border-border pr-10" />
              <Button type="button" variant="ghost" size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="aura-microlabel">New Password</Label>
              <div className="relative">
                <Input id="new-password" type={showNewPassword ? "text" : "password"}
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password" className="bg-background border-border pr-10" />
                <Button type="button" variant="ghost" size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}>
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="aura-microlabel">Confirm New Password</Label>
              <Input id="confirm-password" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password" className="bg-background border-border" />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={handleChangePassword}
            disabled={isSaving || !newPassword || !confirmPassword}
            variant="outline" className="gap-2">
            <Shield className="h-4 w-4" />
            Change Password
          </Button>
        </div>
      </div>
    </Panel>
  );

  const renderNotifications = () => {
    if (prefsLoading) {
      return (
        <Panel>
          <PanelHeader icon={<Bell className="h-3.5 w-3.5" />} label="Notifications — email" />
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading preferences…
          </div>
        </Panel>
      );
    }

    return (
      <div className="space-y-6">
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          Choose which emails you'd like to receive. Changes save automatically.
        </p>
        {notificationGroups.map((group) => {
          const isAi = group.title === "AI Styles";
          return (
            <Panel key={group.title}>
              <PanelHeader
                tone={isAi ? "ai" : "muted"}
                icon={isAi ? <Sparkle size={12} className="text-accent" /> : <group.icon className="h-3.5 w-3.5" />}
                label={`Notifications — ${group.title.toLowerCase()}`}
              />
              <div className="divide-y divide-border">
                {group.items.map(({ key, label, desc, icon: ItemIcon }) => (
                  <SettingRow
                    key={key}
                    icon={<ItemIcon className="h-4 w-4" />}
                    title={label}
                    desc={desc}
                    control={<Switch checked={emailPrefs[key]} onCheckedChange={(v) => handlePrefToggle(key, v)} />}
                  />
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    );
  };

  const renderAccount = () => (
    <div className="space-y-6">
      {/* Session */}
      <Panel>
        <PanelHeader icon={<Settings className="h-3.5 w-3.5" />} label="Account — session" />
        <SettingRow
          icon={<LogOut className="h-4 w-4" />}
          title="Sign Out"
          desc="Sign out of your account on this device"
          control={
            <Button variant="outline" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          }
        />
      </Panel>

      {/* Danger Zone */}
      <Panel className="border-destructive/40">
        <PanelHeader tone="danger" icon={<Trash2 className="h-3.5 w-3.5" />} label="Danger zone" />
        <SettingRow
          icon={<Trash2 className="h-4 w-4 text-destructive" />}
          title={<span className="text-destructive">Delete Account</span>}
          desc="Permanently delete your account and all data"
          control={
            <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes your galleries, styles, and images. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-2">
                  <Label htmlFor="delete-confirm" className="aura-microlabel text-destructive">
                    Type your email to confirm
                  </Label>
                  <Input
                    id="delete-confirm"
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder={email || "DELETE"}
                    aria-label="Confirm account deletion by typing your email"
                    className="border-destructive/40 bg-background focus-visible:ring-destructive"
                  />
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Enter{" "}
                    <span className="font-medium text-foreground">{email || "your account email"}</span>{" "}
                    to enable deletion.
                  </p>
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting || !deleteConfirmed}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50">
                    {isDeleting ? "Deleting..." : "Delete Account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        />
      </Panel>
    </div>
  );

  const tabContent: Record<Tab, React.ReactNode> = {
    profile:       renderProfile(),
    security:      renderSecurity(),
    notifications: renderNotifications(),
    account:       renderAccount(),
  };

  return (
    <div className="relative min-h-full bg-background px-5 py-7 lg:px-10 lg:py-10">
      <div className="mx-auto w-full max-w-[1100px]">
        {/* ════ MASTHEAD ════════════════════════════════════════════════ */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="flex items-center justify-between gap-4 pb-3">
            <span className="caption">Settings — console</span>
            <span className="caption flex items-center gap-1.5 text-foreground">
              <Sparkle size={11} className="text-accent" />
              {email || "Account"}
            </span>
          </div>
          <hr className="aura-hairline" />
          <h1 className="mt-6 text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl">
            Account <span className="text-accent">settings</span>
          </h1>
          <p className="mt-3 font-sans text-base leading-relaxed text-muted-foreground">
            Manage your profile, security, notifications, and account.
          </p>
        </motion.header>

        {isImpersonating && (
          <div className="mt-6 flex items-center gap-2 rounded-[--radius] border border-[hsl(var(--rating))]/30 bg-[hsl(var(--rating))]/10 px-3.5 py-3 text-sm text-[hsl(var(--rating))]">
            <Shield className="h-4 w-4 shrink-0" />
            You are viewing this account in impersonation mode. Sensitive actions are disabled.
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.08 }}
          className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-start"
        >
          {/* ── Section index ──────────────────────────────────────────── */}
          {/* Mobile: horizontal scroll. Desktop: sticky vertical rail. */}
          <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:w-52 lg:shrink-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "group flex items-center gap-3 whitespace-nowrap rounded-[--radius] px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/[0.1] text-foreground"
                      : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-accent" : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* ── Active section content ─────────────────────────────────── */}
          <div className="min-w-0 flex-1">
            {tabContent[activeTab]}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
