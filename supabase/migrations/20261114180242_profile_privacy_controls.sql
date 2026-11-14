-- Additive, opt-in privacy. No content, publication state or stored media is rewritten.
alter table public.user_settings
 add column if not exists ghost_mode boolean not null default false,
 add column if not exists location_visibility text not null default 'public',
 add column if not exists map_visibility text not null default 'public',
 add column if not exists activity_visibility text not null default 'public';
alter table public.user_settings
 drop constraint if exists user_settings_phone_visibility_check,
 drop constraint if exists user_settings_contact_email_visibility_check,
 add constraint user_settings_phone_visibility_check check(phone_visibility in ('public','members','friends','hidden')),
 add constraint user_settings_contact_email_visibility_check check(contact_email_visibility in ('public','members','friends','hidden')),
 add constraint user_settings_location_visibility_check check(location_visibility in ('public','members','friends','hidden')),
 add constraint user_settings_map_visibility_check check(map_visibility in ('public','members','friends','hidden')),
 add constraint user_settings_activity_visibility_check check(activity_visibility in ('public','members','friends','hidden'));
alter table public.user_settings enable row level security;
revoke all on public.user_settings from public,anon,authenticated;
grant all on public.user_settings to service_role;

-- All public reads, including counts/facets, apply this before pagination.
-- Company offers belong to the company, not the technical user_id.
create or replace view public.privacy_visible_listings with (security_invoker=true) as
 select l.* from public.listings l where l.published=true and
 (l.company_id is not null or not exists(select 1 from public.user_settings s where s.user_id=l.user_id and s.ghost_mode));
revoke all on public.privacy_visible_listings from public,anon,authenticated;
grant select on public.privacy_visible_listings to service_role;

-- Stop retaining a fresh public presence timestamp while ghost/hidden is active.
create or replace function public.profile_presence_privacy_guard() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if exists(select 1 from user_settings s where s.user_id=new.user_id and (s.ghost_mode or s.activity_visibility='hidden')) then new.last_seen_at:=null;end if;
 return new;
end $$;
revoke all on function public.profile_presence_privacy_guard() from public,anon,authenticated;
create trigger profile_presence_privacy before insert or update of last_seen_at on public.profiles
 for each row execute function public.profile_presence_privacy_guard();

