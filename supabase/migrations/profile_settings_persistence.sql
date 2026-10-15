-- Persist every profile field currently edited in the profile settings UI.
-- The profiles table is created by the initial project setup; this migration
-- adds optional fields idempotently for installations with older schemas.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS available_from DATE,
  ADD COLUMN IF NOT EXISTS travel_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS imdb_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_images JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS availability_config JSONB,
  ADD COLUMN IF NOT EXISTS focal_point JSONB;

-- The UI stores specific roles such as "actor", "lighting" and "location".
-- An earlier constraint only allowed the four broad categories, so saves for
-- most real profile types failed. The API validates values against the UI's
-- supported types.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_profile_type_check;

-- Settings are written only through authenticated server routes using the
-- server-side database client. RLS prevents direct anonymous access.
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id TEXT PRIMARY KEY,
  profile_visibility TEXT NOT NULL DEFAULT 'public',
  message_permission TEXT NOT NULL DEFAULT 'everyone',
  email_new_message BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS message_permission TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS email_new_message BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_id_uidx
  ON public.user_settings (user_id);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_settings FROM anon, authenticated;
GRANT ALL ON TABLE public.user_settings TO service_role;
