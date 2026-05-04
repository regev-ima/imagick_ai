// RAW file extensions supported by the platform
export const RAW_EXTENSIONS = [
  '.cr2', '.cr3', '.arw', '.nef', '.dng', '.raf',
  '.orf', '.rw2', '.pef', '.srw', '.x3f'
];

/**
 * Check if a file is a RAW format based on its extension
 */
export const isRawFile = (file: File): boolean => {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  return RAW_EXTENSIONS.includes(ext);
};

/**
 * Get the file extension label (e.g., ".CR2")
 */
export const getFileExtension = (filename: string): string => {
  return filename.slice(filename.lastIndexOf('.')).toUpperCase();
};

/**
 * Check if a file is an accepted image (standard or RAW format)
 */
export const isAcceptedImageFile = (file: File): boolean => {
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  return RAW_EXTENSIONS.includes(ext);
};

/** Accept string for file inputs that includes RAW formats */
export const IMAGE_ACCEPT = "image/*,.cr2,.cr3,.arw,.nef,.dng,.raf,.orf,.rw2,.pef,.srw,.x3f";
