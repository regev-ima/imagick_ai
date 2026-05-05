import { useState, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 import { Sentry } from "@/lib/sentry";
 
 interface UploadProgress {
   uploaded: number;
   total: number;
   currentFile: string;
 }
 
 interface ProcessingResult {
   success: boolean;
   imageId: string;
   error?: string;
 }
 
interface UploadCallbacks {
  onFileStart?: (index: number, filename: string) => void;
  onFileComplete?: (index: number, filename: string) => void;
  onFileError?: (index: number, filename: string, error: string) => void;
}

interface SignedUrlInfo {
  name: string;
  signedUrl: string;
  publicUrl: string;
}

const B2_PROXY_URL = "https://cloudflare-b2-proxy.rx8rq49b5c.workers.dev";

 export function useImageProcessing() {
   const [isUploading, setIsUploading] = useState(false);
   const [isProcessing, setIsProcessing] = useState(false);
   const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
 
   /**
   * Get signed URLs from the backend for direct B2 upload
   */
  const getSignedUrls = async (
    bucket: string,
    prefix: string,
    fileNames: string[]
  ): Promise<SignedUrlInfo[] | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("image-upload", {
        body: { bucket, prefix, names: fileNames },
      });

      if (error) {
        console.error("Error getting signed URLs:", error);
        return null;
      }

      console.log("Signed URLs response:", data);
      
      // The API returns { signedUrls: [...] } format
      const urls = data.urls?.signedUrls || data.urls;
      
      if (!Array.isArray(urls)) {
        console.error("Invalid signed URLs format:", data);
        return null;
      }
      
      // Map the signed URLs to include public URLs
      // Format: signedUrl contains the full B2 URL with signature
      return urls.map((signedUrl: string, index: number) => {
        // Extract the public URL by removing query params
        const publicUrl = signedUrl.split("?")[0];
        return {
          name: fileNames[index],
          signedUrl,
          publicUrl,
        };
      });
    } catch (error) {
      console.error("Error getting signed URLs:", error);
      return null;
    }
  };

  /**
   * Upload a single file directly to B2 using the signed URL
   */
  const uploadToB2 = async (
    file: File,
    signedUrl: string
  ): Promise<boolean> => {
    try {
      console.log("Uploading to B2:", file.name, "size:", file.size, "type:", file.type);
      console.log("Signed URL:", signedUrl);
      
      // Read file as ArrayBuffer for more reliable upload
      const arrayBuffer = await file.arrayBuffer();
      
      // Upload directly to B2 proxy with the signed URL in header
      const response = await fetch(B2_PROXY_URL, {
        method: "PUT",
        headers: {
          "signedurl": signedUrl,
          "Content-Type": file.type || "image/jpeg",
          "Content-Length": String(arrayBuffer.byteLength),
        },
        body: arrayBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("B2 upload failed:", response.status, errorText);
        return false;
      }

      console.log("B2 upload successful for:", file.name);
      return true;
    } catch (error) {
      console.error("Error uploading to B2:", error);
      return false;
    }
  };

  /**
   * Upload images directly to B2 storage and create gallery_images records
    */
   const uploadImages = async (
     galleryId: string,
     userId: string,
     files: File[],
     callbacks?: UploadCallbacks
  ): Promise<string[]> => {
    setIsUploading(true);
      const imageIds: string[] = [];
  
      try {
       // Record upload start timestamp
       await supabase
         .from("galleries")
         .update({ upload_started_at: new Date().toISOString() })
         .eq("id", galleryId);
      // Generate unique filenames for all files
      const fileInfos = files.map((file, index) => {
        const fileExt = file.name.split(".").pop() || "jpg";
        const fileId = crypto.randomUUID();
        return {
          file,
          fileId,
          fileName: `${fileId}.${fileExt}`,
          index,
        };
      });
 
      // Get signed URLs for all files at once
      // Use galleries/ parent folder for organization: galleries/{userId}/{galleryId}/
      const prefix = `galleries/${userId}/${galleryId}/`;
      const fileNames = fileInfos.map((f) => f.fileName);
      
      setUploadProgress({
        uploaded: 0,
        total: files.length,
        currentFile: "Getting upload URLs...",
      });
 
      const signedUrls = await getSignedUrls("imagick", prefix, fileNames);
 
      if (!signedUrls || signedUrls.length === 0) {
        toast.error("Failed to get upload URLs");
        return [];
      }
 
      // Create a map of filename to signed URL info
      const urlMap = new Map<string, SignedUrlInfo>();
      signedUrls.forEach((urlInfo) => {
        urlMap.set(urlInfo.name, urlInfo);
      });
 
      // Upload each file to B2
      for (let i = 0; i < fileInfos.length; i++) {
        const { file, fileName } = fileInfos[i];
        const urlInfo = urlMap.get(fileName);

        if (!urlInfo) {
          console.error("No signed URL for file:", fileName);
          toast.error(`Failed to upload ${file.name}`);
          callbacks?.onFileError?.(i, file.name, "No signed URL");
          continue;
        }
 
        // Notify that this file is starting
        callbacks?.onFileStart?.(i, file.name);
        
        setUploadProgress({
          uploaded: i,
          total: files.length,
          currentFile: file.name,
        });

        // Upload to B2
        const uploadSuccess = await uploadToB2(file, urlInfo.signedUrl);

        if (uploadSuccess) {
          // Create gallery_images record with B2 public URL
          const { data: imageRecord, error: insertError } = await supabase
            .from("gallery_images")
            .insert({
              gallery_id: galleryId,
              user_id: userId,
              original_url: urlInfo.publicUrl,
              filename: file.name,
              status: "uploading",
              sort_order: i,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error("Insert error:", insertError);
            callbacks?.onFileError?.(i, file.name, "Database insert failed");
            continue;
          }

          if (imageRecord) {
            imageIds.push(imageRecord.id);
          }
          // Notify that this file completed successfully
          callbacks?.onFileComplete?.(i, file.name);
        } else {
          toast.error(`Failed to upload ${file.name}`);
          callbacks?.onFileError?.(i, file.name, "Upload failed");
        }
       }
 
       setUploadProgress({
         uploaded: files.length,
         total: files.length,
         currentFile: "",
       });
 
       // Update gallery total_images count
       const { data: countData } = await supabase
         .from("gallery_images")
         .select("id", { count: "exact" })
         .eq("gallery_id", galleryId)
         .neq("status", "deleted");
 
       if (countData) {
          await supabase
            .from("galleries")
            .update({ 
              total_images: countData.length,
              upload_completed_at: new Date().toISOString(),
            })
            .eq("id", galleryId);
        }
  
        return imageIds;
 
     } finally {
       setIsUploading(false);
       setUploadProgress(null);
     }
   };
 
   /**
    * Call the process-images edge function to send images to AI processing
    */
   const processImages = async (
     galleryId: string,
     imageIds: string[],
     styleIds: string[]
   ): Promise<{ success: boolean; results?: ProcessingResult[] }> => {
     setIsProcessing(true);
 
     try {
       const { data: sessionData } = await supabase.auth.getSession();
       const accessToken = sessionData.session?.access_token;
 
       if (!accessToken) {
         toast.error("Please log in to process images");
         return { success: false };
       }
 
        // Record processing start timestamp
        await supabase
          .from("galleries")
          .update({ processing_started_at: new Date().toISOString() })
          .eq("id", galleryId);

        const response = await supabase.functions.invoke("process-images", {
         body: {
           galleryId,
           imageIds,
           styleIds,
         },
       });
 
       if (response.error) {
         console.error("Process images error:", response.error);
         toast.error("Failed to start image processing");
         return { success: false };
       }
 
       console.log("Process images response:", response.data);
       return { success: true, results: response.data.results };
 
     } catch (error) {
       console.error("Error processing images:", error);
       toast.error("Failed to process images");
       return { success: false };
 
     } finally {
       setIsProcessing(false);
     }
   };
 
   /**
    * Re-edit existing images with new styles
    */
    const reEditImages = async (
      galleryId: string,
      imageIds: string[],
      styleIds: string[],
      emailData?: { galleryName: string; styleNames: string[] }
    ): Promise<boolean> => {
      setIsProcessing(true);
  
    try {
        // Do NOT change image status during re-edit - images are already "ready"
        // The status field reflects original upload state, not per-style editing

        // Merge new style IDs into gallery's selected_style_ids
        const { data: galleryData } = await supabase
          .from("galleries")
          .select("selected_style_ids")
          .eq("id", galleryId)
          .single();

        const existingIds = galleryData?.selected_style_ids || [];
        const mergedIds = [...new Set([...existingIds, ...styleIds])];

        await supabase
          .from("galleries")
          .update({ selected_style_ids: mergedIds })
          .eq("id", galleryId);

        const result = await processImages(galleryId, imageIds, styleIds);

        if (result.success) {
          toast.success(`Re-editing ${imageIds.length} images with AI styles`);

          // Send re-edit submitted email (fire-and-forget)
          if (emailData) {
            supabase.functions.invoke("send-email", {
              body: {
                type: "re_edit_submitted",
                galleryId,
                galleryName: emailData.galleryName,
                imageCount:  imageIds.length,
                styleNames:  emailData.styleNames,
              },
            }).catch((err) => {
              console.error("re_edit_submitted email failed:", err);
              Sentry.captureException(err, { tags: { context: "re_edit_submitted_email" } });
            });
          }
        }

        return result.success;

      } finally {
        setIsProcessing(false);
      }
    };
 
   /**
    * Upload new images and immediately process them with selected styles
    */
   const uploadAndProcessImages = async (
     galleryId: string,
     userId: string,
     files: File[],
     styleIds: string[],
     galleryName?: string
   ): Promise<boolean> => {
     try {
       // Step 1: Upload images
       const imageIds = await uploadImages(galleryId, userId, files);
 
       if (imageIds.length === 0) {
         toast.error("No images were uploaded successfully");
         return false;
       }

       // Step 2: Send upload complete email (only if session is active)
       const { data: emailSessionData } = await supabase.auth.getSession();
       if (emailSessionData.session) {
         supabase.functions.invoke("send-email", {
           body: {
             type: "gallery_upload_complete",
             galleryName: galleryName || "Your collection",
             imageCount: imageIds.length,
             galleryId,
           },
         }).catch((err) => console.error("send-email (upload_complete) failed:", err));
       } else {
         console.warn("send-email skipped: no active session");
       }
 
       // Step 3: Process images with AI styles
       const result = await processImages(galleryId, imageIds, styleIds);
 
       if (result.success) {
         toast.success(`Processing ${imageIds.length} images with AI styles`);
       }
 
       return result.success;
 
     } catch (error) {
       console.error("Error in upload and process:", error);
       toast.error("Failed to upload and process images");
       return false;
     }
   };
 
   return {
     isUploading,
     isProcessing,
     uploadProgress,
     uploadImages,
     processImages,
     reEditImages,
     uploadAndProcessImages,
   };
 }