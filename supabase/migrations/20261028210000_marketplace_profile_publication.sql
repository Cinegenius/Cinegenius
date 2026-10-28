-- Marketplace owners with an established profile may explicitly publish without
-- an admin approval. Other offer types and explicit admin restrictions keep review.
-- No existing row is published, hidden, reassigned or reclassified by this migration.
BEGIN;
ALTER TABLE public.listings DROP CONSTRAINT listings_moderation_public;
ALTER TABLE public.listings ADD CONSTRAINT listings_moderation_public CHECK (
 moderation_status IN ('draft','pending','approved','owner_published','changes_requested','rejected','hidden','legacy_review_required')
 AND (published IS NOT TRUE OR moderation_status IN ('approved','owner_published','legacy_review_required'))
 AND (moderation_status<>'approved' OR (reviewed_revision IS NOT NULL AND reviewed_revision=content_revision))
 AND (moderation_status<>'owner_published' OR type IN ('prop','vehicle'))
);
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


CREATE OR REPLACE FUNCTION public.marketplace_publish_transition(p_id uuid,p_expected jsonb,p_actor text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.listings%ROWTYPE; profile jsonb; company jsonb; membership_role text; last_admin_action text;
 old_action text:=current_setting('cinegenius.offer_action',true); old_actor text:=current_setting('cinegenius.offer_actor',true);
BEGIN
 IF nullif(trim(p_actor),'') IS NULL THEN RETURN 'forbidden'; END IF;
 SELECT * INTO r FROM listings WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RETURN 'missing'; END IF;
 IF to_jsonb(r) IS DISTINCT FROM p_expected THEN RETURN 'stale'; END IF;
 IF r.type NOT IN ('prop','vehicle') THEN RETURN 'not_marketplace'; END IF;
 IF r.company_id IS NULL THEN
  IF r.user_id IS DISTINCT FROM p_actor THEN RETURN 'forbidden'; END IF;
 ELSE
  SELECT to_jsonb(c) INTO company FROM companies c WHERE id=r.company_id FOR SHARE;
  IF company IS NULL OR company->>'published'<>'true' OR nullif(trim(company->>'slug'),'') IS NULL THEN RETURN 'provider_required'; END IF;
  IF company->>'owner_user_id' IS DISTINCT FROM p_actor THEN
   SELECT role INTO membership_role FROM company_members WHERE company_id=r.company_id AND user_id=p_actor AND status='accepted' FOR SHARE;
   IF membership_role IS NULL OR membership_role NOT IN ('owner','admin','editor') THEN RETURN 'forbidden'; END IF;
  END IF;
 END IF;
 SELECT to_jsonb(p) INTO profile FROM profiles p WHERE user_id=p_actor FOR SHARE;
 IF profile IS NULL OR nullif(trim(profile->>'display_name'),'') IS NULL OR position('@' in profile->>'display_name')>0
  OR nullif(trim(profile->>'location'),'') IS NULL
  OR NOT (nullif(trim(profile->>'role'),'') IS NOT NULL OR nullif(trim(profile->>'profile_type'),'') IS NOT NULL
   OR jsonb_array_length(CASE WHEN jsonb_typeof(profile->'positions')='array' THEN profile->'positions' ELSE '[]'::jsonb END)>0
   OR jsonb_array_length(CASE WHEN jsonb_typeof(profile->'profile_types')='array' THEN profile->'profile_types' ELSE '[]'::jsonb END)>0)
 THEN RETURN 'profile_required'; END IF;
 -- Keep an admin restriction even after an owner edits or re-submits the row.
 SELECT event INTO last_admin_action FROM offer_moderation_events
 WHERE offer_kind='listing' AND offer_id=p_id AND event IN ('approve','hide','reject','changes_requested')
 ORDER BY created_at DESC,id DESC LIMIT 1;
 IF last_admin_action IS NOT NULL AND last_admin_action<>'approve' THEN RETURN 'restricted'; END IF;
 -- An owner's hide can be reversed; an explicit admin restriction cannot.
 IF r.moderation_status IN ('rejected','changes_requested') OR (r.moderation_status='hidden' AND r.reviewed_by IS NOT NULL) THEN RETURN 'restricted'; END IF;
 IF nullif(trim(r.title),'') IS NULL OR nullif(trim(r.city),'') IS NULL OR nullif(trim(r.category),'') IS NULL OR nullif(trim(r.image_url),'') IS NULL THEN RETURN 'incomplete'; END IF;
 IF r.published IS TRUE AND r.moderation_status='owner_published' THEN RETURN 'unchanged'; END IF;
 PERFORM set_config('cinegenius.offer_action','owner_publish',true);
 PERFORM set_config('cinegenius.offer_actor',p_actor,true);
 UPDATE listings SET published=true WHERE id=p_id;
 PERFORM set_config('cinegenius.offer_action',coalesce(old_action,''),true);
 PERFORM set_config('cinegenius.offer_actor',coalesce(old_actor,''),true);
 RETURN 'saved';
END $$;
REVOKE ALL ON FUNCTION public.marketplace_publish_transition(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_publish_transition(uuid,jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
