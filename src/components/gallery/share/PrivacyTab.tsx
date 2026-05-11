import { useMemo, useState } from "react";
import { differenceInDays, format } from "date-fns";
import { AlertTriangle, Calendar, Loader2, Lock, Mail, ShieldAlert, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useActiveGallerySessionsCount } from "@/hooks/useGallerySettings";

interface PrivacyTabProps {
  galleryId: string;
  password: string;
  onPasswordChange: (v: string) => void;
  emailGateEnabled: boolean;
  onEmailGateChange: (v: boolean) => void;
  expiryDate: string | null;
  onExpiryDateChange: (v: string | null) => void;
  onRevoked?: () => void;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3
        className="text-[18px] font-normal tracking-tight text-foreground"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {children}
      </h3>
      <div className="mt-2 h-px w-12 bg-[hsl(var(--neon-pink))]" />
    </div>
  );
}

function toInputDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // Convert to local datetime-local format yyyy-MM-ddTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PrivacyTab(props: PrivacyTabProps) {
  const {
    galleryId, password, onPasswordChange,
    emailGateEnabled, onEmailGateChange,
    expiryDate, onExpiryDateChange,
    onRevoked,
  } = props;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data: activeSessions = 0 } = useActiveGallerySessionsCount(galleryId);

  const expiryRelative = useMemo(() => {
    if (!expiryDate) return null;
    const d = new Date(expiryDate);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const days = differenceInDays(d, now);
    if (days < 0) return { text: "Expired", warn: true };
    if (days === 0) return { text: "Expires today", warn: true };
    if (days === 1) return { text: "Expires tomorrow", warn: false };
    return { text: `Expires in ${days} days`, warn: false };
  }, [expiryDate]);

  const rotateSecret = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("gallery-rotate-share-secret", {
        body: { gallery_id: galleryId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All access revoked. Share new links to re-grant access.");
      onRevoked?.();
      setConfirmOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || "Could not revoke access"),
  });

  return (
    <div className="space-y-10">
      {/* Password */}
      <section>
        <SectionHeading>Password protection</SectionHeading>
        <div className="glass-card rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[hsl(var(--neon-pink)/0.12)] flex items-center justify-center">
              <Lock className="w-4 h-4 text-[hsl(var(--neon-pink))]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Require a password</p>
              <p className="text-[11px] text-muted-foreground">
                {password ? "Enabled — clients must enter this password to view" : "Off — anyone with the link can view"}
              </p>
            </div>
          </div>
          <Input
            type="text"
            placeholder="Leave empty for no password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="bg-muted/30 border-border/40 font-mono"
          />
        </div>
      </section>

      {/* Email gate */}
      <section>
        <SectionHeading>Email gate</SectionHeading>
        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center">
              <Mail className="w-4 h-4 text-[hsl(var(--neon-purple))]" />
            </div>
            <div>
              <p className="text-sm font-medium">Ask for an email before viewing</p>
              <p className="text-[11px] text-muted-foreground">
                Catches guest emails for follow-up; not the same as a password.
              </p>
            </div>
          </div>
          <Switch checked={emailGateEnabled} onCheckedChange={onEmailGateChange} />
        </div>
      </section>

      {/* Expiry */}
      <section>
        <SectionHeading>Link expiry</SectionHeading>
        <div className="glass-card rounded-xl p-5 space-y-3">
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            Auto-expire on
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="datetime-local"
              value={toInputDatetimeLocal(expiryDate)}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return onExpiryDateChange(null);
                onExpiryDateChange(new Date(v).toISOString());
              }}
              className="bg-muted/30 border-border/40 max-w-xs"
            />
            {expiryDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onExpiryDateChange(null)}
                className="text-muted-foreground"
              >
                Clear
              </Button>
            )}
          </div>
          {expiryRelative && (
            <p className={expiryRelative.warn ? "text-xs text-amber-400" : "text-xs text-muted-foreground"}>
              {expiryRelative.text}
              {expiryDate && (
                <span className="ml-2 opacity-60">
                  · {format(new Date(expiryDate), "PPp")}
                </span>
              )}
            </p>
          )}
        </div>
      </section>

      {/* Active sessions counter */}
      <section>
        <SectionHeading>Active sessions</SectionHeading>
        <div className="glass-card rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center">
              <Users2 className="w-5 h-5 text-[hsl(var(--neon-blue))]" />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none">{activeSessions}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {activeSessions === 1 ? "active viewer right now" : "active viewers right now"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Kill switch */}
      <section>
        <SectionHeading>Kill switch</SectionHeading>
        <div className="rounded-xl p-5 border border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Revoke all access</p>
              <p className="text-[11px] text-muted-foreground mt-1 mb-4">
                Invalidates the current gallery link and rotates the share secret. Existing viewers
                will be locked out until you re-issue the link.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="gap-2 transition-shadow hover:shadow-[0_0_25px_-3px_hsl(var(--destructive)/0.6)]"
                onClick={() => setConfirmOpen(true)}
              >
                <AlertTriangle className="w-4 h-4" />
                Revoke all access
              </Button>
            </div>
          </div>
        </div>
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="glass-card border-destructive/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Revoke all access?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate the current gallery link. All existing recipients will lose
              access until you re-issue links. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                rotateSecret.mutate();
              }}
              disabled={rotateSecret.isPending}
            >
              {rotateSecret.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Yes, revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
