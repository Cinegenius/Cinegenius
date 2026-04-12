-- ═══════════════════════════════════════════════════════════════
-- CineGenius — Profil System v2
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles
  -- Mehrfach-Profiltypen
  ADD COLUMN IF NOT EXISTS profile_types        TEXT[]   DEFAULT '{}',

  -- Erweiterte Identität
  ADD COLUMN IF NOT EXISTS first_name           TEXT,
  ADD COLUMN IF NOT EXISTS last_name            TEXT,
  ADD COLUMN IF NOT EXISTS stage_name           TEXT,
  ADD COLUMN IF NOT EXISTS company_name         TEXT,

  -- Standort strukturiert
  ADD COLUMN IF NOT EXISTS location_city        TEXT,
  ADD COLUMN IF NOT EXISTS location_region      TEXT,
  ADD COLUMN IF NOT EXISTS location_country     TEXT,

  -- Konditionen
  ADD COLUMN IF NOT EXISTS day_rate_on_request  BOOLEAN  DEFAULT false,

  -- Talent-Daten (JSONB Blöcke)
  ADD COLUMN IF NOT EXISTS physical             JSONB,
  ADD COLUMN IF NOT EXISTS model_measurements   JSONB,
  ADD COLUMN IF NOT EXISTS performance          JSONB,
  ADD COLUMN IF NOT EXISTS casting              JSONB,

  -- Crew
  ADD COLUMN IF NOT EXISTS crew                 JSONB,

  -- Kreativ
  ADD COLUMN IF NOT EXISTS creative             JSONB,

  -- Anbieter
  ADD COLUMN IF NOT EXISTS vendor               JSONB,
  ADD COLUMN IF NOT EXISTS listings             JSONB    NOT NULL DEFAULT '[]',

  -- Agentur
  ADD COLUMN IF NOT EXISTS agency               JSONB,

  -- Medien
  ADD COLUMN IF NOT EXISTS downloads            JSONB    NOT NULL DEFAULT '[]',

  -- Ausbildung
  ADD COLUMN IF NOT EXISTS education            JSONB    NOT NULL DEFAULT '[]',

  -- Social (neu)
  ADD COLUMN IF NOT EXISTS tiktok_url           TEXT,
  ADD COLUMN IF NOT EXISTS vimeo_url            TEXT,
  ADD COLUMN IF NOT EXISTS imdb_url             TEXT,
  ADD COLUMN IF NOT EXISTS spotlight_url        TEXT,

  -- Datenschutz
  ADD COLUMN IF NOT EXISTS visibility           JSONB;

-- Slug Index (falls noch nicht vorhanden)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_slug_idx
  ON profiles(slug) WHERE slug IS NOT NULL;

-- RPC Funktion aktualisieren
CREATE OR REPLACE FUNCTION update_profile_modules(
  p_user_id TEXT,
  p_profile_type TEXT,
  p_modules JSONB
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET profile_type = p_profile_type,
      modules      = p_modules,
      updated_at   = NOW()
  WHERE user_id = p_user_id;
END;
$$;
