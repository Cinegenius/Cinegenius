-- Prepared only. No production activation: both readiness switches default off.
BEGIN;
CREATE SCHEMA IF NOT EXISTS shots_private;
REVOKE ALL ON SCHEMA shots_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA shots_private TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('shots-ephemeral-v1','shots-ephemeral-v1',false,3145728,ARRAY['image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Restrictive policy defeats any unrelated legacy permissive Storage policy.
DROP POLICY IF EXISTS shots_no_direct_objects_v1 ON storage.objects;
CREATE POLICY shots_no_direct_objects_v1 ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING(bucket_id <> 'shots-ephemeral-v1') WITH CHECK(bucket_id <> 'shots-ephemeral-v1');
CREATE TABLE shots_private.config(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false,cleanup_ready boolean NOT NULL DEFAULT false,worker_seen_at timestamptz,worker_failed_at timestamptz);
INSERT INTO shots_private.config(singleton) VALUES(true);
CREATE TABLE shots_private.shots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL UNIQUE,owner_id text NOT NULL CHECK(owner_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 request_scope text NOT NULL UNIQUE CHECK(request_scope ~ '^[0-9a-f]{64}$'),payload_hash text NOT NULL CHECK(payload_hash ~ '^[0-9a-f]{64}$'),state text NOT NULL DEFAULT 'preparing' CHECK(state IN('preparing','published','deleted','expired')),
 audience text NOT NULL CHECK(audience IN('community','homies')),format text NOT NULL CHECK(format IN('portrait','landscape')),look text NOT NULL CHECK(look IN('original','film','photo','bw')),grain integer NOT NULL CHECK(grain BETWEEN 0 AND 100),
 width integer NOT NULL CHECK(width BETWEEN 1 AND 1600),height integer NOT NULL CHECK(height BETWEEN 1 AND 1600),
 prepared_at timestamptz NOT NULL DEFAULT clock_timestamp(),draft_deadline timestamptz NOT NULL DEFAULT(clock_timestamp()+interval '30 minutes'),published_at timestamptz,expires_at timestamptz,
 upload_token uuid,upload_until timestamptz,
 CHECK((published_at IS NULL)=(expires_at IS NULL)),CHECK(expires_at IS NULL OR expires_at=published_at+interval '30 hours')
);
CREATE INDEX shots_feed_v1 ON shots_private.shots(audience,published_at DESC,id DESC) WHERE state='published';
CREATE INDEX shots_owner_v1 ON shots_private.shots(owner_id,state);
CREATE TABLE shots_private.assets(
 shot_id uuid NOT NULL REFERENCES shots_private.shots(id) ON DELETE CASCADE,variant text NOT NULL CHECK(variant IN('full','thumbnail')),
 object_key text NOT NULL UNIQUE,bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 3145728),sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),stored boolean NOT NULL DEFAULT false,
 PRIMARY KEY(shot_id,variant),CHECK(object_key=shot_id::text||'/'||variant||'.webp')
);
CREATE TABLE shots_private.cleanup(
 shot_id uuid PRIMARY KEY REFERENCES shots_private.shots(id) ON DELETE CASCADE,due_at timestamptz NOT NULL,
 token uuid,lease_until timestamptz,attempts integer NOT NULL DEFAULT 0,last_error text CHECK(last_error IS NULL OR last_error='storage_unavailable')
);
CREATE INDEX shots_cleanup_due_v1 ON shots_private.cleanup(due_at,lease_until);
-- Only an unlinkable per-account/request digest remains, not the raw nonce/account.
-- No account, audience, media path, photo metadata or image bytes survive purge.
CREATE TABLE shots_private.closed_requests(request_scope text PRIMARY KEY CHECK(request_scope ~ '^[0-9a-f]{64}$'),shot_id uuid NOT NULL UNIQUE,status text NOT NULL CHECK(status IN('expired','deleted')),closed_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE shots_private.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots_private.shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots_private.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots_private.cleanup ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots_private.closed_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA shots_private FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA shots_private TO service_role;

CREATE FUNCTION shots_private.ready() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM shots_private.config WHERE singleton AND enabled AND cleanup_ready)
 AND EXISTS(SELECT 1 FROM storage.buckets WHERE id='shots-ephemeral-v1' AND NOT public);
$$;
-- Read access is independent of worker health; publication fails closed on any failed/due cleanup.
CREATE FUNCTION shots_private.publish_ready() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT shots_private.ready()
 AND EXISTS(SELECT 1 FROM shots_private.config WHERE singleton AND worker_seen_at>clock_timestamp()-interval '10 minutes' AND (worker_failed_at IS NULL OR worker_failed_at<worker_seen_at))
 AND NOT EXISTS(SELECT 1 FROM shots_private.cleanup WHERE due_at<=clock_timestamp() OR last_error IS NOT NULL);