create or replace function public.readable_media_asset(p_key text,p_viewer text default null)
returns table(storage_path text,mime_type text) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a media_assets;item jsonb;actor text;company text;organization text;visible boolean:=false;visibility text;
begin
 select * into a from media_assets m where m.storage_path=p_key;
 if not found then return;end if;
 if a.source_type='message' then
  if exists(select 1 from message_attachments ma cross join lateral readable_message_attachment(ma.id,p_viewer) readable
   where ma.reference_url=a.reference_url and ma.message_id::text=a.source_id and readable.id=ma.id) then
   return query select a.storage_path,a.mime_type;
  end if;
  return;
 end if;
 if a.source_type is null then
  visible:=p_viewer is not null and p_viewer=a.owner_user_id;
 else
  case a.source_type
   when 'profile' then select to_jsonb(p) into item from profiles p where p.user_id=a.source_id;
   when 'company' then select to_jsonb(c) into item from companies c where c.id::text=a.source_id;
   when 'listing' then select to_jsonb(l) into item from listings l where l.id::text=a.source_id;
   when 'project' then select to_jsonb(p) into item from projects p where p.id::text=a.source_id;
   when 'project_draft' then select to_jsonb(d) into item from project_drafts d where d.id::text=a.source_id;
   when 'community_post' then select to_jsonb(b) into item from community_posts b where b.id::text=a.source_id;
   when 'company_equipment' then select to_jsonb(e) into item from company_equipment e where e.id::text=a.source_id;
   when 'organization' then select to_jsonb(o) into item from organizations o where o.id::text=a.source_id;
   when 'organization_entry' then select to_jsonb(e) into item from organization_entries e where e.id::text=a.source_id;
   else return;
  end case;
  if item is null or not(a.reference_url=any(public.source_image_urls(a.source_type,item))) then return;end if;
  actor:=case a.source_type
   when 'company' then item->>'owner_user_id'
   when 'project' then item->>'created_by'
   when 'community_post' then item->>'author_id'
   when 'organization' then item->>'owner_user_id'
   when 'organization_entry' then item->>'author_user_id'
   else item->>'user_id'
  end;
  company:=case when a.source_type='company' then a.source_id else item->>'company_id' end;
  organization:=case when a.source_type='organization' then a.source_id else item->>'organization_id' end;
  -- Ghost overrides friendship and original-upload ownership, preserving message history.
  if p_viewer is distinct from actor and exists(select 1 from user_settings s where s.user_id=actor and s.ghost_mode)
   and (a.source_type in ('profile','community_post') or (a.source_type='listing' and company is null)) then return;end if;
  -- Reassignment uses the current controller, never the original uploader.
  if a.source_type='profile' then
   select coalesce(s.profile_visibility,'public') into visibility from user_settings s where s.user_id=actor;
   visible:=(p_viewer is not null and p_viewer=actor) or (nullif(trim(item->>'display_name'),'') is not null and (coalesce(visibility,'public')='public' or exists(
    select 1 from friendships f where f.status='accepted' and ((f.sender_id=actor and f.receiver_id=p_viewer) or (f.receiver_id=actor and f.sender_id=p_viewer)))));
   if p_viewer is distinct from actor and exists(
    select 1 from jsonb_array_elements(case when jsonb_typeof(item->'profile_images')='array' then item->'profile_images' else '[]'::jsonb end) image
    where image->>'url'=a.reference_url and (image->>'visibility'='private' or image->>'public'='false')
   ) then visible:=false;end if;
  elsif a.source_type in ('company','company_equipment') then
   visible:=public.media_company_reader(company,p_viewer) or exists(select 1 from companies c where c.id::text=company and c.published=true and coalesce((item->>'published')::boolean,true));
  elsif a.source_type='listing' then
   visible:=(p_viewer is not null and p_viewer=actor) or public.media_company_editor(company,p_viewer) or coalesce((item->>'published')::boolean,false);
   if p_viewer is distinct from actor and not public.media_company_editor(company,p_viewer) and exists(
    select 1 from jsonb_array_elements(case when jsonb_typeof(item->'metadata'->'production_credits')='array' then item->'metadata'->'production_credits' else '[]'::jsonb end) credit
    where (credit->>'visibility'='private' or credit->>'public'='false') and a.reference_url=any(public.source_image_urls('project',jsonb_build_object('images',credit->'image_urls')))
   ) then visible:=false;end if;
  elsif a.source_type='project' then
   visible:=(p_viewer is not null and p_viewer=actor) or public.project_media_has_rights(item,a.reference_url);
  elsif a.source_type='project_draft' then
   visible:=p_viewer is not null and p_viewer=actor and nullif(item->>'published_project_id','') is null;
  elsif a.source_type='community_post' then
   visible:=(p_viewer is not null and p_viewer=actor) or (nullif(item->>'expires_at','') is not null and (item->>'expires_at')::timestamptz>now());
  elsif a.source_type='organization' then
   visible:=public.media_organization_editor(organization,p_viewer) or item->>'moderation_status'='approved';
  elsif a.source_type='organization_entry' then
   visible:=public.media_organization_editor(organization,p_viewer) or (
    item->>'moderation_status' in ('approved','ended')
    and exists(select 1 from organizations o where o.id::text=organization and o.moderation_status='approved')
   );
  end if;
  if a.source_type not in ('organization','organization_entry') and p_viewer is not null and p_viewer is distinct from actor and exists(
   select 1 from blocks b where (b.blocker_id=actor and b.blocked_id=p_viewer) or (b.blocker_id=p_viewer and b.blocked_id=actor)
  ) then visible:=false;end if;
 end if;
 if visible then return query select a.storage_path,a.mime_type;end if;
end $$;
notify pgrst,'reload schema';


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
 where nullif(trim(p.display_name),'') is not null and coalesce(settings.profile_visibility,'public')='public' and not coalesce(settings.ghost_mode,false)
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
 from public.profiles p join public.user_settings settings on settings.user_id=p.user_id where (settings.profile_visibility='private' or settings.ghost_mode)
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
 from entries e where not exists(select 1 from excluded_paths excluded where excluded.path=e.path)
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
select source_type,source_id,owner_id,author,author_href,source_href,source_label,image_url,caption,media_type,uploaded_at,storage_id,
 row_number() over(partition by coalesce(owner_id,source_id) order by uploaded_at desc,storage_id desc) contributor_rank
from candidates where duplicate_rank=1;

revoke all on public.public_community_media from public,anon,authenticated;
grant select on public.public_community_media to service_role;


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
 where nullif(trim(p.display_name),'') is not null and coalesce(settings.profile_visibility,'public')='public' and not coalesce(settings.ghost_mode,false)
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
 from public.profiles p join public.user_settings settings on settings.user_id=p.user_id where (settings.profile_visibility='private' or settings.ghost_mode)
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

notify pgrst,'reload schema';
