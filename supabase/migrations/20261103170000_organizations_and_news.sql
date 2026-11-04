-- Phase 1: independent industry organizations and moderated public entries.
-- Organization records deliberately do not share company/profile tables.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  last_actor_user_id text not null,
  responsible_user_id text not null,
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 140),
  description text not null default '' check (char_length(description) <= 5000),
  logo_url text,
  topics text[] not null default '{}',
  city text not null default '',
  region text not null default '',
  website_url text,
  public_contact_email text,
  responsible_person jsonb not null default '{}'::jsonb,
  moderation_status text not null default 'draft'
    check (moderation_status in ('draft','submitted','approved','changes_requested','rejected','hidden')),
  moderation_reason text not null default '',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_owner_idx on public.organizations(owner_user_id);
create index if not exists organizations_public_idx on public.organizations(moderation_status, published_at desc);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner','admin')),
  status text not null default 'active' check (status in ('pending','active','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.organization_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_user_id text not null,
  last_actor_user_id text not null,
  slug text not null,
  entry_type text not null check (entry_type in ('news','workshop','training','event')),
  title text not null check (char_length(title) between 2 and 180),
  summary text not null default '' check (char_length(summary) <= 500),
  description text not null default '' check (char_length(description) <= 12000),
  topic text not null default '',
  format text not null default 'onsite' check (format in ('onsite','online','hybrid')),
  city text not null default '',
  venue text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  registration_url text,
  external_url text,
  image_url text,
  moderation_status text not null default 'draft'
    check (moderation_status in ('draft','submitted','approved','changes_requested','rejected','ended','hidden')),
  moderation_reason text not null default '',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists organization_entries_public_idx
  on public.organization_entries(moderation_status, starts_at desc, published_at desc);
create index if not exists organization_entries_org_idx
  on public.organization_entries(organization_id, created_at desc);

create table if not exists public.organization_moderation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  entry_id uuid references public.organization_entries(id) on delete cascade,
  action text not null check (action in ('draft','submitted','approved','changes_requested','rejected','hidden','ended')),
  actor_user_id text not null,
  revision_at timestamptz not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  check ((organization_id is not null)::int + (entry_id is not null)::int = 1)
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_entries enable row level security;
alter table public.organization_moderation_events enable row level security;

revoke all on public.organizations from anon, authenticated;
revoke all on public.organization_members from anon, authenticated;
revoke all on public.organization_entries from anon, authenticated;
revoke all on public.organization_moderation_events from anon, authenticated;

grant all on public.organizations, public.organization_members, public.organization_entries, public.organization_moderation_events to service_role;

comment on table public.organizations is 'Independent associations, education and event organizations; never treated as companies or crew profiles.';
comment on table public.organization_entries is 'Moderated news, workshops, training and events. Phase 1 uses external registration links only.';

-- Every persisted revision and its moderation history are committed together.
-- These tables are reachable only through authenticated server handlers.
create or replace function public.organization_revision_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare parent_status text;
begin
 if new.last_actor_user_id is null or btrim(new.last_actor_user_id)='' then
  raise exception 'organization_actor_required';
 end if;
 new.updated_at:=clock_timestamp();
 if tg_op='UPDATE' then
  new.updated_at:=greatest(new.updated_at,old.updated_at+interval '1 microsecond');
 end if;
 if tg_table_name='organization_entries' and new.moderation_status='ended' then
  if tg_op='INSERT' then raise exception 'organization_entry_not_approved'; end if;
  if old.moderation_status not in ('approved','ended') then raise exception 'organization_entry_not_approved'; end if;
 end if;
 if tg_table_name='organization_entries' and new.moderation_status in ('approved','ended') then
  select moderation_status into parent_status from organizations where id=new.organization_id for share;
  if parent_status is distinct from 'approved' then raise exception 'organization_parent_not_approved'; end if;
 end if;
 return new;
end $$;

create or replace function public.organization_revision_history()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='organizations' and tg_op='INSERT' then
  insert into organization_members(organization_id,user_id,role,status)
  values(new.id,new.owner_user_id,'owner','active');
 end if;
 insert into organization_moderation_events(organization_id,entry_id,action,actor_user_id,revision_at,reason)
 values(case when tg_table_name='organizations' then new.id else null end,
        case when tg_table_name='organization_entries' then new.id else null end,
        new.moderation_status,new.last_actor_user_id,new.updated_at,
        case when new.moderation_status='approved' then 'Reviewed and explicitly approved by administrator.' else new.moderation_reason end);
 return new;
end $$;

do $$declare relation text;begin
 foreach relation in array array['organizations','organization_entries'] loop
  execute format('create trigger organization_revision_guard before insert or update on public.%I for each row execute function public.organization_revision_guard()',relation);
  execute format('create trigger organization_revision_history after insert or update on public.%I for each row execute function public.organization_revision_history()',relation);
 end loop;
end $$;
revoke all on function public.organization_revision_guard() from public,anon,authenticated;
revoke all on function public.organization_revision_history() from public,anon,authenticated;

-- Keep organization media in the existing private media pipeline. An approved
-- organization or entry grants public read access to its current image only;
-- drafts remain visible exclusively to their controllers.
alter table public.media_assets drop constraint if exists media_assets_source_type_check;
alter table public.media_assets add constraint media_assets_source_type_check
  check (source_type in (
    'profile','company','listing','project','project_draft','community_post',
    'company_equipment','organization','organization_entry'
  ));

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
  when 'organization' then jsonb_build_array(item->'logo_url')
  when 'organization_entry' then jsonb_build_array(item->'image_url')
  else '[]'::jsonb end) value;
$$;

create or replace function public.media_organization_editor(organization text, actor text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select actor is not null and exists(
  select 1 from organizations o
  where o.id::text=organization
   and (
    o.owner_user_id=actor
    or exists(
     select 1 from organization_members m
     where m.organization_id=o.id and m.user_id=actor and m.status='active' and m.role in ('owner','admin')
    )
   )
 );
$$;

create or replace function public.bind_media_source()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb:=to_jsonb(new);kind text;parent text;actor text;company text;organization text;urls text[];
begin
 kind:=case tg_table_name
  when 'profiles' then 'profile'
  when 'companies' then 'company'
  when 'listings' then 'listing'
  when 'projects' then 'project'
  when 'project_drafts' then 'project_draft'
  when 'community_posts' then 'community_post'
  when 'company_equipment' then 'company_equipment'
  when 'organizations' then 'organization'
  when 'organization_entries' then 'organization_entry'
 end;
 if kind is null then return new;end if;
 parent:=case when kind='profile' then item->>'user_id' else item->>'id' end;
 actor:=case kind
  when 'company' then item->>'owner_user_id'
  when 'project' then item->>'created_by'
  when 'community_post' then item->>'author_id'
  when 'organization' then item->>'owner_user_id'
  when 'organization_entry' then item->>'author_user_id'
  else item->>'user_id'
 end;
 company:=case when kind='company' then parent else item->>'company_id' end;
 organization:=case when kind='organization' then parent else item->>'organization_id' end;
 urls:=public.source_image_urls(kind,item);
 update media_assets a set source_type=kind,source_id=parent
 where a.reference_url=any(urls)
  and (a.source_type is null or (a.source_type='project_draft' and kind='project'))
  and (
   a.owner_user_id=actor
   or (company is not null and public.media_company_editor(company,a.owner_user_id))
   or (organization is not null and public.media_organization_editor(organization,a.owner_user_id))
  );
 return new;
end $$;

do $$declare relation text;begin
 foreach relation in array array[
  'profiles','companies','listings','projects','project_drafts','community_posts',
  'company_equipment','organizations','organization_entries'
 ] loop
  execute format('drop trigger if exists bind_private_media on public.%I',relation);
  execute format('create trigger bind_private_media after insert or update on public.%I for each row execute function public.bind_media_source()',relation);
 end loop;
end $$;

create or replace function public.readable_media_asset(p_key text,p_viewer text default null)
returns table(storage_path text,mime_type text) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a media_assets;item jsonb;actor text;company text;organization text;visible boolean:=false;visibility text;
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

revoke all on function public.source_image_urls(text,jsonb),public.media_organization_editor(text,text),public.bind_media_source(),public.readable_media_asset(text,text) from public,anon,authenticated;
grant execute on function public.source_image_urls(text,jsonb),public.media_organization_editor(text,text),public.bind_media_source(),public.readable_media_asset(text,text) to service_role;
notify pgrst,'reload schema';
