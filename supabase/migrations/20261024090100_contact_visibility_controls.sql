-- Explicit per-field visibility for personal and business contact details.
-- New and existing values remain private until the owner opts into visibility.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS phone_visibility TEXT NOT NULL DEFAULT 'hidden',
  ADD COLUMN IF NOT EXISTS contact_email_visibility TEXT NOT NULL DEFAULT 'hidden';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_phone_visibility_check') THEN
    ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_phone_visibility_check
      CHECK (phone_visibility IN ('public', 'members', 'hidden'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_contact_email_visibility_check') THEN
    ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_contact_email_visibility_check
      CHECK (contact_email_visibility IN ('public', 'members', 'hidden'));
  END IF;
END $$;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hq_address_public BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_settings.phone_visibility IS 'Owner-selected visibility of the profile phone number: public, signed-in members, or hidden.';
COMMENT ON COLUMN public.user_settings.contact_email_visibility IS 'Owner-selected visibility of the profile contact email: public, signed-in members, or hidden.';
COMMENT ON COLUMN public.companies.email_public IS 'Explicit owner consent to show the company business email on its public profile.';
COMMENT ON COLUMN public.companies.phone_public IS 'Explicit owner consent to show the company business phone on its public profile.';
COMMENT ON COLUMN public.companies.hq_address_public IS 'Explicit owner consent to show the company headquarters address publicly.';