$$;
CREATE FUNCTION shots_private.can_read(s shots_private.shots,actor text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT actor IS NOT NULL AND shots_private.ready() AND s.state='published' AND s.expires_at>clock_timestamp()
 AND (s.owner_id=actor OR (
  NOT EXISTS(SELECT 1 FROM public.user_settings u WHERE u.user_id=s.owner_id AND u.ghost_mode)
  AND NOT EXISTS(SELECT 1 FROM public.blocks b WHERE (b.blocker_id=actor AND b.blocked_id=s.owner_id) OR (b.blocker_id=s.owner_id AND b.blocked_id=actor))
  AND (s.audience='community' OR EXISTS(SELECT 1 FROM public.friendships f WHERE f.status='accepted' AND
   ((f.sender_id=s.owner_id AND f.receiver_id=actor AND f.sender_favorite) OR (f.receiver_id=s.owner_id AND f.sender_id=actor AND f.receiver_favorite))))
 ));
$$;
CREATE FUNCTION shots_private.dto(s shots_private.shots,actor text) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',s.id,'requestId',CASE WHEN s.owner_id=actor THEN s.request_id ELSE NULL END,
  'createdAt',s.published_at,'expiresAt',s.expires_at,'audience',s.audience,'format',s.format,'look',s.look,'grain',s.grain,
  'width',s.width,'height',s.height,'isMine',s.owner_id=actor,
  'media',jsonb_build_object('full','/api/shots/'||s.id||'/media/full','thumbnail','/api/shots/'||s.id||'/media/thumbnail'));
