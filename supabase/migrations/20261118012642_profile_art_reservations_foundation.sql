-- Inactive foundation only. No profiles/media are changed and no catalogue is seeded.
begin;
create schema profile_art_private;
revoke all on schema profile_art_private from public, anon, authenticated, service_role;
grant usage on schema profile_art_private to service_role;
alter default privileges in schema profile_art_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema profile_art_private revoke all on functions from public, anon, authenticated, service_role;

create table profile_art_private.settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into profile_art_private.settings values (true, false);

create table profile_art_private.legacy_shared (
  source_sha256 text primary key check (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_path text not null unique
);

-- Existing v1 bytes are shared, not exclusive inventory. No profile is rewritten.
insert into profile_art_private.legacy_shared(source_sha256,source_path) values
  ('c7772bafbaa6d7a226122368bd70d00e158e1ac2a92e337329c9d8989b04b917','/profile-art/v1/avatar-01.webp'),
  ('e88600279ca558ad1b7f09d8c4ed64ffe294db31aa90fdfaac58ddb13c920aa5','/profile-art/v1/avatar-04.webp'),
  ('e97113efa02acff38d8f2a32879daa5d598b20bfd7d4d47d38b2d73e27217f14','/profile-art/v1/avatar-05.webp'),
  ('2cc0efd4e248d292b9ef44714ee6b33031b2850a7ef587bf70927650df3e14c9','/profile-art/v1/avatar-19.webp'),
  ('e6111146c429e7592a8c23bc2f4bd61d98b8275fd3967fe22bcef7da5813d5d9','/profile-art/v1/avatar-03.webp'),
  ('94224edd74c34cd809e3657d6244dd52f53d9f912bdfa4f7d85fa3f22277d588','/profile-art/v1/avatar-06.webp'),
  ('3433e24a7cd6d87676854c995a0fd3e8511d477d6ce764d458e790fa8cf49175','/profile-art/v1/avatar-12.webp'),
  ('7174d6cc1ccc8b4433014049f9b1a9892fdaee2cd00f93bbc0a4ccb6728ef004','/profile-art/v1/avatar-15.webp'),
  ('5c6e7508c35cf30eb462e8bd9d83514867fd44905f51f91a75e450b80e4b2cc2','/profile-art/v1/avatar-13.webp'),
  ('e53014366ecfc6fdc0edd398c749302852ffc3abbc50a937ed45e6c431d5a1af','/profile-art/v1/avatar-14.webp'),
  ('5fb60bfe7711ed1f588350f7ff4d5d863124f29782ceccb070d32754608c9133','/profile-art/v1/avatar-16.webp'),
  ('fe7e317d062115cd1df491e9023dab133fe9de141afa589b7fed67b3b03c6536','/profile-art/v1/avatar-20.webp'),
  ('c7f0f4eb99fb7160f3c7a2210186afd591ebd0a020a78af3e0379c688b8f0b5e','/profile-art/v1/cover-water.webp'),
  ('faac466e475fbf9ced45b39657f92969285f113387e746d83ac26cee2fd8c8b1','/profile-art/v1/cover-moon.webp'),
  ('f305d986e7e131379d184b88a0e910bd94ffe49b7d64068af6e090fbae0d133d','/profile-art/v1/cover-sun.webp'),
  ('549d89430993feb56abf7a4256fab396f5e00734c7247dc15e3df2e437178de6','/profile-art/v1/cover-earth.webp'),
  ('cfe88311a516bd977e13ca4826008a371261beb3a9c01aa2449efe2cc4c64631','/profile-art/v1/cover-sky.webp'),
  ('28c48450ac8374ff309dd6e40047879dabff865d5156a7f7efe71e1f8706ac18','/profile-art/v1/cover-cold.webp'),
  ('6e80fcf7196f759a90d4cd08dfb613717a0298e665502f57010f871ba14aca6a','/profile-art/v1/cover-heat.webp'),
  ('db70493dbcea810a3f53c8fa35db0dacf149b37af4916a5e2f14c753cbff7857','/profile-art/v1/cover-mountains.webp'),
  ('6a363bd9dca0c3728b4bc7be3fbb35aee632fc7c345c1ff6f696b5a1adbe4a3d','/profile-art/v1/cover-valley.webp'),
  ('7c7f94127252ae35f2ebc4a6ff5a595b8bbb42596498f0ab443cf8d4330c9176','/profile-art/v1/cover-forest.webp'),
  ('b2d2e7d20f5273691bc48ab97dfe37b411fb5053e53df048625ea0c51d912a8b','/profile-art/v1/cover-desert.webp'),
  ('41f156b46b1da2061f16f44d8dd108a0611e6abdb4f6ae0b676ea6a0c8c5306c','/profile-art/v1/cover-polar.webp');

create table profile_art_private.artworks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('avatar', 'cover')),
  -- A reviewed canonical illustration family, shared by ALL colour/crop/file variants.
  -- This is NOT a random ID, URL hash or proof of automatic perceptual deduplication.
  illustration_key text not null unique check (illustration_key ~ '^[a-f0-9]{64}$'),
  source_sha256 text not null unique check (source_sha256 ~ '^[a-f0-9]{64}$'),
  media_key uuid not null unique,
  state text not null default 'quarantine' check (state in ('quarantine', 'ready', 'retired')),
  identity_review text,
  identity_reviewed_at timestamptz,
  unique (id, kind),
  check (state <> 'ready' or (length(btrim(identity_review)) > 0 and identity_review is not null and identity_reviewed_at is not null))
);

