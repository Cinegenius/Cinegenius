-- Display translations only. No original/member content is rewritten.
-- Application must re-authorize the canonical source before BOTH cache read and response.
begin;
create schema if not exists content_translation_private;
revoke all on schema content_translation_private from public, anon, authenticated, service_role;

create table content_translation_private.limits (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  calls_per_day integer not null default 500 check (calls_per_day between 0 and 10000),
  characters_per_day integer not null default 2000000 check (characters_per_day between 0 and 20000000),
  calls_per_principal integer not null default 60 check (calls_per_principal between 0 and 500),
  concurrent_calls integer not null default 4 check (concurrent_calls between 1 and 20)
);
insert into content_translation_private.limits(singleton) values(true);
create table content_translation_private.cache (
  kind text not null check (kind in ('news','organization','listing','company','profile','project','community','reply','service','person')),
  source_id text not null check (length(source_id) between 1 and 125),
  locale text not null check (locale in ('de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk')),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('pending','ready','failed')),
  fields jsonb,
  lease_token uuid,
  lease_until timestamptz,
  retry_after timestamptz,
  expires_at timestamptz not null,
  primary key (kind,source_id,locale)
);
create index content_translation_expiry on content_translation_private.cache(expires_at);
create table content_translation_private.usage (
  day date not null,
  principal text not null check (principal='global' or principal ~ '^[0-9a-f]{64}$'),
  calls integer not null default 0,
  characters bigint not null default 0,
  primary key(day,principal)
);
alter table content_translation_private.limits enable row level security;
alter table content_translation_private.cache enable row level security;
alter table content_translation_private.usage enable row level security;
revoke all on all tables in schema content_translation_private from public,anon,authenticated,service_role;

create function public.read_content_translation(p_kind text,p_source_id text,p_locale text,p_source_hash text)
returns jsonb language sql security definer set search_path=pg_catalog as $$
  select jsonb_build_object('state',c.state,'fields',case when c.state='ready' then c.fields else null end)
  from content_translation_private.cache c
  where c.kind=p_kind and c.source_id=p_source_id and c.locale=p_locale and c.source_hash=p_source_hash
    and c.expires_at>clock_timestamp()
$$;

create function public.claim_content_translation(p_kind text,p_source_id text,p_locale text,p_source_hash text,p_characters integer,p_principal text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  cap content_translation_private.limits%rowtype;
  existing content_translation_private.cache%rowtype;
  global_use content_translation_private.usage%rowtype;
  personal_use content_translation_private.usage%rowtype;
  stamp timestamptz := clock_timestamp();
  usage_day date := (stamp at time zone 'UTC')::date;
  token uuid;
begin
  if p_kind is null or p_locale is null or p_kind not in ('news','organization','listing','company','profile','project','community','reply','service','person')
    or p_locale not in ('de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk')
    or p_characters is null or p_characters not between 1 and 24000
    or p_principal is null or p_principal !~ '^[0-9a-f]{64}$'
    or p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$'
    or p_source_id is null or length(p_source_id) not between 1 and 125 then
    return jsonb_build_object('status','unavailable');
  end if;
  -- Serialize only cheap budget/lease claims. Never hold a transaction during AI calls.
  -- Fail promptly on contention; no transaction-retry SQLSTATE or unchecked write.
  begin
    select * into cap from content_translation_private.limits where singleton for update nowait;
  exception when lock_not_available then return jsonb_build_object('status','pending'); end;
  if not found or not cap.enabled then return jsonb_build_object('status','unavailable'); end if;
  select * into existing from content_translation_private.cache where kind=p_kind and source_id=p_source_id and locale=p_locale;
  if found and existing.source_hash=p_source_hash and existing.expires_at>stamp then
    if existing.state='ready' then return jsonb_build_object('status','ready'); end if;
    if existing.state='pending' and existing.lease_until>stamp then return jsonb_build_object('status','pending'); end if;
    if existing.state='failed' and existing.retry_after>stamp then return jsonb_build_object('status','unavailable'); end if;
  end if;
  if (select count(*) from content_translation_private.cache where state='pending' and lease_until>stamp)>=cap.concurrent_calls then
    return jsonb_build_object('status','pending');
  end if;
  insert into content_translation_private.usage(day,principal) values(usage_day,'global'),(usage_day,p_principal) on conflict do nothing;
  select * into global_use from content_translation_private.usage where day=usage_day and principal='global';
  select * into personal_use from content_translation_private.usage where day=usage_day and principal=p_principal;
  if global_use.calls>=cap.calls_per_day or global_use.characters+p_characters>cap.characters_per_day
    or personal_use.calls>=cap.calls_per_principal then return jsonb_build_object('status','unavailable'); end if;
  update content_translation_private.usage set calls=calls+1,characters=characters+p_characters
    where day=usage_day and principal in ('global',p_principal);
  -- Failed calls may still cost money: reservations are never refunded automatically.
  token := gen_random_uuid();
  insert into content_translation_private.cache(kind,source_id,locale,source_hash,state,lease_token,lease_until,expires_at)
    values(p_kind,p_source_id,p_locale,p_source_hash,'pending',token,stamp+interval '60 seconds',stamp+interval '1 day')
  on conflict(kind,source_id,locale) do update set source_hash=excluded.source_hash,state='pending',fields=null,
    lease_token=excluded.lease_token,lease_until=excluded.lease_until,retry_after=null,expires_at=excluded.expires_at;
  delete from content_translation_private.usage where day<usage_day-2;
  delete from content_translation_private.cache where expires_at<stamp;
  return jsonb_build_object('status','claimed','lease',token);
end $$;

create function public.finish_content_translation(p_kind text,p_source_id text,p_locale text,p_source_hash text,p_lease uuid,p_fields jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare changed integer;
begin
  if p_fields is not null and (jsonb_typeof(p_fields)<>'object' or octet_length(p_fields::text)>400000) then return false; end if;
  update content_translation_private.cache set
    state=case when p_fields is null then 'failed' else 'ready' end,fields=p_fields,lease_token=null,lease_until=null,
    retry_after=case when p_fields is null then clock_timestamp()+interval '15 minutes' else null end,
    expires_at=clock_timestamp()+case when p_fields is null then interval '1 day' else interval '30 days' end
  where kind=p_kind and source_id=p_source_id and locale=p_locale and source_hash=p_source_hash
    and state='pending' and lease_token=p_lease and lease_until>clock_timestamp();
  get diagnostics changed=row_count;
  return changed=1;
end $$;

revoke all on function public.read_content_translation(text,text,text,text) from public,anon,authenticated;
revoke all on function public.claim_content_translation(text,text,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.finish_content_translation(text,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.read_content_translation(text,text,text,text) to service_role;
grant execute on function public.claim_content_translation(text,text,text,text,integer,text) to service_role;
grant execute on function public.finish_content_translation(text,text,text,text,uuid,jsonb) to service_role;
commit;
