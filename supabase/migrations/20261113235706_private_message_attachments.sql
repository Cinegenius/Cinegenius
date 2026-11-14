-- Private chat files. Uploading never publishes an image or sends a message.
create table if not exists public.message_attachments (
 id uuid primary key,
 owner_user_id text not null,
 destination_key text not null check(destination_key ~ '^(conversation:[a-f0-9-]{36}|recipient:[A-Za-z0-9_-]{1,128})$'),
 reference_url text not null unique,
 storage_path text not null,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
 filename text not null check(length(filename) between 1 and 180),
 byte_size integer not null check(byte_size between 1 and 4194304),
 content_sha256 text not null check(content_sha256 ~ '^[a-f0-9]{64}$'),
 message_id uuid references public.messages(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.message_attachments enable row level security;
revoke all on public.message_attachments from public,anon,authenticated;
grant all on public.message_attachments to service_role;
create index if not exists message_attachments_message on public.message_attachments(message_id) where message_id is not null;
create index if not exists message_attachments_owner on public.message_attachments(owner_user_id,created_at);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('message-documents','message-documents',false,4194304,array['application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.media_assets drop constraint if exists media_assets_source_type_check;
alter table public.media_assets add constraint media_assets_source_type_check check(source_type in
 ('profile','company','listing','project','project_draft','community_post','company_equipment','organization','organization_entry','message'));

create or replace function public.message_attachment_target(p_actor text,p_destination text)
returns boolean language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target uuid; recipient text;
begin
 if p_actor is null then return false;end if;
 if p_destination ~ '^recipient:[A-Za-z0-9_-]{1,128}$' then
  recipient:=substring(p_destination from 11);
  return recipient<>p_actor and recipient<>'cinegenius-support' and public.messaging_recipient_available(p_actor,recipient);
 elsif p_destination ~ '^conversation:[a-f0-9-]{36}$' then
  target:=substring(p_destination from 14)::uuid;
  return exists(select 1 from conversation_members cm join conversations c on c.id=cm.conversation_id
   where cm.user_id=p_actor and cm.conversation_id=target and cm.left_at is null
    and (c.kind<>'support' or c.receiver_id=p_actor));
 end if;
 return false;
end $$;

create or replace function public.readable_message_attachment(p_id uuid,p_viewer text)
returns setof public.message_attachments language sql stable security definer set search_path=public,pg_temp as $$
 select a.* from message_attachments a where a.id=p_id and p_viewer is not null and (
  (a.message_id is null and a.owner_user_id=p_viewer) or exists(
   select 1 from messages m join conversations c on c.id=m.conversation_id
   join conversation_members cm on cm.conversation_id=c.id and cm.user_id=p_viewer and cm.left_at is null
   where m.id=a.message_id and m.created_at>=cm.joined_at
    and (m.sender_id<>p_viewer or m.hidden_for_sender_at is null)
    and (c.kind<>'support' or c.receiver_id=p_viewer)
    and not exists(select 1 from blocks b where (b.blocker_id=m.sender_id and b.blocked_id=p_viewer) or (b.blocked_id=m.sender_id and b.blocker_id=p_viewer))
  ));
$$;

create or replace function public.message_attachment_json(p_message uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'url',reference_url,'name',filename,'mime',mime_type,'size',byte_size) order by created_at,id),'[]'::jsonb)
 from message_attachments where message_id=p_message;
$$;

create or replace function public.send_message_with_attachments(
 p_actor text,p_content text,p_key text,p_attachments uuid[],p_conversation uuid default null,p_recipient text default null,
 p_listing_id uuid default null,p_listing_title text default null,p_listing_type text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp set lock_timeout='2s' as $$
declare payload jsonb;replay jsonb;target uuid:=p_conversation;conversation conversations;recipient record;message messages;attachment message_attachments;destination text;ids uuid[];
begin
 select array_agg(distinct value order by value) into ids from unnest(p_attachments) value;
 if p_actor is null or p_actor='cinegenius-support' or p_content is null or length(btrim(p_content))>5000
  or coalesce(cardinality(ids),0) not between 1 and 5 or cardinality(ids)<>cardinality(p_attachments)
  or (p_conversation is null)=(p_recipient is null) then
  raise exception using errcode='22023',message='messaging_invalid';end if;
 destination:=case when target is null then 'recipient:'||p_recipient else 'conversation:'||target::text end;
 payload:=jsonb_build_object('operation','attachment-send','conversation',target,'recipient',p_recipient,'content',btrim(p_content),'attachments',ids,'listing',p_listing_id,'title',p_listing_title,'type',p_listing_type);
 replay:=public.messaging_operation_replay(p_actor,p_key,payload);
 if replay is not null then
  if exists(select 1 from message_attachments a where a.message_id=(replay->'message'->>'id')::uuid and not exists(select 1 from readable_message_attachment(a.id,p_actor))) then
   raise exception using errcode='PT404',message='messaging_unavailable';end if;
  return jsonb_set(replay,'{message,attachments}',public.message_attachment_json((replay->'message'->>'id')::uuid));
 end if;
 -- Lock unbound uploads before sending. No client URL, filename or MIME grants access.
 foreach target in array ids loop
  select * into attachment from message_attachments where id=target for update;
  if not found or attachment.owner_user_id<>p_actor or attachment.message_id is not null or attachment.destination_key<>destination then
   raise exception using errcode='42501',message='messaging_contact_unavailable';end if;
  if attachment.mime_type like 'image/%' then
   perform 1 from media_assets a where a.reference_url=attachment.reference_url and a.owner_user_id=p_actor and a.source_type is null for update;
   if not found then raise exception using errcode='42501',message='messaging_contact_unavailable';end if;
  end if;
 end loop;
 target:=p_conversation;
 if target is null then
  if p_recipient is null or p_recipient !~ '^[A-Za-z0-9_-]{1,128}$' or p_recipient in (p_actor,'cinegenius-support') or length(coalesce(p_listing_title,''))>300 or length(coalesce(p_listing_type,''))>80 then
   raise exception using errcode='22023',message='messaging_invalid';end if;
  if not pg_try_advisory_xact_lock(hashtextextended('messaging-direct:'||least(p_actor,p_recipient)||':'||greatest(p_actor,p_recipient)||':'||coalesce(p_listing_id::text,'general'),0)) then
   raise exception using errcode='PT409',message='messaging_busy';end if;
  if not public.messaging_recipient_available(p_actor,p_recipient) then raise exception using errcode='42501',message='messaging_contact_unavailable';end if;
  select c.id into target from conversations c where c.kind='direct'
   and ((c.sender_id=p_actor and c.receiver_id=p_recipient) or (c.sender_id=p_recipient and c.receiver_id=p_actor)) and c.listing_id is not distinct from p_listing_id
   and exists(select 1 from conversation_members cm where cm.conversation_id=c.id and cm.user_id=p_actor and cm.left_at is null)
   and exists(select 1 from conversation_members cm where cm.conversation_id=c.id and cm.user_id=p_recipient and cm.left_at is null)
   order by c.created_at,c.id limit 1 for update;
  if not found then
   insert into conversations(sender_id,receiver_id,kind,created_by,listing_id,listing_title,listing_type) values(p_actor,p_recipient,'direct',p_actor,p_listing_id,p_listing_title,p_listing_type) returning id into target;
   insert into conversation_members(conversation_id,user_id,role,joined_at) values(target,p_actor,'member',now()),(target,p_recipient,'member',now());
  end if;
 end if;
 -- Same conversation lock and current recipient checks as a normal text send.
 select * into conversation from conversations where id=target for update;
 if not found then raise exception using errcode='PT404',message='messaging_unavailable';end if;
 perform 1 from conversation_members where conversation_id=target and user_id=p_actor and left_at is null for update;
 if not found then raise exception using errcode='PT404',message='messaging_inactive';end if;
 if conversation.kind='support' then
  if conversation.receiver_id is distinct from p_actor then raise exception using errcode='42501',message='messaging_unavailable';end if;
 else
  if not exists(select 1 from conversation_members where conversation_id=target and left_at is null and user_id<>p_actor) then raise exception using errcode='PT404',message='messaging_unavailable';end if;
  for recipient in select user_id from conversation_members where conversation_id=target and left_at is null and user_id<>p_actor order by user_id loop
   if recipient.user_id='cinegenius-support' then raise exception using errcode='42501',message='messaging_contact_unavailable';end if;
   perform public.messaging_assert_pair(p_actor,recipient.user_id,false,false);
  end loop;
 end if;
 insert into messages(conversation_id,sender_id,content) values(target,p_actor,btrim(p_content)) returning * into message;
 update message_attachments set message_id=message.id where id=any(ids);
 update media_assets a set source_type='message',source_id=message.id::text where a.reference_url in(select reference_url from message_attachments where message_id=message.id) and a.source_type is null;
 update conversations set updated_at=now() where id=target;
 insert into messaging_operations(actor_user_id,request_key,request_fingerprint,conversation_id,message_id) values(p_actor,p_key,sha256(convert_to(payload::text,'UTF8')),target,message.id);
 return jsonb_build_object('conversationId',target,'message',to_jsonb(message)||jsonb_build_object('attachments',public.message_attachment_json(message.id)),'created',true,'replayed',false);
end $$;

revoke all on function public.message_attachment_target(text,text),public.readable_message_attachment(uuid,text),public.message_attachment_json(uuid),public.send_message_with_attachments(text,text,text,uuid[],uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.message_attachment_target(text,text),public.readable_message_attachment(uuid,text),public.message_attachment_json(uuid),public.send_message_with_attachments(text,text,text,uuid[],uuid,text,uuid,text,text) to service_role;

-- Preserve every existing canonical media permission branch.
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
