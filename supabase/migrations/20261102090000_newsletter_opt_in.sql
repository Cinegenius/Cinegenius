-- A mailing list populated only by direct, explicit, double-confirmed signups.
-- No Clerk/account table is read or backfilled by this migration.
create table if not exists public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  confirmation_token_hash text,
  confirmation_expires_at timestamptz,
  consent_version text not null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  constraint newsletter_email_normalized check (email = lower(trim(email)))
);

create index if not exists newsletter_subscriptions_confirmed_idx
  on public.newsletter_subscriptions (created_at, id) where status = 'confirmed';

create table if not exists public.newsletter_campaigns (
  id uuid primary key,
  subject text not null,
  heading text not null,
  body text not null,
  cta_label text not null,
  cta_url text not null,
  recommend text not null,
  instagram_label text not null,
  instagram_url text not null,
  signature text not null,
  locale text not null default 'de' check (locale in ('de', 'en', 'es', 'it', 'cs', 'hu')),
  created_by text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'partial', 'failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.newsletter_campaign_deliveries (
  campaign_id uuid not null references public.newsletter_campaigns(id) on delete cascade,
  subscription_id uuid not null references public.newsletter_subscriptions(id) on delete restrict,
  chunk_index integer not null check (chunk_index >= 0),
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped')),
  resend_id text,
  sent_at timestamptz,
  primary key (campaign_id, subscription_id)
);

create index if not exists newsletter_campaign_deliveries_chunk_idx
  on public.newsletter_campaign_deliveries (campaign_id, chunk_index, status);

alter table public.newsletter_subscriptions enable row level security;
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_campaign_deliveries enable row level security;

revoke all on public.newsletter_subscriptions from public, anon, authenticated;
revoke all on public.newsletter_campaigns from public, anon, authenticated;
revoke all on public.newsletter_campaign_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.newsletter_subscriptions to service_role;
grant select, insert, update, delete on public.newsletter_campaigns to service_role;
grant select, insert, update, delete on public.newsletter_campaign_deliveries to service_role;

-- Keep confirmed subscriptions confirmed even if a second signup request races
-- with the confirmation click. This function only receives an address typed
-- into the public newsletter form; it never queries account/Clerk addresses.
create or replace function public.newsletter_request_confirmation(
  p_email text,
  p_confirmation_token_hash text,
  p_confirmation_expires_at timestamptz,
  p_consent_version text,
  p_consent_at timestamptz
) returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare resulting_status text;
begin
  insert into public.newsletter_subscriptions (
    email, status, confirmation_token_hash, confirmation_expires_at,
    consent_version, consent_at, confirmed_at, unsubscribed_at
  ) values (
    lower(trim(p_email)), 'pending', p_confirmation_token_hash, p_confirmation_expires_at,
    p_consent_version, p_consent_at, null, null
  )
  on conflict (email) do update set
    status = 'pending',
    confirmation_token_hash = excluded.confirmation_token_hash,
    confirmation_expires_at = excluded.confirmation_expires_at,
    consent_version = excluded.consent_version,
    consent_at = excluded.consent_at,
    unsubscribed_at = null
  where public.newsletter_subscriptions.status <> 'confirmed'
  returning status into resulting_status;

  return coalesce(resulting_status, 'confirmed');
end;
$$;

revoke all on function public.newsletter_request_confirmation(text, text, timestamptz, text, timestamptz) from public, anon, authenticated;
grant execute on function public.newsletter_request_confirmation(text, text, timestamptz, text, timestamptz) to service_role;
