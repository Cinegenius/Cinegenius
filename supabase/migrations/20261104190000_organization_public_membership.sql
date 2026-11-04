-- Public presentation is separate from technical administration; existing memberships stay private.
alter table public.organization_members add column public_profile boolean not null default false;
create function public.reset_organization_member_visibility() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.status <> 'active' or old.status <> 'active' then new.public_profile := false; end if;
 return new;
end $$;
create trigger organization_member_visibility_reset before update on public.organization_members
for each row execute function public.reset_organization_member_visibility();
create function public.set_organization_profile_visibility(p_org uuid,p_actor text,p_visible boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from organizations where id=p_org for update;
 if not found or nullif(p_actor,'') is null or p_visible is null then raise exception 'forbidden' using errcode='42501'; end if;
 update organization_members set public_profile=p_visible,updated_at=now()
 where organization_id=p_org and user_id=p_actor and status='active';
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 insert into organization_access_events(organization_id,actor_user_id,action,target_id)
 values(p_org,p_actor,case when p_visible then 'show_own_profile' else 'hide_own_profile' end,p_actor);
end $$;
revoke all on function public.set_organization_profile_visibility(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.set_organization_profile_visibility(uuid,text,boolean) to service_role;
