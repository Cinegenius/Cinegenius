-- Additive protection for project artwork. No project/file updates or deletions.
create or replace function public.project_media_has_rights(item jsonb, reference text)
returns boolean language sql immutable set search_path=public,pg_temp as $$
 select coalesce(
  item->'metadata'->'media_rights'->>'version'='1'
  and nullif(item->>'created_by','') is not null
  and item->'metadata'->'media_rights'->>'confirmed_by'=item->>'created_by'
  and nullif(trim(item->'metadata'->'media_rights'->>'confirmed_at'),'') is not null
  and nullif(trim(item->'metadata'->'media_rights'->>'holder'),'') is not null
  and item->'metadata'->'media_rights'->>'basis' in ('own','permission','press','license')
  and (item->'metadata'->'media_rights'->>'basis'='own' or nullif(trim(item->'metadata'->'media_rights'->>'source'),'') is not null)
  and jsonb_typeof(item->'metadata'->'media_rights'->'urls')='array'
  and (item->'metadata'->'media_rights'->'urls') ? reference
 ,false);
$$;
revoke all on function public.project_media_has_rights(jsonb,text) from public,anon,authenticated;
grant execute on function public.project_media_has_rights(jsonb,text) to service_role;

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
   visible:=(p_viewer is not null and p_viewer=actor) or public.project_media_has_rights(item,a.reference_url);
  elsif a.source_type='project_draft' then
   visible:=p_viewer is not null and p_viewer=actor and nullif(item->>'published_project_id','') is null;
  elsif a.source_type='community_post' then
   visible:=(p_viewer is not null and p_viewer=actor) or (nullif(item->>'expires_at','') is not null and (item->>'expires_at')::timestamptz>now());
  end if;
  if p_viewer is not null and p_viewer is distinct from actor and exists(select 1 from blocks b where (b.blocker_id=actor and b.blocked_id=p_viewer) or (b.blocker_id=p_viewer and b.blocked_id=actor)) then visible:=false;end if;
 end if;
 if visible then return query select a.storage_path,a.mime_type;end if;
end $$;

revoke all on function public.readable_media_asset(text,text) from public,anon,authenticated;
grant execute on function public.readable_media_asset(text,text) to service_role;
notify pgrst,'reload schema';
