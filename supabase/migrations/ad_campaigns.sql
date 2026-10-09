-- Self-service, currently free advertising banners.
-- Ads are published immediately and expire after the selected campaign window.

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  advertiser_name text not null check (char_length(advertiser_name) between 1 and 80),
  placement text not null default 'home' check (placement = 'home'),
  headline text not null check (char_length(headline) between 1 and 90),
  description text not null check (char_length(description) between 1 and 180),
  cta_label text not null check (char_length(cta_label) between 1 and 28),
  destination_url text not null,
  image_url text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '30 days'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaigns_valid_window check (ends_at > starts_at)
);

create index if not exists ad_campaigns_active_window_idx
  on public.ad_campaigns (placement, starts_at, ends_at, created_at desc)
  where active = true;

create index if not exists ad_campaigns_owner_created_idx
  on public.ad_campaigns (user_id, created_at desc);

alter table public.ad_campaigns enable row level security;
revoke all on public.ad_campaigns from anon, authenticated;
grant all on public.ad_campaigns to service_role;
