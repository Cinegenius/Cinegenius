-- Prepared only: apply separately after review. No publication or membership changes.
BEGIN;
ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS sender_favorite boolean NOT NULL DEFAULT false;
ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS receiver_favorite boolean NOT NULL DEFAULT false;

-- New/reused relationships never inherit a previous private favorite.
CREATE OR REPLACE FUNCTION public.contact_favorites_reset_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
    OR NEW.status<>'accepted' THEN
    NEW.sender_favorite:=false; NEW.receiver_favorite:=false;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER contact_favorites_reset_v1 BEFORE INSERT OR UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.contact_favorites_reset_v1();

CREATE OR REPLACE FUNCTION public.set_contact_favorite_v1(p_actor text,p_id uuid,p_favorite boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='2s' AS $$
DECLARE edge public.friendships; target text; changed_rows integer;
BEGIN
  IF p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' OR p_id IS NULL OR p_favorite IS NULL THEN
    RETURN jsonb_build_object('status','invalid');
  END IF;
  SELECT * INTO edge FROM public.friendships WHERE id=p_id AND status='accepted' AND p_actor IN(sender_id,receiver_id);
  IF NOT FOUND THEN RETURN jsonb_build_object('status','missing'); END IF;
  target:=CASE WHEN edge.sender_id=p_actor THEN edge.receiver_id ELSE edge.sender_id END;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('contact:'||least(p_actor,target)||':'||greatest(p_actor,target),0)) THEN
    RETURN jsonb_build_object('status','busy');
  END IF;
  SELECT * INTO edge FROM public.friendships WHERE id=p_id AND status='accepted'
    AND ((sender_id=p_actor AND receiver_id=target) OR (sender_id=target AND receiver_id=p_actor)) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','missing'); END IF;
  IF EXISTS(SELECT 1 FROM public.blocks WHERE (blocker_id=p_actor AND blocked_id=target) OR (blocker_id=target AND blocked_id=p_actor)) THEN
    RETURN jsonb_build_object('status','blocked');
  END IF;
  -- All accepted duplicate edges carry the same own preference. Never touch the peer's side or collaboration labels.
  UPDATE public.friendships SET
    sender_favorite=CASE WHEN sender_id=p_actor THEN p_favorite ELSE sender_favorite END,
    receiver_favorite=CASE WHEN receiver_id=p_actor THEN p_favorite ELSE receiver_favorite END
  WHERE status='accepted' AND ((sender_id=p_actor AND receiver_id=target) OR (sender_id=target AND receiver_id=p_actor))
    AND (CASE WHEN sender_id=p_actor THEN sender_favorite ELSE receiver_favorite END) IS DISTINCT FROM p_favorite;
  GET DIAGNOSTICS changed_rows=ROW_COUNT;
  RETURN jsonb_build_object('status','saved','friendship_id',p_id,'is_favorite',p_favorite,'changed',changed_rows>0);
EXCEPTION WHEN lock_not_available THEN RETURN jsonb_build_object('status','busy');
END $$;

CREATE OR REPLACE FUNCTION public.contact_favorites_v1(p_actor text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE favorites jsonb;
BEGIN
  IF p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('friendship_id',id,'is_favorite',favorite) ORDER BY id),'[]'::jsonb) INTO favorites
  FROM (
    SELECT f.id, bool_or(CASE WHEN f.sender_id=p_actor THEN f.sender_favorite ELSE f.receiver_favorite END)
      OVER(PARTITION BY CASE WHEN f.sender_id=p_actor THEN f.receiver_id ELSE f.sender_id END) AS favorite
    FROM public.friendships f WHERE f.status='accepted' AND p_actor IN(f.sender_id,f.receiver_id)
      AND NOT EXISTS(SELECT 1 FROM public.blocks b WHERE
        (b.blocker_id=f.sender_id AND b.blocked_id=f.receiver_id) OR (b.blocker_id=f.receiver_id AND b.blocked_id=f.sender_id))
  ) own_contacts;
  RETURN jsonb_build_object('contract','cinegenius.friendships.v1','writable',
    to_regprocedure('public.set_contact_favorite_v1(text,uuid,boolean)') IS NOT NULL,'favorites',favorites);
END $$;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.friendships FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.friendships TO service_role;
REVOKE ALL ON FUNCTION public.contact_favorites_reset_v1(),public.contact_favorites_v1(text),public.set_contact_favorite_v1(text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contact_favorites_reset_v1(),public.contact_favorites_v1(text),public.set_contact_favorite_v1(text,uuid,boolean) TO service_role;
COMMIT;
