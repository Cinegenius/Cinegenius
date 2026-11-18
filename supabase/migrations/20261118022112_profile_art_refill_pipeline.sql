-- Disabled pipeline. No bucket, image, profile, provider call or hosted schedule is created.
begin;
create table profile_art_private.pipeline_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  reader_enabled boolean not null default false,
  catalog_revision bigint not null default 0 check(catalog_revision between 0 and 9007199254740991)
);
insert into profile_art_private.pipeline_settings values(true,false,false,0);
create table profile_art_private.refill_jobs (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  kind text not null check(kind in ('avatar','cover')),
  media_key uuid not null unique default gen_random_uuid(),
  state text not null default 'queued' check(state in ('queued','running','review','approved','rejected','failed')),
  token uuid, expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  failure_code text check(failure_code ~ '^[a-z_]{1,48}$'),
  candidate jsonb check(candidate is null or octet_length(candidate::text)<=2048),
  check((state='running')=(token is not null and expires_at is not null))
);
create index profile_art_refill_pending on profile_art_private.refill_jobs(state,created_at);
create table profile_art_private.catalog_fingerprints (
  reference_key text primary key check(reference_key ~ '^(legacy_[a-f0-9]{64}|(art|job)_[a-f0-9-]{36})$'),
  source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
  fingerprint jsonb not null check(octet_length(fingerprint::text)<=1024)
);
alter table profile_art_private.pipeline_settings enable row level security;
alter table profile_art_private.refill_jobs enable row level security;
alter table profile_art_private.catalog_fingerprints enable row level security;
revoke all on profile_art_private.pipeline_settings,profile_art_private.refill_jobs,profile_art_private.catalog_fingerprints from public,anon,authenticated,service_role;
grant select on profile_art_private.pipeline_settings,profile_art_private.refill_jobs,profile_art_private.catalog_fingerprints to service_role;

create function profile_art_private.lock_catalog() returns void language plpgsql security invoker
set search_path=pg_catalog,profile_art_private as $$ begin
  if not pg_try_advisory_xact_lock(727618112) then raise exception using errcode='PT409',message='ART_CATALOG_BUSY';end if;
end $$;
create function profile_art_private.valid_fingerprint(f jsonb) returns boolean language sql immutable
set search_path=pg_catalog as $$ select coalesce(jsonb_typeof(f)='object'
  and f->>'version'='cg-art-dct32-gradient-v1'
  and f->>'canonicalPixelSHA256' ~ '^[a-f0-9]{64}$' and f->>'pixelSHA256' ~ '^[a-f0-9]{64}$'
  and f->>'pHash' ~ '^[0-7][a-f0-9]{15}$' and f->>'dHash' ~ '^[a-f0-9]{32}$'
  and f->>'edgeHash' ~ '^[a-f0-9]{32}$',false) $$;
alter table profile_art_private.catalog_fingerprints add constraint profile_art_fingerprint_valid check(profile_art_private.valid_fingerprint(fingerprint));
create function profile_art_private.bump_catalog() returns trigger language plpgsql security definer
set search_path=pg_catalog,profile_art_private as $$ begin
  perform profile_art_private.lock_catalog();
  update profile_art_private.pipeline_settings set catalog_revision=catalog_revision+1 where singleton;
  if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger profile_art_fingerprint_revision before insert or update or delete on profile_art_private.catalog_fingerprints for each row execute function profile_art_private.bump_catalog();
-- Global catalogue lock comes before the existing per-artwork identity lock.
create trigger a_profile_art_catalog_revision before insert or update or delete on profile_art_private.artworks for each row execute function profile_art_private.bump_catalog();
create trigger profile_art_legacy_revision before insert or update or delete on profile_art_private.legacy_shared for each row execute function profile_art_private.bump_catalog();

create function profile_art_private.check_pipeline() returns void language plpgsql security invoker
set search_path=pg_catalog,profile_art_private as $$ begin
  if not coalesce((select enabled from profile_art_private.pipeline_settings where singleton),false) then
    raise exception using errcode='PT503',message='ART_PIPELINE_DISABLED';end if;
