-- Separate homepage Crew exposure from general profile/offer visibility.
-- Preserve existing settings, RLS and service-only access; do not publish profiles.
begin;
alter table public.user_settings
  add column if not exists show_in_home_crew boolean not null default true;
comment on column public.user_settings.show_in_home_crew is
  'Own-account preference for the rotating homepage Crew rail. Does not override profile privacy or Ghost.';
notify pgrst, 'reload schema';
commit;
