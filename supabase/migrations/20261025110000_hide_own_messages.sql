-- Personal deletion only. Recipients and the support record keep the message.
alter table public.messages add column if not exists hidden_for_sender_at timestamptz;

create or replace function public.hide_own_conversation_message(p_actor text,p_conversation uuid,p_message uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare joined timestamptz; hidden_id uuid;
begin
 -- Use the same lock order as sending and leaving a conversation.
 perform 1 from public.conversations where id=p_conversation for update;
 select cm.joined_at into joined from public.conversation_members cm
 where cm.conversation_id=p_conversation and cm.user_id=p_actor and cm.left_at is null for update;
 if not found then raise exception using errcode='42501',message='Nachricht nicht verfügbar.'; end if;
 update public.messages set hidden_for_sender_at=coalesce(hidden_for_sender_at,now())
 where id=p_message and conversation_id=p_conversation and sender_id=p_actor and created_at>=joined
 returning id into hidden_id;
 if hidden_id is null then raise exception using errcode='42501',message='Nachricht nicht verfügbar.'; end if;
 return hidden_id;
end; $$;
revoke all on function public.hide_own_conversation_message(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.hide_own_conversation_message(text,uuid,uuid) to service_role;
