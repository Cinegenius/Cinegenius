begin;
-- A full initial 36-image reserve also needs room for reviewed/rejected attempts
-- and the existing seed journal. Keep a finite daily budget; never bypass quality.
create or replace function profile_art_private.enqueue_refill(p_kind text,p_request uuid) returns jsonb language plpgsql security definer
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$
declare j profile_art_private.refill_jobs%rowtype; available_count integer; chosen text; target_count integer;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  if p_kind is null or p_kind not in ('avatar','cover') or p_request is null then raise exception using errcode='PT400',message='ART_INVALID';end if;
  select * into j from profile_art_private.refill_jobs where request_key=p_request;
  if found then
    if j.kind<>p_kind then raise exception using errcode='PT409',message='ART_KEY_REUSED';end if;
    return jsonb_build_object('jobId',j.id,'state',j.state);end if;
  if p_kind='avatar' then
    select g into chosen from unnest(array['feminine','masculine','neutral']) g
    order by (select count(*) from profile_art_private.artworks a where a.kind='avatar' and a.presentation=g and a.state='ready'
      and not exists(select 1 from profile_art_private.claims c where c.artwork_id=a.id))
      +(select count(*) from profile_art_private.refill_jobs q where q.kind='avatar' and q.presentation=g and q.state in ('queued','running','review')),g limit 1;
    target_count:=6;
  else target_count:=18;end if;
  select count(*) into available_count from profile_art_private.artworks a where a.kind=p_kind and a.state='ready'
    and (p_kind='cover' or a.presentation=chosen)
    and not exists(select 1 from profile_art_private.claims c where c.artwork_id=a.id);
  -- Short, unconfirmed leases do not incur paid replacements. Only ownership consumes stock.
  if available_count+(select count(*) from profile_art_private.refill_jobs where kind=p_kind
    and (p_kind='cover' or presentation=chosen) and state in ('queued','running','review'))>=target_count then
    return jsonb_build_object('jobId',null,'state','sufficient');end if;
  if (select count(*) from profile_art_private.refill_jobs where state in ('queued','running','review'))>=36
    or (select count(*) from profile_art_private.refill_jobs where created_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=64 then
    raise exception using errcode='PT429',message='ART_REFILL_LIMIT';end if;
  insert into profile_art_private.refill_jobs(request_key,kind,presentation) values(p_request,p_kind,chosen) returning * into j;
  return jsonb_build_object('jobId',j.id,'state',j.state);
end $$;
notify pgrst,'reload schema';
commit;
