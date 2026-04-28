-- Ghost Profiles Migration
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)

-- 1. Create unclaimed_profiles table
CREATE TABLE IF NOT EXISTS unclaimed_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  slug         TEXT        NOT NULL UNIQUE,
  primary_role TEXT,
  avatar_url   TEXT,
  bio          TEXT,
  created_by   TEXT        NOT NULL,
  claimed_by   TEXT,
  claimed_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unclaimed_profiles_slug ON unclaimed_profiles(slug);

-- 2. Allow user_id to be nullable in project_credits
ALTER TABLE project_credits ALTER COLUMN user_id DROP NOT NULL;

-- 3. Add unclaimed_profile_id column
ALTER TABLE project_credits
  ADD COLUMN IF NOT EXISTS unclaimed_profile_id UUID REFERENCES unclaimed_profiles(id) ON DELETE CASCADE;

-- 4. Unique index: one unclaimed-profile credit per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_credits_unclaimed_unique
  ON project_credits(project_id, unclaimed_profile_id)
  WHERE unclaimed_profile_id IS NOT NULL;

-- 5. RLS for unclaimed_profiles
ALTER TABLE unclaimed_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unclaimed_profiles_select" ON unclaimed_profiles;
CREATE POLICY "unclaimed_profiles_select" ON unclaimed_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "unclaimed_profiles_insert" ON unclaimed_profiles;
CREATE POLICY "unclaimed_profiles_insert" ON unclaimed_profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "unclaimed_profiles_update" ON unclaimed_profiles;
CREATE POLICY "unclaimed_profiles_update" ON unclaimed_profiles FOR UPDATE USING (true);
