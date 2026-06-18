import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Send, MessageSquare, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Recipient {
  name: string;
  chatId: string;
}

export default function NotificationsSettingsPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ["whatsapp-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "whatsapp_recipients")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      if (data?.value) {
        return JSON.parse(data.value) as Recipient[];
      }
      return [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newRecipients: Recipient[]) => {
      const { error } = await supabase
        .from("platform_settings")
        .upsert(
          { key: "whatsapp_recipients", value: JSON.stringify(newRecipients), updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-recipients"] });
    },
  });

  const handleAdd = () => {
    const phone = newPhone.replace(/[^0-9]/g, "");
    if (!newName.trim() || !phone) {
      toast.error("Please fill in name and phone number");
      return;
    }
    const chatId = `${phone}@c.us`;
    if (recipients.some((r) => r.chatId === chatId)) {
      toast.error("This number already exists");
      return;
    }
    const updated = [...recipients, { name: newName.trim(), chatId }];
    saveMutation.mutate(updated, {
      onSuccess: () => {
        toast.success(`${newName.trim()} added`);
        setNewName("");
        setNewPhone("");
      },
    });
  };

  const handleRemove = (chatId: string) => {
    const updated = recipients.filter((r) => r.chatId !== chatId);
    saveMutation.mutate(updated, {
      onSuccess: () => toast.success("Recipient removed"),
    });
  };

  const handleSendTest = async () => {
    if (!testMessage.trim()) {
      toast.error("Enter a test message");
      return;
    }
    setIsSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke("notify-whatsapp", {
        body: { message: testMessage.trim() },
      });
      if (error) throw error;
      toast.success("Test message sent!");
      setTestMessage("");
    } catch (err: any) {
      toast.error("Failed to send: " + (err.message || "Unknown error"));
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/admin" aria-label="Back to admin"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <span className="caption">WhatsApp alerts</span>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">Manage who receives WhatsApp notifications</p>
        </div>
      </div>

      {/* Add Recipient */}
      <Card className="glass-card overflow-hidden rounded-[--radius] border-border p-0">
        <CardHeader className="border-b border-border bg-background/40 px-4 py-2.5">
          <CardTitle className="aura-microlabel flex items-center gap-2 text-muted-foreground"><Plus className="w-3.5 h-3.5" /> Add Recipient</CardTitle>
          <CardDescription className="text-xs">Add a new WhatsApp number to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="e.g. Admin" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="phone">Phone (with country code)</Label>
              <Input id="phone" placeholder="e.g. 972501234567" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} disabled={saveMutation.isPending}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipients List */}
      <Card className="glass-card overflow-hidden rounded-[--radius] border-border p-0">
        <CardHeader className="border-b border-border bg-background/40 px-4 py-2.5">
          <CardTitle className="aura-microlabel flex items-center gap-2 text-muted-foreground"><MessageSquare className="w-3.5 h-3.5" /> Recipients ({recipients.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recipients configured. Falling back to default GREEN_API_CHAT_ID.</p>
          ) : (
            <div className="space-y-2">
              {recipients.map((r) => (
                <div key={r.chatId} className="flex items-center justify-between p-3 rounded-[--radius] surface-2 border border-border">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="font-mono text-sm text-muted-foreground">{r.chatId.replace("@c.us", "")}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(r.chatId)} disabled={saveMutation.isPending}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Message */}
      <Card className="glass-card overflow-hidden rounded-[--radius] border-border p-0">
        <CardHeader className="border-b border-border bg-background/40 px-4 py-2.5">
          <CardTitle className="aura-microlabel flex items-center gap-2 text-muted-foreground"><Send className="w-3.5 h-3.5" /> Send Test Message</CardTitle>
          <CardDescription className="text-xs">Send a test message to all configured recipients</CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex gap-3">
            <Input
              placeholder="Type a test message..."
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendTest()}
              className="flex-1"
            />
            <Button onClick={handleSendTest} disabled={isSendingTest}>
              <Send className="w-4 h-4 mr-1" /> {isSendingTest ? "Sending..." : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
