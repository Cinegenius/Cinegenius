-- Private, service-only messaging operations. Existing conversations, messages,
-- memberships and read receipts are preserved; legacy chats are never merged.
BEGIN;

CREATE TABLE IF NOT EXISTS public.messaging_operations (
  actor_user_id text NOT NULL,
  request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_-]{8,128}$'),
  request_fingerprint bytea NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_user_id, request_key)
);
ALTER TABLE public.messaging_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messaging_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_operations TO service_role;

-- Coordinate privacy edits even when a settings row did not previously exist.
CREATE OR REPLACE FUNCTION public.messaging_settings_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.message_permission IS NOT DISTINCT FROM OLD.message_permission
    AND NEW.profile_visibility IS NOT DISTINCT FROM OLD.profile_visibility THEN RETURN NEW; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('messaging-settings:'||NEW.user_id,0)) THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='messaging_busy';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER messaging_settings_guard BEFORE INSERT OR UPDATE OF message_permission,profile_visibility ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.messaging_settings_guard();

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocks FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.blocks TO service_role;
CREATE OR REPLACE FUNCTION public.set_member_block(p_actor text,p_target text,p_blocked boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE current_state boolean;
BEGIN
  IF p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' OR p_target IS NULL OR p_target !~ '^[A-Za-z0-9_-]{1,128}$'
    OR p_target=p_actor OR p_target='cinegenius-support' OR p_blocked IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid'; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('contact:'||least(p_actor,p_target)||':'||greatest(p_actor,p_target),0)) THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='messaging_busy';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.blocks WHERE blocker_id=p_actor AND blocked_id=p_target) INTO current_state;
  IF p_blocked AND NOT current_state THEN INSERT INTO public.blocks(blocker_id,blocked_id) VALUES(p_actor,p_target);
  ELSIF NOT p_blocked AND current_state THEN DELETE FROM public.blocks WHERE blocker_id=p_actor AND blocked_id=p_target; END IF;
  RETURN jsonb_build_object('blocked',p_blocked,'changed',current_state IS DISTINCT FROM p_blocked);
END $$;

-- Group admission protects both parties. Sending checks the recipient's current
-- message consent, while preserving existing histories and memberships.
CREATE OR REPLACE FUNCTION public.messaging_assert_pair(p_sender text, p_recipient text, p_symmetric boolean, p_private boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE friends boolean; sender_settings public.user_settings; recipient_settings public.user_settings; participant text;
BEGIN
  IF p_sender IS NULL OR p_recipient IS NULL OR p_sender=p_recipient THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid';
  END IF;
  -- Permission readers may overlap. Contact/block/settings writers acquire
  -- the matching exclusive lock, which remains held through the message write.
  IF NOT pg_try_advisory_xact_lock_shared(hashtextextended('contact:'||least(p_sender,p_recipient)||':'||greatest(p_sender,p_recipient),0)) THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='messaging_busy';
  END IF;
  FOR participant IN SELECT unnest(ARRAY[least(p_sender,p_recipient),greatest(p_sender,p_recipient)]) LOOP
    IF NOT pg_try_advisory_xact_lock_shared(hashtextextended('messaging-settings:'||participant,0)) THEN
      RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='messaging_busy';
    END IF;
  END LOOP;
  PERFORM 1 FROM public.user_settings WHERE user_id IN (p_sender,p_recipient) ORDER BY user_id FOR SHARE;
  SELECT * INTO sender_settings FROM public.user_settings WHERE user_id=p_sender;
  SELECT * INTO recipient_settings FROM public.user_settings WHERE user_id=p_recipient;
  SELECT EXISTS(SELECT 1 FROM public.friendships WHERE status='accepted'
    AND ((sender_id=p_sender AND receiver_id=p_recipient) OR (sender_id=p_recipient AND receiver_id=p_sender))) INTO friends;
  IF EXISTS(SELECT 1 FROM public.blocks WHERE
    (blocker_id=p_sender AND blocked_id=p_recipient) OR (blocker_id=p_recipient AND blocked_id=p_sender))
    OR (recipient_settings.message_permission='friends_only' AND NOT friends)
    OR (p_symmetric AND sender_settings.message_permission='friends_only' AND NOT friends)
    OR (p_private AND NOT friends AND (recipient_settings.profile_visibility='private'
      OR (p_symmetric AND sender_settings.profile_visibility='private'))) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='messaging_contact_unavailable';
  END IF;
END $$;

-- The acting member explicitly chooses to share their own chat identity. Every
-- other private participant still needs an accepted relationship with the new
-- person. Message consent and blocking apply to both directions in every case.
CREATE OR REPLACE FUNCTION public.messaging_assert_group_pair(p_actor text,p_first text,p_second text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
BEGIN
  IF p_first=p_actor THEN
    PERFORM public.messaging_assert_pair(p_first,p_second,true,false);
    PERFORM public.messaging_assert_pair(p_first,p_second,false,true);
  ELSIF p_second=p_actor THEN
    PERFORM public.messaging_assert_pair(p_second,p_first,true,false);
    PERFORM public.messaging_assert_pair(p_second,p_first,false,true);
  ELSE PERFORM public.messaging_assert_pair(p_first,p_second,true,true); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.messaging_recipient_available(p_sender text,p_recipient text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE has_profile boolean; public_provider boolean:=false;
BEGIN
  IF p_sender IS NULL OR p_recipient IS NULL OR p_sender=p_recipient OR p_sender='cinegenius-support' OR p_recipient='cinegenius-support' THEN RETURN false; END IF;
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=p_recipient) INTO has_profile;
  -- Public offer/company contact is already explicitly disclosed by its owner.
  -- It must not require creating a separate personal Crew profile. Lock the
  -- current public source so withdrawal cannot race the new message.
  IF NOT has_profile OR EXISTS(SELECT 1 FROM public.user_settings WHERE user_id=p_recipient AND profile_visibility='private') THEN
    PERFORM 1 FROM public.companies WHERE owner_user_id=p_recipient AND published=true AND nullif(btrim(slug),'') IS NOT NULL AND nullif(btrim(name),'') IS NOT NULL FOR SHARE;
    public_provider:=FOUND;
    IF NOT public_provider THEN
      PERFORM 1 FROM public.listings WHERE user_id=p_recipient AND company_id IS NULL AND published=true
        AND (has_profile OR responsible_person->>'userId'=p_recipient) FOR SHARE;
      public_provider:=FOUND;
    END IF;
  END IF;
  IF NOT has_profile AND NOT public_provider AND NOT EXISTS(SELECT 1 FROM public.friendships WHERE status='accepted' AND
    ((sender_id=p_sender AND receiver_id=p_recipient) OR (sender_id=p_recipient AND receiver_id=p_sender))) THEN RETURN false; END IF;
  PERFORM public.messaging_assert_pair(p_sender,p_recipient,false,NOT public_provider);
  RETURN true;
EXCEPTION WHEN insufficient_privilege OR invalid_parameter_value THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.messaging_available_recipients(p_sender text,p_recipients text[])
RETURNS TABLE(user_id text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE candidate text;
BEGIN
  IF coalesce(cardinality(p_recipients),0)>25 THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid'; END IF;
  FOR candidate IN SELECT DISTINCT unnest(p_recipients) LOOP
    IF public.messaging_recipient_available(p_sender,candidate) THEN user_id:=candidate; RETURN NEXT; END IF;
  END LOOP;
END $$;

-- Recheck all active recipients inside the same transaction that inserts a
-- message. The shared conversation lock serializes against removal/leave/add.
CREATE OR REPLACE FUNCTION public.send_conversation_message(p_conversation_id uuid,p_sender_id text,p_content text)
RETURNS SETOF public.messages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE conversation public.conversations; recipient record;
BEGIN
  IF nullif(btrim(p_content),'') IS NULL OR length(btrim(p_content))>5000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid';
  END IF;
  SELECT * INTO conversation FROM public.conversations WHERE id=p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_unavailable'; END IF;
  PERFORM 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND user_id=p_sender_id AND left_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_inactive'; END IF;
  IF conversation.kind='support' THEN
    IF conversation.receiver_id IS DISTINCT FROM p_sender_id THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='messaging_unavailable';
    END IF;
  ELSE
    IF p_sender_id='cinegenius-support' OR EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL AND user_id='cinegenius-support') THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='messaging_contact_unavailable';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL AND user_id<>p_sender_id) THEN
      RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_unavailable';
    END IF;
    FOR recipient IN SELECT user_id FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL AND user_id<>p_sender_id ORDER BY user_id LOOP
      PERFORM public.messaging_assert_pair(p_sender_id,recipient.user_id,false,false);
    END LOOP;
  END IF;
  RETURN QUERY INSERT INTO public.messages(conversation_id,sender_id,content)
    VALUES(p_conversation_id,p_sender_id,btrim(p_content)) RETURNING *;
  UPDATE public.conversations SET updated_at=now() WHERE id=p_conversation_id;
END $$;

CREATE OR REPLACE FUNCTION public.create_group_conversation(p_creator_id text,p_name text,p_member_ids text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE members text[]; participants text[]; group_id uuid; a integer; b integer;
BEGIN
  IF p_creator_id IS NULL OR p_creator_id !~ '^[A-Za-z0-9_-]{1,128}$' OR p_creator_id='cinegenius-support'
    OR nullif(btrim(p_name),'') IS NULL OR length(btrim(p_name))>80 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid';
  END IF;
  SELECT array_agg(DISTINCT member ORDER BY member) INTO members FROM unnest(p_member_ids) member WHERE member<>p_creator_id;
  IF coalesce(cardinality(members),0) NOT BETWEEN 1 AND 49 OR EXISTS(SELECT 1 FROM unnest(members) member WHERE member !~ '^[A-Za-z0-9_-]{1,128}$' OR member='cinegenius-support') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid';
  END IF;
  PERFORM 1 FROM public.profiles WHERE user_id=ANY(members) ORDER BY user_id FOR SHARE;
  IF (SELECT count(*) FROM public.profiles WHERE user_id=ANY(members))<>cardinality(members) THEN
    RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_member_unavailable';
  END IF;
  participants:=ARRAY(SELECT member FROM unnest(array_prepend(p_creator_id,members)) member ORDER BY member);
  FOR a IN 1..cardinality(participants)-1 LOOP
    FOR b IN a+1..cardinality(participants) LOOP
      PERFORM public.messaging_assert_group_pair(p_creator_id,participants[a],participants[b]);
    END LOOP;
  END LOOP;
  INSERT INTO public.conversations(sender_id,receiver_id,kind,group_name,created_by)
    VALUES(p_creator_id,NULL,'group',btrim(p_name),p_creator_id) RETURNING id INTO group_id;
  INSERT INTO public.conversation_members(conversation_id,user_id,role,joined_at)
    SELECT group_id,member,CASE WHEN member=p_creator_id THEN 'admin' ELSE 'member' END,now() FROM unnest(participants) member;
  RETURN group_id;
END $$;

CREATE OR REPLACE FUNCTION public.manage_group_conversation(p_conversation_id uuid,p_actor_id text,p_action text,p_target_user_id text DEFAULT NULL,p_name text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE actor_role text; target_role text; member record;
BEGIN
  PERFORM 1 FROM public.conversations WHERE id=p_conversation_id AND kind='group' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_unavailable'; END IF;
  SELECT role INTO actor_role FROM public.conversation_members WHERE conversation_id=p_conversation_id AND user_id=p_actor_id AND left_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_inactive'; END IF;
  IF p_action='leave' THEN
    IF actor_role='admin' AND EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL AND user_id<>p_actor_id)
      AND NOT EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL AND user_id<>p_actor_id AND role='admin') THEN
      RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='messaging_last_admin';
    END IF;
    UPDATE public.conversation_members SET left_at=now() WHERE conversation_id=p_conversation_id AND user_id=p_actor_id;
  ELSE
    IF actor_role<>'admin' THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='messaging_admin_required'; END IF;
    IF p_action='rename' THEN
      IF nullif(btrim(p_name),'') IS NULL OR length(btrim(p_name))>80 THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid'; END IF;
      UPDATE public.conversations SET group_name=btrim(p_name) WHERE id=p_conversation_id;
    ELSIF p_action='add' THEN
      IF p_target_user_id IS NULL OR p_target_user_id !~ '^[A-Za-z0-9_-]{1,128}$' OR p_target_user_id='cinegenius-support' OR p_target_user_id=p_actor_id THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid';
      END IF;
      IF EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND user_id=p_target_user_id AND left_at IS NULL) THEN RETURN; END IF;
      IF (SELECT count(*) FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL)>=50 THEN
        RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='messaging_group_full';
      END IF;
      PERFORM 1 FROM public.profiles WHERE user_id=p_target_user_id FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_member_unavailable'; END IF;
      FOR member IN SELECT user_id FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL ORDER BY user_id LOOP
        PERFORM public.messaging_assert_group_pair(p_actor_id,member.user_id,p_target_user_id);
      END LOOP;
      INSERT INTO public.conversation_members(conversation_id,user_id,role,joined_at,left_at)
        VALUES(p_conversation_id,p_target_user_id,'member',now(),NULL)
        ON CONFLICT(conversation_id,user_id) DO UPDATE SET role='member',joined_at=now(),left_at=NULL;
    ELSIF p_action IN ('remove','promote') THEN
      IF p_target_user_id IS NULL OR p_target_user_id=p_actor_id THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid'; END IF;
      SELECT role INTO target_role FROM public.conversation_members WHERE conversation_id=p_conversation_id AND user_id=p_target_user_id AND left_at IS NULL FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_member_unavailable'; END IF;
      IF p_action='promote' THEN
        UPDATE public.conversation_members SET role='admin' WHERE conversation_id=p_conversation_id AND user_id=p_target_user_id;
      ELSE
        UPDATE public.conversation_members SET left_at=now() WHERE conversation_id=p_conversation_id AND user_id=p_target_user_id;
      END IF;
    ELSE RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid'; END IF;
  END IF;
  UPDATE public.conversations SET updated_at=now() WHERE id=p_conversation_id;
END $$;

-- Every operation takes a bounded, account-scoped lock before checking its
-- durable fingerprint. PT409 never triggers PostgREST transaction retries.
CREATE OR REPLACE FUNCTION public.messaging_operation_replay(p_actor text,p_key text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE operation public.messaging_operations; message public.messages;
BEGIN
  IF p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' OR p_key IS NULL OR p_key !~ '^[A-Za-z0-9_-]{8,128}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('messaging-operation:'||p_actor||':'||p_key,0)) THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='messaging_busy';
  END IF;
  SELECT * INTO operation FROM public.messaging_operations WHERE actor_user_id=p_actor AND request_key=p_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF operation.request_fingerprint IS DISTINCT FROM sha256(convert_to(p_payload::text,'UTF8')) THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='messaging_key_reused';
  END IF;
  PERFORM 1 FROM public.conversations WHERE id=operation.conversation_id FOR SHARE;
  PERFORM 1 FROM public.conversation_members WHERE conversation_id=operation.conversation_id AND user_id=p_actor AND left_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_inactive'; END IF;
  IF operation.message_id IS NOT NULL THEN SELECT * INTO message FROM public.messages WHERE id=operation.message_id; END IF;
  RETURN jsonb_build_object('conversationId',operation.conversation_id,'message',CASE WHEN operation.message_id IS NULL THEN NULL ELSE to_jsonb(message) END,'created',false,'replayed',true);
END $$;

CREATE OR REPLACE FUNCTION public.send_conversation_message(p_conversation_id uuid,p_sender_id text,p_content text,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE payload jsonb; replay jsonb; message public.messages;
BEGIN
  payload:=jsonb_build_object('operation','send','conversation',p_conversation_id,'content',btrim(p_content));
  replay:=public.messaging_operation_replay(p_sender_id,p_idempotency_key,payload);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  SELECT * INTO message FROM public.send_conversation_message(p_conversation_id,p_sender_id,p_content);
  INSERT INTO public.messaging_operations(actor_user_id,request_key,request_fingerprint,conversation_id,message_id)
    VALUES(p_sender_id,p_idempotency_key,sha256(convert_to(payload::text,'UTF8')),p_conversation_id,message.id);
  RETURN jsonb_build_object('conversationId',p_conversation_id,'message',to_jsonb(message),'created',true,'replayed',false);
END $$;

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
    AND c.listing_id IS NOT DISTINCT FROM p_listing_id
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

CREATE OR REPLACE FUNCTION public.create_group_conversation(p_creator_id text,p_name text,p_member_ids text[],p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE members text[]; payload jsonb; replay jsonb; conversation_id uuid;
BEGIN
  SELECT array_agg(DISTINCT member ORDER BY member) INTO members FROM unnest(p_member_ids) member WHERE member<>p_creator_id;
  payload:=jsonb_build_object('operation','group','name',btrim(p_name),'members',members);
  replay:=public.messaging_operation_replay(p_creator_id,p_idempotency_key,payload);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  conversation_id:=public.create_group_conversation(p_creator_id,p_name,members);
  INSERT INTO public.messaging_operations(actor_user_id,request_key,request_fingerprint,conversation_id)
    VALUES(p_creator_id,p_idempotency_key,sha256(convert_to(payload::text,'UTF8')),conversation_id);
  RETURN jsonb_build_object('conversationId',conversation_id,'created',true,'replayed',false);
END $$;

-- Recipient keys can contain a 128-character account ID. Expand only the known
-- length constraint; existing recovery contents and revision rules are retained.
DO $draft_key_length$
DECLARE definition text;
BEGIN
  SELECT lower(regexp_replace(pg_get_constraintdef(oid),'[()[:space:]]','','g')) INTO definition
    FROM pg_constraint WHERE conrelid='public.private_form_drafts'::regclass AND conname='private_form_drafts_form_key_check';
  IF definition='checklengthform_key<=100' THEN
    ALTER TABLE public.private_form_drafts DROP CONSTRAINT private_form_drafts_form_key_check;
    ALTER TABLE public.private_form_drafts ADD CONSTRAINT private_form_drafts_form_key_check CHECK(length(form_key)<=180);
  ELSIF definition IS NULL THEN
    ALTER TABLE public.private_form_drafts ADD CONSTRAINT private_form_drafts_form_key_check CHECK(length(form_key)<=180);
  ELSIF definition<>'checklengthform_key<=180' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_draft_constraint_unexpected';
  END IF;
END $draft_key_length$;

REVOKE ALL ON FUNCTION public.messaging_assert_pair(text,text,boolean,boolean),public.messaging_recipient_available(text,text),public.messaging_operation_replay(text,text,jsonb),
  public.messaging_assert_group_pair(text,text,text),
  public.messaging_settings_guard(),public.set_member_block(text,text,boolean),
  public.messaging_available_recipients(text,text[]),
  public.send_conversation_message(uuid,text,text),public.send_conversation_message(uuid,text,text,text),public.start_direct_conversation(text,text,text,text,uuid,text,text),
  public.create_group_conversation(text,text,text[]),public.create_group_conversation(text,text,text[],text),public.manage_group_conversation(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_block(text,text,boolean),public.messaging_recipient_available(text,text),public.messaging_available_recipients(text,text[]),public.send_conversation_message(uuid,text,text),public.send_conversation_message(uuid,text,text,text),
  public.start_direct_conversation(text,text,text,text,uuid,text,text),public.create_group_conversation(text,text,text[]),public.create_group_conversation(text,text,text[],text),
  public.manage_group_conversation(uuid,text,text,text,text) TO service_role;
COMMIT;
