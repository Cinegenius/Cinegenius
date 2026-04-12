-- ═══════════════════════════════════════════════════════════════
-- CineGenius — Extended Profile Fields
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cover_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url    TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_url       TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url      TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url     TEXT,
  ADD COLUMN IF NOT EXISTS website_url      TEXT,
  ADD COLUMN IF NOT EXISTS filmography      JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS video_links      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS day_rate         INTEGER;

-- filmography schema (each entry):
-- { "year": 2023, "title": "Das letzte Licht", "role": "Oberbeleuchter", "type": "Spielfilm", "director": "Anna K." }
