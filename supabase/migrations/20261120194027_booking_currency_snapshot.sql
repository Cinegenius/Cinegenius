begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Earlier booking requests were entered in euros. Preserve the unit with the
-- request, independently of later edits to its source listing or viewer locale.
alter table public.bookings
  add column if not exists currency text not null default 'EUR';
alter table public.bookings
  add constraint bookings_currency_code check (currency ~ '^[A-Z]{3}$');
comment on column public.bookings.currency is
  'ISO 4217 snapshot taken from the listing by the authenticated booking API. Legacy requests remain EUR; no conversion.';

-- Existing RLS, owners and grants remain untouched. No listing/profile writes.
notify pgrst, 'reload schema';
commit;
