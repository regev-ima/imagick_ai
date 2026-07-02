-- Zero-shot CLIP tags per image: [{ "tag": "ריקודים", "score": 0.28 }, ...] top-N.
ALTER TABLE image_features
  ADD COLUMN IF NOT EXISTS tags jsonb;
