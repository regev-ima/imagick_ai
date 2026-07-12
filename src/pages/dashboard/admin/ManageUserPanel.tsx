import { useState } from "react";
import { Coins, Sparkles, UserCog, Ban, ShieldCheck, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Props {
  userId: string;
  email: string;
  fullName: string;
  /** "" | "moderator" | "admin" — empty means a regular user. */
  role: string;
  suspended: boolean;
  onChanged: () => void;
}

async function callManage(action: string, payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-user`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

function Card({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-[--radius] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="aura-microlabel">{title}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

export function ManageUserPanel({ userId, email, fullName, role, suspended, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [credits, setCredits] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [models, setModels] = useState("1");
  const [name, setName] = useState(fullName);
  const [mail, setMail] = useState(email);
  const [newRole, setNewRole] = useState(role || "user");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const run = async (key: string, action: string, payload: Record<string, unknown>, ok: string) => {
    setBusy(key);
    try {
      await callManage(action, { userId, ...payload });
      toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message || "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Grant credits */}
      <Card icon={<Coins className="h-4 w-4" />} title="Grant credits" desc="Add gift credits to this account's balance.">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label className="aura-microlabel text-muted-foreground">Amount</Label>
            <Input type="number" min={1} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="e.g. 1000" className="h-9" />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="aura-microlabel text-muted-foreground">Reason (optional)</Label>
            <Input value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="e.g. goodwill" className="h-9" />
          </div>
          <Button
            variant="glow"
            className="shrink-0"
            disabled={busy !== null || !(Number(credits) > 0)}
            onClick={() => run("credits", "grant_credits", { amount: Number(credits), reason: creditReason || undefined }, `Granted ${Number(credits)} credits`).then(() => { setCredits(""); setCreditReason(""); })}
          >
            {busy === "credits" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant"}
          </Button>
        </div>
      </Card>

      {/* Grant models */}
      <Card icon={<Sparkles className="h-4 w-4" />} title="Add custom models" desc="Grant extra custom-model slots (extra_model add-ons).">
        <div className="flex items-end gap-2">
          <div className="w-28 space-y-1">
            <Label className="aura-microlabel text-muted-foreground">Quantity</Label>
            <Input type="number" min={1} value={models} onChange={(e) => setModels(e.target.value)} className="h-9" />
          </div>
          <Button
            variant="glow"
            disabled={busy !== null || !(Number(models) > 0)}
            onClick={() => run("models", "grant_models", { quantity: Number(models) }, `Added ${Number(models)} model slot(s)`)}
          >
            {busy === "models" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
      </Card>

      {/* Edit details */}
      <Card icon={<UserCog className="h-4 w-4" />} title="Account details" desc="Edit the user's name, email, and role.">
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="aura-microlabel text-muted-foreground">Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="aura-microlabel text-muted-foreground">Email</Label>
            <Input type="email" value={mail} onChange={(e) => setMail(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="aura-microlabel text-muted-foreground">Role</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy !== null || (name === fullName && mail === email && newRole === (role || "user"))}
            onClick={() => run("details", "edit_details", {
              full_name: name !== fullName ? name : undefined,
              email: mail !== email ? mail : undefined,
              role: newRole !== (role || "user") ? newRole : undefined,
            }, "Account details updated")}
          >
            {busy === "details" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </Card>

      {/* Danger zone — suspend / delete */}
      <Card icon={<Ban className="h-4 w-4" />} title="Access & lifecycle" desc={suspended ? "This account is suspended (access blocked)." : "Suspend blocks access; suspended accounts are purged after 60 days."}>
        <div className="flex flex-col gap-2 sm:flex-row">
          {suspended ? (
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              disabled={busy !== null}
              onClick={() => run("unsuspend", "unsuspend", {}, "Account reactivated")}
            >
              {busy === "unsuspend" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Reactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              className="flex-1 gap-1.5 border-rating/40 text-rating hover:bg-rating/10"
              disabled={busy !== null}
              onClick={() => run("suspend", "suspend", {}, "Account suspended")}
            >
              {busy === "suspend" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Suspend (cancel)
            </Button>
          )}
          <Button
            variant="destructive"
            className="flex-1 gap-1.5"
            disabled={busy !== null}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" /> Delete now
          </Button>
        </div>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately erases {email} and all their data (galleries, images, styles, subscription). This cannot be undone. The anti-abuse record that blocks re-claiming free welcome credits is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => run("delete", "delete", {}, "Account deleted")}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
