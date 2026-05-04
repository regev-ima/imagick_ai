import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { X, Settings, Save, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface GallerySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gallery: {
    id: string;
    name: string;
    description: string | null;
    client_link: string | null;
    client_password: string | null;
    ai_culling_enabled: boolean;
    categories: string[] | null;
    user_id: string;
  };
  onUpdate: () => void;
}

export function GallerySettingsModal({ 
  isOpen, 
  onClose, 
  gallery,
  onUpdate 
}: GallerySettingsModalProps) {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form state
  const [name, setName] = useState(gallery.name);
  const [description, setDescription] = useState(gallery.description || "");
  const [aiCulling, setAiCulling] = useState(gallery.ai_culling_enabled);

  useEffect(() => {
    setName(gallery.name);
    setDescription(gallery.description || "");
    setAiCulling(gallery.ai_culling_enabled);
  }, [gallery]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("galleries")
        .update({
          name,
          description: description || null,
          ai_culling_enabled: aiCulling
        })
        .eq("id", gallery.id);

      if (error) throw error;
      
      toast.success("Settings saved successfully");
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // 1. Delete related records
      await supabase.from("gallery_invites").delete().eq("gallery_id", gallery.id);
      await supabase.from("gallery_images").delete().eq("gallery_id", gallery.id);

      // 2. Clean up storage files
      const storagePath = `${gallery.user_id}/${gallery.id}`;
      const { data: files } = await supabase.storage
        .from("gallery-images")
        .list(storagePath);

      if (files && files.length > 0) {
        const filePaths = files.map(f => `${storagePath}/${f.name}`);
        await supabase.storage.from("gallery-images").remove(filePaths);
      }

      // 3. Delete the gallery itself
      const { error } = await supabase
        .from("galleries")
        .delete()
        .eq("id", gallery.id);

      if (error) throw error;

      toast.success("Gallery deleted successfully");
      onClose();
      navigate("/dashboard/galleries");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete gallery");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="glass-card border-border/50">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Gallery Settings</h2>
                <p className="text-sm text-muted-foreground">{gallery.name}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <Tabs defaultValue="general" className="p-6">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <div className="space-y-2">
                <Label>Gallery Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <Label>AI Smart Culling</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect duplicates
                  </p>
                </div>
                <Switch checked={aiCulling} onCheckedChange={setAiCulling} />
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 className="w-4 h-4 text-destructive" />
                  <Label className="text-destructive">Danger Zone</Label>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Once deleted, this gallery cannot be recovered.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isDeleting}>
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      {isDeleting ? "Deleting..." : "Delete Gallery"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{gallery.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all images, edits, and settings for this gallery. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Forever
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-border/50">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
