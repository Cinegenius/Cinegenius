-- Central registry of persisted public uploads. No private message/support sources.
create or replace function public.community_image_entries(value jsonb)
returns table(image_url text, caption text, media_type text) language sql immutable as $$
 select case when jsonb_typeof(item) = 'string' then item #>> '{}' else item->>'url' end,
        coalesce(item->>'caption',''), coalesce(item->>'media_type','')
 from jsonb_array_elements(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end) item
 where coalesce(item->>'visibility','public')='public'
   and coalesce(item->>'is_private','false') <> 'true'
   and coalesce(item->>'public','true') <> 'false';
$$;
create or replace function public.community_production_images(value jsonb)
returns jsonb language sql immutable as $$
 select coalesce(jsonb_agg(jsonb_build_object('url',image.image_url,'caption',credit->>'title','media_type','production')), '[]'::jsonb)
 from jsonb_array_elements(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end) credit
 cross join lateral public.community_image_entries(credit->'image_urls') image
 where nullif(trim(credit->>'title'),'') is not null
   and coalesce(credit->>'visibility','public')='public'
   and coalesce(credit->>'is_private','false')<>'true';
$$;
create or replace function public.community_decode_path(value text)
returns text language plpgsql immutable strict as $$
declare part text[]; bytes bytea := ''::bytea;
begin
 for part in select regexp_matches(value, '(%[0-9a-fA-F]{2}|.)','g') loop
  bytes := bytes || case when left(part[1],1)='%' then decode(substr(part[1],2),'hex') else convert_to(part[1],'UTF8') end;
 end loop;
 return convert_from(bytes,'UTF8');
exception when others then return value;
end;
$$;

