/**
 * Utility functions for generating B2 image URLs with thumbnails and previews
 * 
 * URL Structure:
 * - Original: galleries/{userId}/{galleryId}/{imageId}.JPG
 * - Thumbnail: galleries/{userId}/{galleryId}/thumbnail/{imageId}_reduced_thumbnail.webp
 * - Preview (compressed): galleries/{userId}/{galleryId}/compressed/{imageId}_reduced.webp
 * - Edited by style: galleries/{userId}/{galleryId}/{styleId}/{imageId}.jpeg
 * - Edited thumbnail: galleries/{userId}/{galleryId}/{styleId}/thumbnail/{imageId}_reduced_thumbnail.webp
 * - Edited preview: galleries/{userId}/{galleryId}/{styleId}/compressed/{imageId}_reduced.webp
 */

const B2_BASE_URL = "https://s3.us-east-005.backblazeb2.com/imagick";

/**
 * Extract the base path and filename from a B2 URL
 */
export function parseB2Url(url: string): { basePath: string; filename: string; extension: string } | null {
  if (!url) return null;
  
  try {
    // Remove the base URL to get the path
    let path = url;
    if (url.startsWith(B2_BASE_URL)) {
      path = url.replace(B2_BASE_URL + "/", "");
    } else if (url.startsWith("https://")) {
      // Handle other URL formats
      const urlObj = new URL(url);
      path = urlObj.pathname.replace(/^\/file\/imagick\//, "");
    }
    
    // Split path into directory and filename
    const lastSlash = path.lastIndexOf("/");
    const basePath = lastSlash > 0 ? path.substring(0, lastSlash) : "";
    const fullFilename = lastSlash > 0 ? path.substring(lastSlash + 1) : path;
    
    // Split filename and extension
    const lastDot = fullFilename.lastIndexOf(".");
    const filename = lastDot > 0 ? fullFilename.substring(0, lastDot) : fullFilename;
    const extension = lastDot > 0 ? fullFilename.substring(lastDot + 1) : "";
    
    return { basePath, filename, extension };
  } catch {
    return null;
  }
}

/**
 * Check if a URL is already a derived variant (thumbnail or compressed)
 */
function isAlreadyDerived(url: string): boolean {
  return /\/(thumbnail|compressed)\//.test(url);
}

/**
 * Normalize a URL back to its original base form by stripping
 * /thumbnail/ or /compressed/ segments and the _reduced* suffix.
 * e.g. .../thumbnail/abc_reduced_thumbnail.webp -> .../abc
 * Returns { basePath, coreFilename } where basePath has no trailing /thumbnail or /compressed.
 */
function normalizeToOriginal(url: string): { basePath: string; coreFilename: string } | null {
  const parsed = parseB2Url(url);
  if (!parsed) return null;

  let { basePath, filename } = parsed;

  // Strip /thumbnail or /compressed from the end of basePath
  basePath = basePath.replace(/\/(thumbnail|compressed)$/, "");

  // Strip _reduced_thumbnail or _reduced suffix from filename
  const coreFilename = filename
    .replace(/_reduced_thumbnail$/, "")
    .replace(/_reduced$/, "");

  return { basePath, coreFilename };
}

/**
 * Generate thumbnail URL from any URL (original or already-derived)
 */
export function getThumbnailUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // If already a thumbnail, return as-is
  if (originalUrl.includes("/thumbnail/") && originalUrl.includes("_reduced_thumbnail")) {
    return originalUrl;
  }

  const norm = normalizeToOriginal(originalUrl);
  if (!norm) return originalUrl;

  const pathPrefix = norm.basePath ? `${norm.basePath}/` : '';
  return `${B2_BASE_URL}/${pathPrefix}thumbnail/${norm.coreFilename}_reduced_thumbnail.webp`;
}

/**
 * Generate preview/compressed URL from any URL (original or already-derived)
 */
export function getPreviewUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // If already a compressed/preview, return as-is
  if (originalUrl.includes("/compressed/") && originalUrl.includes("_reduced")) {
    return originalUrl;
  }

  const norm = normalizeToOriginal(originalUrl);
  if (!norm) return originalUrl;

  const pathPrefix = norm.basePath ? `${norm.basePath}/` : '';
  return `${B2_BASE_URL}/${pathPrefix}compressed/${norm.coreFilename}_reduced.webp`;
}

/**
 * Generate edited image URL for a specific style
 * galleries/{userId}/{galleryId}/{filename}.ext -> galleries/{userId}/{galleryId}/{styleId}/{filename}.jpeg
 */
export function getEditedUrl(originalUrl: string, styleId: string): string {
  const parsed = parseB2Url(originalUrl);
  if (!parsed) return originalUrl;
  
  const { basePath, filename } = parsed;
  return `${B2_BASE_URL}/${basePath}/${styleId}/${filename}.jpeg`;
}

/**
 * Generate edited image thumbnail URL for a specific style
 */
export function getEditedThumbnailUrl(originalUrl: string, styleId: string): string {
  const parsed = parseB2Url(originalUrl);
  if (!parsed) return originalUrl;
  
  const { basePath, filename } = parsed;
  return `${B2_BASE_URL}/${basePath}/${styleId}/thumbnail/${filename}_reduced_thumbnail.webp`;
}

/**
 * Generate edited image preview URL for a specific style
 */
export function getEditedPreviewUrl(originalUrl: string, styleId: string): string {
  const parsed = parseB2Url(originalUrl);
  if (!parsed) return originalUrl;
  
  const { basePath, filename } = parsed;
  return `${B2_BASE_URL}/${basePath}/${styleId}/compressed/${filename}_reduced.webp`;
}

/**
 * Get all available style URLs for an image
 * Returns an object mapping style IDs to their URLs
 */
export function getStyleUrls(
  originalUrl: string, 
  styleIds: string[]
): Record<string, { original: string; thumbnail: string; preview: string }> {
  const result: Record<string, { original: string; thumbnail: string; preview: string }> = {};
  
  // Add original as "original" style
  result["original"] = {
    original: originalUrl,
    thumbnail: getThumbnailUrl(originalUrl),
    preview: getPreviewUrl(originalUrl),
  };
  
  // Add each style
  for (const styleId of styleIds) {
    result[styleId] = {
      original: getEditedUrl(originalUrl, styleId),
      thumbnail: getEditedThumbnailUrl(originalUrl, styleId),
      preview: getEditedPreviewUrl(originalUrl, styleId),
    };
  }
  
  return result;
}
