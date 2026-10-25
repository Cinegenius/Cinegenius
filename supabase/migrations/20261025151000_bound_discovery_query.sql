-- Discovery contains directly assigned personal/company media only. This changes
-- the read-only projection, never the original uploads, parents, or photo likes.
create or replace function public.community_direct_image_entries(value jsonb, expected_source text)
returns table(image_url text, caption text, media_type text) language sql immutable rows 20 cost 10 as $$
 select entry.image_url,entry.caption,entry.media_type
 from jsonb_array_elements(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end) item
 cross join lateral public.community_image_entries(jsonb_build_array(item)) entry
 where coalesce(nullif(item->>'source_type',''),expected_source)=expected_source
   and coalesce(nullif(item->>'origin_type',''),expected_source)=expected_source
   and coalesce(nullif(item->'source'->>'type',''),expected_source)=expected_source
   and not exists (
     select 1 from jsonb_each_text(case when jsonb_typeof(item)='object' then item else '{}'::jsonb end) field
     where field.key in ('project_id','listing_id','location_id','equipment_id','vehicle_id','post_id','company_equipment_id')
       and nullif(trim(field.value),'') is not null
   );
$$;

create or replace view public.public_community_media as
with sources as materialized (
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
), excluded_paths as materialized (
 select distinct public.community_decode_path(split_part(substring(
   case when jsonb_typeof(item)='string' then item #>> '{}' else item->>'url' end
   from '/storage/v1/object/public/(.*)'), '?',1)) path
 from excluded_sources s cross join lateral jsonb_array_elements(case when jsonb_typeof(s.images)='array' then s.images else '[]'::jsonb end) item
), entries as materialized (
 -- Decode each URL once, before joining Storage. Inlining this expensive path
 -- expression into Storage joins re-ran it for every candidate/object pair.
 select s.source_type,s.source_id,s.owner_id,s.author,s.author_href,s.source_href,s.source_label,
   i.image_url,i.caption,i.media_type,
   public.community_decode_path(split_part(substring(i.image_url from '/storage/v1/object/public/(.*)'), '?',1)) path
 from sources s cross join lateral public.community_direct_image_entries(s.images,s.source_type) i
 where i.image_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/' and i.image_url !~ '[?&]token='
), eligible_entries as materialized (
 select e.*,split_part(e.path,'/',1) bucket_id,substring(e.path from length(split_part(e.path,'/',1))+2) object_name
 from entries e where not exists(select 1 from excluded_paths excluded where excluded.path=e.path)
), candidates as materialized (
 select e.source_type,e.source_id,e.owner_id,e.author,e.author_href,e.source_href,e.source_label,
   e.image_url,e.caption,e.media_type,o.created_at uploaded_at,o.id storage_id,
   row_number() over(partition by o.id order by case when e.source_type='profile' then 0 else 1 end,
     case when e.media_type in ('avatar','headshot','cover') then 1 else 0 end,e.source_type,e.source_id,e.image_url) duplicate_rank
 from eligible_entries e
 join storage.objects o on o.bucket_id=e.bucket_id and o.name=e.object_name
 join storage.buckets bucket on bucket.id=o.bucket_id and bucket.public=true
 where coalesce(o.metadata->>'mimetype','image/unknown') like 'image/%'
)
select source_type,source_id,owner_id,author,author_href,source_href,source_label,image_url,caption,media_type,uploaded_at,storage_id,
 row_number() over(partition by coalesce(owner_id,source_id) order by uploaded_at desc,storage_id desc) contributor_rank
from candidates where duplicate_rank=1;
revoke all on public.public_community_media from public,anon,authenticated;
grant select on public.public_community_media to service_role;
revoke all on function public.community_direct_image_entries(jsonb,text) from public,anon,authenticated;
grant execute on function public.community_direct_image_entries(jsonb,text) to service_role;
