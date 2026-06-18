import { useState, useEffect } from "react";
import { Mail, Eye, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const EMAIL_TEMPLATES = [
  { key: "welcome",                label: "Welcome Email",            description: "Sent when a new user signs up" },
  { key: "gallery_upload_complete", label: "Gallery Upload Complete",  description: "When all photos finish uploading" },
  { key: "gallery_images_ready",    label: "Gallery Images Ready",     description: "When AI finishes editing all images" },
  { key: "style_training_started",  label: "Style Training Started",   description: "When style training begins" },
  { key: "style_ready",            label: "Style Ready",              description: "When a style finishes training" },
  { key: "re_edit_submitted",      label: "Re-edit Submitted",        description: "When a re-edit job starts" },
  { key: "re_edit_complete",       label: "Re-edit Complete",          description: "When re-edited images are ready" },
  { key: "gallery_shared",         label: "Gallery Shared",           description: "Confirmation sent to photographer after sharing" },
  { key: "gallery_client_invite",  label: "Gallery Client Invite",    description: "Invitation sent to the client with gallery link" },
  { key: "subscription_change",    label: "Subscription Change",      description: "When a user upgrades or downgrades plan" },
  { key: "credits_added",          label: "Credits Added",            description: "When credits are added to the account" },
  { key: "culling_ready",          label: "Culling Ready",            description: "When AI culling finishes scoring photos" },
  { key: "password_reset",         label: "Password Reset",           description: "Password reset link email" },
  { key: "google_account",         label: "Google Account",           description: "Info email for Google-linked accounts requesting password reset" },
  { key: "gd_import_started",      label: "GD Import Started",        description: "When Google Drive import begins" },
  { key: "gd_import_complete",     label: "GD Import Complete",       description: "When Google Drive import finishes and processing starts" },
  { key: "journey_first_gallery",  label: "Journey: First Gallery",   description: "Day 1 — Encourages creating first gallery" },
  { key: "journey_social_proof",   label: "Journey: Social Proof",    description: "Day 3 — Shows what other photographers are doing" },
  { key: "journey_upload_more",    label: "Journey: Upload More",     description: "Day 7 — Encourages uploading more photos" },
  { key: "journey_upgrade",        label: "Journey: Upgrade",         description: "Day 14 — Conversion push for Pro plan" },
  { key: "journey_reengagement",   label: "Journey: Re-engagement",   description: "Day 21 — 'We miss you' for inactive users" },
];

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [previewingKey, setPreviewingKey] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) setRecipientEmail(user.email);
  }, [user?.email]);

  const handlePreview = async (templateKey: string) => {
    setPreviewingKey(templateKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-test-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ templateKey, previewOnly: true }),
        }
      );

      const result = await res.json();
      if (!res.ok) { toast.error(result.error || "Failed to load preview"); return; }

      const win = window.open("", "_blank");
      if (win) {
        win.document.write(result.html);
        win.document.close();
      }
    } catch (err) {
      toast.error("Failed to load preview");
    } finally {
      setPreviewingKey(null);
    }
  };

  const handleSend = async (templateKey: string) => {
    if (!recipientEmail) { toast.error("Please enter a recipient email"); return; }
    setSendingKey(templateKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-test-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ templateKey, recipientEmail }),
        }
      );

      const result = await res.json();
      if (!res.ok) { toast.error(result.error || "Failed to send"); return; }

      toast.success(`Test email sent to ${recipientEmail}`);
    } catch (err) {
      toast.error("Failed to send test email");
    } finally {
      setSendingKey(null);
    }
  };

  return (
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-6">
      <div>
        <span className="caption">Transactional email</span>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Email Templates</h1>
        <p className="text-muted-foreground mt-1">
          Preview and send test emails for all template types
        </p>
      </div>

      <Card className="glass-card overflow-hidden rounded-[--radius] border-border p-0">
        <CardHeader className="border-b border-border bg-background/40 px-4 py-2.5">
          <CardTitle className="aura-microlabel flex items-center gap-2 text-muted-foreground">
            <Mail className="w-3.5 h-3.5" />
            Recipient Email
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <Input
            type="email"
            placeholder="Enter recipient email..."
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            className="max-w-md"
          />
          <p className="text-xs text-muted-foreground mt-2">
            All test emails will be sent to this address
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden rounded-[--radius] border-border p-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="caption">Template</TableHead>
                <TableHead className="caption hidden md:table-cell">Description</TableHead>
                <TableHead className="caption text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EMAIL_TEMPLATES.map((template) => (
                <TableRow key={template.key} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs border-border text-muted-foreground">
                        {template.key}
                      </Badge>
                      <span className="font-medium hidden sm:inline">{template.label}</span>
                    </div>
                    <span className="font-medium sm:hidden text-sm">{template.label}</span>
                    <p className="text-xs text-muted-foreground md:hidden mt-1">{template.description}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {template.description}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(template.key)}
                        disabled={previewingKey === template.key}
                        aria-label={`Preview ${template.label}`}
                      >
                        {previewingKey === template.key ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline ml-1">Preview</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSend(template.key)}
                        disabled={sendingKey === template.key}
                        aria-label={`Send test ${template.label}`}
                      >
                        {sendingKey === template.key ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline ml-1">Send Test</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
