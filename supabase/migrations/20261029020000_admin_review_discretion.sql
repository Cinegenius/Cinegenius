-- Explicit admin decisions may approve incomplete offers from any existing review status.
-- No content backfill, publication, ownership changes or expanded client permissions.
-- Preserve exact record/provider revision locks, audit logs and media visibility checks.
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_offer_moderation() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE action text:=current_setting('cinegenius.offer_action',true); actor text:=nullif(current_setting('cinegenius.offer_actor',true),'');
 ignored text[]:=ARRAY['published','moderation_status','content_revision','reviewed_revision','submitted_at','submitted_by','reviewed_at','reviewed_by','moderation_reason','last_editor_id','updated_at','created_at','view_count','views']; changed boolean;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.moderation_status NOT IN ('draft','pending') OR NEW.published IS TRUE THEN RAISE EXCEPTION 'Offers require admin review' USING ERRCODE='42501'; END IF;
  NEW.published:=false; NEW.content_revision:=1; NEW.reviewed_revision:=null; NEW.reviewed_at:=null; NEW.reviewed_by:=null; NEW.moderation_reason:=null;
  IF NEW.moderation_status='pending' THEN NEW.submitted_at:=clock_timestamp(); NEW.submitted_by:=NEW.last_editor_id; END IF;
  RETURN NEW;
 END IF;
 changed:=(to_jsonb(NEW)-ignored) IS DISTINCT FROM (to_jsonb(OLD)-ignored);
 -- Revisions and approvals cannot be supplied by an owner write. Content edits
 -- invalidate the approval even when an old app still tries to retain published.
 NEW.content_revision:=OLD.content_revision; NEW.reviewed_revision:=OLD.reviewed_revision;
 NEW.reviewed_at:=OLD.reviewed_at; NEW.reviewed_by:=OLD.reviewed_by;
 NEW.moderation_status:=OLD.moderation_status; NEW.submitted_at:=OLD.submitted_at;
 NEW.submitted_by:=OLD.submitted_by; NEW.moderation_reason:=OLD.moderation_reason;
 IF changed THEN
  NEW.content_revision:=OLD.content_revision+1; NEW.published:=false;
  NEW.reviewed_revision:=null; NEW.reviewed_at:=null; NEW.reviewed_by:=null;
  IF OLD.moderation_status IN ('approved','pending','legacy_review_required') THEN
   NEW.moderation_status:='pending'; NEW.submitted_at:=clock_timestamp(); NEW.submitted_by:=NEW.last_editor_id; NEW.moderation_reason:=null;
  ELSE NEW.moderation_status:='draft'; END IF;
 ELSIF action IN ('owner_publish','approve','changes_requested','reject','hide','submit') AND actor IS NOT NULL THEN
  IF action='owner_publish' THEN
   IF TG_TABLE_NAME<>'listings' OR NEW.type NOT IN ('prop','vehicle') THEN RAISE EXCEPTION 'Not a marketplace offer' USING ERRCODE='42501'; END IF;
   NEW.moderation_status:='owner_published'; NEW.published:=true;
   NEW.reviewed_revision:=null; NEW.reviewed_at:=null; NEW.reviewed_by:=null; NEW.moderation_reason:=null;
  ELSIF action='approve' THEN
   NEW.moderation_status:='approved'; NEW.published:=true; NEW.reviewed_revision:=OLD.content_revision;
   NEW.reviewed_at:=clock_timestamp(); NEW.reviewed_by:=actor;
  ELSIF action='submit' THEN
   IF OLD.moderation_status IN ('approved','pending') THEN RETURN OLD; END IF;
   NEW.moderation_status:='pending'; NEW.published:=false; NEW.submitted_at:=clock_timestamp(); NEW.submitted_by:=actor; NEW.moderation_reason:=null;
  ELSE
   NEW.moderation_status:=CASE action WHEN 'hide' THEN 'hidden' WHEN 'reject' THEN 'rejected' ELSE 'changes_requested' END;
   NEW.published:=false; NEW.reviewed_at:=clock_timestamp(); NEW.reviewed_by:=actor;
  END IF;
  IF action<>'submit' THEN NEW.moderation_reason:=nullif(current_setting('cinegenius.offer_reason',true),''); END IF;
 ELSE
  IF NEW.published IS TRUE AND OLD.published IS NOT TRUE THEN RAISE EXCEPTION 'Only admin review may publish' USING ERRCODE='42501'; END IF;
  IF NEW.published IS FALSE AND OLD.published IS TRUE THEN NEW.moderation_status:='hidden'; END IF;
  -- A regular owner write can never promote a private submission to public.
  IF NEW.published IS FALSE AND OLD.published IS FALSE THEN NEW.published:=false; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_offer_moderation() FROM PUBLIC,anon,authenticated;



