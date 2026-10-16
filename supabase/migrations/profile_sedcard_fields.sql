-- Profile editor / talent sedcard fields introduced after profile_v2.sql.
-- These nullable JSONB columns keep the extra details optional for every profile.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS performance JSONB,
  ADD COLUMN IF NOT EXISTS model_measurements JSONB,
  ADD COLUMN IF NOT EXISTS casting JSONB;
