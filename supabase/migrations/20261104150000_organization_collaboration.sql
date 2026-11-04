-- Confirmed organization administration and company associations. No backfill.
create table public.organization_invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 token_hash text not null unique, recipient_hash text not null, recipient_email text not null default '', created_by text not null,
 status text not null default 'pending' check(status in ('pending','accepted','declined','revoked','expired')),
 accepted_by text, expires_at timestamptz not null default now()+interval '14 days', created_at timestamptz not null default now()
);
create unique index organization_invitation_pending on public.organization_invitations(organization_id,recipient_hash) where status='pending';
create table public.organization_company_links (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 company_id uuid not null references public.companies(id), requested_by text not null,
 status text not null default 'pending' check(status in ('pending','accepted','declined','revoked')),
 decided_by text, created_at timestamptz not null default now(), decided_at timestamptz
);
create unique index organization_company_current on public.organization_company_links(organization_id) where status in ('pending','accepted');
create table public.organization_access_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 actor_user_id text not null, action text not null, target_id text not null, created_at timestamptz not null default now()
);
alter table public.organization_invitations enable row level security;
alter table public.organization_company_links enable row level security;
alter table public.organization_access_events enable row level security;
revoke all on public.organization_invitations,public.organization_company_links,public.organization_access_events from public,anon,authenticated;
grant all on public.organization_invitations,public.organization_company_links,public.organization_access_events to service_role;

-- Actor and verified address hashes are supplied only by authenticated server handlers.
create function public.change_organization_access(p_org uuid,p_actor text,p_action text,p_target text default '',p_token text default '',p_hashes text[] default '{}',p_recipient text default '') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.organizations%rowtype; i public.organization_invitations%rowtype; l public.organization_company_links%rowtype; result_id uuid; company_owner text;
begin
 select * into o from organizations where id=p_org for update;
 if not found or nullif(p_actor,'') is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action in ('invite','revoke_invite','remove_member','request_link') and o.owner_user_id<>p_actor then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_action='invite' then
  if p_token !~ '^[a-f0-9]{64}$' or p_target !~ '^[a-f0-9]{64}$' then raise exception 'invalid' using errcode='22023'; end if;
  update organization_invitations set status='expired' where organization_id=p_org and status='pending' and expires_at<=now();
  insert into organization_invitations(organization_id,token_hash,recipient_hash,recipient_email,created_by) values(p_org,p_token,p_target,p_recipient,p_actor) returning id into result_id;
 elsif p_action in ('accept_invite','decline_invite','revoke_invite') then
  select * into i from organization_invitations where organization_id=p_org and id=p_target::uuid for update;
  if not found then raise exception 'unavailable' using errcode='PT409'; end if;
  if p_action<>'revoke_invite' and (not (i.recipient_hash=any(p_hashes)) or i.token_hash<>p_token or p_actor=o.owner_user_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if i.status<>'pending' or i.expires_at<=now() then raise exception 'unavailable' using errcode='PT409'; end if;
  if p_action='accept_invite' then
   insert into organization_members(organization_id,user_id,role,status) values(p_org,p_actor,'admin','active')
    on conflict(organization_id,user_id) do update set role='admin',status='active',updated_at=now();
  end if;
  update organization_invitations set status=case p_action when 'accept_invite' then 'accepted' when 'decline_invite' then 'declined' else 'revoked' end,accepted_by=case when p_action='accept_invite' then p_actor else null end where id=i.id;
  result_id=i.id;
 elsif p_action in ('remove_member','leave') then
  if p_action='leave' then p_target:=p_actor; end if;
  if p_target=o.owner_user_id then raise exception 'owner_required' using errcode='42501'; end if;
  update organization_members set status='ended',updated_at=now() where organization_id=p_org and user_id=p_target and status='active';
  if not found then raise exception 'unavailable' using errcode='PT409'; end if;
 elsif p_action='request_link' then
  perform 1 from companies where id=p_target::uuid and published=true;
  if not found then raise exception 'unavailable' using errcode='PT409'; end if;
  insert into organization_company_links(organization_id,company_id,requested_by) values(p_org,p_target::uuid,p_actor) returning id into result_id;
 elsif p_action in ('accept_link','decline_link','revoke_link') then
  select * into l from organization_company_links where organization_id=p_org and id=p_target::uuid for update;
  if not found then raise exception 'unavailable' using errcode='PT409'; end if;
  select owner_user_id into company_owner from companies where id=l.company_id for update;
  if not (coalesce(company_owner=p_actor,false) or exists(select 1 from company_members where company_id=l.company_id and user_id=p_actor and status='accepted' and role='admin')) then
   if p_action<>'revoke_link' or o.owner_user_id<>p_actor then raise exception 'forbidden' using errcode='42501'; end if;
  end if;
  if (p_action='revoke_link' and l.status not in ('pending','accepted')) or (p_action<>'revoke_link' and l.status<>'pending') then raise exception 'unavailable' using errcode='PT409'; end if;
  update organization_company_links set status=case p_action when 'accept_link' then 'accepted' when 'decline_link' then 'declined' else 'revoked' end,decided_by=p_actor,decided_at=now() where id=l.id;
  result_id=l.id;
 else raise exception 'invalid' using errcode='22023'; end if;
 insert into organization_access_events(organization_id,actor_user_id,action,target_id) values(p_org,p_actor,p_action,coalesce(result_id::text,p_target));
 return jsonb_build_object('id',result_id);
end $$;
revoke all on function public.change_organization_access(uuid,text,text,text,text,text[],text) from public,anon,authenticated;
grant execute on function public.change_organization_access(uuid,text,text,text,text,text[],text) to service_role;
