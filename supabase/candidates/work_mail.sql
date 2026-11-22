-- REVIEW CANDIDATE ONLY. Not an applied/generated migration. Generate with the
-- Supabase CLI and review the dedicated private bucket before activation.
BEGIN;
CREATE TABLE public.work_mail_aliases(owner_id text PRIMARY KEY,local_part text NOT NULL UNIQUE CHECK(local_part ~ '^cg-[a-f0-9]{48}$'),enabled boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE public.work_mail_connections(id uuid PRIMARY KEY,owner_id text NOT NULL,provider text NOT NULL CHECK(provider IN('gmail','microsoft')),encrypted_tokens text NOT NULL CHECK(length(encrypted_tokens) BETWEEN 32 AND 32768),expires_at timestamptz NOT NULL,revision integer NOT NULL DEFAULT 1,refresh_claim uuid,refresh_until timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(owner_id,provider));
CREATE TABLE public.work_mail_oauth_states(state_hash text PRIMARY KEY CHECK(state_hash ~ '^[a-f0-9]{64}$'),owner_id text NOT NULL,session_hash text NOT NULL CHECK(session_hash ~ '^[a-f0-9]{64}$'),provider text NOT NULL CHECK(provider IN('gmail','microsoft')),connection_id uuid NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE public.work_mail_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id text NOT NULL,source text NOT NULL CHECK(source IN('inbound','gmail','microsoft')),external_key text NOT NULL CHECK(external_key ~ '^[a-f0-9]{64}$'),provider_id text NOT NULL CHECK(length(provider_id) BETWEEN 1 AND 2048),connection_id uuid,subject text NOT NULL CHECK(length(subject)<=500),sender text NOT NULL CHECK(length(sender)<=500),received_at timestamptz NOT NULL,preview_text text CHECK(length(preview_text)<=200000),attachments jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(attachments)='array' AND jsonb_array_length(attachments)<=20),original_size integer NOT NULL CHECK(original_size BETWEEN 1 AND 12582912),original_hash text NOT NULL CHECK(original_hash ~ '^[a-f0-9]{64}$'),status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','ready')),imported_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(owner_id,source,external_key),CHECK((source='inbound' AND connection_id IS NULL) OR (source IN('gmail','microsoft') AND connection_id IS NOT NULL)));
CREATE INDEX work_mail_items_owner_page ON public.work_mail_items(owner_id,created_at DESC,id DESC);
CREATE TABLE public.work_mail_attachments(item_id uuid NOT NULL REFERENCES public.work_mail_items(id) ON DELETE CASCADE,attachment_key text NOT NULL CHECK(attachment_key ~ '^[a-f0-9]{64}$'),owner_id text NOT NULL,size integer NOT NULL CHECK(size BETWEEN 0 AND 12582912),sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),PRIMARY KEY(item_id,attachment_key));
DO $$ DECLARE tab text;BEGIN
 FOREACH tab IN ARRAY ARRAY['work_mail_aliases','work_mail_connections','work_mail_oauth_states','work_mail_items','work_mail_attachments'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',tab);
 END LOOP;
END $$;
-- No browser storage grants or signed/public URLs. Server file routes recheck
-- current Clerk ownership for each request and stream inert attachments only.
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('work-mail-private','work-mail-private',false,12582912) ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='work-mail-private' AND public) THEN RAISE EXCEPTION 'work_mail_bucket_must_be_private';END IF;END $$;
-- A private bucket flag alone does not defeat an unrelated legacy permissive policy.
CREATE POLICY work_mail_private_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(bucket_id<>'work-mail-private') WITH CHECK(bucket_id<>'work-mail-private');

