import { useState, useRef, useEffect } from "react";
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
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import { useIsMobile } from "@/hooks/use-mobile";

type Tab = "profile" | "security" | "notifications" | "account";

const tabs: { id: Tab; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { id: "profile",       label: "Profile",       icon: User,     color: "text-violet-400", bg: "bg-violet-500/10" },
  { id: "security",      label: "Security",      icon: Lock,     color: "text-amber-400",  bg: "bg-amber-500/10" },
  { id: "notifications", label: "Notifications", icon: Bell,     color: "text-blue-400",   bg: "bg-blue-500/10" },
  { id: "account",       label: "Account",       icon: Settings, color: "text-rose-400",   bg: "bg-rose-500/10" },
];

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { effectiveUserId, effectiveDisplayName, effectiveEmail, isImpersonating } = useEffectiveUser();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
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
      color: "text-blue-400",
      items: [
        { key: "gallery_upload_complete" as const, label: "Upload complete",  desc: "When all your photos have been uploaded successfully", icon: Upload },
        { key: "gallery_images_ready"   as const, label: "Editing complete", desc: "When the AI finishes editing all images in a collection", icon: Wand2 },
        { key: "re_edit_complete"       as const, label: "Re-edit complete", desc: "When re-edited images are ready to review", icon: RefreshCw },
      ],
    },
    {
      title: "AI Styles",
      icon: Sparkles,
      color: "text-violet-400",
      items: [
        { key: "style_training_started" as const, label: "Training started", desc: "When a new style begins training", icon: Sparkles },
        { key: "style_ready"            as const, label: "Style ready",      desc: "When your style finishes training and is ready to use", icon: Palette },
      ],
    },
    {
      title: "Account",
      icon: CreditCard,
      color: "text-emerald-400",
      items: [
        { key: "subscription_change" as const, label: "Plan & billing updates", desc: "When your plan changes or credits are added", icon: CreditCard },
      ],
    },
  ];

  // ── Tab content renderers ────────────────────────────────────────────────

  const renderProfile = () => (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10">
            <User className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal information and profile picture</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-6">
          <div className="relative group">
            <Avatar className="w-20 h-20 ring-2 ring-border/50 ring-offset-2 ring-offset-background">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xl">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={handlePhotoClick}
              disabled={isUploadingPhoto}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              {isUploadingPhoto ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            </button>
          </div>
          <div className="space-y-1.5">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif"
              onChange={handlePhotoChange} className="hidden" />
            <Button variant="outline" size="sm" className="gap-2"
              onClick={handlePhotoClick} disabled={isUploadingPhoto}>
              {isUploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {isUploadingPhoto ? "Uploading..." : "Change Photo"}
            </Button>
            <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name" className="bg-muted/50 border-border/50" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" value={email} disabled
              className="bg-muted/50 border-border/50 opacity-60" />
            <p className="text-xs text-muted-foreground">Contact support to change email</p>
          </div>
        </div>

        <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2">
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>

        <Separator />

        {/* Appearance */}
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-1.5 rounded-lg bg-pink-500/10">
              <Palette className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Appearance</p>
              <p className="text-xs text-muted-foreground">Choose your preferred theme</p>
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border/50 w-fit">
            <button
              onClick={() => handleThemeChange(false)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                !isDarkMode ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sun className="w-4 h-4" />
              Light
            </button>
            <button
              onClick={() => handleThemeChange(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                isDarkMode ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Moon className="w-4 h-4" />
              Dark
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderSecurity = () => (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage your password and security settings</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input id="current-password" type={showCurrentPassword ? "text" : "password"}
                value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password" className="bg-muted/50 border-border/50 pr-10" />
              <Button type="button" variant="ghost" size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input id="new-password" type={showNewPassword ? "text" : "password"}
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password" className="bg-muted/50 border-border/50 pr-10" />
                <Button type="button" variant="ghost" size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}>
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input id="confirm-password" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password" className="bg-muted/50 border-border/50" />
            </div>
          </div>
        </div>

        <Button onClick={handleChangePassword}
          disabled={isSaving || !newPassword || !confirmPassword}
          variant="outline" className="gap-2">
          <Shield className="w-4 h-4" />
          Change Password
        </Button>
      </CardContent>
    </Card>
  );

  const renderNotifications = () => (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Bell className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>
              Choose which emails you'd like to receive. Changes save automatically.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {prefsLoading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading preferences...
          </div>
        ) : (
          <div className="space-y-6">
            {notificationGroups.map((group) => (
              <div key={group.title}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-md ${group.color === "text-blue-400" ? "bg-blue-500/10" : group.color === "text-violet-400" ? "bg-violet-500/10" : "bg-emerald-500/10"}`}>
                    <group.icon className={`w-3.5 h-3.5 ${group.color}`} />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </p>
                </div>
                <div className="space-y-0 rounded-lg border border-border/50 overflow-hidden">
                  {group.items.map(({ key, label, desc, icon: ItemIcon }, i) => (
                    <div key={key} className={cn(
                      "flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors",
                      i < group.items.length - 1 && "border-b border-border/30"
                    )}>
                      <div className="flex items-start gap-3">
                        <ItemIcon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                      </div>
                      <Switch checked={emailPrefs[key]} onCheckedChange={(v) => handlePrefToggle(key, v)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderAccount = () => (
    <div className="space-y-4">
      {/* Sign Out */}
      <Card className="glass-card border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <LogOut className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Sign Out</p>
                <p className="text-sm text-muted-foreground">Sign out of your account on this device</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="glass-card border-destructive/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">Delete Account</p>
                <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account and remove
                    all your data including galleries, styles, and images.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeleting ? "Deleting..." : "Delete Account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const tabContent: Record<Tab, React.ReactNode> = {
    profile:       renderProfile(),
    security:      renderSecurity(),
    notifications: renderNotifications(),
    account:       renderAccount(),
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">
          Account <span className="text-gradient-primary">Settings</span>
        </h1>
        <p className="text-muted-foreground mt-1.5">Manage your account settings and preferences</p>
      </motion.div>

      {isImpersonating && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-500">
          You are viewing this account in impersonation mode. Sensitive actions are disabled.
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "flex gap-6",
          isMobile ? "flex-col" : "flex-row items-start"
        )}
      >
        {/* ── Sidebar / Tab list ────────────────────────────────────────── */}
        {isMobile ? (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1">
            {tabs.map(({ id, label, icon: Icon, color, bg }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                  activeTab === id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="w-52 shrink-0 flex flex-col gap-1">
            {tabs.map(({ id, label, icon: Icon, color, bg }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                  activeTab === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-md transition-colors shrink-0",
                  activeTab === id ? "bg-white/20" : bg
                )}>
                  <Icon className={cn("w-4 h-4", activeTab === id ? "text-primary-foreground" : color)} />
                </div>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Active tab content ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {tabContent[activeTab]}
        </div>
      </motion.div>
    </div>
  );
}
