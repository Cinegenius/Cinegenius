-- Only server-side discovery may call these functions. Existing source/origin,
-- Ghost, visibility and block checks remain authoritative on every request.
create or replace function public.random_community_media(
  p_seed text, p_offset integer default 0, p_limit integer default 48,
  p_blocked_owners text[] default '{}', p_include_total boolean default true,
  p_media_origin text default null
) returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if p_seed is null or p_seed !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid discovery seed' using errcode='22023';
  end if;
  with eligible as materialized (
    select m.* from public.public_community_media m
    where m.source_type in ('profile','company')
      and (m.owner_id is null or not (m.owner_id=any(coalesce(p_blocked_owners,'{}'))))
      and (m.image_url like '/api/media/%' or starts_with(m.image_url,rtrim(p_media_origin,'/')||'/storage/v1/object/public/'))
  ), ranked as (
    select e.*,
      row_number() over(partition by coalesce(e.owner_id,e.source_id)
        order by md5(p_seed||':'||e.storage_id::text),e.storage_id) photo_order,
      md5(p_seed||':'||coalesce(e.owner_id,e.source_id)) owner_order
    from eligible e
  ), page as (
    select * from ranked order by photo_order,owner_order,storage_id
    offset greatest(0,coalesce(p_offset,0)) limit greatest(1,least(100,coalesce(p_limit,48)))
  )
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(page)-'photo_order'-'owner_order' order by photo_order,owner_order,storage_id) from page),'[]'::jsonb),
    'total',case when p_include_total then (select count(*) from eligible) else 0 end
  ) into result;
  return result;
end;
$$;

-- Page zero and subsequent pages use the same seed and complete candidate set.
-- The application selects the existing projection and rechecks account privacy
-- before serializing anything; full profile records are never public RPCs.
create or replace function public.random_crew_profiles(p_seed text, p_offset integer default 0, p_limit integer default 96)
returns setof public.profiles language plpgsql stable security invoker set search_path=public,pg_temp as $$
begin
  if p_seed is null or p_seed !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid discovery seed' using errcode='22023';
  end if;
  return query select p.* from public.profiles p
    where nullif(trim(p.display_name),'') is not null
    order by md5(p_seed||':'||p.user_id),p.user_id
    offset greatest(0,coalesce(p_offset,0)) limit greatest(1,least(300,coalesce(p_limit,96)));
end;
$$;

create or replace function public.random_crew_listings(p_seed text)
returns setof public.listings language plpgsql stable security invoker set search_path=public,pg_temp as $$
begin
  if p_seed is null or p_seed !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid discovery seed' using errcode='22023';
  end if;
  return query select l.* from public.listings l
    where l.published=true and l.type='creator'
    order by md5(p_seed||':'||coalesce(l.user_id,'listing_'||l.id::text)),l.id;
end;
$$;

revoke all on function public.random_community_media(text,integer,integer,text[],boolean,text) from public,anon,authenticated;
revoke all on function public.random_crew_profiles(text,integer,integer) from public,anon,authenticated;
revoke all on function public.random_crew_listings(text) from public,anon,authenticated;
grant execute on function public.random_community_media(text,integer,integer,text[],boolean,text) to service_role;
grant execute on function public.random_crew_profiles(text,integer,integer) to service_role;
grant execute on function public.random_crew_listings(text) to service_role;