CREATE FUNCTION public.work_mail_v1(p_actor text,p_action text,p jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE item work_mail_items;conn work_mail_connections;prior work_mail_attachments;result jsonb;identifier uuid;total bigint;counted integer;state work_mail_oauth_states;size_value integer;
BEGIN
 IF p_actor IS NULL OR p_actor !~ '^user_[A-Za-z0-9]{1,128}$' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='mail_not_allowed';END IF;
 IF p_action IN('connection_delete','connection_save','item_commit') THEN PERFORM pg_advisory_xact_lock(hashtextextended('work-mail-quota:'||p_actor,0));END IF;
 IF p_action='status' THEN
  RETURN jsonb_build_object('version',1,'accountId',p_actor,'alias',(SELECT jsonb_build_object('localPart',local_part,'enabled',enabled) FROM work_mail_aliases WHERE owner_id=p_actor),'connections',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'provider',provider,'createdAt',created_at)) FROM work_mail_connections WHERE owner_id=p_actor),'[]'::jsonb));
 ELSIF p_action IN('alias_create','alias_rotate') THEN
  IF p->>'localPart' IS NULL OR p->>'localPart' !~ '^cg-[a-f0-9]{48}$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='mail_invalid';END IF;
  INSERT INTO work_mail_aliases(owner_id,local_part) VALUES(p_actor,p->>'localPart') ON CONFLICT(owner_id) DO UPDATE SET local_part=CASE WHEN p_action='alias_rotate' THEN excluded.local_part ELSE work_mail_aliases.local_part END,enabled=true;
  RETURN jsonb_build_object('localPart',(SELECT local_part FROM work_mail_aliases WHERE owner_id=p_actor));
 ELSIF p_action='alias_toggle' THEN
  IF jsonb_typeof(p->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='mail_invalid';END IF;
  UPDATE work_mail_aliases SET enabled=(p->>'enabled')::boolean WHERE owner_id=p_actor;RETURN '{}';
 ELSIF p_action='oauth_start' THEN
  IF p->>'stateHash' IS NULL OR p->>'stateHash' !~ '^[a-f0-9]{64}$' OR p->>'sessionHash' IS NULL OR p->>'sessionHash' !~ '^[a-f0-9]{64}$' OR p->>'provider' NOT IN('gmail','microsoft') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='mail_invalid';END IF;
  DELETE FROM work_mail_oauth_states WHERE owner_id=p_actor OR expires_at<clock_timestamp();
  INSERT INTO work_mail_oauth_states VALUES(p->>'stateHash',p_actor,p->>'sessionHash',p->>'provider',(p->>'connectionId')::uuid,clock_timestamp()+interval '10 minutes');RETURN '{}';
 ELSIF p_action='oauth_consume' THEN
  DELETE FROM work_mail_oauth_states WHERE state_hash=p->>'stateHash' AND owner_id=p_actor AND session_hash=p->>'sessionHash' AND provider=p->>'provider' AND connection_id=(p->>'connectionId')::uuid AND expires_at>clock_timestamp() RETURNING * INTO state;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='mail_oauth_expired';END IF;RETURN '{}';
 ELSIF p_action='connection_save' THEN
  IF p->>'provider' NOT IN('gmail','microsoft') OR p->>'encryptedTokens' IS NULL OR length(p->>'encryptedTokens') NOT BETWEEN 32 AND 32768 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='mail_invalid';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('work-mail-connection:'||p_actor,0));
  DELETE FROM work_mail_connections WHERE owner_id=p_actor AND provider=p->>'provider';
  INSERT INTO work_mail_connections(id,owner_id,provider,encrypted_tokens,expires_at) VALUES((p->>'connectionId')::uuid,p_actor,p->>'provider',p->>'encryptedTokens',(p->>'expiresAt')::timestamptz);RETURN '{}';
 ELSIF p_action IN('connection_get','connection_delete','refresh_claim','refresh_commit','refresh_release') THEN
  SELECT * INTO conn FROM work_mail_connections WHERE id=(p->>'connectionId')::uuid AND owner_id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='mail_not_found';END IF;
  IF p_action='connection_get' THEN RETURN to_jsonb(conn);
  ELSIF p_action='connection_delete' THEN DELETE FROM work_mail_connections WHERE id=conn.id;RETURN '{}';
  ELSIF p_action='refresh_claim' THEN
   IF conn.revision<>(p->>'revision')::integer OR conn.refresh_until>clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='mail_busy';END IF;
   UPDATE work_mail_connections SET refresh_claim=(p->>'claim')::uuid,refresh_until=clock_timestamp()+interval '45 seconds' WHERE id=conn.id;RETURN to_jsonb(conn);
  ELSIF p_action='refresh_release' THEN UPDATE work_mail_connections SET refresh_claim=null,refresh_until=null WHERE id=conn.id AND refresh_claim=(p->>'claim')::uuid;RETURN '{}';
  ELSE
   IF conn.refresh_claim IS DISTINCT FROM (p->>'claim')::uuid OR conn.refresh_until<clock_timestamp() OR p->>'encryptedTokens' IS NULL OR length(p->>'encryptedTokens') NOT BETWEEN 32 AND 32768 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='mail_busy';END IF;
   UPDATE work_mail_connections SET encrypted_tokens=p->>'encryptedTokens',expires_at=(p->>'expiresAt')::timestamptz,revision=revision+1,refresh_claim=null,refresh_until=null WHERE id=conn.id;RETURN '{}';
  END IF;
 ELSIF p_action='list' THEN
  RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(v ORDER BY v->>'createdAt' DESC,v->>'id' DESC) FROM (SELECT jsonb_build_object('id',id,'source',source,'subject',subject,'from',sender,'receivedAt',received_at,'createdAt',created_at,'imported',imported_at IS NOT NULL,'hasAttachments',jsonb_array_length(attachments)>0) v FROM work_mail_items WHERE owner_id=p_actor AND status='ready' AND (p->>'before' IS NULL OR (created_at,id)<((p->>'before')::timestamptz,(p->>'beforeId')::uuid)) ORDER BY created_at DESC,id DESC LIMIT 26) rows),'[]'::jsonb));
 ELSIF p_action='item_find' THEN
  SELECT * INTO item FROM work_mail_items WHERE owner_id=p_actor AND source=p->>'source' AND external_key=p->>'externalKey';RETURN CASE WHEN FOUND THEN to_jsonb(item) ELSE 'null'::jsonb END;
 ELSIF p_action='item_reserve' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('work-mail-quota:'||p_actor,0));
  SELECT * INTO item FROM work_mail_items WHERE owner_id=p_actor AND source=p->>'source' AND external_key=p->>'externalKey' FOR UPDATE;
  IF FOUND THEN IF item.original_hash<>p->>'sha256' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='mail_conflict';END IF;RETURN to_jsonb(item);END IF;
  SELECT count(*),coalesce(sum(original_size),0) INTO counted,total FROM work_mail_items WHERE owner_id=p_actor;
  SELECT total+coalesce(sum(size),0) INTO total FROM work_mail_attachments WHERE owner_id=p_actor;
  IF p->>'source'<>'inbound' AND NOT EXISTS(SELECT 1 FROM work_mail_connections WHERE id=(p->>'connectionId')::uuid AND owner_id=p_actor AND provider=p->>'source') THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='mail_connection_removed';END IF;
  size_value:=(p->>'size')::integer;
  IF counted>=200 OR total+size_value>104857600 THEN RAISE EXCEPTION USING ERRCODE='PT429',MESSAGE='mail_quota';END IF;
  INSERT INTO work_mail_items(owner_id,source,external_key,provider_id,connection_id,subject,sender,received_at,preview_text,attachments,original_size,original_hash,imported_at)
  VALUES(p_actor,p->>'source',p->>'externalKey',p->>'providerId',(p->>'connectionId')::uuid,p->>'subject',p->>'from',(p->>'receivedAt')::timestamptz,p->>'text',p->'attachments',size_value,p->>'sha256',CASE WHEN p->>'source'<>'inbound' THEN clock_timestamp() END) RETURNING * INTO item;RETURN to_jsonb(item);
 ELSIF p_action IN('item_get','item_commit','item_import','item_abort','attachment_get','attachments_list','attachment_commit') THEN
  IF p_action='attachment_commit' THEN PERFORM pg_advisory_xact_lock(hashtextextended('work-mail-quota:'||p_actor,0));END IF;
  SELECT * INTO item FROM work_mail_items WHERE id=(p->>'itemId')::uuid AND owner_id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='mail_not_found';END IF;
  IF p_action='item_get' THEN IF item.status<>'ready' THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='mail_not_found';END IF;RETURN to_jsonb(item);
  ELSIF p_action='item_commit' THEN IF item.status='pending' AND item.source<>'inbound' AND NOT EXISTS(SELECT 1 FROM work_mail_connections WHERE id=item.connection_id AND owner_id=p_actor AND provider=item.source) THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='mail_connection_removed';END IF;IF item.original_hash IS DISTINCT FROM p->>'sha256' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='mail_conflict';END IF;UPDATE work_mail_items SET status='ready' WHERE id=item.id;RETURN jsonb_build_object('id',item.id);
  ELSIF p_action='item_abort' THEN DELETE FROM work_mail_items WHERE id=item.id AND status='pending' AND original_hash=p->>'sha256';RETURN '{}';
  ELSIF p_action='item_import' THEN IF item.status<>'ready' THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='mail_not_found';END IF;UPDATE work_mail_items SET imported_at=coalesce(imported_at,clock_timestamp()) WHERE id=item.id;RETURN '{}';
  ELSIF p_action='attachments_list' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',attachment_key,'sha256',sha256,'size',size)) FROM work_mail_attachments WHERE item_id=item.id AND owner_id=p_actor),'[]'::jsonb);
  ELSIF p_action='attachment_get' THEN SELECT * INTO prior FROM work_mail_attachments WHERE item_id=item.id AND owner_id=p_actor AND attachment_key=p->>'attachmentKey';RETURN CASE WHEN FOUND THEN to_jsonb(prior) ELSE 'null'::jsonb END;
  ELSE
   IF item.status<>'ready' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(item.attachments) a WHERE encode(sha256(convert_to(a->>'id','UTF8')),'hex')=p->>'attachmentKey') THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='mail_not_found';END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended('work-mail-quota:'||p_actor,0));
   SELECT * INTO prior FROM work_mail_attachments WHERE item_id=item.id AND attachment_key=p->>'attachmentKey';
   IF FOUND THEN IF prior.sha256 IS DISTINCT FROM p->>'sha256' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='mail_conflict';END IF;RETURN '{}';END IF;
   SELECT coalesce(sum(original_size),0) INTO total FROM work_mail_items WHERE owner_id=p_actor;
   SELECT total+coalesce(sum(size),0) INTO total FROM work_mail_attachments WHERE owner_id=p_actor;
   IF total+(p->>'size')::integer>104857600 THEN RAISE EXCEPTION USING ERRCODE='PT429',MESSAGE='mail_quota';END IF;
   INSERT INTO work_mail_attachments VALUES(item.id,p->>'attachmentKey',p_actor,(p->>'size')::integer,p->>'sha256');RETURN '{}';
  END IF;
 ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='mail_invalid';END IF;
END $$;
REVOKE ALL ON FUNCTION public.work_mail_v1(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.work_mail_v1(text,text,jsonb) TO service_role;
CREATE FUNCTION public.work_mail_resolve_alias(p_local text) RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT owner_id FROM work_mail_aliases WHERE local_part=p_local AND enabled $$;
REVOKE ALL ON FUNCTION public.work_mail_resolve_alias(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.work_mail_resolve_alias(text) TO service_role;
COMMIT;
