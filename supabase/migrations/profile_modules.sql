-- ═══════════════════════════════════════════════════════════════
-- CineGenius — Profile Module System
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_type       TEXT DEFAULT 'crew'
    CHECK (profile_type IN ('performer', 'crew', 'creative', 'vendor')),
  ADD COLUMN IF NOT EXISTS tagline            TEXT,
  ADD COLUMN IF NOT EXISTS slug              TEXT,
  ADD COLUMN IF NOT EXISTS modules           JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS awards            JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS availability_config JSONB,
  ADD COLUMN IF NOT EXISTS profile_images    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS showreel_url      TEXT;

-- Unique slug index (partial – only for non-null slugs)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_slug_idx
  ON profiles(slug) WHERE slug IS NOT NULL;

-- ─── JSONB schemas (documentation only) ──────────────────────────
--
-- modules[] entry:
-- {
--   "type":    "hero" | "portfolio" | "showreel" | "about" | "skills"
--            | "filmography" | "awards" | "listings" | "availability" | "contact",
--   "enabled": true,
--   "order":   0,
--   "locked":  false,
--   "config":  { ... type-specific ... }
-- }
--
-- profile_images[] entry:
-- { "url": "...", "caption": "...", "featured": true }
--
-- awards[] entry:
-- { "title": "...", "event": "...", "year": 2024, "category": "..." }
--
-- availability_config:
-- { "status": "available"|"busy"|"selective", "available_from": "ISO",
--   "locations": ["Berlin"], "travel": "national" }
