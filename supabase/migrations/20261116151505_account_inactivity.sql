-- Private, shared web/app lifecycle. Applying this migration does not enroll,
-- hide or delete any account. The production worker has a separate release gate.
alter table public.user_settings add column account_inactive boolean not null default false;
create table public.account_activity (
 user_id text primary key,
 enrolled_at timestamptz not null default now(),
 last_activity_at timestamptz not null default now(),
 cycle bigint not null default 1,
 stage text not null default 'active' check(stage in ('active','reminder','warning','paused','deletion_pending','review')),
 reminder_delivered_at timestamptz,
 warning_delivered_at timestamptz,
 final_delivered_at timestamptz,
 review_after timestamptz,
 next_check_at timestamptz not null default (now()+interval '12 months'),
 issue text check(issue in ('email_unverified','delivery_unknown','recipient_changed','provider_unavailable','retention_review')),
 exempt boolean not null default false,
 updated_at timestamptz not null default now()
);
create index account_activity_due on public.account_activity(next_check_at,last_activity_at) where not exempt;
create table public.account_activity_outbox (
 id uuid primary key default gen_random_uuid(),
 user_id text not null references public.account_activity(user_id) on delete cascade,
 cycle bigint not null,
 stage text not null check(stage in ('policy','reminder','warning','paused','deletion_pending','review','reactivated')),
 status text not null default 'queued' check(status in ('queued','sending','sent','delivered','canceled','unknown')),
 payload jsonb,
 first_attempt_at timestamptz,
 provider_id text,
 delivered_at timestamptz,
 created_at timestamptz not null default now(),
 unique(user_id,cycle,stage)
);
create index account_activity_outbox_delivery on public.account_activity_outbox(user_id,cycle,status);
create table public.account_activity_worker (
 id boolean primary key default true check(id),
 scan_offset integer not null default 0 check(scan_offset>=0),
 lease_id uuid,
 lease_until timestamptz
);
insert into public.account_activity_worker(id) values(true);
alter table public.account_activity enable row level security;
alter table public.account_activity_outbox enable row level security;
alter table public.account_activity_worker enable row level security;
revoke all on public.account_activity,public.account_activity_outbox,public.account_activity_worker from public,anon,authenticated;
grant all on public.account_activity,public.account_activity_outbox,public.account_activity_worker to service_role;

-- No historical backdating: all existing accounts get a full 12-month period
-- starting at enrollment. p_at comes from verified Clerk data or server time.
create function public.record_account_activity(p_user_id text,p_at timestamptz default null,p_exempt boolean default false)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare s account_activity; v_now timestamptz:=clock_timestamp(); v_at timestamptz; resumed boolean:=false;
begin
 if nullif(trim(p_user_id),'') is null then raise exception 'invalid account' using errcode='22023';end if;
 v_at:=least(coalesce(p_at,v_now),v_now);
 insert into account_activity(user_id,exempt,next_check_at) values(p_user_id,p_exempt,v_now) on conflict do nothing;
 if found and not p_exempt then insert into account_activity_outbox(user_id,cycle,stage) values(p_user_id,1,'policy');end if;
 select * into s from account_activity where user_id=p_user_id for update;
 if v_at>s.last_activity_at or (p_exempt and not s.exempt) then
  resumed:=s.stage<>'active';
  -- One stored timestamp; no browsing history or public online indicator.
  update account_activity set last_activity_at=greatest(v_at,last_activity_at),cycle=cycle+case when resumed then 1 else 0 end,
   stage='active',reminder_delivered_at=null,warning_delivered_at=null,final_delivered_at=null,review_after=null,
   issue=null,exempt=p_exempt,updated_at=v_now,next_check_at=case when resumed or exists(select 1 from account_activity_outbox o where o.user_id=p_user_id and o.cycle=s.cycle and o.status in ('queued','sending')) then v_now else greatest(v_at,last_activity_at)+interval '12 months' end
   where user_id=p_user_id returning * into s;
  update account_activity_outbox set status='canceled',payload=null where user_id=p_user_id and cycle<s.cycle;
  update user_settings set account_inactive=false where user_id=p_user_id and account_inactive;
  if resumed then insert into account_activity_outbox(user_id,cycle,stage) values(p_user_id,s.cycle,'reactivated') on conflict do nothing;end if;
 else
  update account_activity set exempt=p_exempt where user_id=p_user_id;
 end if;
 return jsonb_build_object('reactivated',resumed,'state',to_jsonb(s)-'user_id'-'issue'-'next_check_at');
end $$;

create function public.claim_account_activity_worker(p_lease uuid)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_offset integer;
begin
 update account_activity_worker set lease_id=p_lease,lease_until=clock_timestamp()+interval '2 minutes'
 where id and (lease_until is null or lease_until<clock_timestamp()) returning scan_offset into v_offset;
 return v_offset;
