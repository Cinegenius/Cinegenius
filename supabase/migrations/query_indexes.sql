-- ============================================================
-- CineGenius — Query Optimization Indexes
-- ============================================================
-- Run this in the Supabase SQL editor.
-- All statements are idempotent (IF NOT EXISTS).

-- Trigram extension for fast ILIKE full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── listings ────────────────────────────────────────────────────────────────

-- Most queried pattern: published listings by type, newest first.
-- Covers: creators page, jobs page, locations page, vehicles page,
--         props page, search API, marketplace page.
-- Partial index (WHERE published = true) shrinks the index by ~50%
-- assuming ~half of listings are unpublished drafts.
CREATE INDEX IF NOT EXISTS idx_listings_type_created
  ON listings (type, created_at DESC)
  WHERE published = true;

-- User's own listings (dashboard, "my listings" API).
CREATE INDEX IF NOT EXISTS idx_listings_user_id_created
  ON listings (user_id, created_at DESC);

-- City equality + ilike filter (locations page filter, search).
CREATE INDEX IF NOT EXISTS idx_listings_city_trgm
  ON listings USING gin (city gin_trgm_ops);

-- Title search (search API: title.ilike.%q%).
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
  ON listings USING gin (title gin_trgm_ops);

-- Description search (search API: description.ilike.%q%).
CREATE INDEX IF NOT EXISTS idx_listings_description_trgm
  ON listings USING gin (description gin_trgm_ops);

-- ─── profiles ────────────────────────────────────────────────────────────────

-- Creators page + search: only non-null, non-empty names. Partial index
-- avoids indexing placeholder/incomplete profiles.
CREATE INDEX IF NOT EXISTS idx_profiles_has_name_created
  ON profiles (created_at DESC)
  WHERE display_name IS NOT NULL AND display_name <> '';

-- display_name search (search API, recommendations lookup).
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm
  ON profiles USING gin (display_name gin_trgm_ops);

-- Location search (search API: location.ilike.%q%).
CREATE INDEX IF NOT EXISTS idx_profiles_location_trgm
  ON profiles USING gin (location gin_trgm_ops);

-- user_id point lookups — likely already PK but explicit for join plans.
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON profiles (user_id);

-- ─── conversations ───────────────────────────────────────────────────────────

-- OR query: sender_id.eq.X OR receiver_id.eq.X, ordered by updated_at.
-- Two separate indexes are more efficient than a combined one for OR clauses.
CREATE INDEX IF NOT EXISTS idx_conversations_sender_updated
  ON conversations (sender_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_receiver_updated
  ON conversations (receiver_id, updated_at DESC);

-- ─── companies ───────────────────────────────────────────────────────────────

-- Owner's companies list.
CREATE INDEX IF NOT EXISTS idx_companies_owner_created
  ON companies (owner_user_id, created_at DESC);

-- Public company directory.
CREATE INDEX IF NOT EXISTS idx_companies_published_created
  ON companies (created_at DESC)
  WHERE published = true;

-- Name + city search (search API, companies page filter).
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm
  ON companies USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_companies_city_trgm
  ON companies USING gin (city gin_trgm_ops);

-- ─── recommendations ─────────────────────────────────────────────────────────

-- Filter by recipient, ordered by date (profile page).
CREATE INDEX IF NOT EXISTS idx_recommendations_recipient_created
  ON recommendations (recipient_id, created_at DESC);

-- ─── favorites ───────────────────────────────────────────────────────────────

-- UNIQUE(user_id, listing_id) constraint already creates a btree index
-- used for toggle lookups. Add a covering index for ordered list queries.
CREATE INDEX IF NOT EXISTS idx_favorites_user_created
  ON favorites (user_id, created_at DESC);

-- ─── bookings ────────────────────────────────────────────────────────────────

-- Incoming bookings: filter by listing_id (provider's view).
CREATE INDEX IF NOT EXISTS idx_bookings_listing_id_created
  ON bookings (listing_id, created_at DESC);

-- bookings_user_id_idx likely already exists; kept for reference:
-- CREATE INDEX IF NOT EXISTS idx_bookings_user_id_created
--   ON bookings (user_id, created_at DESC);
