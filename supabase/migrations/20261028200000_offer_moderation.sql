-- Mandatory admin release for NEW offers and future material edits. Existing
-- public rows remain available for a human decision, with no invented approval.
BEGIN;
CREATE TABLE IF NOT EXISTS public.offer_moderation_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_kind text NOT NULL,
 offer_id uuid NOT NULL, actor_user_id text, event text NOT NULL,
 from_status text, to_status text NOT NULL, content_revision bigint NOT NULL,
 reason text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.offer_moderation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offer_moderation_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.offer_moderation_events TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.listings,public.company_equipment TO service_role;
CREATE INDEX IF NOT EXISTS offer_moderation_history ON public.offer_moderation_events(offer_kind,offer_id,created_at DESC);

DO $$ DECLARE tbl text; role_name text; cols text; col text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['listings','company_equipment'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT ''draft'', ADD COLUMN IF NOT EXISTS content_revision bigint NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS reviewed_revision bigint, ADD COLUMN IF NOT EXISTS submitted_at timestamptz, ADD COLUMN IF NOT EXISTS submitted_by text, ADD COLUMN IF NOT EXISTS reviewed_at timestamptz, ADD COLUMN IF NOT EXISTS reviewed_by text, ADD COLUMN IF NOT EXISTS moderation_reason text, ADD COLUMN IF NOT EXISTS last_editor_id text',tbl);
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN published SET DEFAULT false',tbl);
  EXECUTE format('UPDATE public.%I SET moderation_status=''legacy_review_required'' WHERE published IS TRUE AND moderation_status=''draft''',tbl);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(moderation_status,submitted_at)',tbl||'_moderation_queue',tbl);
  SELECT string_agg(quote_ident(column_name),',') INTO cols FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl;
  -- Preserve the existing server-only data boundary. Old permissive row
  -- policies must not expose a private submission through direct REST reads.
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  FOREACH role_name IN ARRAY ARRAY['PUBLIC','anon','authenticated'] LOOP
   EXECUTE format('REVOKE ALL ON public.%I FROM %s',tbl,role_name);
   EXECUTE format('REVOKE SELECT (%s),INSERT (%s),UPDATE (%s),REFERENCES (%s) ON public.%I FROM %s',cols,cols,cols,cols,tbl,role_name);
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl LOOP
    IF has_column_privilege(role_name,format('public.%I',tbl),col,'SELECT') OR has_column_privilege(role_name,format('public.%I',tbl),col,'INSERT') OR has_column_privilege(role_name,format('public.%I',tbl),col,'UPDATE') THEN
     RAISE EXCEPTION 'Unexpected inherited offer access: %.% for %. Migration rolled back.',tbl,col,role_name;
    END IF;
   END LOOP;
  END LOOP;
  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',tbl,tbl||'_moderation_public');
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (moderation_status IN (''draft'',''pending'',''approved'',''changes_requested'',''rejected'',''hidden'',''legacy_review_required'') AND (published IS NOT TRUE OR moderation_status IN (''approved'',''legacy_review_required'')) AND (moderation_status<>''approved'' OR (reviewed_revision IS NOT NULL AND reviewed_revision=content_revision)))',tbl,tbl||'_moderation_public');
 END LOOP;
END $$;

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
 ELSIF action IN ('approve','changes_requested','reject','hide','submit') AND actor IS NOT NULL THEN
  IF action='approve' THEN
   IF OLD.moderation_status NOT IN ('pending','legacy_review_required') THEN RAISE EXCEPTION 'Offer not submitted' USING ERRCODE='42501'; END IF;
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

CREATE OR REPLACE FUNCTION public.log_offer_moderation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor text:=coalesce(nullif(current_setting('cinegenius.offer_actor',true),''),NEW.last_editor_id); BEGIN
 IF TG_OP='INSERT' OR NEW.moderation_status IS DISTINCT FROM OLD.moderation_status OR NEW.content_revision IS DISTINCT FROM OLD.content_revision THEN
  INSERT INTO offer_moderation_events(offer_kind,offer_id,actor_user_id,event,from_status,to_status,content_revision,reason)
  VALUES(CASE TG_TABLE_NAME WHEN 'listings' THEN 'listing' ELSE 'company_equipment' END,NEW.id,actor,
    CASE WHEN TG_OP='INSERT' THEN CASE WHEN NEW.moderation_status='pending' THEN 'submitted' ELSE 'created' END
      WHEN NEW.content_revision<>OLD.content_revision THEN 'content_changed' ELSE coalesce(nullif(current_setting('cinegenius.offer_action',true),''),'hidden') END,
    CASE WHEN TG_OP='INSERT' THEN null ELSE OLD.moderation_status END,NEW.moderation_status,NEW.content_revision,NEW.moderation_reason);
 END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_offer_moderation() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE tbl text; BEGIN FOREACH tbl IN ARRAY ARRAY['listings','company_equipment'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS offer_moderation_guard ON public.%I',tbl);
 EXECUTE format('CREATE TRIGGER offer_moderation_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_offer_moderation()',tbl);
 EXECUTE format('DROP TRIGGER IF EXISTS offer_moderation_log ON public.%I',tbl);
 EXECUTE format('CREATE TRIGGER offer_moderation_log AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_offer_moderation()',tbl);
END LOOP; END $$;

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
 IF p_action='approve' AND current_row->>'moderation_status' NOT IN ('pending','legacy_review_required') THEN RETURN 'not_submitted';END IF;
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
-- Compatible old admin entry point cannot bypass moderation or revision checks.
CREATE OR REPLACE FUNCTION public.admin_review_listing_transition(p_id uuid,p_expected jsonb,p_provider_company jsonb,p_provider_profile jsonb,p_published boolean,p_actor text,p_reason text)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT offer_review_transition('listing',p_id,p_expected,p_provider_company,p_provider_profile,CASE WHEN p_published THEN 'approve' ELSE 'hide' END,p_actor,p_reason,null);
$$;
REVOKE ALL ON FUNCTION public.admin_review_listing_transition(uuid,jsonb,jsonb,jsonb,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_listing_transition(uuid,jsonb,jsonb,jsonb,boolean,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