end $$;
create function public.finish_account_activity_worker(p_lease uuid,p_offset integer)
returns void language sql security invoker set search_path=public,pg_temp as $$
 update account_activity_worker set lease_id=null,lease_until=null,scan_offset=greatest(p_offset,0) where id and lease_id=p_lease;
$$;

-- All decisions hold the same account lock as reactivation. Every callback is
-- conditional on its cycle, so stale workers cannot re-hide a returning member.
create function public.advance_account_activity(p_user_id text,p_cycle bigint)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare s account_activity; v_now timestamptz:=clock_timestamp(); v_stage text; changed boolean:=false;
begin
 select * into s from account_activity where user_id=p_user_id for update;
 if not found or s.cycle<>p_cycle or s.exempt then return jsonb_build_object('stale',true);end if;
 update account_activity set next_check_at=case when s.stage='active' and v_now<s.last_activity_at+interval '12 months' and not exists(select 1 from account_activity_outbox where user_id=p_user_id and cycle=p_cycle and status in ('queued','sending')) then s.last_activity_at+interval '12 months' else v_now+interval '1 day' end where user_id=p_user_id;
 if s.stage='active' and v_now>=s.last_activity_at+interval '12 months' then v_stage:='reminder';
 elsif s.stage='reminder' and s.reminder_delivered_at is not null
  and v_now>=greatest(s.last_activity_at+interval '15 months',s.reminder_delivered_at+interval '30 days') then v_stage:='warning';
 elsif s.stage='warning' and s.warning_delivered_at is not null
  and v_now>=greatest(s.last_activity_at+interval '18 months',s.warning_delivered_at+interval '30 days') then
  v_stage:='paused';
  insert into user_settings(user_id,account_inactive) values(p_user_id,true)
   on conflict(user_id) do update set account_inactive=true;
  changed:=true;
 elsif s.stage='paused' and v_now>=s.last_activity_at+interval '24 months' then v_stage:='deletion_pending';
 elsif s.stage='deletion_pending' and s.review_after is not null and v_now>=s.review_after then
  v_stage:='review';
 end if;
 if v_stage is not null then
  update account_activity_outbox set payload=null where user_id=p_user_id and cycle=p_cycle and stage=s.stage and status='delivered';
  update account_activity set stage=v_stage,updated_at=v_now,issue=case when v_stage='review' then 'retention_review' else null end where user_id=p_user_id;
  insert into account_activity_outbox(user_id,cycle,stage) values(p_user_id,p_cycle,v_stage) on conflict do nothing;
 end if;
 return jsonb_build_object('changed',changed,'stage',coalesce(v_stage,s.stage));
end $$;

