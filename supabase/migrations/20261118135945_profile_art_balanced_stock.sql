begin;
-- Presentation describes optional artwork, never the member's gender or pronouns.
alter table profile_art_private.artworks add column presentation text check(presentation in ('feminine','masculine','neutral'));
alter table profile_art_private.artworks add constraint art_presentation_kind check(kind='avatar' or presentation is null);
alter table profile_art_private.refill_jobs add column vision_review jsonb check(vision_review is null or octet_length(vision_review::text)<=2048);
alter table profile_art_private.refill_jobs add column presentation text check(presentation in ('feminine','masculine','neutral'));
alter table profile_art_private.pipeline_settings add column automatic_review_enabled boolean not null default false;
-- 12 choices plus a six-image reserve. Avatars: four shown + two spare per group.
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
    or (select count(*) from profile_art_private.refill_jobs where created_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=48 then
    raise exception using errcode='PT429',message='ART_REFILL_LIMIT';end if;
  insert into profile_art_private.refill_jobs(request_key,kind,presentation) values(p_request,p_kind,chosen) returning * into j;
  return jsonb_build_object('jobId',j.id,'state',j.state);
end $$;

-- A claim durably requests its replacement in the SAME transaction. Quota/busy
-- failures may defer generation but must not undo a successful profile save.
create function profile_art_private.refill_after_claim() returns trigger language plpgsql security definer
set search_path=pg_catalog,profile_art_private as $$ begin
  begin perform profile_art_private.enqueue_refill(new.kind,gen_random_uuid());
  exception when sqlstate 'PT429' or sqlstate 'PT409' or sqlstate 'PT503' then null;end;
  return new;
end $$;
revoke all on function profile_art_private.refill_after_claim() from public,anon,authenticated,service_role;
create trigger profile_art_claim_refill after insert on profile_art_private.claims for each row execute function profile_art_private.refill_after_claim();
create function profile_art_private.claim_refill_v2() returns jsonb language plpgsql security definer
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$ declare j profile_art_private.refill_jobs%rowtype;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  -- An interrupted provider request may have incurred cost. Never auto-repeat it.
  update profile_art_private.refill_jobs set state='failed',failure_code='interrupted',completed_at=clock_timestamp(),token=null,expires_at=null where state='running' and expires_at<=clock_timestamp();
  if exists(select 1 from profile_art_private.refill_jobs where state='running') then return null;end if;
  select * into j from profile_art_private.refill_jobs where state='queued' order by created_at,id limit 1 for update skip locked;
  if not found then return null;end if;
  update profile_art_private.refill_jobs set state='running',token=gen_random_uuid(),expires_at=clock_timestamp()+interval '150 seconds' where id=j.id returning * into j;
  return jsonb_build_object('id',j.id,'kind',j.kind,'presentation',j.presentation,'mediaKey',j.media_key,'token',j.token,'expiresAt',j.expires_at);
end $$;

-- Old deployed workers must not generate the retired style during rollout.
create or replace function public.profile_art_claim_refill() returns jsonb language sql security invoker set search_path=pg_catalog as $$ select null::jsonb $$;
create function public.profile_art_claim_refill_v2() returns jsonb language sql security invoker set search_path=pg_catalog,profile_art_private as $$ select profile_art_private.claim_refill_v2() $$;
revoke all on function profile_art_private.claim_refill_v2(),public.profile_art_claim_refill_v2() from public,anon,authenticated,service_role;
grant execute on function profile_art_private.claim_refill_v2(),public.profile_art_claim_refill_v2() to service_role;

-- A separate vision review may release only fixed-policy platform art. It has no
-- user prompts, user photos or profile permissions. Old maintenance review remains private.
create function profile_art_private.complete_review(p_job uuid,p_review jsonb,p_verified_sha text) returns jsonb language plpgsql security definer
set search_path=pg_catalog,profile_art_private set lock_timeout='500ms' as $$
declare j profile_art_private.refill_jobs%rowtype; art uuid; family text;begin
  perform profile_art_private.check_pipeline();perform profile_art_private.lock_catalog();
  select * into j from profile_art_private.refill_jobs where id=p_job for update nowait;
  if not found or j.state<>'review' or p_verified_sha is distinct from j.candidate->>'byteSHA256' then raise exception using errcode='PT409',message='ART_NOT_REVIEWABLE';end if;
  if jsonb_typeof(p_review) is distinct from 'object' or p_review->>'policy' is distinct from 'cg-silhouette-nature-v1'
    or p_review->>'model' is distinct from 'gpt-5.4-mini'
    or jsonb_typeof(p_review->'accepted') is distinct from 'boolean'
    or length(coalesce(p_review->>'description','')) not between 12 and 400
    or (j.kind='avatar' and (j.presentation is null or j.presentation not in ('feminine','masculine','neutral'))) then
    raise exception using errcode='PT400',message='ART_REVIEW_REQUIRED';end if;
  update profile_art_private.refill_jobs set vision_review=p_review where id=j.id;
  if not (p_review->>'accepted')::boolean then
    update profile_art_private.refill_jobs set state='rejected',failure_code='style_review_rejected' where id=j.id;
    return jsonb_build_object('status','rejected','inventoryReady',false);end if;
  if not (select automatic_review_enabled from profile_art_private.pipeline_settings where singleton) then
    return jsonb_build_object('status','review','inventoryReady',false);end if;
  family:=encode(sha256(convert_to(lower(regexp_replace(btrim(p_review->>'description'),'\s+',' ','g')),'UTF8')),'hex');
  art:=profile_art_private.approve_candidate(j.id,(select catalog_revision from profile_art_private.pipeline_settings where singleton),family,
    'Automated independent vision review: '||(p_review->>'description'),p_verified_sha);
  update profile_art_private.artworks set presentation=j.presentation where id=art;
  return jsonb_build_object('status','ready','jobId',j.id,'inventoryReady',true);
end $$;
create function public.profile_art_complete_review(p_job uuid,p_review jsonb,p_verified_sha text) returns jsonb language sql security invoker
set search_path=pg_catalog,profile_art_private as $$ select profile_art_private.complete_review(p_job,p_review,p_verified_sha) $$;
revoke all on function profile_art_private.complete_review(uuid,jsonb,text),public.profile_art_complete_review(uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function profile_art_private.complete_review(uuid,jsonb,text),public.profile_art_complete_review(uuid,jsonb,text) to service_role;

-- Stable, interleaved 4+4+4 assortment; surplus ready art stays available as reserve.
create function public.profile_art_choices_v2(p_user text,p_kind text) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,profile_art_private as $$ declare result jsonb; stamp timestamptz:=clock_timestamp();begin
  perform profile_art_private.check_enabled(p_user,p_kind);
  select jsonb_build_object(
    'revision',coalesce((select revision from profile_art_private.slots where user_id=p_user and kind=p_kind),0),
    'available',coalesce((select jsonb_agg(item order by rank,presentation,id) from (
      select id,presentation,rank,jsonb_build_object('artworkId',id,'kind',kind,'mediaKey',media_key,'presentation',presentation) item from (
        select a.*,row_number() over(partition by a.presentation order by a.id) rank
        from profile_art_private.artworks a where a.kind=p_kind and a.state='ready'
          and (p_kind='cover' or a.presentation is not null)
          and not exists(select 1 from profile_art_private.claims c where c.artwork_id=a.id)
          and not exists(select 1 from profile_art_private.leases l where l.artwork_id=a.id and l.expires_at>stamp)
      ) ranked where rank<=case when p_kind='avatar' then 4 else 12 end
    ) available),'[]'::jsonb),
    'selected',(select jsonb_build_object('artworkId',a.id,'kind',a.kind,'mediaKey',a.media_key,'presentation',a.presentation)
      from profile_art_private.slots s join profile_art_private.artworks a on a.id=s.selected_artwork_id where s.user_id=p_user and s.kind=p_kind),
    'lease',(select jsonb_build_object('artworkId',l.artwork_id,'token',l.token,'expiresAt',l.expires_at,'kind',l.kind,'mediaKey',a.media_key,'presentation',a.presentation)
      from profile_art_private.leases l join profile_art_private.artworks a on a.id=l.artwork_id
      where l.user_id=p_user and l.kind=p_kind and l.expires_at>stamp and a.state='ready')
  ) into result;return result;
end $$;
revoke all on function public.profile_art_choices_v2(text,text) from public,anon,authenticated,service_role;
grant execute on function public.profile_art_choices_v2(text,text) to service_role;
notify pgrst,'reload schema';
commit;
