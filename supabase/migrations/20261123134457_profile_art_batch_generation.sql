begin;
-- Keep pending jobs in the existing queue/budget. No stock, ownership or settings
-- are changed. Old synchronous workers stop claiming after this migration.
alter table profile_art_private.refill_jobs
  add column batch_state text check(batch_state in ('submitting','submitted','unknown','ready','consumed','failed')),
  add column batch_token uuid,
  add column batch_started_at timestamptz,
  add column batch_next_poll_at timestamptz,
  add column batch_input_file text check(batch_input_file ~ '^file[-_][A-Za-z0-9_-]{1,120}$'),
  add column batch_provider_id text unique check(batch_provider_id ~ '^batch_[A-Za-z0-9_-]{1,120}$'),
  add column batch_output_file text check(batch_output_file ~ '^file[-_][A-Za-z0-9_-]{1,120}$'),
  add column batch_error_file text check(batch_error_file ~ '^file[-_][A-Za-z0-9_-]{1,120}$'),
  add column batch_payload_sha text check(batch_payload_sha ~ '^[a-f0-9]{64}$'),
  add column batch_cleaned boolean not null default false;
create index profile_art_batch_pending on profile_art_private.refill_jobs(batch_state,batch_next_poll_at) where batch_state is not null;

create function profile_art_private.batch_descriptor(j profile_art_private.refill_jobs) returns jsonb language sql immutable
set search_path=pg_catalog as $$ select jsonb_build_object('id',j.id,'kind',j.kind,'presentation',j.presentation,'mediaKey',j.media_key,
  'token',j.batch_token,'expiresAt',j.batch_started_at+interval '3 minutes','state',j.batch_state,
  'inputFileId',j.batch_input_file,'batchId',j.batch_provider_id,'outputFileId',j.batch_output_file,'errorFileId',j.batch_error_file,'payloadSHA',j.batch_payload_sha) $$;

create function profile_art_private.batch_command(p_action text,p_job uuid,p_token uuid,p_value jsonb) returns jsonb language plpgsql security definer
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$
declare j profile_art_private.refill_jobs%rowtype;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  if p_action='begin' then
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
create function public.profile_art_batch_command(p_action text,p_job uuid default null,p_token uuid default null,p_value jsonb default '{}'::jsonb) returns jsonb language sql security invoker
set search_path=pg_catalog,profile_art_private as $$ select profile_art_private.batch_command(p_action,p_job,p_token,p_value) $$;
revoke all on function profile_art_private.batch_descriptor(profile_art_private.refill_jobs),profile_art_private.batch_command(text,uuid,uuid,jsonb),public.profile_art_batch_command(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function profile_art_private.batch_command(text,uuid,uuid,jsonb),public.profile_art_batch_command(text,uuid,uuid,jsonb) to service_role;

create or replace function profile_art_private.claim_refill() returns jsonb language sql security invoker set search_path=pg_catalog as $$ select null::jsonb $$;
create or replace function profile_art_private.claim_refill_v2() returns jsonb language sql security invoker set search_path=pg_catalog as $$ select null::jsonb $$;
create function profile_art_private.claim_refill_v3() returns jsonb language plpgsql security definer
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$ declare j profile_art_private.refill_jobs%rowtype;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  update profile_art_private.refill_jobs set state='failed',failure_code='interrupted',completed_at=clock_timestamp(),token=null,expires_at=null where state='running' and expires_at<=clock_timestamp();
  if exists(select 1 from profile_art_private.refill_jobs where state='running') then return null;end if;
  select * into j from profile_art_private.refill_jobs where state='queued' and batch_state='ready' order by created_at,id limit 1 for update skip locked;
  if not found then return null;end if;
  update profile_art_private.refill_jobs set state='running',token=gen_random_uuid(),expires_at=clock_timestamp()+interval '150 seconds',batch_state='consumed',batch_next_poll_at=clock_timestamp() where id=j.id returning * into j;
  return jsonb_build_object('id',j.id,'kind',j.kind,'presentation',j.presentation,'mediaKey',j.media_key,'token',j.token,'expiresAt',j.expires_at,'outputFileId',j.batch_output_file,'generationSHA',j.batch_payload_sha);
end $$;
create function public.profile_art_claim_refill_v3() returns jsonb language sql security invoker set search_path=pg_catalog,profile_art_private as $$ select profile_art_private.claim_refill_v3() $$;
revoke all on function profile_art_private.claim_refill_v3(),public.profile_art_claim_refill_v3() from public,anon,authenticated,service_role;
grant execute on function profile_art_private.claim_refill_v3(),public.profile_art_claim_refill_v3() to service_role;
notify pgrst,'reload schema';
commit;
