-- Photo ratings are separate from binary profile-image likes and from crew reviews.
-- Writes and reads go through authenticated server routes using the service role;
-- RLS intentionally exposes no direct anonymous table access.
CREATE TABLE IF NOT EXISTS profile_image_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL,
  reviewer_id text NOT NULL,
  image_url text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_image_ratings_one_per_user_image UNIQUE (profile_id, image_url, reviewer_id)
);

CREATE INDEX IF NOT EXISTS profile_image_ratings_image_lookup
  ON profile_image_ratings (profile_id, image_url);

ALTER TABLE profile_image_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE profile_image_ratings FROM anon, authenticated;
GRANT ALL ON TABLE profile_image_ratings TO service_role;
