begin;
-- Tombstones retain the duplicate/ownership history; never recycle a deleted motif.
alter table profile_art_private.artworks add column deleted_at timestamptz;
alter table profile_art_private.artworks add constraint deleted_art_quarantined check(deleted_at is null or state='quarantine');
create function profile_art_private.guard_art_deletion() returns trigger language plpgsql security invoker
set search_path=pg_catalog,profile_art_private as $$ begin
  if old.deleted_at is not null and (new.deleted_at is distinct from old.deleted_at or new.state<>'quarantine') then
    raise exception using errcode='PT409',message='ART_PERMANENTLY_DELETED';end if;
  return new;
end $$;
revoke all on function profile_art_private.guard_art_deletion() from public,anon,authenticated,service_role;
create trigger profile_art_permanent_deletion before update on profile_art_private.artworks for each row execute function profile_art_private.guard_art_deletion();
create function public.profile_art_save_profile_v2(p_user text,p_payload jsonb,p_choices jsonb,p_expected timestamptz,p_request uuid,p_create boolean,p_deletions jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,profile_art_private set lock_timeout='500ms' as $$
declare current_profile public.profiles%rowtype; saved public.profiles%rowtype;
  journal profile_art_private.profile_saves%rowtype; fingerprint text; exists_profile boolean;
  item jsonb; removed_art uuid; removed_media uuid; k text; media uuid; receipt jsonb; cols text; vals text; assignments text;
  allowed text[] := array[
    'display_name','display_name_alias','slug','phone','contact_email','location','bio','pronouns','show_pronouns',
    'available','available_from','travel_ready','avatar_url','cover_image_url','portfolio_url','website_url',
    'skills','memberships','positions','languages','portfolio_images','profile_images','experience','reel_url','imdb_url',
    'instagram_url','tiktok_url','youtube_url','vimeo_url','linkedin_url','day_rate','filmography','video_links',
    'availability_config','profile_types','profile_type','modules','physical','performance','model_measurements','casting',
    'crew','creative','vendor','focal_point','tagline','profile_layout','account_type',
    'place_country_code','place_region_id','place_city_id','place_city_name','place_region_name','place_status','place_original'];
begin
  perform profile_art_private.check_enabled(p_user,'avatar');
  if p_request is null or p_create is null or jsonb_typeof(p_payload) is distinct from 'object'
    or jsonb_typeof(p_choices) is distinct from 'array' or jsonb_array_length(p_choices) not between 0 and 2
    or jsonb_typeof(p_deletions) is distinct from 'array' or jsonb_array_length(p_deletions) not between 0 and 2
    or jsonb_array_length(p_choices)+jsonb_array_length(p_deletions)=0 then
    raise exception using errcode='PT400',message='ART_INVALID'; end if;
  p_payload := p_payload-'user_id'-'updated_at';
  if exists(select 1 from jsonb_object_keys(p_payload) key where not key=any(allowed))
    or (p_payload ? 'account_type' and (not p_create or p_payload->>'account_type' is distinct from 'person')) then
    raise exception using errcode='PT400',message='ART_INVALID'; end if;
  if (select count(distinct value->>'kind') from jsonb_array_elements(p_choices))<>jsonb_array_length(p_choices) then
    raise exception using errcode='PT400',message='ART_INVALID'; end if;
  fingerprint := md5(jsonb_build_object('payload',p_payload,'choices',p_choices,'expected',p_expected,'create',p_create,'deletions',p_deletions)::text);
  perform profile_art_private.lock_account(p_user);
  select * into current_profile from public.profiles where user_id=p_user for update nowait;
  exists_profile := found;
  select * into journal from profile_art_private.profile_saves where user_id=p_user and request_key=p_request;
  if found then
    if journal.input_hash<>fingerprint then raise exception using errcode='PT409',message='ART_KEY_REUSED'; end if;
    if not exists_profile or current_profile.updated_at is distinct from journal.saved_at then
      raise exception using errcode='PT409',message='ART_STALE_RETRY'; end if;
    return to_jsonb(current_profile);
  end if;
  if (exists_profile and (p_expected is null or current_profile.updated_at is distinct from p_expected))
    or (not exists_profile and (p_expected is not null or not p_create)) then
    raise exception using errcode='PT409',message='ART_PROFILE_CHANGED'; end if;
  if (select count(distinct value->>'kind') from jsonb_array_elements(p_deletions))<>jsonb_array_length(p_deletions) then
    raise exception using errcode='PT400',message='ART_INVALID';end if;
  for item in select value from jsonb_array_elements(p_deletions) loop
    k:=item->>'kind';
    if jsonb_typeof(item) is distinct from 'object' or k is null or k not in ('avatar','cover')
      or exists(select 1 from jsonb_object_keys(item) key where key not in ('kind','mediaKey'))
      or coalesce(item->>'mediaKey','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode='PT400',message='ART_INVALID';end if;
    removed_media:=(item->>'mediaKey')::uuid;
    select a.id into removed_art from profile_art_private.artworks a join profile_art_private.claims c on c.artwork_id=a.id
      where c.user_id=p_user and a.kind=k and a.media_key=removed_media and a.deleted_at is null;
    if removed_art is null then raise exception using errcode='PT409',message='ART_NOT_OWNED';end if;
  end loop;
  for item in select value from jsonb_array_elements(p_choices) loop
    k:=item->>'kind';
    if k is null or k not in ('avatar','cover') or jsonb_typeof(item) is distinct from 'object'
      or exists(select 1 from jsonb_object_keys(item) key where key not in ('kind','token','revision','requestKey')) then
      raise exception using errcode='PT400',message='ART_INVALID'; end if;
    select a.media_key into media from profile_art_private.leases l join profile_art_private.artworks a on a.id=l.artwork_id
      where l.user_id=p_user and l.kind=k and l.token=(item->>'token')::uuid;
    if media is null then raise exception using errcode='PT409',message='ART_EXPIRED'; end if;
    receipt := profile_art_private.confirm_in_profile_save(p_user,k,(item->>'token')::uuid,(item->>'revision')::bigint,(item->>'requestKey')::uuid,media);
    p_payload := jsonb_set(p_payload,array[case when k='avatar' then 'avatar_url' else 'cover_image_url' end],
      to_jsonb('/profile-art/v2/'||k||'-'||(receipt->>'mediaKey')||'.webp'));
  end loop;
  p_payload := p_payload||jsonb_build_object('user_id',p_user,'updated_at',clock_timestamp());
  -- Quote only the preceding allowlisted identifiers. jsonb_populate_record uses
  -- the actual profile column types, and omitted columns retain defaults/values.
  select string_agg(format('%I',key),',' order by key),string_agg(format('r.%I',key),',' order by key),
    string_agg(format('%I=r.%I',key,key),',' order by key) into cols,vals,assignments from jsonb_object_keys(p_payload) key;
  if exists_profile then
    execute format('update public.profiles p set %s from jsonb_populate_record(null::public.profiles,$1) r where p.user_id=$2 returning p.*',assignments)
      into saved using p_payload,p_user;
  else
    execute format('insert into public.profiles (%s) select %s from jsonb_populate_record(null::public.profiles,$1) r returning *',cols,vals)
      into saved using p_payload;
  end if;
  delete from profile_art_private.profile_saves where user_id=p_user and created_at<clock_timestamp()-interval '2 days';
  if (select count(*) from profile_art_private.profile_saves where user_id=p_user)>=512 then
    raise exception using errcode='PT429',message='ART_RATE_LIMIT'; end if;
  insert into profile_art_private.profile_saves(user_id,request_key,input_hash,saved_at) values(p_user,p_request,fingerprint,saved.updated_at);
  for item in select value from jsonb_array_elements(p_deletions) loop
    k:=item->>'kind';removed_media:=(item->>'mediaKey')::uuid;
    if (case when k='avatar' then saved.avatar_url else saved.cover_image_url end)='/profile-art/v2/'||k||'-'||removed_media||'.webp' then
      raise exception using errcode='PT400',message='ART_STILL_SELECTED';end if;
    update profile_art_private.artworks set state='quarantine',deleted_at=clock_timestamp()
      where kind=k and media_key=removed_media and deleted_at is null;
  end loop;
  return to_jsonb(saved);
exception when lock_not_available or deadlock_detected then
  raise exception using errcode='PT409',message='ART_BUSY';
when invalid_text_representation then raise exception using errcode='PT400',message='ART_INVALID';
end $$;

revoke all on function public.profile_art_save_profile_v2(text,jsonb,jsonb,timestamptz,uuid,boolean,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.profile_art_save_profile_v2(text,jsonb,jsonb,timestamptz,uuid,boolean,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
