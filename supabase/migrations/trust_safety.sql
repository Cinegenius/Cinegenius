-- ============================================================
-- CineGenius — Trust & Safety: blocks + reports
-- ============================================================

-- ─── blocks ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blocks (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id  text        NOT NULL,   -- user who initiated the block
  blocked_id  text        NOT NULL,   -- user who was blocked
  created_at  timestamptz DEFAULT now(),

  UNIQUE (blocker_id, blocked_id),
  CHECK  (blocker_id <> blocked_id)   -- can't block yourself
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own block records
CREATE POLICY "blocker can manage own blocks"
  ON blocks FOR ALL
  USING (auth.uid()::text = blocker_id);

-- Index: "have I been blocked by X?" (fastest possible lookup)
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_blocked
  ON blocks (blocker_id, blocked_id);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id
  ON blocks (blocked_id);

-- ─── reports ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id  text        NOT NULL,
  target_type  text        NOT NULL CHECK (target_type IN ('user', 'listing', 'review')),
  target_id    text        NOT NULL,
  reason       text        NOT NULL CHECK (reason IN (
                             'spam', 'harassment', 'fake_profile',
                             'inappropriate_content', 'scam', 'underage', 'other'
                           )),
  details      text,                  -- optional free-text elaboration
  status       text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at   timestamptz DEFAULT now(),

  -- One report per reporter per target (prevents spam-reporting)
  UNIQUE (reporter_id, target_id, target_type)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Reporters can submit and view their own reports, not edit/delete them
CREATE POLICY "reporter can insert own reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid()::text = reporter_id);

CREATE POLICY "reporter can view own reports"
  ON reports FOR SELECT
  USING (auth.uid()::text = reporter_id);

-- Admins see everything — set ADMIN_USER_IDS in application layer,
-- Supabase service role key bypasses RLS entirely for the admin dashboard.

CREATE INDEX IF NOT EXISTS idx_reports_reporter_id
  ON reports (reporter_id);

CREATE INDEX IF NOT EXISTS idx_reports_target
  ON reports (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_reports_status_created
  ON reports (status, created_at DESC);