create function public.bind_account_activity_mail(p_id uuid,p_cycle bigint,p_payload jsonb,p_notification jsonb,p_admin_notifications jsonb default '[]'::jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare s account_activity; o account_activity_outbox; v_user text; alert jsonb;
begin
 select user_id into v_user from account_activity_outbox where id=p_id;
 select * into s from account_activity where user_id=v_user for update;
 select * into o from account_activity_outbox where id=p_id for update;
 if s.user_id is null or s.cycle<>p_cycle or o.cycle<>p_cycle or s.exempt or o.status not in ('queued','sending')
  or (o.stage not in ('reactivated','policy') and o.stage<>s.stage) then return null;end if;
 if o.first_attempt_at is not null and o.first_attempt_at<clock_timestamp()-interval '23 hours' then
  update account_activity_outbox set status='unknown',payload=null where id=p_id;
  update account_activity set issue='delivery_unknown' where user_id=v_user;
  return null;
 end if;
 if o.payload is null then
  if p_payload->>'to' is null or p_notification->>'title' is null or p_notification->>'body' is null then return null;end if;
  update account_activity_outbox set payload=p_payload,first_attempt_at=clock_timestamp(),status='sending' where id=p_id returning * into o;
  insert into notifications(id,user_id,type,title,body,href,localization)
   values(o.id,v_user,'account_inactivity',p_notification->>'title',p_notification->>'body','/dashboard?tab=settings',p_notification->'localization')
   on conflict(id) do nothing;
  if o.stage='review' then
   for alert in select value from jsonb_array_elements(p_admin_notifications) loop
    if nullif(alert->>'userId','') is not null then
     insert into notifications(id,user_id,type,title,body,href,localization)
      values(md5(o.id::text||':'||(alert->>'userId'))::uuid,alert->>'userId','account_inactivity',alert->>'title',alert->>'body','/admin?tab=accounts',alert->'localization') on conflict(id) do nothing;
    end if;
   end loop;
  end if;
 end if;
 return to_jsonb(o);
end $$;
create function public.finish_account_activity_mail(p_id uuid,p_cycle bigint,p_provider_id text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare s account_activity; v_user text;
begin
 select user_id into v_user from account_activity_outbox where id=p_id;
 select * into s from account_activity where user_id=v_user for update;
 if s.cycle<>p_cycle or s.exempt then return false;end if;
 update account_activity_outbox set status='sent',provider_id=p_provider_id,payload=case when stage in ('policy','reactivated','paused','review') then null else payload end where id=p_id and cycle=p_cycle and status='sending';
 return found;
end $$;
create function public.confirm_account_activity_delivery(p_id uuid,p_cycle bigint,p_outcome text,p_recipient text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare s account_activity; o account_activity_outbox; v_user text; v_now timestamptz:=clock_timestamp();
begin
 select user_id into v_user from account_activity_outbox where id=p_id;
 select * into s from account_activity where user_id=v_user for update;
 select * into o from account_activity_outbox where id=p_id for update;
 if s.cycle<>p_cycle or o.cycle<>p_cycle or s.exempt or o.status not in ('sent','delivered') then return false;end if;
 if p_outcome='delivered' and lower(o.payload->>'to')=lower(p_recipient) then
  update account_activity_outbox set status='delivered',delivered_at=coalesce(delivered_at,v_now) where id=p_id;
  if o.stage='reminder' then update account_activity set reminder_delivered_at=coalesce(reminder_delivered_at,v_now),issue=null where user_id=v_user;
  elsif o.stage='warning' then update account_activity set warning_delivered_at=coalesce(warning_delivered_at,v_now),issue=null where user_id=v_user;
  elsif o.stage='deletion_pending' then update account_activity set final_delivered_at=coalesce(final_delivered_at,v_now),review_after=coalesce(review_after,v_now+interval '30 days'),issue=null where user_id=v_user;end if;
  return true;
 end if;
 -- Loss of delivery evidence never starts/advances a grace period.
 if p_outcome in ('bounced','failed','suppressed','complained','canceled','recipient_changed') then
  update account_activity_outbox set status='unknown',payload=null where id=p_id;
  update account_activity set issue=case when p_outcome='recipient_changed' then 'recipient_changed' else 'delivery_unknown' end,
   reminder_delivered_at=case when o.stage='reminder' then null else reminder_delivered_at end,
   warning_delivered_at=case when o.stage='warning' then null else warning_delivered_at end,
   final_delivered_at=case when o.stage='deletion_pending' then null else final_delivered_at end,
   review_after=case when o.stage='deletion_pending' then null else review_after end where user_id=v_user;
 end if;
 return false;
end $$;

-- Explicit grants for every new RPC. No client may forge activity, clear an
-- inactivity restriction or read recipients/delivery history through PostgREST.
revoke all on function public.record_account_activity(text,timestamptz,boolean),public.claim_account_activity_worker(uuid),public.finish_account_activity_worker(uuid,integer),public.advance_account_activity(text,bigint),public.bind_account_activity_mail(uuid,bigint,jsonb,jsonb,jsonb),public.finish_account_activity_mail(uuid,bigint,text),public.confirm_account_activity_delivery(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.record_account_activity(text,timestamptz,boolean),public.claim_account_activity_worker(uuid),public.finish_account_activity_worker(uuid,integer),public.advance_account_activity(text,bigint),public.bind_account_activity_mail(uuid,bigint,jsonb,jsonb,jsonb),public.finish_account_activity_mail(uuid,bigint,text),public.confirm_account_activity_delivery(uuid,bigint,text,text) to service_role;

-- Preserve user-chosen privacy and moderation; add a separate inactivity overlay.
create or replace view public.privacy_visible_listings with (security_invoker=true) as
 select l.* from public.listings l where l.published=true and
 (l.company_id is not null or not exists(select 1 from public.user_settings s where s.user_id=l.user_id and (s.ghost_mode or s.account_inactive)));
revoke all on public.privacy_visible_listings from public,anon,authenticated;
grant select on public.privacy_visible_listings to service_role;

-- Stop retaining a fresh public presence timestamp while ghost/hidden is active.
create or replace function public.profile_presence_privacy_guard() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if exists(select 1 from user_settings s where s.user_id=new.user_id and ((s.ghost_mode or s.account_inactive) or s.activity_visibility='hidden')) then new.last_seen_at:=null;end if;
 return new;
end $$;
revoke all on function public.profile_presence_privacy_guard() from public,anon,authenticated;


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
  if p_viewer is distinct from actor and exists(select 1 from user_settings s where s.user_id=actor and (s.ghost_mode or s.account_inactive))
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
 where nullif(trim(p.display_name),'') is not null and coalesce(settings.profile_visibility,'public')='public' and not coalesce((settings.ghost_mode or settings.account_inactive),false)
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
 from public.profiles p join public.user_settings settings on settings.user_id=p.user_id where (settings.profile_visibility='private' or (settings.ghost_mode or settings.account_inactive))
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
 where nullif(trim(p.display_name),'') is not null and coalesce(settings.profile_visibility,'public')='public' and not coalesce((settings.ghost_mode or settings.account_inactive),false)
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
 from public.profiles p join public.user_settings settings on settings.user_id=p.user_id where (settings.profile_visibility='private' or (settings.ghost_mode or settings.account_inactive))
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
