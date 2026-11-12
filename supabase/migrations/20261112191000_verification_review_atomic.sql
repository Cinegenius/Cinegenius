-- Additive and rerunnable. No existing request, profile or document is deleted or inferred.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_revision bigint NOT NULL DEFAULT 1;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS review_version bigint NOT NULL DEFAULT 1;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS review_reason text;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verification_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.verification_requests TO service_role;
CREATE INDEX IF NOT EXISTS verification_requests_member_status_idx ON public.verification_requests(user_id,status,submitted_at DESC);

CREATE OR REPLACE FUNCTION public.verification_revision_trigger() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='profiles' THEN
  IF NEW.verified IS DISTINCT FROM OLD.verified THEN NEW.verification_revision:=OLD.verification_revision+1;END IF;
 ELSE NEW.review_version:=OLD.review_version+1;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS verification_profile_revision ON public.profiles;
CREATE TRIGGER verification_profile_revision BEFORE UPDATE OF verified ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.verification_revision_trigger();
DROP TRIGGER IF EXISTS verification_request_revision ON public.verification_requests;
CREATE TRIGGER verification_request_revision BEFORE UPDATE ON public.verification_requests FOR EACH ROW EXECUTE FUNCTION public.verification_revision_trigger();

CREATE OR REPLACE FUNCTION public.verification_submit(p_user text,p_notes text DEFAULT null) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pr profiles; existing verification_requests; new_id uuid;
BEGIN
 IF nullif(trim(p_user),'') IS NULL OR length(coalesce(p_notes,''))>6000 THEN RETURN jsonb_build_object('status','invalid');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('verification:'||p_user,0));
 SELECT * INTO pr FROM profiles WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','missing');END IF;
 IF pr.verified THEN RETURN jsonb_build_object('status','approved');END IF;
 SELECT * INTO existing FROM verification_requests WHERE user_id=p_user AND status='pending' ORDER BY submitted_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('status','pending','id',existing.id);END IF;
 INSERT INTO verification_requests(user_id,display_name,status,notes) VALUES(p_user,pr.display_name,'pending',p_notes) RETURNING id INTO new_id;
 RETURN jsonb_build_object('status','saved','id',new_id);
END $$;

CREATE OR REPLACE FUNCTION public.verification_review(p_id uuid,p_version bigint,p_profile_revision bigint,p_action text,p_actor text,p_reason text,p_notification jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target text; pr profiles; request verification_requests;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('approve','reject') OR nullif(trim(p_actor),'') IS NULL OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 OR p_version IS NULL OR p_profile_revision IS NULL THEN RETURN 'invalid';END IF;
 SELECT user_id INTO target FROM verification_requests WHERE id=p_id;
 IF NOT FOUND THEN RETURN 'missing';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('verification:'||target,0));
 SELECT * INTO pr FROM profiles WHERE user_id=target FOR UPDATE;
 IF NOT FOUND THEN RETURN 'profile_missing';END IF;
 SELECT * INTO request FROM verification_requests WHERE id=p_id FOR UPDATE;
 IF request.user_id IS DISTINCT FROM target OR request.review_version<>p_version OR pr.verification_revision<>p_profile_revision OR request.status<>'pending' THEN RETURN 'stale';END IF;
 IF p_action='approve' THEN UPDATE profiles SET verified=true WHERE user_id=target;END IF;
 UPDATE verification_requests SET status=CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,reviewed_at=now(),reviewed_by=p_actor,review_reason=trim(p_reason) WHERE id=p_id;
 INSERT INTO admin_audit_log(actor_user_id,action,entity_type,entity_id,reason,outcome,metadata) VALUES(p_actor,'verification_'||p_action,'verification_request',p_id::text,trim(p_reason),'succeeded',jsonb_build_object('review_version',p_version,'profile_revision',p_profile_revision));
 INSERT INTO notifications(user_id,type,title,body,href,localization) VALUES(target,CASE p_action WHEN 'approve' THEN 'verification_approved' ELSE 'verification_pending' END,p_notification->>'title',p_notification->>'body','/profile?tab=verification',p_notification->'localization');
 RETURN 'saved';
END $$;

CREATE OR REPLACE FUNCTION public.verification_set_profile(p_user text,p_revision bigint,p_verified boolean,p_actor text,p_reason text,p_notification jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pr profiles;
BEGIN
 IF nullif(trim(p_user),'') IS NULL OR nullif(trim(p_actor),'') IS NULL OR p_verified IS NULL OR p_revision IS NULL OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN RETURN 'invalid';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('verification:'||p_user,0));
 SELECT * INTO pr FROM profiles WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN 'missing';END IF;
 IF pr.verification_revision<>p_revision THEN RETURN 'stale';END IF;
 IF pr.verified IS NOT DISTINCT FROM p_verified THEN RETURN 'unchanged';END IF;
 UPDATE profiles SET verified=p_verified WHERE user_id=p_user;
 UPDATE verification_requests SET status=CASE WHEN p_verified THEN 'approved' ELSE 'rejected' END,reviewed_at=now(),reviewed_by=p_actor,review_reason=trim(p_reason) WHERE user_id=p_user AND (status='pending' OR (NOT p_verified AND status='approved'));
 INSERT INTO admin_audit_log(actor_user_id,action,entity_type,entity_id,reason,outcome,metadata) VALUES(p_actor,CASE WHEN p_verified THEN 'profile_verify' ELSE 'profile_unverify' END,'profile',p_user,trim(p_reason),'succeeded',jsonb_build_object('profile_revision',p_revision));
 INSERT INTO notifications(user_id,type,title,body,href,localization) VALUES(p_user,CASE WHEN p_verified THEN 'verification_approved' ELSE 'verification_pending' END,p_notification->>'title',p_notification->>'body','/profile?tab=verification',p_notification->'localization');
 RETURN 'saved';
END $$;
REVOKE ALL ON FUNCTION public.verification_revision_trigger(),public.verification_submit(text,text),public.verification_review(uuid,bigint,bigint,text,text,text,jsonb),public.verification_set_profile(text,bigint,boolean,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verification_submit(text,text),public.verification_review(uuid,bigint,bigint,text,text,text,jsonb),public.verification_set_profile(text,bigint,boolean,text,text,jsonb) TO service_role;
COMMIT;
