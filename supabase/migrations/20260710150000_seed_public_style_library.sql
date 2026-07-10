-- =====================================================================
-- Public Style Library — register the shared, publicly-available trained
-- styles so every account can browse and pick them.
--
-- Each row is a preset (is_preset = true, visibility = public) owned by the
-- system user, with style_id_external set to the editing engine's model id
-- so the look is immediately usable. Demo/reference images are left null for
-- now (cards fall back to the default preview) and can be attached later
-- through the admin Showcase / Style-details panel.
--
-- Idempotent: a style is only inserted when no existing row already carries
-- that engine id, so re-running (or a model already linked elsewhere) never
-- creates a duplicate.
-- =====================================================================

INSERT INTO public.styles (user_id, name, description, is_preset, visibility, category, status, style_id_external, is_active)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  v.name,
  NULL,
  true,
  'public',
  NULL,
  'ready',
  v.sid,
  true
FROM (VALUES
  ('Gentle Boost',              '1'),
  ('AtmosGuard',                '8'),
  ('Desert Mirage',             '5'),
  ('UltraNova AI',              '7'),
  ('Soft Vibrance',             '10'),
  ('Nova AI',                   '2'),
  ('Warm Noir',                 '14'),
  ('Desert Dunes Radiant',      '22'),
  ('Soft Pastel Glow',          '111222333'),
  ('Vintage Sage',              '1721638116487'),
  ('Radiant Monochrome',        '1721646147067'),
  ('Vibrant Canvas',            '1721649701913'),
  ('Cinematic Jade',            '1725793863093'),
  ('Angel Touch',               '20'),
  ('vivid',                     '1731921010776'),
  ('Monochrome Elegance B&W',   '1732729601986'),
  ('Sunset Vibes',              '1733072796113'),
  ('Tierra',                    '1733143229472'),
  ('PRO AI',                    '1734281528692'),
  ('Vibrant Pulse',             '1738321147296'),
  ('Coral Bloom',               '1744205882853'),
  ('New Creama',                '1745499368414')
) AS v(name, sid)
WHERE NOT EXISTS (
  SELECT 1 FROM public.styles s WHERE s.style_id_external = v.sid
);
