-- Run after applying both community-media/direct-invitation migrations.
-- Uses synthetic profiles only; nothing is committed.
begin;
do $$
declare
  owner_id text := 'cg_verify_owner_'||gen_random_uuid();
  member_id text := 'cg_verify_member_'||gen_random_uuid();
  outsider_id text := 'cg_verify_other_'||gen_random_uuid();
  co_id uuid := gen_random_uuid();
  invite_id uuid;
  repeated_id uuid;
  result_status text;
begin
 insert into public.profiles(user_id,display_name,slug) values(owner_id,'Controlled verification owner',owner_id),(member_id,'Controlled verification member',member_id),(outsider_id,'Controlled verification outsider',outsider_id);
 insert into public.companies(id,owner_user_id,slug,name,published) values(co_id,owner_id,'verify-'||co_id,'Controlled verification company',false);
 invite_id:=public.invite_company_member(owner_id,co_id,member_id,array['Geschäftsführer/in','Technische Leitung']);
 repeated_id:=public.invite_company_member(owner_id,co_id,member_id,array['Geschäftsführer/in']);
 if repeated_id<>invite_id then raise exception 'Duplicate invitation'; end if;
 if exists(select 1 from public.company_members where company_id=co_id and user_id=member_id) then raise exception 'Unconfirmed public membership'; end if;
 if (select count(*) from public.notifications where user_id=member_id)<>1 then raise exception 'Duplicate notification'; end if;
 begin
  perform public.respond_company_invitation(outsider_id,invite_id,'accept');
  raise exception 'Unrelated recipient accepted';
 exception when insufficient_privilege then null;
 end;
 result_status:=public.respond_company_invitation(member_id,invite_id,'accept');
 if result_status<>'claimed' or not exists(select 1 from public.company_members where company_id=co_id and user_id=member_id and status='accepted' and role='member' and public_titles=array['Geschäftsführer/in','Technische Leitung']) then raise exception 'Acceptance or separation of permissions failed'; end if;
 perform public.respond_company_invitation(member_id,invite_id,'accept');
 if (select count(*) from public.company_members where company_id=co_id and user_id=member_id)<>1 then raise exception 'Duplicate membership'; end if;
 delete from public.company_members where company_id=co_id and user_id=member_id;
 invite_id:=public.invite_company_member(owner_id,co_id,member_id,array['Freie Mitarbeit']);
 perform public.respond_company_invitation(member_id,invite_id,'decline');
 invite_id:=public.invite_company_member(owner_id,co_id,member_id,array['Freie Mitarbeit']);
 perform public.respond_company_invitation(owner_id,invite_id,'revoke');
 insert into public.company_members(company_id,user_id,role,status,public_titles) values(co_id,member_id,'member','pending',array['Freie Mitarbeit']);
 begin
  perform public.invite_company_member(owner_id,co_id,member_id,array['Freie Mitarbeit']);
  raise exception 'Parallel invitation and request';
 exception when unique_violation then null;
 end;
 delete from public.company_members where company_id=co_id and user_id=member_id;
 if has_table_privilege('anon','public.public_community_media','select') or has_function_privilege('anon','public.invite_company_member(text,uuid,text,text[])','execute') then raise exception 'Anonymous access allowed'; end if;
end $$;
select 'PASS: production schema, private invitation, idempotency, notification, acceptance, member-only rights, decline, withdraw, request collision, denied anonymous access. All writes rolled back.' as result;

rollback;
