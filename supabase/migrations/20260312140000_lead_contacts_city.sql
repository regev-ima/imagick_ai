-- ============================================================
-- Lead Contacts: Optional City
-- ============================================================

ALTER TABLE public.lead_contacts
  ADD COLUMN IF NOT EXISTS city text;
