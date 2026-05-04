export interface TemplateImage {
  id: string;
  filename: string;
  original_url: string;
  is_liked: boolean;
  ai_rating: number | null;
  culling_label: string | null;
}

export interface TemplateProps {
  galleryName: string;
  description?: string;
  images: TemplateImage[];
  heroImage?: string;
  darkMode: boolean;
  downloadEnabled: boolean;
  onLike: (imageId: string) => void;
  onDownload: (imageId: string) => void;
  categories: string[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}