create or replace view public.public_community_media as
with sources as (
 select 'profile'::text source_type, p.user_id::text source_id, p.user_id owner_id,
   p.display_name author, '/profile/' || coalesce(nullif(p.slug,''),p.user_id) author_href,
   '/profile/' || coalesce(nullif(p.slug,''),p.user_id) source_href, p.display_name source_label,
   jsonb_build_array(jsonb_build_object('url',p.avatar_url,'media_type','avatar'),jsonb_build_object('url',p.cover_image_url,'media_type','cover'))
    || case when jsonb_typeof(p.profile_images::jsonb)='array' then p.profile_images::jsonb else '[]'::jsonb end
    || to_jsonb(coalesce(p.portfolio_images,'{}')) images
 from public.profiles p
 left join public.user_settings settings on settings.user_id=p.user_id
 where nullif(trim(p.display_name),'') is not null and coalesce(settings.profile_visibility,'public') <> 'private'
 union all
 select 'company',c.id::text,c.owner_user_id,c.name,'/companies/'||c.slug,'/companies/'||c.slug,c.name,
   jsonb_build_array(jsonb_build_object('url',c.logo_url,'media_type','logo'),jsonb_build_object('url',c.cover_url,'media_type','cover')) || to_jsonb(coalesce(c.portfolio_images,'{}'))
 from public.companies c where c.published=true
 union all
 select case l.type when 'location' then 'location' when 'job' then 'job' when 'service' then 'company_service' else 'marketplace' end,l.id::text,
   case when l.company_id is not null then c.owner_user_id else p.user_id end,
   case when l.company_id is not null then c.name else p.display_name end,
   case when l.company_id is not null then '/companies/'||c.slug else '/profile/'||coalesce(nullif(p.slug,''),p.user_id) end,
   case l.type when 'location' then '/locations/'||l.id::text when 'vehicle' then '/vehicles/'||l.id::text when 'prop' then '/props/'||l.id::text when 'animal' then '/tiere/'||l.id::text when 'job' then '/jobs/'||l.id::text when 'service' then '/companies/'||c.slug end,l.title,
   jsonb_build_array(l.image_url) || to_jsonb(coalesce(l.extra_images,'{}')) || to_jsonb(coalesce(l.images,'{}'))
    || case when l.type='location' then jsonb_build_array(jsonb_build_object('url',l.floor_plan_url,'media_type','floor_plan')) else '[]'::jsonb end
    || case when l.type in ('location','prop','vehicle') then public.community_production_images(l.metadata->'production_credits') else '[]'::jsonb end
 from public.listings l
 left join public.companies c on c.id=l.company_id and c.published=true
 left join public.profiles p on p.user_id=l.user_id
 left join public.user_settings settings on settings.user_id=p.user_id
 where l.published=true and l.type in ('location','prop','vehicle','service','animal','job')
   and (l.type<>'service' or c.slug is not null)
   and ((l.company_id is not null and c.id is not null) or (l.company_id is null and p.user_id is not null and coalesce(settings.profile_visibility,'public') <> 'private'))
 union all
 select 'company_equipment',e.id::text,c.owner_user_id,c.name,'/companies/'||c.slug,'/companies/'||c.slug,e.name,to_jsonb(coalesce(e.images,'{}'))
 from public.company_equipment e join public.companies c on c.id=e.company_id
 where c.published=true and e.published=true
 union all
 select 'project',pr.id::text,case when coalesce(settings.profile_visibility,'public')<>'private' then p.user_id end,case when coalesce(settings.profile_visibility,'public')='private' then pr.title else coalesce(p.display_name,pr.title) end,
   case when p.user_id is not null and coalesce(settings.profile_visibility,'public') <> 'private' then '/profile/'||coalesce(nullif(p.slug,''),p.user_id) end,
   '/projects/'||pr.id::text,pr.title,jsonb_build_array(pr.poster_url)||to_jsonb(coalesce(pr.images,'{}'))
 from public.projects pr
 left join public.profiles p on p.user_id=pr.created_by
 left join public.user_settings settings on settings.user_id=p.user_id
 -- projects contains published records; unfinished projects live in project_drafts.
 where coalesce(pr.metadata->>'visibility','public')='public' and coalesce(pr.metadata->>'published','true') <> 'false'
 union all
 select 'board',b.id::text,p.user_id,p.display_name,
   case when coalesce(settings.profile_visibility,'public') <> 'private' then '/profile/'||coalesce(nullif(p.slug,''),p.user_id) end,
   '/community?post='||b.id::text,b.title,
   -- Currently text-only. Supports public image fields when that upload area is added.
   coalesce(to_jsonb(b)->'images','[]'::jsonb) || jsonb_build_array(to_jsonb(b)->'image_url')
 from public.community_posts b join public.profiles p on p.user_id=b.author_id
 left join public.user_settings settings on settings.user_id=p.user_id
 where b.expires_at>now() and coalesce(to_jsonb(b)->>'published','true') <> 'false'
), candidates as (
 select s.source_type,s.source_id,s.owner_id,s.author,s.author_href,s.source_href,s.source_label,
  i.image_url,i.caption,i.media_type,o.created_at uploaded_at,o.id storage_id,
  row_number() over(partition by o.id order by case when s.source_type='profile' then 0 else 1 end,case when i.media_type in ('avatar','headshot','cover') then 1 else 0 end,s.source_type,s.source_id,i.image_url) duplicate_rank
 from sources s cross join lateral public.community_image_entries(s.images) i
 cross join lateral (select public.community_decode_path(split_part(substring(i.image_url from '/storage/v1/object/public/(.*)'), '?',1)) as path) stored_path
 -- Separate bucket/name comparisons can use Storage's existing path index.
 join storage.objects o on o.bucket_id=split_part(stored_path.path,'/',1)
   and o.name=substring(stored_path.path from length(split_part(stored_path.path,'/',1))+2)
 join storage.buckets bucket on bucket.id=o.bucket_id and bucket.public=true
 where i.image_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/'
   and coalesce(o.metadata->>'mimetype','image/unknown') like 'image/%'
)
select source_type,source_id,owner_id,author,author_href,source_href,source_label,image_url,caption,media_type,uploaded_at,storage_id,
 row_number() over(partition by coalesce(owner_id,source_id) order by uploaded_at desc,storage_id desc) contributor_rank
from candidates where duplicate_rank=1;
revoke all on public.public_community_media from public,anon,authenticated;
grant select on public.public_community_media to service_role;
revoke all on function public.community_image_entries(jsonb) from public,anon,authenticated;
revoke all on function public.community_production_images(jsonb) from public,anon,authenticated;
revoke all on function public.community_decode_path(text) from public,anon,authenticated;
grant execute on function public.community_image_entries(jsonb),public.community_production_images(jsonb),public.community_decode_path(text) to service_role;
