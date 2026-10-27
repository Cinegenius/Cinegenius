-- Additive: existing public objects and image references are not moved/deleted.
-- New unbound/draft uploads are private; a service-only origin ledger prevents
-- another profile or public mirror from granting additional file permissions.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('protected-media','protected-media',false,4194304,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.media_assets (
 storage_path text primary key,
 reference_url text not null unique,
 owner_user_id text not null,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 source_type text check(source_type in ('profile','company','listing','project','project_draft','community_post','company_equipment')),
 source_id text,
 created_at timestamptz not null default now(),
 check((source_type is null)=(source_id is null)),
 check(storage_path ~ '^((profile-media/avatars|profile-media|avatars)/)?[A-Za-z0-9_-]{1,128}/[a-fA-F0-9]{32}\.(jpg|png|webp)$'),
 check(reference_url='/api/media/'||storage_path)
);
alter table public.media_assets enable row level security;
revoke all on public.media_assets from public,anon,authenticated;
grant all on public.media_assets to service_role;
create index if not exists media_assets_source on public.media_assets(source_type,source_id);

-- Only image-bearing fields can establish a source association.
create or replace function public.source_image_urls(kind text, item jsonb)
returns text[] language sql immutable set search_path=public,pg_temp as $$
 select coalesce(array_agg(distinct case when jsonb_typeof(value)='string' then value #>> '{}' else value->>'url' end) filter(where jsonb_typeof(value)='string' or jsonb_typeof(value->'url')='string'),'{}')
 from jsonb_array_elements(case kind
  when 'profile' then jsonb_build_array(item->'avatar_url',item->'cover_image_url')||coalesce(item->'profile_images','[]')||coalesce(item->'portfolio_images','[]')
  when 'company' then jsonb_build_array(item->'logo_url',item->'cover_url')||coalesce(item->'portfolio_images','[]')
  when 'listing' then jsonb_build_array(item->'image_url',item->'floor_plan_url')||coalesce(item->'extra_images','[]')||coalesce(item->'images','[]')||jsonb_path_query_array(coalesce(item->'metadata','{}'),'$.production_credits[*].image_urls[*]')
  when 'project' then jsonb_build_array(item->'poster_url')||coalesce(item->'images','[]')
  when 'project_draft' then jsonb_build_array(item->'draft_data'->'poster_url')||coalesce(item->'draft_data'->'images','[]')
  when 'community_post' then jsonb_build_array(item->'image_url')||coalesce(item->'images','[]')
  when 'company_equipment' then case when jsonb_typeof(item->'images')='array' then item->'images' else '[]'::jsonb end
  else '[]'::jsonb end) value;
$$;

create or replace function public.media_company_editor(company text, actor text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select actor is not null and exists(
 select 1 from companies c where c.id::text=company and (c.owner_user_id=actor or exists(
  select 1 from company_members m where m.company_id=c.id and m.user_id=actor and m.status='accepted' and m.role in ('admin','editor','manager')
 )));
$$;

create or replace function public.media_company_reader(company text, actor text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.media_company_editor(company,actor) or (actor is not null and exists(
  select 1 from company_members m where m.company_id::text=company and m.user_id=actor and m.status='accepted' and m.role='member'
 ));
$$;

create or replace function public.bind_media_source()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb:=to_jsonb(new);kind text;parent text;actor text;company text;urls text[];
begin
 kind:=case tg_table_name when 'profiles' then 'profile' when 'companies' then 'company' when 'listings' then 'listing' when 'projects' then 'project' when 'project_drafts' then 'project_draft' when 'community_posts' then 'community_post' when 'company_equipment' then 'company_equipment' end;
 if kind is null then return new;end if;
 parent:=case when kind='profile' then item->>'user_id' else item->>'id' end;
 actor:=case kind when 'company' then item->>'owner_user_id' when 'project' then item->>'created_by' when 'community_post' then item->>'author_id' else item->>'user_id' end;
 company:=case when kind='company' then parent else item->>'company_id' end;
 urls:=public.source_image_urls(kind,item);
 update media_assets a set source_type=kind,source_id=parent
 where a.reference_url=any(urls)
  and (a.source_type is null or (a.source_type='project_draft' and kind='project'))
  and (a.owner_user_id=actor or (company is not null and public.media_company_editor(company,a.owner_user_id)));
 return new;
end $$;

do $$declare relation text;begin
 foreach relation in array array['profiles','companies','listings','projects','project_drafts','community_posts','company_equipment'] loop
  execute format('drop trigger if exists bind_private_media on public.%I',relation);
  execute format('create trigger bind_private_media after insert or update on public.%I for each row execute function public.bind_media_source()',relation);
 end loop;
end $$;

create or replace function public.readable_media_asset(p_key text,p_viewer text default null)
returns table(storage_path text,mime_type text) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a media_assets;item jsonb;actor text;company text;visible boolean:=false;visibility text;
begin
 select * into a from media_assets m where m.storage_path=p_key;
 if not found then return;end if;
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
   else return;
  end case;
  if item is null or not(a.reference_url=any(public.source_image_urls(a.source_type,item))) then return;end if;
  actor:=case a.source_type when 'company' then item->>'owner_user_id' when 'project' then item->>'created_by' when 'community_post' then item->>'author_id' else item->>'user_id' end;
  company:=case when a.source_type='company' then a.source_id else item->>'company_id' end;
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
   -- projects contains published records; private working copies live in project_drafts.
   visible:=true;
  elsif a.source_type='project_draft' then
   visible:=p_viewer is not null and p_viewer=actor and nullif(item->>'published_project_id','') is null;
  elsif a.source_type='community_post' then
   visible:=(p_viewer is not null and p_viewer=actor) or (nullif(item->>'expires_at','') is not null and (item->>'expires_at')::timestamptz>now());
  end if;
  if p_viewer is not null and p_viewer is distinct from actor and exists(select 1 from blocks b where (b.blocker_id=actor and b.blocked_id=p_viewer) or (b.blocker_id=p_viewer and b.blocked_id=actor)) then visible:=false;end if;
 end if;
 if visible then return query select a.storage_path,a.mime_type;end if;
end $$;

revoke all on function public.source_image_urls(text,jsonb),public.media_company_editor(text,text),public.media_company_reader(text,text),public.bind_media_source(),public.readable_media_asset(text,text) from public,anon,authenticated;
grant execute on function public.source_image_urls(text,jsonb),public.media_company_editor(text,text),public.media_company_reader(text,text),public.bind_media_source(),public.readable_media_asset(text,text) to service_role;
notify pgrst,'reload schema';

-- Extend the existing allowlist without admitting mirrored listings/projects.
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

-- Journal for the separately reviewed, resumable cutover of legacy private files.
-- The old public copy is retired only after byte-for-byte verification of the
-- private copy and atomic replacement of the private parent's image references.
alter table public.media_assets add column if not exists legacy_bucket text;
alter table public.media_assets add column if not exists legacy_path text;
alter table public.media_assets add column if not exists legacy_reference text;
alter table public.media_assets add column if not exists legacy_retired_at timestamptz;
create unique index if not exists media_assets_legacy_object on public.media_assets(legacy_bucket,legacy_path) where legacy_bucket is not null;

create or replace function public.replace_private_media_reference(p_source_type text,p_source_id text,p_owner text,p_old_refs text[],p_new_ref text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb;asset media_assets;draft jsonb;images jsonb;
begin
 -- Deliberately limited to the two confirmed legacy cases. Other origins need
 -- their own reviewed migration; no arbitrary table/column names are accepted.
 if p_source_type='company' then
  select to_jsonb(c) into item from companies c where c.id::text=p_source_id for update;
  if item is null or item->>'owner_user_id' is distinct from p_owner or coalesce((item->>'published')::boolean,true) then return false;end if;
 elsif p_source_type='project_draft' then
  select to_jsonb(d) into item from project_drafts d where d.id::text=p_source_id for update;
  if item is null or item->>'user_id' is distinct from p_owner or nullif(item->>'published_project_id','') is not null then return false;end if;
 else return false;
 end if;
 select * into asset from media_assets a where a.reference_url=p_new_ref and a.owner_user_id=p_owner and a.legacy_bucket='listing-images' for update;
 if not found or (asset.source_type is not null and (asset.source_type<>p_source_type or asset.source_id<>p_source_id)) then return false;end if;
 if not exists(select 1 from unnest(p_old_refs) old where old=any(public.source_image_urls(p_source_type,item))) then
  return p_new_ref=any(public.source_image_urls(p_source_type,item));
 end if;
 if p_source_type='company' then
  update companies c set
   logo_url=case when c.logo_url=any(p_old_refs) then p_new_ref else c.logo_url end,
   cover_url=case when c.cover_url=any(p_old_refs) then p_new_ref else c.cover_url end,
   portfolio_images=case when c.portfolio_images is null then null else array(select case when image=any(p_old_refs) then p_new_ref else image end from unnest(c.portfolio_images) with ordinality as entries(image,position) order by position) end
  where c.id::text=p_source_id;
 else
  draft:=item->'draft_data';
  if draft->>'poster_url'=any(p_old_refs) then draft:=jsonb_set(draft,'{poster_url}',to_jsonb(p_new_ref));end if;
  if jsonb_typeof(draft->'images')='array' then
   select coalesce(jsonb_agg(case when jsonb_typeof(image)='string' and image #>> '{}'=any(p_old_refs) then to_jsonb(p_new_ref)
    when jsonb_typeof(image)='object' and image->>'url'=any(p_old_refs) then jsonb_set(image,'{url}',to_jsonb(p_new_ref)) else image end order by position),'[]') into images
   from jsonb_array_elements(draft->'images') with ordinality as entries(image,position);
   draft:=jsonb_set(draft,'{images}',images);
  end if;
  update project_drafts d set draft_data=draft where d.id::text=p_source_id;
 end if;
 return true;
end $$;
revoke all on function public.replace_private_media_reference(text,text,text,text[],text) from public,anon,authenticated;
grant execute on function public.replace_private_media_reference(text,text,text,text[],text) to service_role;
notify pgrst,'reload schema';
alter table public.media_assets add column if not exists legacy_sha256 text;

-- Old shared optimizer copies must not outlive a reviewed private-file cutover.
create or replace function public.is_legacy_media_retired(p_bucket text,p_path text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from media_assets where legacy_bucket=p_bucket and legacy_path=p_path);
$$;
revoke all on function public.is_legacy_media_retired(text,text) from public,anon,authenticated;
grant execute on function public.is_legacy_media_retired(text,text) to service_role;
notify pgrst,'reload schema';
alter table public.media_assets add column if not exists content_sha256 text;
notify pgrst,'reload schema';
