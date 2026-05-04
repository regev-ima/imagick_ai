-- הוספת שדות חדשים לטבלת styles
ALTER TABLE public.styles
  -- ניהול משתמשים
  ADD COLUMN IF NOT EXISTS allowed_user_ids uuid[] DEFAULT '{}',
  
  -- היררכיית גרסאות
  ADD COLUMN IF NOT EXISTS father_style_id uuid REFERENCES public.styles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS history_ids text[] DEFAULT '{}',
  
  -- Google Drive
  ADD COLUMN IF NOT EXISTS google_before_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS google_after_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS google_before_metadata jsonb,
  ADD COLUMN IF NOT EXISTS google_after_metadata jsonb,
  
  -- תמונות מיובאות
  ADD COLUMN IF NOT EXISTS before_image_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS after_image_urls text[] DEFAULT '{}',
  
  -- דמו
  ADD COLUMN IF NOT EXISTS demo_images text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS demo_link text,
  ADD COLUMN IF NOT EXISTS preview_images text[] DEFAULT '{}',
  
  -- מעקב ייבוא
  ADD COLUMN IF NOT EXISTS import_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS import_completion_date timestamptz,
  ADD COLUMN IF NOT EXISTS total_images_to_import integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_images_imported integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matching_images_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upload_method text DEFAULT 'direct',
  
  -- מעקב אימון
  ADD COLUMN IF NOT EXISTS training_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS training_completion_date timestamptz,
  ADD COLUMN IF NOT EXISTS training_sessions_count integer DEFAULT 0,
  
  -- שדות נוספים
  ADD COLUMN IF NOT EXISTS style_id_external text,
  ADD COLUMN IF NOT EXISTS associated_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS error_details text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS team_remarks text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recommended boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS manual_link_before text,
  ADD COLUMN IF NOT EXISTS manual_link_after text;

-- עדכון פוליסת SELECT לכלול allowed_user_ids
DROP POLICY IF EXISTS "Users can view their own styles" ON public.styles;

CREATE POLICY "Users can view accessible styles"
ON public.styles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR is_preset = true 
  OR visibility = 'public'
  OR auth.uid() = ANY(allowed_user_ids)
);