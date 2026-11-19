-- Service-only installation bindings and a transactional notification outbox.
-- This migration does NOT enable registration, dispatch, APNs, or a scheduler.
BEGIN;
DO $guard$ BEGIN
 IF to_regclass('public.notifications') IS NULL OR to_regclass('public.messages') IS NULL OR to_regclass('public.conversation_members') IS NULL OR to_regclass('public.message_reads') IS NULL OR to_regclass('public.blocks') IS NULL THEN RAISE EXCEPTION 'Required notifications table missing'; END IF;
END $guard$;
CREATE SCHEMA IF NOT EXISTS native_push_private;
REVOKE ALL ON SCHEMA native_push_private FROM PUBLIC,anon,authenticated;
CREATE TABLE native_push_private.settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), enabled boolean NOT NULL DEFAULT false,
 bundle_id text, environment text CHECK(environment IN('sandbox','production')),
 activated_at timestamptz NOT NULL DEFAULT clock_timestamp(), worker_at timestamptz, provider_failure_at timestamptz
);
INSERT INTO native_push_private.settings(singleton)VALUES(true);
CREATE TABLE native_push_private.installations(
 id uuid PRIMARY KEY, proof_hash text NOT NULL CHECK(proof_hash ~ '^[0-9a-f]{64}$'),
 revision uuid NOT NULL DEFAULT gen_random_uuid(), user_id text, session_id text,
 device_token text, token_hash text, bundle_id text, environment text CHECK(environment IN('sandbox','production')),
 locale text, messages boolean NOT NULL DEFAULT false, notices boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT false, registered_at timestamptz, updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(NOT active OR(user_id IS NOT NULL AND session_id IS NOT NULL AND device_token IS NOT NULL AND token_hash IS NOT NULL AND bundle_id IS NOT NULL AND environment IS NOT NULL))
);
CREATE UNIQUE INDEX native_push_unique_active_token ON native_push_private.installations(bundle_id,environment,token_hash) WHERE active;
CREATE TABLE native_push_private.deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_kind text NOT NULL CHECK(source_kind IN('message','notification')), source_id text NOT NULL, installation_id uuid NOT NULL REFERENCES native_push_private.installations(id) ON DELETE CASCADE,
 registration_revision uuid NOT NULL, recipient_id text NOT NULL, kind text NOT NULL CHECK(kind IN('messages','notifications')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','leased','accepted','cancelled','failed','expired')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 due_at timestamptz NOT NULL DEFAULT clock_timestamp(), attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
 lease uuid, lease_until timestamptz, accepted_at timestamptz,
 UNIQUE(source_kind,source_id,installation_id,registration_revision)
);
CREATE INDEX native_push_due ON native_push_private.deliveries(due_at) WHERE state IN('pending','leased');
ALTER TABLE native_push_private.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE native_push_private.installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE native_push_private.deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA native_push_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA native_push_private TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA native_push_private TO service_role;

CREATE FUNCTION native_push_private.activation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.enabled AND(NOT OLD.enabled OR NEW.bundle_id IS DISTINCT FROM OLD.bundle_id OR NEW.environment IS DISTINCT FROM OLD.environment) THEN
  NEW.activated_at=clock_timestamp();NEW.worker_at=NULL;NEW.provider_failure_at=NULL;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER native_push_activation BEFORE UPDATE ON native_push_private.settings FOR EACH ROW EXECUTE FUNCTION native_push_private.activation();

CREATE FUNCTION native_push_private.enqueue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg native_push_private.settings; destination text; BEGIN
 SELECT * INTO cfg FROM native_push_private.settings WHERE singleton;
 -- Persist committed events through worker outages; readiness gates dispatch, never durability.
 IF NOT cfg.enabled
  OR NEW.type='new_message' OR NEW.read IS TRUE OR NEW.created_at IS NULL OR NEW.created_at<cfg.activated_at OR NEW.created_at>clock_timestamp()+interval '1 minute'
  OR NEW.created_at+interval '24 hours'<=clock_timestamp() THEN RETURN NEW;END IF;
 destination='notifications';
 INSERT INTO native_push_private.deliveries(source_kind,source_id,installation_id,registration_revision,recipient_id,kind,expires_at)
 SELECT 'notification',NEW.id::text,i.id,i.revision,NEW.user_id,destination,least(NEW.created_at+interval '24 hours',clock_timestamp()+interval '24 hours')
 FROM native_push_private.installations i WHERE i.active AND i.user_id=NEW.user_id AND i.bundle_id=cfg.bundle_id AND i.environment=cfg.environment
 AND CASE WHEN destination='messages' THEN i.messages ELSE i.notices END ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION native_push_private.enqueue() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER native_push_new_notification AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION native_push_private.enqueue();

