-- Serialize contact changes per pair. Existing relationships and collaboration
-- labels are preserved; no legacy row is merged, deleted or made public here.
BEGIN;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.friendships FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.friendships TO service_role;
CREATE INDEX IF NOT EXISTS friendships_contact_pair_idx ON public.friendships(sender_id,receiver_id,status);
CREATE OR REPLACE FUNCTION public.contact_connection(
 p_actor text,p_action text,p_target text DEFAULT null,p_id uuid DEFAULT null,
 p_label text DEFAULT null,p_public boolean DEFAULT false,p_notification jsonb DEFAULT null
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE current_contact public.friendships; selected_contact public.friendships; target text; event_name text; changed boolean:=false;
BEGIN
 IF p_actor IS NULL OR p_actor !~ '^[a-zA-Z0-9_-]{1,128}$' OR p_action IS NULL OR p_action NOT IN ('request','accepted','rejected','remove','collab') THEN RETURN jsonb_build_object('status','invalid');END IF;
 IF p_action='request' THEN target:=p_target;
 ELSE
  SELECT * INTO current_contact FROM public.friendships WHERE id=p_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','missing');END IF;
  IF p_actor NOT IN (current_contact.sender_id,current_contact.receiver_id) THEN RETURN jsonb_build_object('status','forbidden');END IF;
  target:=CASE WHEN current_contact.sender_id=p_actor THEN current_contact.receiver_id ELSE current_contact.sender_id END;
 END IF;
 IF target IS NULL OR target !~ '^[a-zA-Z0-9_-]{1,128}$' OR target=p_actor THEN RETURN jsonb_build_object('status','invalid');END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('contact:'||least(p_actor,target)||':'||greatest(p_actor,target),0)) THEN RETURN jsonb_build_object('status','busy');END IF;
 IF p_action<>'request' THEN
  SELECT * INTO current_contact FROM public.friendships WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','missing');END IF;
  IF p_actor NOT IN (current_contact.sender_id,current_contact.receiver_id) THEN RETURN jsonb_build_object('status','forbidden');END IF;
 END IF;
 IF p_action NOT IN ('remove','rejected') AND EXISTS(SELECT 1 FROM public.blocks WHERE (blocker_id=p_actor AND blocked_id=target) OR (blocker_id=target AND blocked_id=p_actor)) THEN RETURN jsonb_build_object('status','blocked');END IF;
 IF p_action='remove' THEN
  -- Explicit removal includes duplicate legacy edges so hidden duplicates cannot
  -- continue granting friends-only access after the member removes this person.
  DELETE FROM public.friendships WHERE (sender_id=p_actor AND receiver_id=target) OR (sender_id=target AND receiver_id=p_actor);
  RETURN jsonb_build_object('status','saved','changed',true,'friendship',null);
 END IF;
 IF p_action='collab' THEN
  IF current_contact.status<>'accepted' THEN RETURN jsonb_build_object('status','stale');END IF;
  IF length(coalesce(p_label,''))>120 OR p_public IS NULL THEN RETURN jsonb_build_object('status','invalid');END IF;
  IF current_contact.sender_id=p_actor THEN UPDATE public.friendships SET sender_collab_label=nullif(trim(p_label),''),sender_collab_public=p_public,updated_at=now() WHERE id=p_id RETURNING * INTO current_contact;
  ELSE UPDATE public.friendships SET receiver_collab_label=nullif(trim(p_label),''),receiver_collab_public=p_public,updated_at=now() WHERE id=p_id RETURNING * INTO current_contact;END IF;
  RETURN jsonb_build_object('status','saved','changed',true,'friendship',to_jsonb(current_contact));
 END IF;
 SELECT * INTO selected_contact FROM public.friendships
  WHERE (sender_id=p_actor AND receiver_id=target) OR (sender_id=target AND receiver_id=p_actor)
  ORDER BY CASE status WHEN 'accepted' THEN 2 WHEN 'pending' THEN 1 ELSE 0 END DESC,created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF p_action='request' THEN
  IF FOUND AND selected_contact.status IN ('accepted','pending') THEN RETURN jsonb_build_object('status','existing','changed',false,'friendship',to_jsonb(selected_contact));END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=target) THEN RETURN jsonb_build_object('status','missing');END IF;
  IF selected_contact.id IS NULL THEN
   INSERT INTO public.friendships(sender_id,receiver_id,status) VALUES(p_actor,target,'pending') RETURNING * INTO current_contact;
  ELSE
   UPDATE public.friendships SET sender_id=p_actor,receiver_id=target,status='pending',updated_at=now(),sender_collab_label=null,receiver_collab_label=null,sender_collab_public=false,receiver_collab_public=false WHERE id=selected_contact.id RETURNING * INTO current_contact;
  END IF;
  event_name:='friend_request';changed:=true;
 ELSE
  IF current_contact.receiver_id<>p_actor THEN RETURN jsonb_build_object('status','forbidden');END IF;
  IF current_contact.status=p_action THEN RETURN jsonb_build_object('status','existing','changed',false,'friendship',to_jsonb(current_contact));END IF;
  IF current_contact.status<>'pending' THEN RETURN jsonb_build_object('status','stale');END IF;
  IF selected_contact.status='accepted' THEN RETURN jsonb_build_object('status','existing','changed',false,'friendship',to_jsonb(selected_contact));END IF;
  UPDATE public.friendships SET status=p_action,updated_at=now() WHERE id=p_id RETURNING * INTO current_contact;
  changed:=true;
  IF p_action='accepted' THEN event_name:='friend_accepted';target:=current_contact.sender_id;END IF;
 END IF;
 IF event_name IS NOT NULL THEN
  IF nullif(p_notification->>'title','') IS NULL OR nullif(p_notification->>'body','') IS NULL OR jsonb_typeof(p_notification->'localization') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_contact_notification';END IF;
  INSERT INTO public.notifications(user_id,type,title,body,href,localization) VALUES(target,event_name,p_notification->>'title',p_notification->>'body','/messages?requests=1',p_notification->'localization');
 END IF;
 RETURN jsonb_build_object('status','saved','changed',changed,'event',event_name,'friendship',to_jsonb(current_contact));
END $$;
REVOKE ALL ON FUNCTION public.contact_connection(text,text,text,uuid,text,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contact_connection(text,text,text,uuid,text,boolean,jsonb) TO service_role;
COMMIT;
