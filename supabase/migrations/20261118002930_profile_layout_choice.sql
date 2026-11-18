-- Presentation only: no profile types, media, existing rows or permissions change.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_layout text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_profile_layout_check
  CHECK (profile_layout IS NULL OR profile_layout IN ('compact', 'large-photo'));

COMMENT ON COLUMN public.profiles.profile_layout IS
  'Owner-selected presentation shared by Web and App. NULL preserves legacy layout. Independent of occupation and profile types.';

NOTIFY pgrst, 'reload schema';
