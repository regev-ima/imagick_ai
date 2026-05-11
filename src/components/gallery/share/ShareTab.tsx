import { useState } from "react";
import {
  Check, Copy, Eye, Loader2, Mail, MessageCircle,
  Plus, Send, Trash2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InvitedClient {
  id: string;
  email: string;
  client_name: string | null;
  sent_at: string | null;
  viewed_at: string | null;
}

interface ShareTabProps {
  galleryId: string;
  galleryName: string;
  shortLink: string;
  password: string;
  selectedTemplate: string;
  darkMode: boolean;
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

function buildWhatsAppMessage(galleryUrl: string) {
  // RTL-aware Hebrew variant if browser language is Hebrew.
  const lang = (typeof navigator !== "undefined" && navigator.language) || "";
  if (lang.toLowerCase().startsWith("he")) {
    return `הגלריה שלכם מוכנה! ${galleryUrl}`;
  }
  return `Hi! Your gallery is ready - ${galleryUrl}`;
}

function recordShareEvent(galleryId: string, channel: "whatsapp" | "copy" | "email") {
  // Fire-and-forget beacon — never block the UI on this.
  try {
    void supabase.functions.invoke("gallery-record-share", {
      body: { gallery_id: galleryId, channel },
    });
  } catch {
    // intentionally silent
  }
}

export function ShareTab(props: ShareTabProps) {
  const { galleryId, galleryName, shortLink, password, selectedTemplate, darkMode } = props;
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const { data: invitedClients = [], refetch: refetchInvites } = useQuery({
    queryKey: ["gallery-invites", galleryId],
    queryFn: async (): Promise<InvitedClient[]> => {
      const { data, error } = await supabase
        .from("gallery_invites")
        .select("*")
        .eq("gallery_id", galleryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvitedClient[];
    },
  });

  const addClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("gallery_invites").insert({
        gallery_id: galleryId,
        email: newEmail.trim().toLowerCase(),
        client_name: newName.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewEmail("");
      setNewName("");
      refetchInvites();
      toast.success("Client added");
    },
    onError: (e: any) => {
      if (e.message?.includes("duplicate")) {
        toast.error("This email is already invited");
      } else {
        toast.error("Could not add client");
      }
    },
  });

  const removeClient = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.from("gallery_invites").delete().eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchInvites();
      toast.success("Removed");
    },
  });

  const sendInviteEmail = useMutation({
    mutationFn: async (client: InvitedClient) => {
      const response = await supabase.functions.invoke("send-gallery-invite", {
        body: {
          galleryId,
          email: client.email,
          clientName: client.client_name,
          galleryName,
          galleryUrl: shortLink,
          password: password || null,
          template: selectedTemplate,
          darkMode,
        },
      });
      if (response.error) throw response.error;
      await supabase
        .from("gallery_invites")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", client.id);
      recordShareEvent(galleryId, "email");
    },
    onSuccess: () => {
      refetchInvites();
      toast.success("Invite sent");
    },
    onError: () => toast.error("Could not send. Check email settings."),
  });

  const sendToAll = useMutation({
    mutationFn: async () => {
      const pending = invitedClients.filter((c) => !c.sent_at);
      for (const c of pending) {
        await sendInviteEmail.mutateAsync(c);
      }
    },
    onSuccess: () => toast.success("Invites sent to all pending"),
  });

  const handleAddClient = () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    addClient.mutate();
  };

  const openWhatsApp = () => {
    const msg = buildWhatsAppMessage(shortLink);
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    recordShareEvent(galleryId, "whatsapp");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shortLink);
    toast.success("Link copied");
    recordShareEvent(galleryId, "copy");
  };

  const focusEmailInput = () => {
    // Smooth scroll the email composer card into view.
    const el = document.getElementById("share-email-section");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      const input = document.getElementById("share-email-input") as HTMLInputElement | null;
      input?.focus();
    }, 350);
  };

  return (
    <div className="space-y-10">
      {/* Quick share */}
      <section>
        <SectionHeading>Quick share</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <BigShareButton
            label="WhatsApp"
            sub="Send to phone"
            accentClass="from-emerald-500/20 to-emerald-700/10 border-emerald-500/40 text-emerald-300 hover:shadow-[0_0_30px_-3px_hsl(150_70%_45%/0.5)]"
            iconClass="bg-emerald-500/20 text-emerald-300"
            onClick={openWhatsApp}
            icon={<MessageCircle className="w-6 h-6" />}
          />
          <BigShareButton
            label="Copy link"
            sub="Paste anywhere"
            accentClass="from-[hsl(var(--neon-pink)/0.18)] to-[hsl(var(--neon-purple)/0.12)] border-[hsl(var(--neon-pink)/0.4)] text-[hsl(var(--neon-pink))] hover:shadow-[0_0_30px_-3px_hsl(var(--neon-pink)/0.5)]"
            iconClass="bg-[hsl(var(--neon-pink)/0.15)] text-[hsl(var(--neon-pink))]"
            onClick={copyLink}
            icon={<Copy className="w-6 h-6" />}
          />
          <BigShareButton
            label="Email"
            sub="Branded invite"
            accentClass="from-blue-500/20 to-blue-700/10 border-blue-500/40 text-blue-300 hover:shadow-[0_0_30px_-3px_hsl(210_80%_55%/0.5)]"
            iconClass="bg-blue-500/20 text-blue-300"
            onClick={focusEmailInput}
            icon={<Mail className="w-6 h-6" />}
          />
        </div>
      </section>

      {/* Invite by email */}
      <section id="share-email-section">
        <SectionHeading>Invite by email</SectionHeading>
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Client name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-muted/30 border-border/40 flex-[0.4]"
            />
            <Input
              id="share-email-input"
              type="email"
              placeholder="client@email.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="bg-muted/30 border-border/40 flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAddClient()}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleAddClient}
              disabled={addClient.isPending}
            >
              {addClient.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>

          {invitedClients.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Invited ({invitedClients.length})
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => sendToAll.mutate()}
                  disabled={sendToAll.isPending || invitedClients.every((c) => c.sent_at)}
                >
                  {sendToAll.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  Send to all
                </Button>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {invitedClients.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.client_name || c.email}
                      </p>
                      {c.client_name && (
                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {c.viewed_at && (
                        <span className="text-xs text-[hsl(var(--neon-pink))] flex items-center gap-1">
                          <Eye className="w-3 h-3" /> Viewed
                        </span>
                      )}
                      {c.sent_at ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Check className="w-3 h-3" /> Sent
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => sendInviteEmail.mutate(c)}
                          disabled={sendInviteEmail.isPending}
                        >
                          {sendInviteEmail.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Send
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeClient.mutate(c.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No clients invited yet</p>
              <p className="text-xs">Add emails above to send branded invites.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function BigShareButton({
  label, sub, icon, onClick, accentClass, iconClass,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  onClick: () => void;
  accentClass: string;
  iconClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative rounded-2xl border bg-gradient-to-br transition-all p-5 text-left overflow-hidden",
        accentClass,
      )}
    >
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-3", iconClass)}>
        {icon}
      </div>
      <p className="text-base font-medium text-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
      <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-current opacity-10 blur-2xl pointer-events-none transition-opacity group-hover:opacity-20" />
    </button>
  );
}
