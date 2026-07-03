import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudIcon, FolderOpen, Images, HardDrive, Loader2, AlertCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { extractFunctionError } from "@/lib/functionError";

export interface SingleFolderInfo {
  folderName: string;
  imageCount: number;
  totalSizeMB: number;
  fileNames: string[];
  driveLink: string;
}

export interface DriveFolderInfo {
  folders: SingleFolderInfo[];
  totalImageCount: number;
  totalSizeMB: number;
}

interface GoogleDriveInputProps {
  onUpdate: (folderInfo: DriveFolderInfo | null, driveLinks: string[]) => void;
  folderInfo: DriveFolderInfo | null;
  disabled?: boolean;
}

type ValidationState = "idle" | "validating" | "error";

export function GoogleDriveInput({ 
  onUpdate,
  folderInfo,
  disabled = false 
}: GoogleDriveInputProps) {
  const [link, setLink] = useState("");
  const [state, setState] = useState<ValidationState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const validateAndAddLink = useCallback(async () => {
    if (!link.trim()) {
      setErrorMessage("Please enter a Google Drive folder link");
      setState("error");
      return;
    }

    // Basic validation
    if (!link.includes("drive.google.com") || !link.includes("folders")) {
      setErrorMessage("Please enter a valid Google Drive folder link");
      setState("error");
      return;
    }

    // Check if already added
    if (folderInfo?.folders.some(f => f.driveLink === link)) {
      setErrorMessage("This folder is already added");
      setState("error");
      return;
    }

    setState("validating");
    setErrorMessage("");

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Please sign in to continue");
      }

      const response = await supabase.functions.invoke("gd-import", {
        body: {
          driveLink: link,
          metadataOnly: true,
        },
      });

      if (response.error) {
        // Surface the function's real JSON error body — error.message alone is
        // always the generic "Edge Function returned a non-2xx status code".
        throw new Error(
          await extractFunctionError(response.error, "Failed to validate folder"),
        );
      }

      const data = response.data;
      
      if (!data.success) {
        throw new Error(data.error || "Failed to access folder");
      }

      const newFolder: SingleFolderInfo = {
        folderName: data.folderName,
        imageCount: data.imageCount,
        totalSizeMB: data.totalSizeMB,
        fileNames: data.fileNames || [],
        driveLink: link,
      };

      const updatedFolders = [...(folderInfo?.folders || []), newFolder];
      const totalImageCount = updatedFolders.reduce((sum, f) => sum + f.imageCount, 0);
      const totalSizeMB = updatedFolders.reduce((sum, f) => sum + f.totalSizeMB, 0);

      setState("idle");
      setLink("");
      onUpdate(
        { folders: updatedFolders, totalImageCount, totalSizeMB },
        updatedFolders.map(f => f.driveLink)
      );
    } catch (error: any) {
      console.error("Validation error:", error);
      setErrorMessage(error.message || "Cannot access this folder. Please make sure it's shared with 'Anyone with the link' as Viewer.");
      setState("error");
    }
  }, [link, folderInfo, onUpdate]);

  const removeFolder = useCallback((index: number) => {
    if (!folderInfo) return;
    
    const updatedFolders = folderInfo.folders.filter((_, i) => i !== index);
    
    if (updatedFolders.length === 0) {
      onUpdate(null, []);
    } else {
      const totalImageCount = updatedFolders.reduce((sum, f) => sum + f.imageCount, 0);
      const totalSizeMB = updatedFolders.reduce((sum, f) => sum + f.totalSizeMB, 0);
      onUpdate(
        { folders: updatedFolders, totalImageCount, totalSizeMB },
        updatedFolders.map(f => f.driveLink)
      );
    }
  }, [folderInfo, onUpdate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !disabled && state !== "validating") {
      e.preventDefault();
      validateAndAddLink();
    }
  };

  const formatSize = (sizeMB: number) => {
    return sizeMB < 1000 
      ? `${Math.round(sizeMB * 10) / 10} MB` 
      : `${(sizeMB / 1024).toFixed(1)} GB`;
  };

  return (
    <div className="space-y-4">
      {/* Added Folders List */}
      <AnimatePresence>
        {folderInfo && folderInfo.folders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {folderInfo.folders.map((folder, index) => (
              <motion.div
                key={folder.driveLink}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="rounded-lg border border-border/50 bg-muted/30 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{folder.folderName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Images className="w-3 h-3" />
                          {folder.imageCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatSize(folder.totalSizeMB)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={() => removeFolder(index)}
                    disabled={disabled}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}

            {/* Total Summary */}
            {folderInfo.folders.length > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-sm">
                <span className="text-muted-foreground">
                  Total: {folderInfo.folders.length} folders
                </span>
                <div className="flex items-center gap-3 font-medium">
                  <span className="flex items-center gap-1">
                    <Images className="w-3.5 h-3.5" />
                    {folderInfo.totalImageCount} images
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5" />
                    {formatSize(folderInfo.totalSizeMB)}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add New Folder Input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <CloudIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="url"
              placeholder={folderInfo?.folders.length ? "Add another folder..." : "Paste Google Drive folder link..."}
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                if (state === "error") {
                  setState("idle");
                  setErrorMessage("");
                }
              }}
              onKeyDown={handleKeyDown}
              disabled={disabled || state === "validating"}
              className={cn(
                "pl-9 bg-muted border-border/50",
                state === "error" && "border-destructive focus-visible:ring-destructive"
              )}
            />
          </div>
          <Button
            type="button"
            onClick={validateAndAddLink}
            disabled={disabled || state === "validating" || !link.trim()}
            className="gap-2"
          >
            {state === "validating" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add
              </>
            )}
          </Button>
        </div>

        <AnimatePresence>
          {state === "error" && errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Cannot access folder</p>
                  <p className="text-muted-foreground mt-0.5">{errorMessage}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-muted-foreground">
          {folderInfo?.folders.length 
            ? "You can add multiple folders. All images will be imported into one gallery."
            : "Make sure the folder is shared with \"Anyone with the link\" as Viewer"
          }
        </p>
      </div>
    </div>
  );
}
