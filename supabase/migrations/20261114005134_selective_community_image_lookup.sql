-- A preview needs the current eligibility of one file, not the ranked gallery.
-- Retain all aliases of that storage path until duplicate ownership is resolved;
-- retain every exclusion and canonical-parent check from the public gallery.
create or replace function public.public_community_image(p_image text)
returns table(storage_id uuid, uploaded_at timestamptz, owner_id text)
language sql stable security definer set search_path = public, pg_temp
as $function$
with requested as materialized (
 select case when p_image like '/api/media/%' then 'protected-media/'||substring(p_image from 12)
 else public.community_decode_path(split_part(substring(p_image from '/storage/v1/object/public/(.*)'), '?',1)) end path
 where length(p_image) between 1 and 2048
), sources as materialized (
 -- Explicit allowlist: only these two parent types supply discovery candidates.
 select 'profile'::text source_type,p.user_id::text source_id,p.user_id owner_id,
   p.display_name author,'/profile/'||coalesce(nullif(p.slug,''),p.user_id) author_href,
   '/profile/'||coalesce(nullif(p.slug,''),p.user_id) source_href,p.display_name source_label,
   jsonb_build_array(jsonb_build_object('url',p.avatar_url,'media_type','avatar'),jsonb_build_object('url',p.cover_image_url,'media_type','cover'))
    || case when jsonb_typeof(p.profile_images::jsonb)='array' then p.profile_images::jsonb else '[]'::jsonb end
    || to_jsonb(coalesce(p.portfolio_images,'{}')) images
 from public.profiles p left join public.user_settings settings on settings.user_id=p.user_id
 where nullif(trim(p.display_name),'') is not null and coalesce(settings.profile_visibility,'public')='public'
 union all
 select 'company',c.id::text,c.owner_user_id,c.name,'/companies/'||c.slug,'/companies/'||c.slug,c.name,
   jsonb_build_array(jsonb_build_object('url',c.logo_url,'media_type','logo'),jsonb_build_object('url',c.cover_url,'media_type','cover'))
    || to_jsonb(coalesce(c.portfolio_images,'{}'))
 from public.companies c where c.published=true
), excluded_sources as materialized (
 -- A foreign parent assignment takes precedence over a profile mirror. Include
 -- private/draft parents too; changing their visibility must not admit the file.
 select jsonb_build_array(l.image_url,l.floor_plan_url)||to_jsonb(coalesce(l.extra_images,'{}'))||to_jsonb(coalesce(l.images,'{}'))
   || jsonb_path_query_array(coalesce(l.metadata,'{}'::jsonb),'$.production_credits[*].image_urls[*]') images
 from public.listings l
 union all
 select jsonb_build_array(pr.poster_url)||to_jsonb(coalesce(pr.images,'{}')) from public.projects pr
 union all
 select jsonb_build_array(d.draft_data->'poster_url')||coalesce(d.draft_data->'images','[]'::jsonb) from public.project_drafts d
 union all
 select to_jsonb(coalesce(e.images,'{}')) from public.company_equipment e
 union all
 select coalesce(to_jsonb(b)->'images','[]'::jsonb)||jsonb_build_array(to_jsonb(b)->'image_url') from public.community_posts b

 union all
 select jsonb_build_array(p.avatar_url,p.cover_image_url)||coalesce(to_jsonb(p.profile_images),'[]')||coalesce(to_jsonb(p.portfolio_images),'[]')
 from public.profiles p join public.user_settings settings on settings.user_id=p.user_id where settings.profile_visibility='private'
 union all
 select jsonb_build_array(c.logo_url,c.cover_url)||coalesce(to_jsonb(c.portfolio_images),'[]') from public.companies c where c.published=false
), excluded_paths as materialized (
 select distinct case when (case when jsonb_typeof(item)='string' then item #>> '{}' else item->>'url' end) like '/api/media/%' then 'protected-media/'||substring((case when jsonb_typeof(item)='string' then item #>> '{}' else item->>'url' end) from 12) else public.community_decode_path(split_part(substring(case when jsonb_typeof(item)='string' then item #>> '{}' else item->>'url' end from '/storage/v1/object/public/(.*)'), '?',1)) end path
 from excluded_sources s cross join lateral jsonb_array_elements(case when jsonb_typeof(s.images)='array' then s.images else '[]'::jsonb end) item
), entries as materialized (
 -- Decode each URL once, before joining Storage. Inlining this expensive path
 -- expression into Storage joins re-ran it for every candidate/object pair.
 select s.source_type,s.source_id,s.owner_id,s.author,s.author_href,s.source_href,s.source_label,
   i.image_url,i.caption,i.media_type,
   case when i.image_url like '/api/media/%' then 'protected-media/'||substring(i.image_url from 12) else public.community_decode_path(split_part(substring(i.image_url from '/storage/v1/object/public/(.*)'), '?',1)) end path
 from sources s cross join lateral public.community_direct_image_entries(s.images,s.source_type) i
 where (i.image_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/' and i.image_url !~ '[?&]token=') or i.image_url like '/api/media/%'
), eligible_entries as materialized (
 select e.*,split_part(e.path,'/',1) bucket_id,substring(e.path from length(split_part(e.path,'/',1))+2) object_name
 from entries e where e.path=(select path from requested) and not exists(select 1 from excluded_paths excluded where excluded.path=e.path)
), candidates as materialized (
 select e.source_type,e.source_id,e.owner_id,e.author,e.author_href,e.source_href,e.source_label,
   e.image_url,e.caption,e.media_type,o.created_at uploaded_at,o.id storage_id,
   row_number() over(partition by o.id order by case when e.source_type='profile' then 0 else 1 end,
     case when e.media_type in ('avatar','headshot','cover') then 1 else 0 end,e.source_type,e.source_id,e.image_url) duplicate_rank
 from eligible_entries e
 join storage.objects o on o.bucket_id=e.bucket_id and o.name=e.object_name
 join storage.buckets bucket on bucket.id=o.bucket_id
 left join media_assets asset on asset.reference_url=e.image_url
 where (bucket.public=true or (bucket.id='protected-media' and asset.source_type=e.source_type and asset.source_id=e.source_id and exists(select 1 from readable_media_asset(asset.storage_path,null)))) and coalesce(o.metadata->>'mimetype','image/unknown') like 'image/%'
)
select storage_id,uploaded_at,owner_id from candidates where duplicate_rank=1 and image_url=p_image limit 1;

$function$;
revoke all on function public.public_community_image(text) from public, anon, authenticated;
grant execute on function public.public_community_image(text) to service_role;
