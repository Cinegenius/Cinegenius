-- Keep legacy likes, but collapse duplicate rows before enforcing one like per
-- account, profile, and uploaded image. Existing counts become accurate.
WITH ranked AS (
  SELECT ctid,
         row_number() OVER (
           PARTITION BY liker_id, profile_id, image_url
           ORDER BY created_at ASC NULLS LAST, id ASC
         ) AS row_number
  FROM profile_image_likes
)
DELETE FROM profile_image_likes AS likes
USING ranked
WHERE likes.ctid = ranked.ctid
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS profile_image_likes_one_per_user_image
  ON profile_image_likes (liker_id, profile_id, image_url);

CREATE INDEX IF NOT EXISTS profile_image_likes_profile_image_lookup
  ON profile_image_likes (profile_id, image_url);
