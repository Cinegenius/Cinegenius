-- ═══════════════════════════════════════════════════════════════════════════
-- CineGenius — Companies Migration
-- Adds company profiles, account_type distinction, and service listings
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Extend profiles with account_type
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'person'
    CHECK (account_type IN ('person', 'company'));

-- 2. Companies table
CREATE TABLE IF NOT EXISTS companies (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id    TEXT    NOT NULL,
  slug             TEXT    NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  logo_url         TEXT,
  description      TEXT    NOT NULL DEFAULT '',
  city             TEXT    NOT NULL DEFAULT '',
  website          TEXT,
  email            TEXT,
  phone            TEXT,
  categories       TEXT[]  NOT NULL DEFAULT '{}',
  services         TEXT[]  NOT NULL DEFAULT '{}',
  portfolio_images TEXT[]  NOT NULL DEFAULT '{}',
  verified         BOOLEAN NOT NULL DEFAULT false,
  published        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_slug  ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_city  ON companies(city);
CREATE INDEX IF NOT EXISTS idx_companies_cats  ON companies USING gin(categories);

-- 3. Extend listings with company_id + service type
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Drop old type constraint if it exists, then re-add with 'service'
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_type_check;
ALTER TABLE listings
  ADD CONSTRAINT listings_type_check
    CHECK (type IN ('job', 'prop', 'vehicle', 'location', 'creator', 'service'));

CREATE INDEX IF NOT EXISTS idx_listings_company ON listings(company_id);

-- 4. RLS — companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select_published" ON companies;
DROP POLICY IF EXISTS "companies_select_own" ON companies;
DROP POLICY IF EXISTS "companies_insert_own" ON companies;
DROP POLICY IF EXISTS "companies_update_own" ON companies;

CREATE POLICY "companies_select_published"
  ON companies FOR SELECT USING (published = true);

CREATE POLICY "companies_select_own"
  ON companies FOR SELECT USING (auth.uid()::text = owner_user_id);

CREATE POLICY "companies_insert_own"
  ON companies FOR INSERT WITH CHECK (auth.uid()::text = owner_user_id);

CREATE POLICY "companies_update_own"
  ON companies FOR UPDATE USING (auth.uid()::text = owner_user_id);