create function profile_art_private.guard_artwork_identity() returns trigger
language plpgsql security invoker set search_path = pg_catalog, profile_art_private as $$
begin
  perform profile_art_private.lock_artwork(new.id);
  if exists (select 1 from profile_art_private.legacy_shared where source_sha256 = new.source_sha256) then
    raise exception using errcode = 'PT409', message = 'ART_LEGACY_SHARED';
  end if;
  if tg_op = 'UPDATE' and (new.id, new.kind, new.illustration_key, new.source_sha256, new.media_key)
      is distinct from (old.id, old.kind, old.illustration_key, old.source_sha256, old.media_key) then
    raise exception using errcode = 'PT409', message = 'ART_IDENTITY_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger profile_art_identity before insert or update on profile_art_private.artworks
for each row execute function profile_art_private.guard_artwork_identity();

-- Confirmed ownership is durable even after choosing another image. Never recycle it
-- to another member: old public copies may still exist. Deletion policy is future work.
create table profile_art_private.claims (
  artwork_id uuid primary key,
  user_id text not null check (length(user_id) between 1 and 128),
  kind text not null,
  confirmed_at timestamptz not null default clock_timestamp(),
  foreign key (artwork_id, kind) references profile_art_private.artworks(id, kind),
  unique (artwork_id, user_id, kind)
);
create table profile_art_private.slots (
  user_id text not null check (length(user_id) between 1 and 128),
  kind text not null check (kind in ('avatar', 'cover')),
  revision bigint not null default 0 check (revision between 0 and 9007199254740991),
  selected_artwork_id uuid,
  primary key (user_id, kind),
  foreign key (selected_artwork_id, user_id, kind) references profile_art_private.claims(artwork_id, user_id, kind)
);
create table profile_art_private.leases (
  artwork_id uuid primary key,
  user_id text not null,
  kind text not null,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null,
  unique (user_id, kind),
  foreign key (artwork_id, kind) references profile_art_private.artworks(id, kind),
  foreign key (user_id, kind) references profile_art_private.slots(user_id, kind)
);
create table profile_art_private.operations (
  user_id text not null,
  request_key uuid not null,
  payload jsonb not null,
  receipt jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, request_key)
);

alter table profile_art_private.settings enable row level security;
alter table profile_art_private.legacy_shared enable row level security;
alter table profile_art_private.artworks enable row level security;
alter table profile_art_private.claims enable row level security;
alter table profile_art_private.slots enable row level security;
alter table profile_art_private.leases enable row level security;
alter table profile_art_private.operations enable row level security;
revoke all on all tables in schema profile_art_private from public, anon, authenticated, service_role;
grant select on all tables in schema profile_art_private to service_role;
grant insert, update on profile_art_private.slots to service_role;
grant insert, update, delete on profile_art_private.leases to service_role;
grant insert on profile_art_private.operations to service_role;
-- No service-role writes to catalogue, settings or confirmed ownership.

