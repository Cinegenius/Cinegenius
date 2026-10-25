-- Targeted invitations are private until the invited member confirms.
alter table public.company_invitations add column if not exists recipient_user_id text;
alter table public.company_invitations drop constraint if exists company_invitations_status_check;
alter table public.company_invitations add constraint company_invitations_status_check check(status in ('pending','claimed','revoked','declined'));
create unique index if not exists company_direct_invitation_pending_unique on public.company_invitations(company_id,recipient_user_id) where recipient_user_id is not null and status='pending';
create index if not exists company_direct_invitation_recipient on public.company_invitations(recipient_user_id,created_at desc) where recipient_user_id is not null;
grant select,insert,update,delete on public.company_invitations to service_role;

-- Serialize requests and invitations for the same pair, including old API writers.
create or replace function public.guard_company_membership_pair() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare target_user text;
begin
 target_user := case when tg_table_name='company_members' then to_jsonb(new)->>'user_id' else to_jsonb(new)->>'recipient_user_id' end;
 if target_user is null then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.company_id::text||':'||target_user,0));
 if tg_table_name='company_members' and new.status in ('pending','accepted') then
  if exists(select 1 from public.company_invitations i where i.company_id=new.company_id and i.recipient_user_id=target_user and i.status='pending' and i.expires_at>now()) then
   raise exception using errcode='23505',message='Für diese Person liegt bereits eine Einladung vor.';
  end if;
 elsif tg_table_name='company_invitations' and new.status='pending' and (to_jsonb(new)->>'expires_at')::timestamptz>now() then
  if exists(select 1 from public.company_members m where m.company_id=new.company_id and m.user_id=target_user and m.status in ('pending','accepted')) then
   raise exception using errcode='23505',message='Für diese Person besteht bereits eine Zugehörigkeit oder Anfrage.';
  end if;
 end if;
 return new;
end; $$;
drop trigger if exists company_member_pair_guard on public.company_members;
create trigger company_member_pair_guard before insert or update on public.company_members for each row execute function public.guard_company_membership_pair();
drop trigger if exists company_invitation_pair_guard on public.company_invitations;
create trigger company_invitation_pair_guard before insert or update on public.company_invitations for each row execute function public.guard_company_membership_pair();

create or replace function public.invite_company_member(p_actor text,p_company uuid,p_recipient text,p_titles text[])
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare co public.companies; invitation_id uuid;
begin
 select * into co from public.companies where id=p_company;
 if co.id is null or not(co.owner_user_id=p_actor or exists(select 1 from public.company_members m where m.company_id=p_company and m.user_id=p_actor and m.status='accepted' and m.role='admin')) then
  raise exception using errcode='42501',message='Keine Berechtigung, Teammitglieder einzuladen.';
 end if;
 if p_recipient=p_actor or p_recipient=co.owner_user_id or not exists(select 1 from public.profiles p where p.user_id=p_recipient and nullif(trim(p.display_name),'') is not null) then
  raise exception using errcode='22023',message='Diese Person kann nicht eingeladen werden.';
 end if;
 if coalesce(array_length(p_titles,1),0) not between 1 and 5 or exists(select 1 from unnest(p_titles) t where length(trim(t)) not between 1 and 80) then
  raise exception using errcode='22023',message='Bitte wähle eine bis fünf öffentliche Funktionen.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company::text||':'||p_recipient,0));
 update public.company_invitations set status='revoked' where company_id=p_company and recipient_user_id=p_recipient and status='pending' and expires_at<=now();
 select id into invitation_id from public.company_invitations where company_id=p_company and recipient_user_id=p_recipient and status='pending';
 if invitation_id is not null then return invitation_id; end if;
 insert into public.company_invitations(company_id,recipient_user_id,token_hash,permission_role,public_titles,created_by,expires_at)
 values(p_company,p_recipient,gen_random_uuid()::text,'member',p_titles,p_actor,now()+interval '14 days') returning id into invitation_id;
 insert into public.notifications(user_id,type,title,body,href) values(p_recipient,'company_invitation','Einladung ins Firmenteam',co.name||' lädt dich ein: '||array_to_string(p_titles,' · ')||'. Die Zuordnung wird erst nach deiner Annahme öffentlich.','/company-invitations');
 return invitation_id;
end; $$;