$$;
CREATE FUNCTION public.shots_v1(p_action text,p_actor text DEFAULT NULL,p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='2s' AS $$
DECLARE s shots_private.shots;a shots_private.assets;j shots_private.cleanup;c shots_private.closed_requests;asset jsonb;rows jsonb;next_row jsonb;v_token uuid;stamp timestamptz:=clock_timestamp();size_sum bigint;row_count integer;result jsonb:='[]'::jsonb;paths jsonb;
BEGIN
 IF p_action IN('cleanup_claim','cleanup_finish','cleanup_retry','cleanup_complete','cleanup_failed') THEN
  IF p_action='cleanup_failed' THEN
   UPDATE shots_private.config SET worker_failed_at=stamp WHERE singleton;
   RETURN jsonb_build_object('status','ok','serverNow',stamp);
  END IF;
  IF p_action='cleanup_complete' THEN
   IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='shots-ephemeral-v1' AND NOT public) OR EXISTS(SELECT 1 FROM shots_private.cleanup WHERE due_at<=stamp OR last_error IS NOT NULL) THEN
    UPDATE shots_private.config SET worker_failed_at=stamp WHERE singleton;
    RETURN jsonb_build_object('status','backlog','serverNow',stamp);
   END IF;
   -- Only a fully successful run, including Storage absence ACKs, may renew readiness.
   UPDATE shots_private.config SET worker_seen_at=stamp WHERE singleton;
   RETURN jsonb_build_object('status','healthy','serverNow',stamp);
  END IF;
  IF p_action='cleanup_claim' THEN
   -- Caller verifies private Storage readiness before reaching this operation.
   FOR s IN SELECT sh.* FROM shots_private.shots sh JOIN shots_private.cleanup cj ON cj.shot_id=sh.id WHERE cj.due_at<=stamp AND (cj.lease_until IS NULL OR cj.lease_until<=stamp) ORDER BY cj.due_at,sh.id FOR UPDATE OF sh SKIP LOCKED LIMIT 10 LOOP
    SELECT * INTO j FROM shots_private.cleanup WHERE shot_id=s.id FOR UPDATE SKIP LOCKED;
    IF NOT FOUND OR j.due_at>stamp OR j.lease_until>stamp THEN CONTINUE;END IF;
    IF s.state='published' AND s.expires_at>stamp OR s.state='preparing' AND s.draft_deadline>stamp OR s.upload_until+interval '2 minutes'>stamp THEN CONTINUE;END IF;
    UPDATE shots_private.shots SET state=CASE WHEN state='deleted' THEN 'deleted' ELSE 'expired' END,upload_token=NULL,upload_until=NULL WHERE id=s.id;
    v_token:=gen_random_uuid();UPDATE shots_private.cleanup SET token=v_token,lease_until=stamp+interval '90 seconds',attempts=attempts+1 WHERE shot_id=j.shot_id RETURNING * INTO j;
    SELECT jsonb_agg(jsonb_build_object('key',object_key,'variant',variant) ORDER BY variant) INTO paths FROM shots_private.assets WHERE shot_id=j.shot_id;
    result:=result||jsonb_build_array(jsonb_build_object('id',j.shot_id,'token',v_token,'paths',paths));
   END LOOP;
   RETURN jsonb_build_object('status','ok','serverNow',stamp,'jobs',result);
  END IF;
  PERFORM 1 FROM shots_private.shots WHERE id=(p->>'id')::uuid FOR UPDATE;
  SELECT * INTO j FROM shots_private.cleanup WHERE shot_id=(p->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status',CASE WHEN EXISTS(SELECT 1 FROM shots_private.closed_requests WHERE shot_id=(p->>'id')::uuid) THEN 'done' ELSE 'missing' END,'serverNow',stamp);END IF;
  IF j.token IS DISTINCT FROM (p->>'token')::uuid OR j.lease_until<=stamp THEN RETURN jsonb_build_object('status','conflict','serverNow',stamp);END IF;
  IF p_action='cleanup_retry' THEN
   UPDATE shots_private.cleanup SET token=NULL,lease_until=NULL,due_at=stamp+make_interval(secs=>least(3600,15*power(2,least(attempts,8)))::integer),last_error='storage_unavailable' WHERE shot_id=j.shot_id;
   RETURN jsonb_build_object('status','retry','serverNow',stamp);
  END IF;
  SELECT coalesce(jsonb_agg(object_key ORDER BY object_key),'[]'::jsonb) INTO paths FROM shots_private.assets WHERE shot_id=j.shot_id;
  IF jsonb_typeof(p->'removed')<>'array' OR (SELECT coalesce(jsonb_agg(value ORDER BY value),'[]'::jsonb) FROM jsonb_array_elements(p->'removed')) IS DISTINCT FROM paths THEN RETURN jsonb_build_object('status','invalid','serverNow',stamp);END IF;
  SELECT * INTO s FROM shots_private.shots WHERE id=j.shot_id FOR UPDATE;
  IF s.state='published' AND s.expires_at>stamp OR s.state='preparing' AND s.draft_deadline>stamp THEN RETURN jsonb_build_object('status','conflict','serverNow',stamp);END IF;
  INSERT INTO shots_private.closed_requests(request_scope,shot_id,status) VALUES(s.request_scope,s.id,CASE WHEN s.state='deleted' THEN 'deleted' ELSE 'expired' END) ON CONFLICT DO NOTHING;
  DELETE FROM shots_private.shots WHERE id=s.id;
  RETURN jsonb_build_object('status','done','serverNow',stamp);
 END IF;
 IF p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' THEN RETURN jsonb_build_object('status','invalid','serverNow',stamp);END IF;
 IF p_action<>'delete' AND NOT shots_private.ready() THEN RETURN jsonb_build_object('status','unavailable','serverNow',stamp);END IF;
 IF p_action='capabilities' THEN RETURN jsonb_build_object('status','ok','serverNow',stamp,'publishAllowed',shots_private.publish_ready() AND NOT EXISTS(SELECT 1 FROM public.user_settings WHERE user_id=p_actor AND ghost_mode));END IF;
 IF p_action='feed' THEN
  IF p->>'audience' NOT IN('community','homies') THEN RETURN jsonb_build_object('status','invalid','serverNow',stamp);END IF;
  SELECT coalesce(jsonb_agg(shots_private.dto(q,p_actor) ORDER BY q.published_at DESC,q.id DESC),'[]'::jsonb) INTO rows FROM
   (SELECT * FROM shots_private.shots sh WHERE sh.audience=p->>'audience' AND shots_private.can_read(sh,p_actor)
    AND (p->>'beforeId' IS NULL OR (sh.published_at,sh.id)<((p->>'beforeAt')::timestamptz,(p->>'beforeId')::uuid)) ORDER BY sh.published_at DESC,sh.id DESC LIMIT 25) q;
  next_row:=CASE WHEN jsonb_array_length(rows)>24 THEN rows->23 ELSE NULL END;
  IF next_row IS NOT NULL THEN rows:=rows-24;END IF;
  RETURN jsonb_build_object('status','ok','serverNow',stamp,'items',rows,'publishAllowed',shots_private.publish_ready() AND NOT EXISTS(SELECT 1 FROM public.user_settings WHERE user_id=p_actor AND ghost_mode),'next',CASE WHEN next_row IS NOT NULL THEN jsonb_build_object('id',next_row->'id','createdAt',next_row->'createdAt') ELSE NULL END);
 END IF;
 IF p_action='request' THEN
  SELECT * INTO s FROM shots_private.shots WHERE request_id=(p->>'requestId')::uuid AND owner_id=p_actor;
  IF NOT FOUND THEN
   SELECT * INTO c FROM shots_private.closed_requests WHERE request_scope=p->>'requestScope';
   RETURN jsonb_build_object('status',CASE WHEN FOUND THEN c.status ELSE 'absent' END,'serverNow',stamp,'item',NULL,'retryAllowed',NOT FOUND);
  END IF;
  RETURN jsonb_build_object('status',CASE WHEN s.state='deleted' THEN 'deleted' WHEN s.state='preparing' AND s.draft_deadline>stamp THEN 'pending' WHEN s.expires_at>stamp AND s.state='published' THEN 'published' ELSE 'expired' END,'serverNow',stamp,
   'retryAllowed',s.state='preparing' AND s.draft_deadline>stamp AND (s.upload_until IS NULL OR s.upload_until<=stamp),'item',CASE WHEN shots_private.can_read(s,p_actor) THEN shots_private.dto(s,p_actor) ELSE NULL END);
 END IF;
 IF p_action IN('prepare','uploaded','publish') AND NOT shots_private.publish_ready() THEN RETURN jsonb_build_object('status','unavailable','serverNow',stamp);END IF;
 IF p_action='prepare' THEN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('shots:'||p_actor,0)) THEN RETURN jsonb_build_object('status','pending','serverNow',stamp);END IF;
  IF EXISTS(SELECT 1 FROM shots_private.closed_requests WHERE request_scope=p->>'requestScope') THEN RETURN jsonb_build_object('status','expired','serverNow',stamp);END IF;
  SELECT * INTO s FROM shots_private.shots WHERE request_id=(p->>'requestId')::uuid FOR UPDATE;
  IF FOUND THEN
   IF s.owner_id<>p_actor OR s.payload_hash IS DISTINCT FROM p->>'payloadHash' THEN RETURN jsonb_build_object('status','conflict','serverNow',stamp);END IF;
   IF s.state='published' AND s.expires_at>stamp THEN RETURN jsonb_build_object('status','published','serverNow',stamp,'item',shots_private.dto(s,p_actor));END IF;
   IF s.state<>'preparing' OR s.draft_deadline<=stamp THEN RETURN jsonb_build_object('status','expired','serverNow',stamp);END IF;
   IF s.upload_until>stamp THEN RETURN jsonb_build_object('status','pending','serverNow',stamp);END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM public.user_settings WHERE user_id=p_actor AND ghost_mode) THEN RETURN jsonb_build_object('status','conflict','serverNow',stamp);END IF;
   SELECT count(*),coalesce(sum((SELECT sum(bytes) FROM shots_private.assets WHERE shot_id=sh.id)),0) INTO row_count,size_sum FROM shots_private.shots sh WHERE owner_id=p_actor AND ((state='published' AND expires_at>stamp) OR (state='preparing' AND draft_deadline>stamp));
   IF jsonb_typeof(p->'assets')<>'array' OR jsonb_array_length(p->'assets')<>2 OR (SELECT count(DISTINCT x->>'variant') FROM jsonb_array_elements(p->'assets') x WHERE x->>'variant' IN('full','thumbnail') AND (x->>'bytes')::integer BETWEEN 1 AND 3145728 AND x->>'sha256' ~ '^[0-9a-f]{64}$')<>2 THEN RETURN jsonb_build_object('status','invalid','serverNow',stamp);END IF;
   IF row_count>=6 OR size_sum+(SELECT sum((x->>'bytes')::integer) FROM jsonb_array_elements(p->'assets') x)>12582912 THEN RETURN jsonb_build_object('status','capacity','serverNow',stamp);END IF;
   INSERT INTO shots_private.shots(request_id,owner_id,request_scope,payload_hash,audience,format,look,grain,width,height)
    VALUES((p->>'requestId')::uuid,p_actor,p->>'requestScope',p->>'payloadHash',p->>'audience',p->>'format',p->>'look',(p->>'grain')::integer,(p->>'width')::integer,(p->>'height')::integer) RETURNING * INTO s;
   FOR asset IN SELECT value FROM jsonb_array_elements(p->'assets') LOOP
    INSERT INTO shots_private.assets(shot_id,variant,object_key,bytes,sha256) VALUES(s.id,asset->>'variant',s.id::text||'/'||(asset->>'variant')||'.webp',(asset->>'bytes')::integer,asset->>'sha256');
   END LOOP;
   INSERT INTO shots_private.cleanup(shot_id,due_at) VALUES(s.id,s.draft_deadline);
  END IF;
  v_token:=gen_random_uuid();UPDATE shots_private.shots SET upload_token=v_token,upload_until=stamp+interval '90 seconds' WHERE id=s.id;
  SELECT jsonb_agg(jsonb_build_object('variant',variant,'key',object_key,'bytes',bytes,'sha256',sha256,'stored',stored) ORDER BY variant) INTO rows FROM shots_private.assets WHERE shot_id=s.id;
  RETURN jsonb_build_object('status','prepared','serverNow',stamp,'id',s.id,'token',v_token,'assets',rows);
 END IF;
 IF p_action IN('uploaded','publish','delete') THEN SELECT * INTO s FROM shots_private.shots WHERE id=(p->>'id')::uuid FOR UPDATE;ELSE SELECT * INTO s FROM shots_private.shots WHERE id=(p->>'id')::uuid;END IF;
 IF NOT FOUND THEN
  IF p_action='delete' THEN RETURN jsonb_build_object('status','deleted','serverNow',stamp,'purgePending',false);END IF;
  RETURN jsonb_build_object('status','missing','serverNow',stamp);
 END IF;
 IF p_action='get' THEN RETURN jsonb_build_object('status',CASE WHEN shots_private.can_read(s,p_actor) THEN 'ok' ELSE 'missing' END,'serverNow',stamp,'item',CASE WHEN shots_private.can_read(s,p_actor) THEN shots_private.dto(s,p_actor) ELSE NULL END);END IF;
 IF p_action='media' THEN
  IF NOT shots_private.can_read(s,p_actor) THEN RETURN jsonb_build_object('status','missing','serverNow',stamp);END IF;
  SELECT * INTO a FROM shots_private.assets WHERE shot_id=s.id AND variant=p->>'variant' AND stored;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','missing','serverNow',stamp);END IF;
  RETURN jsonb_build_object('status','ok','serverNow',stamp,'key',a.object_key,'sha256',a.sha256,'bytes',a.bytes);
 END IF;
 IF s.owner_id<>p_actor THEN RETURN jsonb_build_object('status','missing','serverNow',stamp);END IF;
 IF p_action='delete' THEN
  UPDATE shots_private.shots SET state='deleted',upload_token=NULL WHERE id=s.id;
  UPDATE shots_private.cleanup SET due_at=stamp WHERE shot_id=s.id;
  RETURN jsonb_build_object('status','deleted','serverNow',stamp,'purgePending',true);
 END IF;
 IF s.upload_token IS DISTINCT FROM (p->>'token')::uuid OR s.upload_until<=clock_timestamp() OR s.state<>'preparing' OR s.draft_deadline<=clock_timestamp() THEN RETURN jsonb_build_object('status','conflict','serverNow',stamp);END IF;
 IF p_action='uploaded' THEN
  UPDATE shots_private.assets SET stored=true WHERE shot_id=s.id AND variant=p->>'variant' AND sha256=p->>'sha256';
  IF NOT FOUND THEN RETURN jsonb_build_object('status','conflict','serverNow',stamp);END IF;
  RETURN jsonb_build_object('status','ok','serverNow',stamp);
 END IF;
 IF p_action='publish' THEN
  -- Wire timestamps and stable pagination share the same millisecond precision.
  stamp:=date_trunc('milliseconds',clock_timestamp());
  IF NOT shots_private.publish_ready() THEN RETURN jsonb_build_object('status','unavailable','serverNow',stamp);END IF;
  IF EXISTS(SELECT 1 FROM public.user_settings WHERE user_id=p_actor AND ghost_mode) OR EXISTS(SELECT 1 FROM shots_private.assets WHERE shot_id=s.id AND NOT stored) THEN RETURN jsonb_build_object('status','conflict','serverNow',stamp);END IF;
  UPDATE shots_private.shots SET state='published',published_at=stamp,expires_at=stamp+interval '30 hours',upload_token=NULL,upload_until=NULL WHERE id=s.id RETURNING * INTO s;
  UPDATE shots_private.cleanup SET due_at=s.expires_at WHERE shot_id=s.id;
  RETURN jsonb_build_object('status','published','serverNow',stamp,'item',shots_private.dto(s,p_actor));
 END IF;
 RETURN jsonb_build_object('status','invalid','serverNow',stamp);
EXCEPTION WHEN lock_not_available THEN RETURN jsonb_build_object('status','pending','serverNow',clock_timestamp());
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shots_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA shots_private TO service_role;
REVOKE ALL ON FUNCTION public.shots_v1(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shots_v1(text,text,jsonb) TO service_role;
COMMIT;
