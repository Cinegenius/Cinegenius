-- Exact-row compare and publication/audit in one transaction. No content migration.
create or replace function public.admin_review_listing_transition(
 p_id uuid, p_expected jsonb, p_provider_company jsonb, p_provider_profile jsonb,
 p_published boolean, p_actor text, p_reason text
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare current_row jsonb; linked_company jsonb; linked_profile jsonb; provider_id text;
begin
 if p_actor is null or length(trim(p_actor))=0 or p_published is null
   or p_reason is null or length(trim(p_reason)) not between 5 and 500 then return 'invalid';end if;
 select to_jsonb(l) into current_row from listings l where l.id=p_id for update;
 if current_row is null then return 'missing';end if;
 if current_row is distinct from p_expected then return 'stale';end if;
 if current_row->>'company_id' is not null then
  select to_jsonb(c) into linked_company from companies c where c.id::text=current_row->>'company_id' for share;
  provider_id:=linked_company->>'owner_user_id';
 else provider_id:=current_row->>'user_id';end if;
 if provider_id is not null then
  select to_jsonb(p) into linked_profile from profiles p where p.user_id=provider_id for share;
 end if;
 if linked_company is distinct from p_provider_company or linked_profile is distinct from p_provider_profile then return 'stale';end if;
 if (current_row->>'published')::boolean is not distinct from p_published then return 'unchanged';end if;
 update listings set published=p_published where id=p_id;
 insert into admin_audit_log(actor_user_id,action,entity_type,entity_id,reason,outcome,metadata)
 values(p_actor,case when p_published then 'listing_publish' else 'listing_hide' end,'listing',p_id::text,trim(p_reason),'succeeded',jsonb_build_object('published',p_published,'reviewed',true));
 return 'saved';
end;$$;
revoke all on function public.admin_review_listing_transition(uuid,jsonb,jsonb,jsonb,boolean,text,text) from public,anon,authenticated;
grant execute on function public.admin_review_listing_transition(uuid,jsonb,jsonb,jsonb,boolean,text,text) to service_role;
