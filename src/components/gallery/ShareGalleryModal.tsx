import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Copy, ExternalLink, Lock, Mail, Plus, Trash2, 
  Sun, Moon, Download, Droplets, Send, Users, Eye,
  Palette, Calendar, Check, Loader2, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GalleryStatistics } from "./GalleryStatistics";
import { TemplateMiniPreview } from "./TemplateMiniPreview";

interface Gallery {
  id: string;
  name: string;
  client_link: string | null;
  client_password: string | null;
  template?: string;
  client_dark_mode?: boolean;
  download_enabled?: boolean;
  watermark_enabled?: boolean;
  expiry_date?: string | null;
  hero_image_url?: string | null;
}

interface ShareGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  gallery: Gallery;
  onUpdate: () => void;
}

interface InvitedClient {
  id: string;
  email: string;
  client_name: string | null;
  sent_at: string | null;
  viewed_at: string | null;
}

const TEMPLATES = [
  {
    id: "elegant",
    name: "Elegant",
    description: "Refined masonry layout with tall hero"
  },
  {
    id: "modern",
    name: "Modern",
    description: "Clean minimal grid with tight spacing"
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Magazine-style with dramatic presentation"
  },
  {
    id: "classic",
    name: "Classic",
    description: "Large hero cover with uniform grid"
  },
  {
    id: "filmstrip",
    name: "Filmstrip",
    description: "Horizontal scroll with large images"
  },
  {
    id: "story",
    name: "Story",
    description: "Full-screen vertical cinematic scroll"
  }
];