CREATE FUNCTION native_push_private.message_visible(message_id uuid,recipient text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.messages m
 JOIN public.conversation_members cm ON cm.conversation_id=m.conversation_id AND cm.user_id=recipient AND cm.left_at IS NULL AND cm.joined_at<=m.created_at
 JOIN public.conversation_members sender ON sender.conversation_id=m.conversation_id AND sender.user_id=m.sender_id AND sender.joined_at<=m.created_at AND(sender.left_at IS NULL OR sender.left_at>=m.created_at)
 WHERE m.id=message_id AND m.sender_id<>recipient
 AND NOT EXISTS(SELECT 1 FROM public.message_reads r WHERE r.message_id=m.id AND r.user_id=recipient)
 AND NOT EXISTS(SELECT 1 FROM public.blocks b WHERE(b.blocker_id=m.sender_id AND b.blocked_id=recipient)OR(b.blocker_id=recipient AND b.blocked_id=m.sender_id)));
$$;
REVOKE ALL ON FUNCTION native_push_private.message_visible(uuid,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION native_push_private.enqueue_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg native_push_private.settings; BEGIN
 SELECT*INTO cfg FROM native_push_private.settings WHERE singleton;
 -- Registration, recipient and source checks still apply while the worker is unavailable.
 IF NOT cfg.enabled OR NEW.created_at IS NULL OR NEW.created_at<cfg.activated_at OR NEW.created_at>clock_timestamp()+interval '1 minute' OR NEW.created_at+interval '24 hours'<=clock_timestamp() THEN RETURN NEW;END IF;
 INSERT INTO native_push_private.deliveries(source_kind,source_id,installation_id,registration_revision,recipient_id,kind,expires_at)
 SELECT 'message',NEW.id::text,i.id,i.revision,cm.user_id,'messages',least(NEW.created_at+interval '24 hours',clock_timestamp()+interval '24 hours')
 FROM public.conversation_members cm JOIN native_push_private.installations i ON i.user_id=cm.user_id AND i.active AND i.messages AND i.bundle_id=cfg.bundle_id AND i.environment=cfg.environment
 WHERE cm.conversation_id=NEW.conversation_id AND cm.left_at IS NULL AND cm.joined_at<=NEW.created_at AND cm.user_id<>NEW.sender_id
 AND native_push_private.message_visible(NEW.id,cm.user_id) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION native_push_private.enqueue_message() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER native_push_new_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION native_push_private.enqueue_message();

CREATE FUNCTION public.native_push_v1(p_action text,p_actor text,p_session text,p jsonb DEFAULT'{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='2s' AS $$
DECLARE cfg native_push_private.settings; inst native_push_private.installations; job native_push_private.deliveries;
 now_at timestamptz=clock_timestamp(); ready boolean; own_binding boolean; output jsonb; expected uuid; new_revision uuid;
 notification record; visible boolean; job_id uuid; lease_id uuid; proof text=p->>'proofHash'; installation uuid; outcome text; delay_ms bigint; invalid_at timestamptz;
BEGIN
 -- Small DB-only critical sections; no provider call or external lock is held here.
 PERFORM pg_advisory_xact_lock(hashtext('native-push-v1'));
 SELECT * INTO cfg FROM native_push_private.settings WHERE singleton;
 ready=cfg.enabled AND cfg.bundle_id=p->>'bundleId' AND cfg.environment=p->>'environment'
  AND cfg.worker_at IS NOT NULL AND cfg.worker_at>now_at-interval '5 minutes'
  AND(cfg.provider_failure_at IS NULL OR cfg.provider_failure_at<now_at-interval '15 minutes');
 IF p_action='capabilities' THEN RETURN jsonb_build_object('status','ok','register',coalesce(ready,false),'dispatch',coalesce(ready,false));END IF;
 IF p_action IN('view','register','revoke') THEN
  IF p_actor IS NULL OR length(p_actor)>160 OR p_session IS NULL OR length(p_session)>160 OR proof IS NULL OR proof!~'^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('status','invalid');END IF;
  BEGIN installation=(p->>'installationId')::uuid;expected=(p->>'expectedRevision')::uuid;EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('status','invalid');END;
  IF installation IS NULL THEN RETURN jsonb_build_object('status','invalid');END IF;
  SELECT * INTO inst FROM native_push_private.installations WHERE id=installation FOR UPDATE;
  IF FOUND AND inst.proof_hash<>proof THEN RETURN jsonb_build_object('status','missing');END IF;
  own_binding=inst.active AND inst.user_id=p_actor AND inst.session_id=p_session;
  IF p_action='view' THEN
   output=jsonb_build_object('status','ok','installationId',installation,'revision',inst.revision,'binding',CASE WHEN inst.id IS NULL OR NOT inst.active OR(inst.user_id=p_actor AND NOT own_binding) THEN 'absent' WHEN own_binding THEN 'own' ELSE 'different-account' END);
   IF own_binding THEN output=output||jsonb_build_object('preferences',jsonb_build_object('messages',inst.messages,'notices',inst.notices),'locale',inst.locale);END IF;
   RETURN output;
  END IF;
  IF expected IS DISTINCT FROM inst.revision THEN RETURN jsonb_build_object('status','conflict');END IF;
  IF p_action='revoke' THEN
   IF inst.active AND NOT own_binding THEN RETURN jsonb_build_object('status','ok','installationId',installation,'revision',inst.revision,'revoked',true);END IF;
   IF inst.id IS NULL THEN INSERT INTO native_push_private.installations(id,proof_hash)VALUES(installation,proof)RETURNING*INTO inst;
   ELSIF inst.active THEN
    UPDATE native_push_private.installations SET active=false,revision=gen_random_uuid(),user_id=NULL,session_id=NULL,device_token=NULL,token_hash=NULL,messages=false,notices=false,locale=NULL,updated_at=now_at WHERE id=installation RETURNING*INTO inst;
   END IF;
   UPDATE native_push_private.deliveries SET state='cancelled',lease=NULL,lease_until=NULL WHERE installation_id=installation AND state IN('pending','leased');
   RETURN jsonb_build_object('status','ok','installationId',installation,'revision',inst.revision,'revoked',true);
  END IF;
  IF NOT coalesce(ready,false) THEN RETURN jsonb_build_object('status','unavailable');END IF;
  IF p->>'deviceToken' IS NULL OR length(p->>'deviceToken')>1024 OR length(p->>'deviceToken')<2 OR length(p->>'deviceToken')%2<>0 OR p->>'deviceToken'!~'^[0-9a-f]+$'
   OR p->>'tokenHash'!~'^[0-9a-f]{64}$' OR jsonb_typeof(p->'messages')<>'boolean' OR jsonb_typeof(p->'notices')<>'boolean'
   OR p->>'locale' NOT IN('de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk') THEN RETURN jsonb_build_object('status','invalid');END IF;
  IF inst.active AND own_binding AND inst.device_token=p->>'deviceToken' AND inst.bundle_id=cfg.bundle_id AND inst.environment=cfg.environment AND inst.locale=p->>'locale'
    AND inst.messages=(p->>'messages')::boolean AND inst.notices=(p->>'notices')::boolean THEN
   RETURN jsonb_build_object('status','ok','installationId',installation,'revision',inst.revision,'binding','own','preferences',jsonb_build_object('messages',inst.messages,'notices',inst.notices),'locale',inst.locale);
  END IF;
  IF(SELECT count(*) FROM native_push_private.installations WHERE active AND user_id=p_actor AND id<>installation)>=10 THEN RETURN jsonb_build_object('status','capacity');END IF;
  -- The same token/topic/environment belongs to only one current installation.
  UPDATE native_push_private.installations SET active=false,revision=gen_random_uuid(),user_id=NULL,session_id=NULL,device_token=NULL,token_hash=NULL,messages=false,notices=false,locale=NULL,updated_at=now_at
   WHERE active AND token_hash=p->>'tokenHash' AND bundle_id=cfg.bundle_id AND environment=cfg.environment AND id<>installation;
  new_revision=gen_random_uuid();
  INSERT INTO native_push_private.installations(id,proof_hash,revision,user_id,session_id,device_token,token_hash,bundle_id,environment,locale,messages,notices,active,registered_at,updated_at)
   VALUES(installation,proof,new_revision,p_actor,p_session,p->>'deviceToken',p->>'tokenHash',cfg.bundle_id,cfg.environment,p->>'locale',(p->>'messages')::boolean,(p->>'notices')::boolean,true,now_at,now_at)
   ON CONFLICT(id)DO UPDATE SET revision=excluded.revision,user_id=excluded.user_id,session_id=excluded.session_id,device_token=excluded.device_token,token_hash=excluded.token_hash,bundle_id=excluded.bundle_id,environment=excluded.environment,locale=excluded.locale,messages=excluded.messages,notices=excluded.notices,active=true,registered_at=now_at,updated_at=now_at RETURNING*INTO inst;
  UPDATE native_push_private.deliveries d SET state='cancelled',lease=NULL,lease_until=NULL WHERE state IN('pending','leased') AND EXISTS(SELECT 1 FROM native_push_private.installations i WHERE i.id=d.installation_id AND(NOT i.active OR i.revision<>d.registration_revision));
  RETURN jsonb_build_object('status','ok','installationId',installation,'revision',inst.revision,'binding','own','preferences',jsonb_build_object('messages',inst.messages,'notices',inst.notices),'locale',inst.locale);
 END IF;
 IF p_action='worker_heartbeat' THEN
  IF NOT cfg.enabled OR cfg.bundle_id IS DISTINCT FROM p->>'bundleId' OR cfg.environment IS DISTINCT FROM p->>'environment' THEN RETURN jsonb_build_object('status','disabled');END IF;
  UPDATE native_push_private.settings SET worker_at=now_at WHERE singleton;
  RETURN jsonb_build_object('status','ok');
 END IF;
 IF p_action='claim' THEN
  IF NOT coalesce(ready,false) THEN RETURN jsonb_build_object('status','disabled','jobs','[]'::jsonb);END IF;
  UPDATE native_push_private.deliveries SET state='expired',lease=NULL,lease_until=NULL WHERE state IN('pending','leased') AND expires_at<=now_at;
  WITH chosen AS(SELECT id FROM native_push_private.deliveries WHERE expires_at>now_at AND attempts<8 AND due_at<=now_at AND(state='pending' OR(state='leased' AND lease_until<=now_at))ORDER BY due_at,id LIMIT 10 FOR UPDATE SKIP LOCKED), claimed AS(
   UPDATE native_push_private.deliveries d SET state='leased',lease=gen_random_uuid(),lease_until=now_at+interval '90 seconds',attempts=attempts+1 FROM chosen c WHERE d.id=c.id RETURNING d.id,d.lease)
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'lease',lease)),'[]'::jsonb)INTO output FROM claimed;
  RETURN jsonb_build_object('status','ok','jobs',output);
 END IF;
 IF p_action='prune' THEN
  DELETE FROM native_push_private.deliveries WHERE id IN(SELECT id FROM native_push_private.deliveries WHERE state NOT IN('pending','leased') AND created_at<now_at-interval '7 days' LIMIT 100);
  DELETE FROM native_push_private.installations WHERE id IN(SELECT id FROM native_push_private.installations WHERE NOT active AND updated_at<now_at-interval '30 days' LIMIT 100);
  RETURN jsonb_build_object('status','ok');
 END IF;
 BEGIN job_id=(p->>'id')::uuid;lease_id=(p->>'lease')::uuid;EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('status','invalid');END;
 SELECT*INTO job FROM native_push_private.deliveries WHERE id=job_id FOR UPDATE;
 IF job.id IS NULL OR job.state<>'leased' OR job.lease IS DISTINCT FROM lease_id OR job.lease_until<=now_at THEN RETURN jsonb_build_object('status','stale');END IF;
 SELECT*INTO inst FROM native_push_private.installations WHERE id=job.installation_id;
 IF p_action='prepare' THEN
  IF job.source_kind='message' THEN visible=native_push_private.message_visible(job.source_id::uuid,job.recipient_id);
  ELSE SELECT n.user_id,n.read,n.type INTO notification FROM public.notifications n WHERE n.id::text=job.source_id;
   visible=notification.user_id IS NOT DISTINCT FROM job.recipient_id AND notification.read IS NOT TRUE AND notification.type<>'new_message';
  END IF;
  IF job.expires_at<=now_at OR job.created_at<cfg.activated_at OR NOT coalesce(visible,false)
   OR NOT inst.active OR inst.revision<>job.registration_revision OR inst.user_id IS DISTINCT FROM job.recipient_id OR inst.bundle_id IS DISTINCT FROM cfg.bundle_id OR inst.environment IS DISTINCT FROM cfg.environment
   OR NOT(CASE WHEN job.kind='messages' THEN inst.messages ELSE inst.notices END) THEN
   UPDATE native_push_private.deliveries SET state='cancelled',lease=NULL,lease_until=NULL WHERE id=job.id;RETURN jsonb_build_object('status','cancelled');
  END IF;
  IF NOT coalesce(ready,false) THEN
   -- A concurrent worker/provider outage is retryable, unlike lost recipient rights.
   UPDATE native_push_private.deliveries SET state='pending',due_at=least(job.expires_at,greatest(job.due_at,now_at+interval '1 minute')),lease=NULL,lease_until=NULL WHERE id=job.id;
   RETURN jsonb_build_object('status','deferred');
  END IF;
  RETURN jsonb_build_object('status','ready','id',job.id,'lease',job.lease,'revision',inst.revision,'accountId',inst.user_id,'sessionId',inst.session_id,'deviceToken',inst.device_token,'locale',inst.locale,'destination',job.kind,'expiresAt',job.expires_at,'bundleId',inst.bundle_id,'environment',inst.environment);
 END IF;
 IF p_action='finish' THEN
  outcome=p->>'outcome';
  IF outcome NOT IN('accepted','invalid-device','revoked','retry','configuration','rejected','expired') THEN RETURN jsonb_build_object('status','invalid');END IF;
  IF outcome IN('invalid-device','revoked') AND inst.active AND inst.revision=job.registration_revision THEN
   invalid_at=CASE WHEN jsonb_typeof(p->'invalidSince')='number' THEN to_timestamp((p->>'invalidSince')::double precision/1000)ELSE NULL END;
   IF outcome='revoked' OR invalid_at IS NULL OR inst.registered_at<=invalid_at THEN
    UPDATE native_push_private.installations SET active=false,revision=gen_random_uuid(),user_id=NULL,session_id=NULL,device_token=NULL,token_hash=NULL,messages=false,notices=false,locale=NULL,updated_at=now_at WHERE id=inst.id;
    UPDATE native_push_private.deliveries SET state='cancelled',lease=NULL,lease_until=NULL WHERE installation_id=inst.id AND state IN('pending','leased') AND id<>job.id;
   END IF;
  END IF;
  IF outcome='configuration' THEN UPDATE native_push_private.settings SET provider_failure_at=now_at WHERE singleton;END IF;
  IF outcome IN('retry','configuration') AND job.attempts<8 AND job.expires_at>now_at THEN
   delay_ms=greatest(60000,least(900000,coalesce((p->>'retryAfterMs')::bigint,60000)),least(900000,60000*(2::bigint^(job.attempts-1))));
   UPDATE native_push_private.deliveries SET state='pending',due_at=least(job.expires_at,now_at+delay_ms*interval '1 millisecond'),lease=NULL,lease_until=NULL WHERE id=job.id;
  ELSE UPDATE native_push_private.deliveries SET state=CASE outcome WHEN 'accepted' THEN 'accepted' WHEN 'expired' THEN 'expired' WHEN 'revoked' THEN 'cancelled' ELSE 'failed' END,accepted_at=CASE WHEN outcome='accepted' THEN now_at ELSE NULL END,lease=NULL,lease_until=NULL WHERE id=job.id;END IF;
  RETURN jsonb_build_object('status','ok');
 END IF;
 RETURN jsonb_build_object('status','invalid');
END $$;
REVOKE ALL ON FUNCTION public.native_push_v1(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.native_push_v1(text,text,text,jsonb) TO service_role;
COMMIT;
