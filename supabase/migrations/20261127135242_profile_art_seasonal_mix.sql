begin;
-- Server dates, shared worldwide. Finite 2026 editions: no annual recurrence.
create table profile_art_private.seasonal_editions (
 id text primary key check(id in ('winter-2026','nikolaus-2026')),
 available_from timestamptz not null,
 refill_enabled boolean not null default false,
 available_until timestamptz not null check(available_until>available_from)
);
insert into profile_art_private.seasonal_editions(id,available_from,available_until) values
 ('winter-2026','2026-11-27 00:00:00 Europe/Berlin','2027-01-01 00:00:00 Europe/Berlin'),
 ('nikolaus-2026','2026-12-04 00:00:00 Europe/Berlin','2026-12-07 00:00:00 Europe/Berlin');
alter table profile_art_private.seasonal_editions enable row level security;
revoke all on profile_art_private.seasonal_editions from public,anon,authenticated,service_role;
grant select on profile_art_private.seasonal_editions to service_role;
alter table profile_art_private.artworks
 add column seasonal_edition text references profile_art_private.seasonal_editions(id),
 add column seasonal_slot smallint,
 add constraint art_seasonal_kind check(seasonal_edition is null or kind='avatar'),
 add constraint art_seasonal_slot check(coalesce(
  (seasonal_edition is null and seasonal_slot is null) or
  (seasonal_edition='winter-2026' and seasonal_slot is null) or
  (seasonal_edition='nikolaus-2026' and seasonal_slot is not null and seasonal_slot between 1 and 7),false)),
 add constraint art_seasonal_unique unique(seasonal_edition,seasonal_slot);
-- Slot 1: Nikolaus; 2-4: three distinct reindeer; 5-7: three distinct helpers.
-- Only winter can refill. Never ask the provider for additional holiday figures.
alter table profile_art_private.refill_jobs add column seasonal_edition text
 check(seasonal_edition is null or (seasonal_edition='winter-2026' and kind='avatar'))
 references profile_art_private.seasonal_editions(id);

create function profile_art_private.season_active(p_edition text,p_at timestamptz) returns boolean
 language sql stable security invoker set search_path=pg_catalog,profile_art_private as $$
 select p_edition is null or exists(select 1 from profile_art_private.seasonal_editions
 where id=p_edition and p_at>=available_from and p_at<available_until)
