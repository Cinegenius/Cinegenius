begin;
alter table public.profiles add column if not exists pronouns text;
alter table public.profiles add column if not exists show_pronouns boolean not null default false;
alter table public.profiles add constraint profiles_pronouns_length check (pronouns is null or (char_length(pronouns) <= 60 and pronouns !~ '[[:cntrl:]<>]'));
comment on column public.profiles.pronouns is 'Optional self-described pronouns. Never inferred or used for search/ranking.';
comment on column public.profiles.show_pronouns is 'Explicit opt-in to display pronouns within the current profile audience.';
commit;