create or replace function public.respond_company_invitation(p_actor text,p_invitation uuid,p_decision text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare inv public.company_invitations; co public.companies; next_status text;
begin
 select * into inv from public.company_invitations where id=p_invitation;
 if inv.id is null or inv.recipient_user_id is null then raise exception using errcode='22023',message='Einladung nicht gefunden.'; end if;
 -- Use the same lock ordering as every request/invitation writer.
 perform pg_advisory_xact_lock(hashtextextended(inv.company_id::text||':'||inv.recipient_user_id,0));
 select * into inv from public.company_invitations where id=p_invitation for update;
 select * into co from public.companies where id=inv.company_id;
 if p_decision='revoke' then
  if not(co.owner_user_id=p_actor or exists(select 1 from public.company_members m where m.company_id=inv.company_id and m.user_id=p_actor and m.status='accepted' and m.role='admin')) then raise exception using errcode='42501',message='Keine Berechtigung.'; end if;
  next_status:='revoked';
 elsif p_actor=inv.recipient_user_id and p_decision in ('accept','decline') then
  next_status:=case when p_decision='accept' then 'claimed' else 'declined' end;
 else raise exception using errcode='42501',message='Nur die eingeladene Person darf antworten.';
 end if;
 if inv.status=next_status then return next_status; end if;
 if inv.status<>'pending' or inv.expires_at<=now() then raise exception using errcode='22023',message='Diese Einladung ist nicht mehr offen oder abgelaufen.'; end if;
 -- Invalidation and membership creation are one transaction; failure rolls both back.
 update public.company_invitations set status=next_status,claimed_by=case when p_decision='accept' then p_actor else null end where id=inv.id;
 if p_decision='accept' then
  if co.owner_user_id=p_actor or exists(select 1 from public.company_members m where m.company_id=inv.company_id and m.user_id=p_actor and m.status in ('pending','accepted')) then raise exception using errcode='23505',message='Es besteht bereits eine Zugehörigkeit oder Anfrage.'; end if;
  insert into public.company_members(company_id,user_id,role,title,public_titles,status)
  values(inv.company_id,p_actor,'member',inv.public_titles[1],inv.public_titles,'accepted');
 end if;
 insert into public.notifications(user_id,type,title,body,href) values(
  case when p_decision='revoke' then inv.recipient_user_id else inv.created_by end,
  'company_invitation_response',case p_decision when 'accept' then 'Teameinladung angenommen' when 'decline' then 'Teameinladung abgelehnt' else 'Teameinladung zurückgezogen' end,
  co.name||': '||array_to_string(inv.public_titles,' · '),case when p_decision='revoke' then '/company-invitations' else '/company-dashboard?company_id='||co.id::text||'&tab=team' end);
 return next_status;
end; $$;
revoke all on function public.invite_company_member(text,uuid,text,text[]),public.respond_company_invitation(text,uuid,text),public.guard_company_membership_pair() from public,anon,authenticated;
grant execute on function public.invite_company_member(text,uuid,text,text[]),public.respond_company_invitation(text,uuid,text) to service_role;

-- Search only approved public fields, filter privacy and existing relationships
-- before applying the result limit. No account email/phone is selected.
create or replace function public.search_company_candidates(p_actor text,p_company uuid,p_query text)
returns table(user_id text,display_name text,avatar_url text,slug text,role text,positions text[],location text)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.user_id,p.display_name,p.avatar_url,p.slug,p.role,p.positions,p.location
 from public.profiles p join public.companies c on c.id=p_company
 left join public.user_settings settings on settings.user_id=p.user_id
 where length(trim(p_query)) between 2 and 80
   and (c.owner_user_id=p_actor or exists(select 1 from public.company_members actor where actor.company_id=c.id and actor.user_id=p_actor and actor.status='accepted' and actor.role='admin'))
   and p.user_id<>p_actor and p.user_id<>c.owner_user_id
   and coalesce(settings.profile_visibility,'public')<>'private'
   and p.display_name ilike '%'||p_query||'%'
   and not exists(select 1 from public.company_members m where m.company_id=c.id and m.user_id=p.user_id and m.status in ('pending','accepted'))
   and not exists(select 1 from public.company_invitations i where i.company_id=c.id and i.recipient_user_id=p.user_id and i.status='pending' and i.expires_at>now())
 order by p.display_name,p.user_id limit 20;
$$;
revoke all on function public.search_company_candidates(text,uuid,text) from public,anon,authenticated;
grant execute on function public.search_company_candidates(text,uuid,text) to service_role;
