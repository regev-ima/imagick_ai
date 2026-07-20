import { useState, useMemo } from "react";
import { cullingScoreToStars } from "@/lib/cullingScore";
import { Download, Images, Heart, Star, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getEditedUrl } from "@/lib/imageUrls";
import { ZIP_DOWNLOAD_URL } from "@/lib/constants";

type DownloadSubset = "selected" | "all" | "liked" | "top-picks";

interface GalleryImage {
  id: string;
  filename: string;
  original_url: string;
  is_liked: boolean;
  culling_score?: number | null;
}

interface DownloadGalleryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  galleryName: string;
  images: GalleryImage[];
  selectedImageIds: string[];
  galleryStyles: Array<{ id: string; name: string }>;
  styleApiIdMap: Record<string, string>;
  hasCullingData: boolean;
}

export function DownloadGalleryModal({
  open,
  onOpenChange,
  galleryName,
  images,
  selectedImageIds,
  galleryStyles,
  styleApiIdMap,
  hasCullingData,
}: DownloadGalleryModalProps) {
  const [subset, setSubset] = useState<DownloadSubset>(
    selectedImageIds.length > 0 ? "selected" : "all"
  );
  const [styleVersion, setStyleVersion] = useState("original");
  const [zipFilename, setZipFilename] = useState(galleryName);

  // Compute target images based on subset
  const targetImages = useMemo(() => {
    switch (subset) {
      case "selected":
        return images.filter((img) => selectedImageIds.includes(img.id));
      case "liked":
        return images.filter((img) => img.is_liked);
      case "top-picks":
        return images.filter((img) => cullingScoreToStars(img.culling_score) >= 4);
      case "all":
      default:
        return images;
    }
  }, [subset, images, selectedImageIds]);

  const likedCount = useMemo(() => images.filter((img) => img.is_liked).length, [images]);
  const topPicksCount = useMemo(() => {
    return images.filter((img) => cullingScoreToStars(img.culling_score) >= 4).length;
  }, [images]);

  const handleDownload = async () => {
    if (targetImages.length === 0) {
      toast.error("No images to download");
      return;
    }

    try {
      const selectedStyleName = galleryStyles.find(s => s.id === styleVersion)?.name;
      const files = targetImages.map((img) => {
        if (styleVersion === "original") {
          return { url: img.original_url, path: img.filename };
        }
        const apiId = styleApiIdMap[styleVersion] || "1";
        const url = getEditedUrl(img.original_url, apiId);
        const baseName = img.filename.replace(/\.[^.]+$/, "");
        const styledFilename = `${baseName}.jpeg`;
        const path = selectedStyleName
          ? `${selectedStyleName}/${styledFilename}`
          : styledFilename;
        return { url, path };
      });

      // Use a hidden form POST so the browser handles the download natively
      // (streams directly to disk instead of buffering in RAM). The new
      // Cloudflare Worker returns a real streamed ZIP, so keeping the native
      // form POST — not fetch()+blob() — is what preserves the instant,
      // low-memory download.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = ZIP_DOWNLOAD_URL;
      form.style.display = "none";

      const filenameInput = document.createElement("input");
      filenameInput.type = "hidden";
      filenameInput.name = "filename";
      filenameInput.value = zipFilename || galleryName;
      form.appendChild(filenameInput);

      const filesInput = document.createElement("input");
      filesInput.type = "hidden";
      filesInput.name = "files";
      filesInput.value = JSON.stringify(files);
      form.appendChild(filesInput);

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      toast.success(`Downloading ${targetImages.length} images...`);
      onOpenChange(false);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Download failed. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Download Gallery
          </DialogTitle>
          <DialogDescription>
            Choose which images to download as a ZIP file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Subset Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              What to download
            </Label>
            <RadioGroup value={subset} onValueChange={(v) => setSubset(v as DownloadSubset)}>
              {selectedImageIds.length > 0 && (
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <RadioGroupItem value="selected" />
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 text-sm">Selected Images</span>
                  <span className="text-xs text-muted-foreground">{selectedImageIds.length}</span>
                </label>
              )}
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                <RadioGroupItem value="all" />
                <Images className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 text-sm">All Images</span>
                <span className="text-xs text-muted-foreground">{images.length}</span>
              </label>
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                <RadioGroupItem value="liked" />
                <Heart className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 text-sm">Liked Only</span>
                <span className="text-xs text-muted-foreground">{likedCount}</span>
              </label>
              {hasCullingData && (
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <RadioGroupItem value="top-picks" />
                  <Star className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 text-sm">Top Picks (4-5 ★)</span>
                  <span className="text-xs text-muted-foreground">{topPicksCount}</span>
                </label>
              )}
            </RadioGroup>
          </div>

          <Separator />

          {/* Style Version */}
          {galleryStyles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Version
              </Label>
              <Select value={styleVersion} onValueChange={setStyleVersion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original</SelectItem>
                  {galleryStyles.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filename */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              ZIP Filename
            </Label>
            <Input
              value={zipFilename}
              onChange={(e) => setZipFilename(e.target.value)}
              placeholder={galleryName}
            />
          </div>

          {/* Summary */}
          <div className="text-xs text-muted-foreground text-center py-1">
            {targetImages.length} image{targetImages.length !== 1 ? "s" : ""} will be downloaded
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={targetImages.length === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download ZIP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