create function profile_art_private.check_enabled(p_user text, p_kind text) returns void
language plpgsql security invoker set search_path = pg_catalog, profile_art_private as $$
begin
  if p_user is null or length(btrim(p_user)) not between 1 and 128 or p_kind is null or p_kind not in ('avatar','cover') then
    raise exception using errcode = 'PT400', message = 'ART_INVALID';
  end if;
  if not coalesce((select enabled from profile_art_private.settings where singleton), false) then
    raise exception using errcode = 'PT503', message = 'ART_UNAVAILABLE';
  end if;
end $$;

create function profile_art_private.lock_account(p_user text) returns void
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if not pg_try_advisory_xact_lock(hashtextextended('profile-art/account/' || p_user, 0)) then
    raise exception using errcode = 'PT409', message = 'ART_BUSY';
  end if;
end $$;

create function profile_art_private.lock_artwork(p_artwork uuid) returns void
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if not pg_try_advisory_xact_lock(hashtextextended('profile-art/artwork/' || p_artwork::text, 0)) then
    raise exception using errcode = 'PT409', message = 'ART_BUSY';
  end if;
end $$;

-- SELECT only: no implicit reservation, cleanup, renewal or slot creation on browsing.
create function public.profile_art_choices(p_user text, p_kind text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, profile_art_private as $$
declare result jsonb; stamp timestamptz := clock_timestamp();
begin
  perform profile_art_private.check_enabled(p_user, p_kind);
  select jsonb_build_object(
    'revision', coalesce((select revision from profile_art_private.slots where user_id=p_user and kind=p_kind), 0),
    'available', coalesce((select jsonb_agg(item order by id) from (
      select a.id, jsonb_build_object('artworkId', a.id, 'kind', a.kind, 'mediaKey', a.media_key) item
      from profile_art_private.artworks a where a.kind=p_kind and a.state='ready'
        and not exists (select 1 from profile_art_private.claims c where c.artwork_id=a.id)
        and not exists (select 1 from profile_art_private.leases l where l.artwork_id=a.id and l.expires_at>stamp)
      order by a.id limit 24
    ) available), '[]'::jsonb),
    'selected', (select jsonb_build_object('artworkId', a.id, 'kind', a.kind, 'mediaKey', a.media_key)
      from profile_art_private.slots s join profile_art_private.artworks a on a.id=s.selected_artwork_id
      where s.user_id=p_user and s.kind=p_kind),
    'lease', (select jsonb_build_object('artworkId', l.artwork_id, 'token', l.token, 'expiresAt', l.expires_at)
      from profile_art_private.leases l where l.user_id=p_user and l.kind=p_kind and l.expires_at>stamp)
  ) into result;
  return result;
end $$;

create function public.profile_art_lease(p_user text, p_kind text, p_artwork uuid, p_expected bigint, p_request uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, profile_art_private set lock_timeout = '500ms' as $$
declare s profile_art_private.slots%rowtype; op profile_art_private.operations%rowtype;
  a profile_art_private.artworks%rowtype; l profile_art_private.leases%rowtype;
  payload jsonb := jsonb_build_object('action','lease','kind',p_kind,'artwork',p_artwork,'expected',p_expected);
  result jsonb; stamp timestamptz;
begin
  perform profile_art_private.check_enabled(p_user,p_kind);
  if p_artwork is null or p_request is null or p_expected is null or p_expected<0 then
    raise exception using errcode='PT400',message='ART_INVALID'; end if;
  perform profile_art_private.lock_account(p_user);
  insert into profile_art_private.slots(user_id,kind) values(p_user,p_kind) on conflict do nothing;
  select * into s from profile_art_private.slots where user_id=p_user and kind=p_kind for update nowait;
  select * into op from profile_art_private.operations where user_id=p_user and request_key=p_request;
  if found then
    if op.payload is distinct from payload then raise exception using errcode='PT409',message='ART_KEY_REUSED'; end if;
    if s.revision <> (op.receipt->>'revision')::bigint or not exists (
      select 1 from profile_art_private.leases where user_id=p_user and kind=p_kind
      and token=(op.receipt->>'token')::uuid and expires_at>clock_timestamp()
    ) then raise exception using errcode='PT409',message='ART_STALE_RETRY'; end if;
    return op.receipt;
  end if;
  if s.revision<>p_expected then raise exception using errcode='PT409',message='ART_REVISION'; end if;
  perform profile_art_private.lock_artwork(p_artwork);
  select * into a from profile_art_private.artworks where id=p_artwork and kind=p_kind;
  if not found or a.state<>'ready' or exists(select 1 from profile_art_private.claims where artwork_id=p_artwork and user_id<>p_user) then
    raise exception using errcode='PT409',message='ART_UNAVAILABLE'; end if;
  stamp := clock_timestamp();
  if exists(select 1 from profile_art_private.leases where artwork_id=p_artwork and user_id<>p_user and expires_at>stamp) then
    raise exception using errcode='PT409',message='ART_UNAVAILABLE'; end if;
  -- Replacement and expiry reuse occur in the same transaction; failure preserves the old lease.
  delete from profile_art_private.leases where (user_id=p_user and kind=p_kind) or (artwork_id=p_artwork and expires_at<=stamp);
  insert into profile_art_private.leases(artwork_id,user_id,kind,expires_at)
    values(p_artwork,p_user,p_kind,stamp+interval '5 minutes') returning * into l;
  update profile_art_private.slots set revision=revision+1 where user_id=p_user and kind=p_kind returning * into s;
  result := jsonb_build_object('artworkId',l.artwork_id,'token',l.token,'expiresAt',l.expires_at,'revision',s.revision);
  insert into profile_art_private.operations values(p_user,p_request,payload,result,clock_timestamp());
  return result;
exception when lock_not_available or deadlock_detected or unique_violation then
  raise exception using errcode='PT409',message='ART_BUSY';
end $$;

create function public.profile_art_cancel(p_user text, p_kind text, p_expected bigint, p_request uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, profile_art_private set lock_timeout = '500ms' as $$
declare s profile_art_private.slots%rowtype; op profile_art_private.operations%rowtype;
  payload jsonb := jsonb_build_object('action','cancel','kind',p_kind,'expected',p_expected); result jsonb;
begin
  perform profile_art_private.check_enabled(p_user,p_kind);
  if p_request is null or p_expected is null or p_expected<0 then raise exception using errcode='PT400',message='ART_INVALID'; end if;
  perform profile_art_private.lock_account(p_user);
  insert into profile_art_private.slots(user_id,kind) values(p_user,p_kind) on conflict do nothing;
  select * into s from profile_art_private.slots where user_id=p_user and kind=p_kind for update nowait;
  select * into op from profile_art_private.operations where user_id=p_user and request_key=p_request;
  if found then
    if op.payload is distinct from payload then raise exception using errcode='PT409',message='ART_KEY_REUSED'; end if;
    if s.revision<>(op.receipt->>'revision')::bigint then raise exception using errcode='PT409',message='ART_STALE_RETRY'; end if;
    return op.receipt;
  end if;
  if s.revision<>p_expected then raise exception using errcode='PT409',message='ART_REVISION'; end if;
  delete from profile_art_private.leases where user_id=p_user and kind=p_kind;
  update profile_art_private.slots set revision=revision+1 where user_id=p_user and kind=p_kind returning * into s;
  result := jsonb_build_object('revision',s.revision);
  insert into profile_art_private.operations values(p_user,p_request,payload,result,clock_timestamp());
  return result;
exception when lock_not_available or deadlock_detected then
  raise exception using errcode='PT409',message='ART_BUSY';
end $$;

-- INTERNAL ONLY: the future validated profile-save RPC must call this and write the
-- canonical image reference in ONE transaction. No separate confirmation endpoint.
-- p_media_key is resolved by that writer, never a user-supplied URL. No new URL scheme here.
create function profile_art_private.confirm_in_profile_save(p_user text, p_kind text, p_token uuid, p_expected bigint, p_request uuid, p_media_key uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, profile_art_private set lock_timeout = '500ms' as $$
declare s profile_art_private.slots%rowtype; op profile_art_private.operations%rowtype;
  a profile_art_private.artworks%rowtype; l profile_art_private.leases%rowtype;
  payload jsonb := jsonb_build_object('action','confirm','kind',p_kind,'token',p_token,'expected',p_expected,'mediaKey',p_media_key); result jsonb;
begin
  perform profile_art_private.check_enabled(p_user,p_kind);
  if p_token is null or p_request is null or p_expected is null or p_expected<0 or p_media_key is null then
    raise exception using errcode='PT400',message='ART_INVALID'; end if;
  perform profile_art_private.lock_account(p_user);
  select * into s from profile_art_private.slots where user_id=p_user and kind=p_kind for update nowait;
  if not found then raise exception using errcode='PT409',message='ART_EXPIRED'; end if;
  select * into op from profile_art_private.operations where user_id=p_user and request_key=p_request;
  if found then
    if op.payload is distinct from payload then raise exception using errcode='PT409',message='ART_KEY_REUSED'; end if;
    if s.revision<>(op.receipt->>'revision')::bigint or s.selected_artwork_id is distinct from (op.receipt->>'artworkId')::uuid then
      raise exception using errcode='PT409',message='ART_STALE_RETRY'; end if;
    return op.receipt;
  end if;
  if s.revision<>p_expected then raise exception using errcode='PT409',message='ART_REVISION'; end if;
  select * into l from profile_art_private.leases where user_id=p_user and kind=p_kind and token=p_token for update nowait;
  if not found or l.expires_at<=clock_timestamp() then raise exception using errcode='PT409',message='ART_EXPIRED'; end if;
  perform profile_art_private.lock_artwork(l.artwork_id);
  select * into a from profile_art_private.artworks where id=l.artwork_id;
  if a.state<>'ready' or a.media_key<>p_media_key or exists(select 1 from profile_art_private.claims where artwork_id=a.id and user_id<>p_user) then
    raise exception using errcode='PT409',message='ART_UNAVAILABLE'; end if;
  -- Recheck after locks: acquiring a lock must never revive a lease which expired meanwhile.
  if l.expires_at<=clock_timestamp() then raise exception using errcode='PT409',message='ART_EXPIRED'; end if;
  insert into profile_art_private.claims(artwork_id,user_id,kind) values(a.id,p_user,p_kind) on conflict do nothing;
  update profile_art_private.slots set selected_artwork_id=a.id,revision=revision+1 where user_id=p_user and kind=p_kind returning * into s;
  delete from profile_art_private.leases where user_id=p_user and kind=p_kind;
  result := jsonb_build_object('artworkId',a.id,'mediaKey',a.media_key,'revision',s.revision);
  insert into profile_art_private.operations values(p_user,p_request,payload,result,clock_timestamp());
  return result;
exception when lock_not_available or deadlock_detected or unique_violation then
  raise exception using errcode='PT409',message='ART_BUSY';
end $$;

revoke all on all functions in schema profile_art_private from public, anon, authenticated, service_role;
grant execute on function profile_art_private.check_enabled(text,text), profile_art_private.lock_account(text), profile_art_private.lock_artwork(uuid) to service_role;
revoke all on function public.profile_art_choices(text,text), public.profile_art_lease(text,text,uuid,bigint,uuid), public.profile_art_cancel(text,text,bigint,uuid) from public, anon, authenticated;
grant execute on function public.profile_art_choices(text,text), public.profile_art_lease(text,text,uuid,bigint,uuid), public.profile_art_cancel(text,text,bigint,uuid) to service_role;
-- No grant for confirm_in_profile_save, including service_role. A future reviewed
-- transaction-level writer is required before this can become a usable feature.
notify pgrst, 'reload schema';
commit;
