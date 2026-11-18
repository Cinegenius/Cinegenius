begin;

-- Hash-only, account-bound receipts. Profile content is never duplicated here.
create table profile_art_private.profile_saves (
  user_id text not null,
  request_key uuid not null,
  input_hash text not null,
  saved_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, request_key)
);
alter table profile_art_private.profile_saves enable row level security;
revoke all on profile_art_private.profile_saves from public, anon, authenticated, service_role;

-- Limit retained per-account receipts, while allowing identical recent retries.
create function profile_art_private.bound_operation_journal() returns trigger
language plpgsql security definer set search_path=pg_catalog,profile_art_private as $$
begin
  perform profile_art_private.lock_account(new.user_id);
  delete from profile_art_private.operations where user_id=new.user_id and created_at<clock_timestamp()-interval '2 days';
  if (select count(*) from profile_art_private.operations where user_id=new.user_id)>=1024 then
    raise exception using errcode='PT429',message='ART_RATE_LIMIT';
  end if;
  return new;
end $$;
create trigger bound_art_operations before insert on profile_art_private.operations
for each row execute function profile_art_private.bound_operation_journal();

-- Every writer (including older clients and the photograph upload route) respects
-- durable ownership. Canonical v2 URLs are not caller-supplied ownership proofs.
create function profile_art_private.guard_profile_art() returns trigger
language plpgsql security definer set search_path=pg_catalog,profile_art_private as $$
declare k text; value text; old_value text; art uuid; old_art uuid; media uuid;
begin
  if tg_op='UPDATE' and new.user_id is distinct from old.user_id then
    raise exception using errcode='PT409',message='ART_ACCOUNT_IMMUTABLE'; end if;
  foreach k in array array['avatar','cover'] loop
    value := case when k='avatar' then new.avatar_url else new.cover_image_url end;
    old_value := case when tg_op='UPDATE' then case when k='avatar' then old.avatar_url else old.cover_image_url end end;
    if tg_op='UPDATE' and value is not distinct from old_value then continue; end if;
    if coalesce(value,'') not like '%profile-art/v2%' and coalesce(old_value,'') not like '%profile-art/v2%' then continue; end if;
    perform profile_art_private.lock_account(new.user_id);
    art := null;
    if coalesce(value,'') like '%profile-art/v2%' then
      if value !~ ('^/profile-art/v2/'||k||'-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$') then
        raise exception using errcode='PT400',message='ART_INVALID'; end if;
      media := substring(value from length('/profile-art/v2/'||k||'-')+1 for 36)::uuid;
      select a.id into art from profile_art_private.artworks a join profile_art_private.claims c on c.artwork_id=a.id
      where a.media_key=media and a.kind=k and c.user_id=new.user_id and a.state in ('ready','retired');
      if art is null then raise exception using errcode='PT409',message='ART_NOT_OWNED'; end if;
    end if;
    select selected_artwork_id into old_art from profile_art_private.slots where user_id=new.user_id and kind=k for update nowait;
    if found and old_art is distinct from art then
      update profile_art_private.slots set selected_artwork_id=art,revision=revision+1 where user_id=new.user_id and kind=k;
      delete from profile_art_private.leases where user_id=new.user_id and kind=k;
    end if;
  end loop;
  return new;
exception when lock_not_available or deadlock_detected then
  raise exception using errcode='PT409',message='ART_BUSY';
end $$;
create trigger guard_exclusive_profile_art before insert or update of user_id,avatar_url,cover_image_url on public.profiles
for each row execute function profile_art_private.guard_profile_art();

-- Only the authenticated, validating application adapter may execute this writer.
-- Profile row, both claims and save receipt are committed (or rolled back) together.
create function public.profile_art_save_profile(p_user text,p_payload jsonb,p_choices jsonb,p_expected timestamptz,p_request uuid,p_create boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,profile_art_private set lock_timeout='500ms' as $$
declare current_profile public.profiles%rowtype; saved public.profiles%rowtype;
  journal profile_art_private.profile_saves%rowtype; fingerprint text; exists_profile boolean;
  item jsonb; k text; media uuid; receipt jsonb; cols text; vals text; assignments text;
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
    or jsonb_typeof(p_choices) is distinct from 'array' or jsonb_array_length(p_choices) not between 1 and 2 then
    raise exception using errcode='PT400',message='ART_INVALID'; end if;
  p_payload := p_payload-'user_id'-'updated_at';
  if exists(select 1 from jsonb_object_keys(p_payload) key where not key=any(allowed))
    or (p_payload ? 'account_type' and (not p_create or p_payload->>'account_type' is distinct from 'person')) then
    raise exception using errcode='PT400',message='ART_INVALID'; end if;
  if (select count(distinct value->>'kind') from jsonb_array_elements(p_choices))<>jsonb_array_length(p_choices) then
    raise exception using errcode='PT400',message='ART_INVALID'; end if;
  fingerprint := md5(jsonb_build_object('payload',p_payload,'choices',p_choices,'expected',p_expected,'create',p_create)::text);
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
  return to_jsonb(saved);
exception when lock_not_available or deadlock_detected then
  raise exception using errcode='PT409',message='ART_BUSY';
when invalid_text_representation then raise exception using errcode='PT400',message='ART_INVALID';
end $$;
revoke all on function profile_art_private.bound_operation_journal(),profile_art_private.guard_profile_art() from public,anon,authenticated,service_role;
revoke all on function public.profile_art_save_profile(text,jsonb,jsonb,timestamptz,uuid,boolean) from public,anon,authenticated;
grant execute on function public.profile_art_save_profile(text,jsonb,jsonb,timestamptz,uuid,boolean) to service_role;
create or replace function public.profile_art_choices(p_user text, p_kind text) returns jsonb
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
    'lease', (select jsonb_build_object('artworkId', l.artwork_id, 'token', l.token, 'expiresAt', l.expires_at, 'kind', l.kind, 'mediaKey', a.media_key)
      from profile_art_private.leases l join profile_art_private.artworks a on a.id=l.artwork_id where l.user_id=p_user and l.kind=p_kind and l.expires_at>stamp and a.state='ready')
  ) into result;
  return result;
end $$;

notify pgrst,'reload schema';
commit;
