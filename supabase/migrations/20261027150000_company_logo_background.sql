-- Presentation only. Existing files, membership permissions and visibility stay intact.
alter table public.companies
  add column if not exists logo_background text not null default 'auto'
  check (logo_background in ('auto', 'light', 'dark'));

comment on column public.companies.logo_background is
  'Logo presentation surface: auto uses light; light/dark are chosen by a company editor.';

notify pgrst, 'reload schema';