CREATE OR REPLACE FUNCTION public.offer_review_transition(p_kind text,p_id uuid,p_expected jsonb,p_provider_company jsonb,p_provider_profile jsonb,p_action text,p_actor text,p_reason text,p_notification jsonb DEFAULT null)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tbl text; current_row jsonb; co jsonb; pr jsonb; provider_id text; old_action text:=current_setting('cinegenius.offer_action',true); old_actor text:=current_setting('cinegenius.offer_actor',true); BEGIN
 tbl:=CASE p_kind WHEN 'listing' THEN 'listings' WHEN 'company_equipment' THEN 'company_equipment' END;
 IF tbl IS NULL OR p_action NOT IN ('approve','changes_requested','reject','hide','submit') OR nullif(trim(p_actor),'') IS NULL THEN RETURN 'invalid';END IF;
 IF p_action<>'submit' AND (p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 500) THEN RETURN 'invalid';END IF;
 EXECUTE format('SELECT to_jsonb(l) FROM public.%I l WHERE id=$1 FOR UPDATE',tbl) INTO current_row USING p_id;
 IF current_row IS NULL THEN RETURN 'missing';END IF;
 IF current_row IS DISTINCT FROM p_expected THEN RETURN 'stale';END IF;
 IF p_action='submit' AND current_row->>'moderation_status' IN ('pending','approved') THEN RETURN 'unchanged';END IF;
 IF current_row->>'company_id' IS NOT NULL THEN SELECT to_jsonb(c) INTO co FROM companies c WHERE c.id::text=current_row->>'company_id' FOR SHARE; provider_id:=co->>'owner_user_id';
 ELSE provider_id:=current_row->>'user_id';END IF;
 IF provider_id IS NOT NULL THEN SELECT to_jsonb(p) INTO pr FROM profiles p WHERE p.user_id=provider_id FOR SHARE;END IF;
 IF p_action<>'submit' AND (co IS DISTINCT FROM p_provider_company OR pr IS DISTINCT FROM p_provider_profile) THEN RETURN 'stale';END IF;
 IF (p_action='approve' AND current_row->>'moderation_status'='approved') OR (p_action='hide' AND current_row->>'moderation_status'='hidden') THEN RETURN 'unchanged';END IF;
 PERFORM set_config('cinegenius.offer_action',p_action,true); PERFORM set_config('cinegenius.offer_actor',p_actor,true); PERFORM set_config('cinegenius.offer_reason',coalesce(trim(p_reason),''),true);
 EXECUTE format('UPDATE public.%I SET published=$1 WHERE id=$2',tbl) USING p_action='approve',p_id;
 PERFORM set_config('cinegenius.offer_action',coalesce(old_action,''),true); PERFORM set_config('cinegenius.offer_actor',coalesce(old_actor,''),true); PERFORM set_config('cinegenius.offer_reason','',true);
 IF p_action<>'submit' THEN
  INSERT INTO admin_audit_log(actor_user_id,action,entity_type,entity_id,reason,outcome,metadata)
  VALUES(p_actor,'offer_'||p_action,p_kind,p_id::text,trim(p_reason),'succeeded',jsonb_build_object('reviewed',true,'content_revision',current_row->'content_revision'));
  IF provider_id IS NOT NULL AND p_notification IS NOT NULL THEN
   INSERT INTO notifications(user_id,type,title,body,href) VALUES(provider_id,'offer_review',p_notification->>'title',p_notification->>'body',p_notification->>'href');
  END IF;
 END IF;
 RETURN 'saved';
END $$;
REVOKE ALL ON FUNCTION public.offer_review_transition(text,uuid,jsonb,jsonb,jsonb,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.offer_review_transition(text,uuid,jsonb,jsonb,jsonb,text,text,text,jsonb) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
