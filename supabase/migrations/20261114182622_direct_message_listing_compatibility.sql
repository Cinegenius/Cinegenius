-- Production conversations.listing_id is text; API parameters remain UUID.
-- Compare canonical text on both sides, including NULL for ordinary chats.
-- Keep existing conversations, membership, read receipts and send keys intact.
CREATE OR REPLACE FUNCTION public.start_direct_conversation(p_sender_id text,p_receiver_id text,p_content text,p_idempotency_key text,p_listing_id uuid DEFAULT NULL,p_listing_title text DEFAULT NULL,p_listing_type text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE payload jsonb; replay jsonb; conversation_id uuid; message public.messages;
BEGIN
  IF p_receiver_id IS NULL OR p_receiver_id !~ '^[A-Za-z0-9_-]{1,128}$' OR p_receiver_id='cinegenius-support' OR p_sender_id='cinegenius-support'
    OR p_receiver_id=p_sender_id OR nullif(btrim(p_content),'') IS NULL OR length(btrim(p_content))>5000
    OR length(coalesce(p_listing_title,''))>300 OR length(coalesce(p_listing_type,''))>80 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid';
  END IF;
  payload:=jsonb_build_object('operation','direct','recipient',p_receiver_id,'content',btrim(p_content),'listing',p_listing_id,'title',p_listing_title,'type',p_listing_type);
  replay:=public.messaging_operation_replay(p_sender_id,p_idempotency_key,payload);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('messaging-direct:'||least(p_sender_id,p_receiver_id)||':'||greatest(p_sender_id,p_receiver_id)||':'||coalesce(p_listing_id::text,'general'),0)) THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='messaging_busy';
  END IF;
  IF NOT public.messaging_recipient_available(p_sender_id,p_receiver_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='messaging_contact_unavailable';
  END IF;
  SELECT c.id INTO conversation_id FROM public.conversations c WHERE c.kind='direct'
    AND ((c.sender_id=p_sender_id AND c.receiver_id=p_receiver_id) OR (c.sender_id=p_receiver_id AND c.receiver_id=p_sender_id))
    AND c.listing_id::text IS NOT DISTINCT FROM p_listing_id::text
    AND EXISTS(SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id=c.id AND cm.user_id=p_sender_id AND cm.left_at IS NULL)
    AND EXISTS(SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id=c.id AND cm.user_id=p_receiver_id AND cm.left_at IS NULL)
    ORDER BY c.created_at,c.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.conversations(sender_id,receiver_id,kind,created_by,listing_id,listing_title,listing_type)
      VALUES(p_sender_id,p_receiver_id,'direct',p_sender_id,p_listing_id,p_listing_title,p_listing_type) RETURNING id INTO conversation_id;
    INSERT INTO public.conversation_members(conversation_id,user_id,role,joined_at)
      VALUES(conversation_id,p_sender_id,'member',now()),(conversation_id,p_receiver_id,'member',now());
  END IF;
  SELECT * INTO message FROM public.send_conversation_message(conversation_id,p_sender_id,p_content);
  INSERT INTO public.messaging_operations(actor_user_id,request_key,request_fingerprint,conversation_id,message_id)
    VALUES(p_sender_id,p_idempotency_key,sha256(convert_to(payload::text,'UTF8')),conversation_id,message.id);
  RETURN jsonb_build_object('conversationId',conversation_id,'message',to_jsonb(message),'created',true,'replayed',false);
END $$;

REVOKE ALL ON FUNCTION public.start_direct_conversation(text,text,text,text,uuid,text,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_direct_conversation(text,text,text,text,uuid,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
