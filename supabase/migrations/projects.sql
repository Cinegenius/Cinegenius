-- ═══════════════════════════════════════════════════════════════
-- CineGenius — Shared Project System
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  year        INTEGER,
  type        TEXT,
  description TEXT,
  director    TEXT,
  poster_url  TEXT,
  images      TEXT[] NOT NULL DEFAULT '{}',
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_credits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- type values: Spielfilm, Kurzfilm, Serie, Dokumentation, Werbefilm, Musikvideo, Corporate
