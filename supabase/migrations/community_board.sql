-- Community board: questions, recommendations, requests and offers.
-- Posts are visible for at most 48 hours; replies are removed with their post.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null,
  kind text not null check (kind in ('question', 'recommendation', 'request', 'offer')),
  title text not null,
  body text not null,
  city text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours')
);

alter table public.community_posts
  add column if not exists expires_at timestamptz;

update public.community_posts
set expires_at = coalesce(expires_at, created_at + interval '48 hours')
where expires_at is null;

alter table public.community_posts
  alter column expires_at set default (now() + interval '48 hours'),
  alter column expires_at set not null;

create index if not exists community_posts_expiry_created_idx
  on public.community_posts (expires_at, created_at desc);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists community_replies_post_created_idx
  on public.community_replies (post_id, created_at asc);

-- The app accesses these tables through its server-only service-role client.
-- Keep direct client access disabled; API routes enforce ownership and auth.
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
revoke all on public.community_posts from anon, authenticated;
revoke all on public.community_replies from anon, authenticated;
grant all on public.community_posts to service_role;
grant all on public.community_replies to service_role;