export function ShareGalleryModal({ isOpen, onClose, gallery, onUpdate }: ShareGalleryModalProps) {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState(gallery.template || "elegant");
  const [darkMode, setDarkMode] = useState(gallery.client_dark_mode ?? true);
  const [password, setPassword] = useState(gallery.client_password || "");
  const [downloadEnabled, setDownloadEnabled] = useState(gallery.download_enabled ?? true);
  const [watermarkEnabled, setWatermarkEnabled] = useState(gallery.watermark_enabled ?? false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [canClose, setCanClose] = useState(false);

  // Add delay before allowing backdrop close to prevent accidental double-click closes
  useEffect(() => {
    if (isOpen) {
      setCanClose(false);
      const timer = setTimeout(() => setCanClose(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Fetch invited clients
  const { data: invitedClients = [], refetch: refetchInvites } = useQuery({
    queryKey: ["gallery-invites", gallery.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_invites")
        .select("*")
        .eq("gallery_id", gallery.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as InvitedClient[];
    },
    enabled: isOpen
  });

  // Update gallery settings mutation
  const updateSettings = useMutation({
    mutationFn: async () => {
      // Update non-password settings directly
      const { error } = await supabase
        .from("galleries")
        .update({
          template: selectedTemplate,
          client_dark_mode: darkMode,
          download_enabled: downloadEnabled,
          watermark_enabled: watermarkEnabled
        })
        .eq("id", gallery.id);
      
      if (error) throw error;

      // Update password via edge function (hashes the password securely)
      const passwordChanged = password !== (gallery.client_password || "");
      if (passwordChanged) {
        const response = await supabase.functions.invoke("update-gallery-password", {
          body: {
            galleryId: gallery.id,
            password: password || null
          }
        });
        
        if (response.error) throw response.error;
      }
    },
    onSuccess: () => {
      onUpdate();
      toast.success("Settings updated successfully");
    },
    onError: () => {
      toast.error("Failed to update settings");
    }
  });

  // Add client mutation
  const addClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("gallery_invites")
        .insert({
          gallery_id: gallery.id,
          email: newEmail.trim().toLowerCase(),
          client_name: newName.trim() || null
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      setNewEmail("");
      setNewName("");
      refetchInvites();
      toast.success("Client added successfully");
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("This email is already invited");
      } else {
        toast.error("Failed to add client");
      }
    }
  });

  // Remove client mutation
  const removeClient = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from("gallery_invites")
        .delete()
        .eq("id", clientId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      refetchInvites();
      toast.success("Client removed");
    }
  });

  // Send invite email mutation
  const sendInviteEmail = useMutation({
    mutationFn: async (client: InvitedClient) => {
      const response = await supabase.functions.invoke("send-gallery-invite", {
        body: {
          galleryId: gallery.id,
          email: client.email,
          clientName: client.client_name,
          galleryName: gallery.name,
          galleryUrl: `${window.location.origin}/gallery/${gallery.client_link}`,
          password: password || null,
          template: selectedTemplate,
          darkMode
        }
      });
      
      if (response.error) throw response.error;

      // Update sent_at timestamp
      await supabase
        .from("gallery_invites")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", client.id);
    },
    onSuccess: () => {
      refetchInvites();
      toast.success("Invite sent successfully");
    },
    onError: () => {
      toast.error("Failed to send invite. Please configure email settings.");
    }
  });

  // Send to all mutation
  const sendToAll = useMutation({
    mutationFn: async () => {
      const clientsToSend = invitedClients.filter(c => !c.sent_at);
      for (const client of clientsToSend) {
        await sendInviteEmail.mutateAsync(client);
      }
    },
    onSuccess: () => {
      toast.success(`Invites sent to all clients`);
    }
  });

  const galleryLink = `${window.location.origin}/gallery/${gallery.client_link || gallery.id}`;
  const shortId = gallery.client_link?.split('-').pop() || gallery.id.substring(0, 8);
  const shortLink = `${window.location.origin}/g/${shortId}`;
  
  const copyLink = () => {
    navigator.clipboard.writeText(shortLink);
    toast.success("Link copied to clipboard");
  };

  const handleAddClient = () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    addClient.mutate();
  };

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (canClose) {
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="glass-card border-border/50 flex flex-col max-h-[90vh]">
          {/* Header with Link */}
          <div className="p-6 border-b border-border/50 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Share Gallery</h2>
                <p className="text-sm text-muted-foreground">{gallery.name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            {/* Gallery Link */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Direct Link</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border/50 text-sm font-mono truncate">
                  {galleryLink}
                </div>
                <Button variant="outline" size="icon" onClick={() => {
                  navigator.clipboard.writeText(galleryLink);
                  toast.success("Link copied to clipboard");
                }}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={galleryLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
              <Label className="text-xs text-muted-foreground">Short Link</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border/50 text-sm font-mono truncate">
                  {shortLink}
                </div>
                <Button variant="outline" size="icon" onClick={copyLink}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="settings" className="w-full" onClick={(e) => e.stopPropagation()}>
              <TabsList className="w-full justify-start px-6 pt-4 bg-transparent">
                <TabsTrigger value="settings" className="gap-2">
                  <Palette className="w-4 h-4" />
                  Design
                </TabsTrigger>
                <TabsTrigger value="access" className="gap-2">
                  <Lock className="w-4 h-4" />
                  Access
                </TabsTrigger>
                <TabsTrigger value="clients" className="gap-2">
                  <Users className="w-4 h-4" />
                  Clients
                  {invitedClients.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                      {invitedClients.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="stats" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Statistics
                </TabsTrigger>
              </TabsList>

              {/* Design Tab */}
              <TabsContent value="settings" className="p-6 space-y-6">
                {/* Template Selection */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Gallery Template</Label>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t.id)}
                        className={cn(
                          "relative rounded-xl overflow-hidden border-2 transition-all p-0.5",
                          selectedTemplate === t.id
                            ? "border-primary shadow-lg shadow-primary/20"
                            : "border-border/50 hover:border-primary/50"
                        )}
                      >
                        <div className="aspect-[4/3] rounded-lg overflow-hidden relative">
                          <TemplateMiniPreview templateId={t.id} darkMode={darkMode} />
                          {selectedTemplate === t.id && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="p-2 text-center">
                          <p className="text-xs font-medium">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {t.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Display Options */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Display Options</Label>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {darkMode ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-yellow-500" />}
                      <div>
                        <p className="text-sm font-medium">Dark Mode</p>
                        <p className="text-xs text-muted-foreground">Display gallery in dark theme</p>
                      </div>
                    </div>
                    <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Download className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Allow Downloads</p>
                        <p className="text-xs text-muted-foreground">Let clients download images</p>
                      </div>
                    </div>
                    <Switch checked={downloadEnabled} onCheckedChange={setDownloadEnabled} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Droplets className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Watermark Images</p>
                        <p className="text-xs text-muted-foreground">Add watermark to previews</p>
                      </div>
                    </div>
                    <Switch checked={watermarkEnabled} onCheckedChange={setWatermarkEnabled} />
                  </div>
                </div>
              </TabsContent>

              {/* Access Tab */}
              <TabsContent value="access" className="p-6 space-y-6">

                {/* Password Protection */}
                <div>
                  <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password Protection
                  </Label>
                  <Input
                    type="text"
                    placeholder="Enter password (leave empty for public access)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-muted border-border/50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {password ? "Gallery is password protected" : "Gallery is publicly accessible"}
                  </p>
                </div>
              </TabsContent>

              {/* Clients Tab */}
              <TabsContent value="clients" className="p-6 space-y-6">
                {/* Add Client */}
                <div>
                  <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Invite Clients
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Client name (optional)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="bg-muted border-border/50 flex-[0.4]"
                    />
                    <Input
                      type="email"
                      placeholder="client@email.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="bg-muted border-border/50 flex-1"
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
                </div>

                {/* Client List */}
                {invitedClients.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Invited Clients</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => sendToAll.mutate()}
                        disabled={sendToAll.isPending || invitedClients.every(c => c.sent_at)}
                      >
                        {sendToAll.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        Send to All
                      </Button>
                    </div>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {invitedClients.map((client) => (
                        <div 
                          key={client.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/30"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {client.client_name || client.email}
                            </p>
                            {client.client_name && (
                              <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {client.viewed_at && (
                              <span className="text-xs text-primary flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Viewed
                              </span>
                            )}
                            {client.sent_at ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Check className="w-3 h-3" /> Sent
                              </span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={() => sendInviteEmail.mutate(client)}
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
                              onClick={() => removeClient.mutate(client.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {invitedClients.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No clients invited yet</p>
                    <p className="text-xs">Add email addresses above to invite clients</p>
                  </div>
                )}
              </TabsContent>

              {/* Statistics Tab */}
              <TabsContent value="stats" className="p-6">
                <GalleryStatistics galleryId={gallery.id} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border/50 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="glow" 
              onClick={() => updateSettings.mutate()}
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Save Settings
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
