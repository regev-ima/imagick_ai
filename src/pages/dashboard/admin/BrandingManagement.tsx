import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Upload, Trash2, Sun, Moon, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface LogoSlot {
  key: string;
  label: string;
  description: string;
  theme: "dark" | "light";
  variant: "full" | "icon";
}

const logoSlots: LogoSlot[] = [
  { key: "logo_dark_full", label: "Dark Mode — Full Logo", description: "Displayed when sidebar is expanded", theme: "dark", variant: "full" },
  { key: "logo_dark_icon", label: "Dark Mode — Icon", description: "Displayed when sidebar is collapsed", theme: "dark", variant: "icon" },
  { key: "logo_light_full", label: "Light Mode — Full Logo", description: "Displayed when sidebar is expanded", theme: "light", variant: "full" },
  { key: "logo_light_icon", label: "Light Mode — Icon", description: "Displayed when sidebar is collapsed", theme: "light", variant: "icon" },
];

export default function BrandingManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value");
      if (error) throw error;
      return Object.fromEntries((data || []).map(r => [r.key, r.value]));
    },
  });

  const handleUpload = async (slot: LogoSlot, file: File) => {
    if (!user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploadingKey(slot.key);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/logos/${slot.key}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("gallery-images")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("gallery-images")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("platform_settings")
        .update({ value: publicUrl, updated_at: new Date().toISOString(), updated_by: user.id })
        .eq("key", slot.key);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      toast.success(`${slot.label} updated`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleRemove = async (slot: LogoSlot) => {
    try {
      const { error } = await supabase
        .from("platform_settings")
        .update({ value: null, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq("key", slot.key);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      toast.success(`${slot.label} removed — default logo will be used`);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove");
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/admin"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Branding</h1>
          <p className="text-muted-foreground mt-1">
            Upload custom logos for dark and light modes
          </p>
        </div>
      </div>

      {(["dark", "light"] as const).map((theme) => (
        <motion.div
          key={theme}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                {theme === "dark" ? "Dark Mode Logos" : "Light Mode Logos"}
              </CardTitle>
              <CardDescription>
                These logos appear in the sidebar navigation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-6">
                {logoSlots.filter(s => s.theme === theme).map((slot) => {
                  const currentUrl = settings[slot.key];
                  const isUploading = uploadingKey === slot.key;

                  return (
                    <div key={slot.key} className="space-y-3">
                      <div>
                        <Label>{slot.label}</Label>
                        <p className="text-xs text-muted-foreground">{slot.description}</p>
                      </div>

                      <div className={`
                        relative flex items-center justify-center rounded-xl border-2 border-dashed border-border/50
                        ${theme === "dark" ? "bg-[#0a0a0a]" : "bg-white"}
                        ${slot.variant === "full" ? "h-24 px-6" : "h-24 w-24"}
                        overflow-hidden
                      `}>
                        {currentUrl ? (
                          <img
                            src={currentUrl}
                            alt={slot.label}
                            className={`object-contain ${slot.variant === "full" ? "max-h-14" : "max-h-12 max-w-12"}`}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted-foreground">
                            <ImageIcon className="w-6 h-6 opacity-40" />
                            <span className="text-xs">No logo</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          ref={(el) => { fileInputRefs.current[slot.key] = el; }}
                          type="file"
                          accept="image/png,image/svg+xml,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(slot, f);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={isUploading}
                          onClick={() => fileInputRefs.current[slot.key]?.click()}
                        >
                          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          {isUploading ? "Uploading…" : "Upload"}
                        </Button>
                        {currentUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            onClick={() => handleRemove(slot)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
