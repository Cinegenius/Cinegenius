-- Manual, exact-version company publication. No existing company is modified here.
create or replace function public.admin_review_company_publication(
 p_id uuid, p_expected jsonb, p_owner_profile jsonb, p_actor text, p_reason text
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare current_row jsonb; owner_profile jsonb;
begin
 if nullif(trim(p_actor),'') is null or p_reason is null or length(trim(p_reason)) not between 5 and 500 then return 'invalid';end if;
 select to_jsonb(c) into current_row from companies c where c.id=p_id for update;
 if current_row is null then return 'missing';end if;
 if current_row is distinct from p_expected then return 'stale';end if;
 if nullif(trim(current_row->>'owner_user_id'),'') is null or nullif(trim(current_row->>'slug'),'') is null then return 'provider_required';end if;
 select to_jsonb(p) into owner_profile from profiles p where p.user_id=current_row->>'owner_user_id' for share;
 if owner_profile is distinct from p_owner_profile then return 'stale';end if;
 if (current_row->>'published')::boolean is true then return 'unchanged';end if;
 update companies set published=true,updated_at=now() where id=p_id;
 insert into admin_audit_log(actor_user_id,action,entity_type,entity_id,reason,outcome,metadata)
 values(p_actor,'company_publish','company',p_id::text,trim(p_reason),'succeeded',jsonb_build_object('published',true,'reviewed',true,'previously_private',true));
 return 'saved';
end;$$;
revoke all on function public.admin_review_company_publication(uuid,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.admin_review_company_publication(uuid,jsonb,jsonb,text,text) to service_role;
