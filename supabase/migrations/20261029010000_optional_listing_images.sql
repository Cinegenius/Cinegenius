-- Images are optional. Preserve the exact owner/company/profile/revision checks,
-- explicit admin restrictions, service-only execution, and all existing content.
-- Apply before releasing the dependent optional-image UI.
BEGIN;
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
 IF nullif(trim(r.title),'') IS NULL OR nullif(trim(r.city),'') IS NULL OR nullif(trim(r.category),'') IS NULL THEN RETURN 'incomplete'; END IF;
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
