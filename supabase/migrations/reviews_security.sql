-- Add security columns to reviews (idempotent)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_id  text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verified     boolean NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verified_via text CHECK (verified_via IN ('booking', 'application'));

-- One review per reviewer per target (covers listing + user reviews)
CREATE UNIQUE INDEX IF NOT EXISTS reviews_reviewer_target_unique
  ON reviews (reviewer_id, target_id, target_type);

-- Fast lookup by target
CREATE INDEX IF NOT EXISTS idx_reviews_target
  ON reviews (target_id, target_type, created_at DESC);

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "anyone can read reviews"
  ON reviews FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "authenticated users insert own reviews"
  ON reviews FOR INSERT WITH CHECK (auth.uid()::text = reviewer_id);
