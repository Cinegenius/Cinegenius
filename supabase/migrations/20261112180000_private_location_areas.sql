BEGIN;
CREATE TABLE IF NOT EXISTS public.listing_private_locations (
 listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
 address text NOT NULL DEFAULT '' CHECK(length(address)<=500),
 lat double precision NOT NULL CHECK(lat BETWEEN -90 AND 90),
 lng double precision NOT NULL CHECK(lng BETWEEN -180 AND 180),
 revision bigint NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.listing_private_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_private_locations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.listing_private_locations TO service_role;
-- Both reads and writes check current offer-editor rights inside the transaction.
CREATE OR REPLACE FUNCTION public.listing_private_location(p_id uuid,p_actor text,p_write boolean DEFAULT false,p_value jsonb DEFAULT null,p_area jsonb DEFAULT null,p_revision bigint DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='1500ms' AS $$
DECLARE item public.listings%ROWTYPE; saved public.listing_private_locations%ROWTYPE; company_owner text; member_role text; current_revision bigint;
BEGIN
 SELECT * INTO item FROM listings WHERE id=p_id AND type='location' FOR UPDATE;
 IF NOT FOUND OR nullif(p_actor,'') IS NULL THEN RETURN jsonb_build_object('status','missing'); END IF;
 IF item.company_id IS NULL THEN
  IF item.user_id IS DISTINCT FROM p_actor THEN RETURN jsonb_build_object('status','missing'); END IF;
 ELSE
  SELECT owner_user_id INTO company_owner FROM companies WHERE id=item.company_id FOR SHARE;
  IF company_owner IS DISTINCT FROM p_actor THEN
   SELECT role INTO member_role FROM company_members WHERE company_id=item.company_id AND user_id=p_actor AND status='accepted' FOR SHARE;
   IF member_role IS NULL OR member_role NOT IN ('owner','admin','editor','manager') THEN RETURN jsonb_build_object('status','missing'); END IF;
  END IF;
 END IF;
 SELECT * INTO saved FROM listing_private_locations WHERE listing_id=p_id;
 current_revision:=coalesce((item.metadata->>'location_area_revision')::bigint,0);
 IF NOT p_write THEN RETURN jsonb_build_object('status','ok','value',CASE WHEN saved.listing_id IS NULL THEN null ELSE jsonb_build_object('address',saved.address,'lat',saved.lat,'lng',saved.lng) END,'revision',current_revision); END IF;
 IF current_revision<>p_revision THEN RETURN jsonb_build_object('status','conflict'); END IF;
 IF p_value IS NULL THEN
  IF saved.listing_id IS NULL THEN RETURN jsonb_build_object('status','saved','revision',current_revision); END IF;
  -- The public revision remains after deletion and prevents stale-editor overwrites.
  DELETE FROM listing_private_locations WHERE listing_id=p_id;
  UPDATE listings SET metadata=(coalesce(metadata,'{}'::jsonb)-'location_area') || jsonb_build_object('location_area_revision',coalesce((metadata->>'location_area_revision')::bigint,0)+1),last_editor_id=p_actor WHERE id=p_id;
  RETURN jsonb_build_object('status','saved','revision',current_revision+1);
 END IF;
 IF p_area IS NULL OR NOT (p_value ?& ARRAY['lat','lng','address']) OR NOT (p_area ?& ARRAY['lat','lng','radius_meters']) OR jsonb_typeof(p_value->'lat')<>'number' OR jsonb_typeof(p_value->'lng')<>'number' OR jsonb_typeof(p_value->'address')<>'string'
  OR NOT ((p_value->>'lat')::double precision BETWEEN -90 AND 90) OR NOT ((p_value->>'lng')::double precision BETWEEN -180 AND 180)
  OR length(p_value->>'address')>500 OR p_area->>'radius_meters'<>'500'
  OR NOT ((p_area->>'lat')::double precision BETWEEN -90 AND 90) OR NOT ((p_area->>'lng')::double precision BETWEEN -180 AND 180) THEN RAISE EXCEPTION 'Invalid location' USING ERRCODE='22023'; END IF;
 IF saved.listing_id IS NOT NULL AND saved.address=p_value->>'address' AND saved.lat=(p_value->>'lat')::double precision AND saved.lng=(p_value->>'lng')::double precision THEN
  RETURN jsonb_build_object('status','saved','revision',saved.revision);
 END IF;
 INSERT INTO listing_private_locations(listing_id,address,lat,lng,revision) VALUES(p_id,p_value->>'address',(p_value->>'lat')::double precision,(p_value->>'lng')::double precision,current_revision+1)
 ON CONFLICT(listing_id) DO UPDATE SET address=excluded.address,lat=excluded.lat,lng=excluded.lng,revision=excluded.revision,updated_at=now();
 UPDATE listings SET metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('location_area',p_area,'location_area_revision',coalesce((metadata->>'location_area_revision')::bigint,0)+1),last_editor_id=p_actor WHERE id=p_id;
 RETURN jsonb_build_object('status','saved','revision',current_revision+1);
END $$;
REVOKE ALL ON FUNCTION public.listing_private_location(uuid,text,boolean,jsonb,jsonb,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listing_private_location(uuid,text,boolean,jsonb,jsonb,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