end $$;
create function public.profile_art_catalog_snapshot() returns jsonb language plpgsql security invoker
set search_path=pg_catalog,profile_art_private as $$ declare rev bigint;result jsonb;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  if (select count(*) from profile_art_private.catalog_fingerprints)>20000
    or exists(select 1 from profile_art_private.legacy_shared l where not exists(select 1 from profile_art_private.catalog_fingerprints f where f.reference_key='legacy_'||l.source_sha256 and f.source_sha256=l.source_sha256))
    or exists(select 1 from profile_art_private.artworks a where not exists(select 1 from profile_art_private.catalog_fingerprints f where f.reference_key='art_'||a.id::text and f.source_sha256=a.source_sha256))
    or exists(select 1 from profile_art_private.refill_jobs j where j.state='review' and not exists(select 1 from profile_art_private.catalog_fingerprints f where f.reference_key='job_'||j.id::text)) then
    raise exception using errcode='PT503',message='ART_CATALOG_INCOMPLETE';end if;
  select catalog_revision into rev from profile_art_private.pipeline_settings where singleton;
  select coalesce(jsonb_agg(jsonb_build_object('artworkID',reference_key,'fingerprint',fingerprint) order by reference_key),'[]'::jsonb) into result from profile_art_private.catalog_fingerprints;
  return jsonb_build_object('revision',rev,'comparisons',jsonb_build_object('scope','all-catalog-art','complete',true,'snapshotID','r_'||rev,'entries',result));
end $$;