$$;
revoke all on function profile_art_private.season_active(text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function profile_art_private.season_active(text,timestamptz) to service_role;

-- Persist the generation brief on acceptance. No dependence on the worker clock.
create function profile_art_private.seasonal_art_identity() returns trigger language plpgsql security invoker
 set search_path=pg_catalog,profile_art_private as $$ begin
 if tg_op='INSERT' then
  new.seasonal_edition:=coalesce(new.seasonal_edition,(select seasonal_edition from profile_art_private.refill_jobs where id=new.id));
 elsif (new.seasonal_edition,new.seasonal_slot) is distinct from (old.seasonal_edition,old.seasonal_slot)
  and (old.seasonal_edition is not null or exists(select 1 from profile_art_private.claims where artwork_id=old.id)) then
  raise exception using errcode='PT409',message='ART_IDENTITY_IMMUTABLE';
 end if;
 return new;
end $$;
revoke all on function profile_art_private.seasonal_art_identity() from public,anon,authenticated,service_role;
create trigger profile_art_seasonal_identity before insert or update on profile_art_private.artworks
 for each row execute function profile_art_private.seasonal_art_identity();

-- Protect every existing lease/save client, including old versions and direct RPCs.
-- Owned art remains usable after the edition, subject to the existing deletion rules.
create function profile_art_private.guard_seasonal_use() returns trigger language plpgsql security invoker
 set search_path=pg_catalog,profile_art_private as $$ declare edition text; deadline timestamptz;begin
 select a.seasonal_edition,e.available_until into edition,deadline
 from profile_art_private.artworks a left join profile_art_private.seasonal_editions e on e.id=a.seasonal_edition where a.id=new.artwork_id;
 if edition is not null and not exists(select 1 from profile_art_private.claims where artwork_id=new.artwork_id and user_id=new.user_id) then
  if not profile_art_private.season_active(edition,clock_timestamp()) then
   raise exception using errcode='PT409',message='ART_UNAVAILABLE';
  end if;
  if tg_table_name='leases' then new.expires_at:=least(new.expires_at,deadline);end if;
 end if;
 return new;
end $$;
revoke all on function profile_art_private.guard_seasonal_use() from public,anon,authenticated,service_role;
create trigger profile_art_seasonal_lease before insert or update on profile_art_private.leases
 for each row execute function profile_art_private.guard_seasonal_use();
create trigger profile_art_seasonal_claim before insert on profile_art_private.claims
 for each row execute function profile_art_private.guard_seasonal_use();


create or replace function public.profile_art_choices_v2(p_user text,p_kind text) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,profile_art_private as $$ declare result jsonb; stamp timestamptz:=clock_timestamp();begin
 perform profile_art_private.check_enabled(p_user,p_kind);
 with eligible as (
  select a.* from profile_art_private.artworks a where a.kind=p_kind and a.state='ready'
   and (p_kind='cover' or a.presentation is not null)
   and profile_art_private.season_active(a.seasonal_edition,stamp)
   and not exists(select 1 from profile_art_private.claims c where c.artwork_id=a.id)
   and not exists(select 1 from profile_art_private.leases l where l.artwork_id=a.id and l.expires_at>stamp)
 ), regular_ranked as (
  select e.*,row_number() over(partition by presentation order by id) presentation_rank from eligible e where seasonal_edition is null
 ), regular as (
  select r.*,row_number() over(order by presentation_rank,presentation,id) rn from regular_ranked r
  where presentation_rank<=case when p_kind='avatar' then 4 else 12 end
 ), seasonal as (
  select e.*,row_number() over(order by
   case when seasonal_edition='nikolaus-2026' and seasonal_slot=1 then 0 when seasonal_edition='nikolaus-2026' then 1 else 2 end,
   md5(p_user||':'||(stamp at time zone 'Europe/Berlin')::date::text||':'||id::text),id) rn
  from eligible e where seasonal_edition is not null
 ), quota as (
  -- Never a seasonal-only catalogue, including temporary ordinary-stock shortages.
  select least(3,(select count(*) from regular)/3,(select count(*) from seasonal))::int n
 ), mixed as (
  select id,kind,media_key,presentation,rn+(rn-1)/3 position from regular
   where rn<=12-(select n from quota)
  union all
  select id,kind,media_key,presentation,rn*4 position from seasonal where rn<=(select n from quota)
 )
 select jsonb_build_object(
  'revision',coalesce((select revision from profile_art_private.slots where user_id=p_user and kind=p_kind),0),
  'available',coalesce((select jsonb_agg(jsonb_build_object('artworkId',id,'kind',kind,'mediaKey',media_key,'presentation',presentation) order by position,id) from mixed),'[]'::jsonb),
  'selected',(select jsonb_build_object('artworkId',a.id,'kind',a.kind,'mediaKey',a.media_key,'presentation',a.presentation)
   from profile_art_private.slots s join profile_art_private.artworks a on a.id=s.selected_artwork_id where s.user_id=p_user and s.kind=p_kind),
  'lease',(select jsonb_build_object('artworkId',l.artwork_id,'token',l.token,'expiresAt',l.expires_at,'kind',l.kind,'mediaKey',a.media_key,'presentation',a.presentation)
   from profile_art_private.leases l join profile_art_private.artworks a on a.id=l.artwork_id
   where l.user_id=p_user and l.kind=p_kind and l.expires_at>stamp and a.state='ready')
 ) into result;return result;
end $$;
create or replace function public.profile_art_choices(p_user text,p_kind text) returns jsonb language sql security invoker
 set search_path=pg_catalog,public as $$ select public.profile_art_choices_v2(p_user,p_kind) $$;

create or replace function profile_art_private.enqueue_refill(p_kind text,p_request uuid) returns jsonb language plpgsql security definer
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$
declare j profile_art_private.refill_jobs%rowtype; available_count integer; chosen text; target_count integer; edition text;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  if p_kind is null or p_kind not in ('avatar','cover') or p_request is null then raise exception using errcode='PT400',message='ART_INVALID';end if;
  select * into j from profile_art_private.refill_jobs where request_key=p_request;
  if found then
    if j.kind<>p_kind then raise exception using errcode='PT409',message='ART_KEY_REUSED';end if;
    return jsonb_build_object('jobId',j.id,'state',j.state);end if;
  if p_kind='avatar' and (select refill_enabled from profile_art_private.seasonal_editions where id='winter-2026')
   and profile_art_private.season_active('winter-2026',clock_timestamp())
   and (select count(*) from profile_art_private.artworks a where seasonal_edition='winter-2026' and state='ready'
    and not exists(select 1 from profile_art_private.claims c where c.artwork_id=a.id))
    +(select count(*) from profile_art_private.refill_jobs where seasonal_edition='winter-2026' and state in ('queued','running','review'))<3 then
    edition:='winter-2026';chosen:='neutral';target_count:=3;
  elsif p_kind='avatar' then
    select g into chosen from unnest(array['feminine','masculine','neutral']) g
    order by (select count(*) from profile_art_private.artworks a where a.kind='avatar' and a.presentation=g and a.state='ready' and a.seasonal_edition is null
      and not exists(select 1 from profile_art_private.claims c where c.artwork_id=a.id))
      +(select count(*) from profile_art_private.refill_jobs q where q.kind='avatar' and q.presentation=g and q.seasonal_edition is null and q.state in ('queued','running','review')),g limit 1;
    target_count:=6;
  else target_count:=18;end if;
  select count(*) into available_count from profile_art_private.artworks a where a.kind=p_kind and a.state='ready' and a.seasonal_edition is not distinct from edition
    and (p_kind='cover' or a.presentation=chosen)
    and not exists(select 1 from profile_art_private.claims c where c.artwork_id=a.id);
  -- Short, unconfirmed leases do not incur paid replacements. Only ownership consumes stock.
  if available_count+(select count(*) from profile_art_private.refill_jobs where kind=p_kind and seasonal_edition is not distinct from edition
    and (p_kind='cover' or presentation=chosen) and state in ('queued','running','review'))>=target_count then
    return jsonb_build_object('jobId',null,'state','sufficient');end if;
  if (select count(*) from profile_art_private.refill_jobs where state in ('queued','running','review'))>=36
    or (select count(*) from profile_art_private.refill_jobs where created_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=64 then
    raise exception using errcode='PT429',message='ART_REFILL_LIMIT';end if;
  insert into profile_art_private.refill_jobs(request_key,kind,presentation,seasonal_edition) values(p_request,p_kind,chosen,edition) returning * into j;
  return jsonb_build_object('jobId',j.id,'state',j.state);
end $$;
create or replace function profile_art_private.refill_after_claim() returns trigger language plpgsql security definer
set search_path=pg_catalog,profile_art_private as $$ begin
  if exists(select 1 from profile_art_private.artworks where id=new.artwork_id and seasonal_edition='nikolaus-2026') then return new;end if;
  begin perform profile_art_private.enqueue_refill(new.kind,gen_random_uuid());
  exception when sqlstate 'PT429' or sqlstate 'PT409' or sqlstate 'PT503' then null;end;
  return new;
end $$;
create or replace function profile_art_private.batch_descriptor(j profile_art_private.refill_jobs) returns jsonb language sql immutable
set search_path=pg_catalog as $$ select jsonb_build_object('id',j.id,'kind',j.kind,'presentation',j.presentation,'seasonalEdition',j.seasonal_edition,'mediaKey',j.media_key,
  'token',j.batch_token,'expiresAt',j.batch_started_at+interval '3 minutes','state',j.batch_state,
  'inputFileId',j.batch_input_file,'batchId',j.batch_provider_id,'outputFileId',j.batch_output_file,'errorFileId',j.batch_error_file,'payloadSHA',j.batch_payload_sha) $$;
create or replace function profile_art_private.batch_command(p_action text,p_job uuid,p_token uuid,p_value jsonb) returns jsonb language plpgsql security definer
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$
declare j profile_art_private.refill_jobs%rowtype;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  if p_action='begin' then
    -- Never submit an expired winter job. Existing submitted batches are reconciled,
    -- not repeated; late results remain outside new selection by their edition.
    update profile_art_private.refill_jobs set state='failed',failure_code='season_ended',completed_at=clock_timestamp()
     where state='queued' and batch_state is null and seasonal_edition is not null
     and not profile_art_private.season_active(seasonal_edition,clock_timestamp());
    -- Six outstanding single-image batches bound memory/transfer on collection.
    -- Every image gets the Batch price, independently of input-file length.
    if (select count(*) from profile_art_private.refill_jobs where batch_state in ('submitting','submitted','unknown','ready'))>=6 then return null;end if;
    select * into j from profile_art_private.refill_jobs where state='queued' and batch_state is null order by created_at,id limit 1 for update skip locked;
    if not found then return null;end if;
    update profile_art_private.refill_jobs set batch_state='submitting',batch_token=gen_random_uuid(),batch_started_at=clock_timestamp(),batch_next_poll_at=clock_timestamp()+interval '15 minutes' where id=j.id returning * into j;
  elsif p_action='poll' then
    select * into j from profile_art_private.refill_jobs where state='queued' and batch_state in ('submitting','submitted','unknown') and batch_next_poll_at<=clock_timestamp() order by batch_next_poll_at,id limit 1 for update skip locked;
    if not found then return null;end if;
    update profile_art_private.refill_jobs set batch_state=case when batch_state='submitting' then 'unknown' else batch_state end,batch_next_poll_at=clock_timestamp()+interval '15 minutes' where id=j.id returning * into j;
  elsif p_action='cleanup' then
    select * into j from profile_art_private.refill_jobs where state in ('approved','rejected','failed','review') and batch_state in ('consumed','failed') and not batch_cleaned
      and batch_next_poll_at<=clock_timestamp() order by batch_next_poll_at,id limit 1 for update skip locked;
    if not found then return null;end if;
    update profile_art_private.refill_jobs set batch_next_poll_at=clock_timestamp()+interval '15 minutes' where id=j.id returning * into j;
  else
    select * into j from profile_art_private.refill_jobs where id=p_job for update nowait;
    if not found or p_token is null or j.batch_token is distinct from p_token then raise exception using errcode='PT409',message='ART_BATCH_STALE';end if;
    if jsonb_typeof(p_value) is distinct from 'object' or octet_length(p_value::text)>2048 then raise exception using errcode='PT400',message='ART_BATCH_INVALID';end if;
    if p_action='input' and j.state='queued' and j.batch_state='submitting' then
      if not coalesce(p_value->>'fileId' ~ '^file[-_][A-Za-z0-9_-]{1,120}$' and p_value->>'sha' ~ '^[a-f0-9]{64}$',false)
        or (j.batch_input_file is not null and (j.batch_input_file is distinct from p_value->>'fileId' or j.batch_payload_sha is distinct from p_value->>'sha')) then raise exception using errcode='PT400',message='ART_BATCH_INVALID';end if;
      update profile_art_private.refill_jobs set batch_input_file=p_value->>'fileId',batch_payload_sha=p_value->>'sha' where id=j.id returning * into j;
    elsif p_action='submitted' and j.state='queued' and j.batch_state in ('submitting','unknown','submitted') then
      if j.batch_input_file is null or j.batch_payload_sha is null or not coalesce(p_value->>'batchId' ~ '^batch_[A-Za-z0-9_-]{1,120}$',false)
        or (j.batch_provider_id is not null and j.batch_provider_id is distinct from p_value->>'batchId') then raise exception using errcode='PT400',message='ART_BATCH_INVALID';end if;
      update profile_art_private.refill_jobs set batch_state='submitted',batch_provider_id=p_value->>'batchId',batch_next_poll_at=clock_timestamp()+interval '15 minutes' where id=j.id returning * into j;
    elsif p_action='terminal' and j.state='queued' and j.batch_state='submitted' then
      if coalesce(p_value->>'status','') not in ('completed','failed','expired','cancelled')
        or (p_value->>'outputFileId' is not null and p_value->>'outputFileId' !~ '^file[-_][A-Za-z0-9_-]{1,120}$')
        or (p_value->>'errorFileId' is not null and p_value->>'errorFileId' !~ '^file[-_][A-Za-z0-9_-]{1,120}$') then raise exception using errcode='PT400',message='ART_BATCH_INVALID';end if;
      update profile_art_private.refill_jobs set batch_output_file=p_value->>'outputFileId',batch_error_file=p_value->>'errorFileId',
        batch_state=case when p_value->>'outputFileId' is null then 'failed' else 'ready' end,
        state=case when p_value->>'outputFileId' is null then 'failed' else 'queued' end,
        failure_code=case when p_value->>'outputFileId' is null then 'batch_no_result' else null end,
        completed_at=case when p_value->>'outputFileId' is null then clock_timestamp() else null end,batch_next_poll_at=clock_timestamp()
        where id=j.id returning * into j;
    elsif p_action='cleaned' and j.state in ('approved','rejected','failed','review') and j.batch_state in ('consumed','failed') then
      update profile_art_private.refill_jobs set batch_cleaned=true where id=j.id returning * into j;
    else raise exception using errcode='PT409',message='ART_BATCH_STALE';end if;
  end if;
  return profile_art_private.batch_descriptor(j);
end $$;
create or replace function profile_art_private.claim_refill_v3() returns jsonb language plpgsql security definer
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$ declare j profile_art_private.refill_jobs%rowtype;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  update profile_art_private.refill_jobs set state='failed',failure_code='interrupted',completed_at=clock_timestamp(),token=null,expires_at=null where state='running' and expires_at<=clock_timestamp();
  update profile_art_private.refill_jobs set state='failed',batch_state='failed',failure_code='season_ended',completed_at=clock_timestamp(),batch_next_poll_at=clock_timestamp()
   where state='queued' and batch_state='ready' and seasonal_edition is not null
   and not profile_art_private.season_active(seasonal_edition,clock_timestamp());
  if exists(select 1 from profile_art_private.refill_jobs where state='running') then return null;end if;
  select * into j from profile_art_private.refill_jobs where state='queued' and batch_state='ready' order by created_at,id limit 1 for update skip locked;
  if not found then return null;end if;
  update profile_art_private.refill_jobs set state='running',token=gen_random_uuid(),expires_at=clock_timestamp()+interval '150 seconds',batch_state='consumed',batch_next_poll_at=clock_timestamp() where id=j.id returning * into j;
  return jsonb_build_object('id',j.id,'kind',j.kind,'presentation',j.presentation,'seasonalEdition',j.seasonal_edition,'mediaKey',j.media_key,'token',j.token,'expiresAt',j.expires_at,'outputFileId',j.batch_output_file,'generationSHA',j.batch_payload_sha);
end $$;

-- Existing function grants retained by CREATE OR REPLACE. No catalogue seed,
-- provider call, new cron, feature activation or profile update in this migration.
notify pgrst,'reload schema';
commit;