-- Definer routines are private-schema, bounded, service-only entrypoints. The service
-- role cannot directly mutate the queue/settings/artwork catalogue or approve art.
create function profile_art_private.enqueue_refill(p_kind text,p_request uuid) returns jsonb language plpgsql security definer
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$
declare j profile_art_private.refill_jobs%rowtype; available_count integer;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  if p_kind is null or p_kind not in ('avatar','cover') or p_request is null then raise exception using errcode='PT400',message='ART_INVALID';end if;
  select * into j from profile_art_private.refill_jobs where request_key=p_request;
  if found then
    if j.kind<>p_kind then raise exception using errcode='PT409',message='ART_KEY_REUSED';end if;
    return jsonb_build_object('jobId',j.id,'state',j.state);end if;
  if (select count(*) from profile_art_private.refill_jobs)>=512
    or (select count(*) from profile_art_private.refill_jobs where state in ('queued','running','review'))>=16
    or (select count(*) from profile_art_private.refill_jobs where created_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=12 then
    raise exception using errcode='PT429',message='ART_REFILL_LIMIT';end if;
  select count(*) into available_count from profile_art_private.artworks a where a.kind=p_kind and a.state='ready'
    and not exists(select 1 from profile_art_private.claims c where c.artwork_id=a.id)
    and not exists(select 1 from profile_art_private.leases l where l.artwork_id=a.id and l.expires_at>clock_timestamp());
  if available_count+(select count(*) from profile_art_private.refill_jobs where kind=p_kind and state in ('queued','running','review'))>=8 then
    return jsonb_build_object('jobId',null,'state','sufficient');end if;
  insert into profile_art_private.refill_jobs(request_key,kind) values(p_request,p_kind) returning * into j;
  return jsonb_build_object('jobId',j.id,'state',j.state);
end $$;
create function public.profile_art_enqueue_refill(p_kind text,p_request uuid) returns jsonb language sql security invoker
set search_path=pg_catalog,profile_art_private as $$ select profile_art_private.enqueue_refill(p_kind,p_request) $$;

create function profile_art_private.claim_refill() returns jsonb language plpgsql security definer
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$ declare j profile_art_private.refill_jobs%rowtype;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  -- An interrupted provider request may have incurred cost. Never auto-repeat it.
  update profile_art_private.refill_jobs set state='failed',failure_code='interrupted',completed_at=clock_timestamp(),token=null,expires_at=null where state='running' and expires_at<=clock_timestamp();
  if exists(select 1 from profile_art_private.refill_jobs where state='running') then return null;end if;
  select * into j from profile_art_private.refill_jobs where state='queued' order by created_at,id limit 1 for update skip locked;
  if not found then return null;end if;
  update profile_art_private.refill_jobs set state='running',token=gen_random_uuid(),expires_at=clock_timestamp()+interval '90 seconds' where id=j.id returning * into j;
  return jsonb_build_object('id',j.id,'kind',j.kind,'mediaKey',j.media_key,'token',j.token,'expiresAt',j.expires_at);
end $$;
create function public.profile_art_claim_refill() returns jsonb language sql security invoker
set search_path=pg_catalog,profile_art_private as $$ select profile_art_private.claim_refill() $$;

create function profile_art_private.stage_candidate(p_job uuid,p_token uuid,p_revision bigint,p_candidate jsonb) returns jsonb language plpgsql security definer
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$ declare j profile_art_private.refill_jobs%rowtype;rev bigint;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  select * into j from profile_art_private.refill_jobs where id=p_job for update nowait;
  if not found or j.state<>'running' or j.token is distinct from p_token or j.expires_at<=clock_timestamp() then raise exception using errcode='PT409',message='ART_JOB_EXPIRED';end if;
  select catalog_revision into rev from profile_art_private.pipeline_settings where singleton;
  if p_revision is distinct from rev then raise exception using errcode='PT409',message='ART_CATALOG_CHANGED';end if;
  if not coalesce(jsonb_typeof(p_candidate)='object' and octet_length(p_candidate::text)<=2048
    and p_candidate->>'sourceSHA256' ~ '^[a-f0-9]{64}$' and p_candidate->>'byteSHA256' ~ '^[a-f0-9]{64}$'
    and p_candidate->>'verifiedSHA256'=p_candidate->>'byteSHA256'
    and jsonb_typeof(p_candidate->'byteLength')='number' and (p_candidate->>'byteLength')::int between 1 and case when j.kind='avatar' then 64000 else 180000 end
    and profile_art_private.valid_fingerprint(p_candidate->'fingerprint'),false) then raise exception using errcode='PT400',message='ART_INVALID_CANDIDATE';end if;
  if exists(select 1 from profile_art_private.legacy_shared where source_sha256=p_candidate->>'sourceSHA256') then raise exception using errcode='PT409',message='ART_LEGACY_SHARED';end if;
  if (select count(*) from profile_art_private.catalog_fingerprints)>=20000 then raise exception using errcode='PT503',message='ART_CATALOG_FULL';end if;
  insert into profile_art_private.catalog_fingerprints values('job_'||j.id::text,p_candidate->>'sourceSHA256',p_candidate->'fingerprint');
  update profile_art_private.refill_jobs set state='review',candidate=p_candidate,token=null,expires_at=null,completed_at=clock_timestamp() where id=j.id;
  return jsonb_build_object('jobId',j.id,'state','review','inventoryReady',false);
end $$;
create function public.profile_art_stage_candidate(p_job uuid,p_token uuid,p_revision bigint,p_candidate jsonb) returns jsonb language sql security invoker
set search_path=pg_catalog,profile_art_private as $$ select profile_art_private.stage_candidate(p_job,p_token,p_revision,p_candidate) $$;

create function profile_art_private.fail_refill(p_job uuid,p_token uuid,p_code text) returns void language plpgsql security definer
set search_path=pg_catalog,profile_art_private as $$ begin
  if p_code is null or p_code !~ '^[a-z_]{1,48}$' then raise exception using errcode='PT400',message='ART_INVALID';end if;
  update profile_art_private.refill_jobs set state='failed',failure_code=p_code,token=null,expires_at=null,completed_at=clock_timestamp() where id=p_job and state='running' and token=p_token;
end $$;
create function public.profile_art_fail_refill(p_job uuid,p_token uuid,p_code text) returns void language sql security invoker
set search_path=pg_catalog,profile_art_private as $$ select profile_art_private.fail_refill(p_job,p_token,p_code) $$;

create function profile_art_private.hash_distance(a text,b text) returns int language sql immutable
set search_path=pg_catalog as $$ select length(replace(((('x'||a)::bit(128)) # (('x'||b)::bit(128)))::text,'0','')) $$;
-- Maintenance-only release: independent human illustration-family/content review,
-- a fresh read-back hash and the exact current complete catalogue revision required.
-- No grant to service_role; neither provider nor worker may approve itself.
create function profile_art_private.approve_candidate(p_job uuid,p_revision bigint,p_family text,p_review text,p_verified_sha text) returns uuid language plpgsql security invoker
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$
declare j profile_art_private.refill_jobs%rowtype;f jsonb;ref record;pd integer;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  perform public.profile_art_catalog_snapshot();
  if p_revision is distinct from (select catalog_revision from profile_art_private.pipeline_settings where singleton) then raise exception using errcode='PT409',message='ART_CATALOG_CHANGED';end if;
  select * into j from profile_art_private.refill_jobs where id=p_job for update nowait;
  if not found or j.state<>'review' then raise exception using errcode='PT409',message='ART_NOT_REVIEWABLE';end if;
  if not coalesce(p_family ~ '^[a-f0-9]{64}$' and length(btrim(p_review)) between 12 and 512 and p_verified_sha=j.candidate->>'byteSHA256',false) then raise exception using errcode='PT400',message='ART_REVIEW_REQUIRED';end if;
  f:=j.candidate->'fingerprint';
  for ref in select fingerprint from profile_art_private.catalog_fingerprints where reference_key<>'job_'||j.id::text loop
    if f->>'canonicalPixelSHA256' in (ref.fingerprint->>'canonicalPixelSHA256',ref.fingerprint->>'pixelSHA256') or f->>'pixelSHA256' in (ref.fingerprint->>'canonicalPixelSHA256',ref.fingerprint->>'pixelSHA256') then
      raise exception using errcode='PT409',message='ART_DUPLICATE';end if;
    pd:=profile_art_private.hash_distance(f->>'pHash',ref.fingerprint->>'pHash');
    if least(pd,63-pd)<=8 and (profile_art_private.hash_distance(f->>'dHash',ref.fingerprint->>'dHash')<=24 or profile_art_private.hash_distance(f->>'edgeHash',ref.fingerprint->>'edgeHash')<=12) then
      raise exception using errcode='PT409',message='ART_SIMILAR';end if;
  end loop;
  insert into profile_art_private.artworks(id,kind,illustration_key,source_sha256,media_key,state,identity_review,identity_reviewed_at)
    values(j.id,j.kind,p_family,j.candidate->>'sourceSHA256',j.media_key,'ready',p_review,clock_timestamp());
  update profile_art_private.catalog_fingerprints set reference_key='art_'||j.id::text where reference_key='job_'||j.id::text;
  update profile_art_private.refill_jobs set state='approved' where id=j.id;
  return j.id;
exception when unique_violation then raise exception using errcode='PT409',message='ART_DUPLICATE';
end $$;

create function public.profile_art_read_descriptor(p_kind text,p_media uuid) returns jsonb language sql security invoker
set search_path=pg_catalog,profile_art_private as $$
  select jsonb_build_object('kind',a.kind,'mediaKey',a.media_key,'sha256',j.candidate->>'byteSHA256','byteLength',(j.candidate->>'byteLength')::integer,'revision',s.catalog_revision)
  from profile_art_private.artworks a join profile_art_private.refill_jobs j on j.id=a.id and j.media_key=a.media_key
  cross join profile_art_private.pipeline_settings s
  where s.singleton and s.reader_enabled and a.kind=p_kind and a.media_key=p_media and j.state='approved'
    and (a.state='ready' or (a.state='retired' and exists(select 1 from profile_art_private.claims c where c.artwork_id=a.id)))
$$;

revoke all on function profile_art_private.lock_catalog(),profile_art_private.valid_fingerprint(jsonb),profile_art_private.bump_catalog(),profile_art_private.check_pipeline(),profile_art_private.enqueue_refill(text,uuid),profile_art_private.claim_refill(),profile_art_private.stage_candidate(uuid,uuid,bigint,jsonb),profile_art_private.fail_refill(uuid,uuid,text),profile_art_private.hash_distance(text,text),profile_art_private.approve_candidate(uuid,bigint,text,text,text) from public,anon,authenticated,service_role;
grant execute on function profile_art_private.lock_catalog(),profile_art_private.check_pipeline(),profile_art_private.enqueue_refill(text,uuid),profile_art_private.claim_refill(),profile_art_private.stage_candidate(uuid,uuid,bigint,jsonb),profile_art_private.fail_refill(uuid,uuid,text) to service_role;
revoke all on function public.profile_art_catalog_snapshot(),public.profile_art_enqueue_refill(text,uuid),public.profile_art_claim_refill(),public.profile_art_stage_candidate(uuid,uuid,bigint,jsonb),public.profile_art_fail_refill(uuid,uuid,text),public.profile_art_read_descriptor(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.profile_art_catalog_snapshot(),public.profile_art_enqueue_refill(text,uuid),public.profile_art_claim_refill(),public.profile_art_stage_candidate(uuid,uuid,bigint,jsonb),public.profile_art_fail_refill(uuid,uuid,text),public.profile_art_read_descriptor(text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
