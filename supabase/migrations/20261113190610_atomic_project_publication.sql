-- One publication transaction: content, credits and the retry receipt either
-- commit together or remain unchanged. Only the authenticated server calls it.
CREATE OR REPLACE FUNCTION public.publish_project_draft(
  p_actor text, p_draft_id uuid, p_expected_updated_at timestamptz,
  p_fields jsonb, p_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  d public.project_drafts%ROWTYPE;
  current_project public.projects%ROWTYPE;
  fields public.projects%ROWTYPE;
  v_project_id uuid;
  profile_id uuid;
  entry jsonb;
  crew_name text;
  crew_role text;
  publication_metadata jsonb;
BEGIN
  IF nullif(btrim(p_actor), '') IS NULL THEN
    RAISE SQLSTATE 'PT401' USING MESSAGE = 'authentication_required';
  END IF;
  SELECT * INTO d FROM public.project_drafts
    WHERE id = p_draft_id AND user_id = p_actor FOR UPDATE NOWAIT;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE = 'draft_not_found'; END IF;
  IF d.published_project_id IS NOT NULL THEN RETURN d.published_project_id; END IF;
  IF p_expected_updated_at IS NULL OR d.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE = 'draft_changed';
  END IF;
  fields := jsonb_populate_record(NULL::public.projects, p_fields);
  IF nullif(btrim(fields.title), '') IS NULL OR nullif(btrim(fields.type), '') IS NULL THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE = 'project_details_required';
  END IF;
  -- The server prepares metadata from the exact owner-scoped draft revision.
  -- Member publication can never confer or preserve administrative verification.
  publication_metadata := (coalesce(p_metadata, '{}'::jsonb) - 'verified') ||
    jsonb_build_object('project_details', (coalesce(p_metadata->'project_details', '{}'::jsonb) - 'verified') || '{"verified":false}'::jsonb);

  IF d.source_project_id IS NOT NULL THEN
    SELECT * INTO current_project FROM public.projects
      WHERE id = d.source_project_id AND created_by = p_actor FOR UPDATE NOWAIT;
    IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE = 'project_not_found'; END IF;
    IF current_project.updated_at IS DISTINCT FROM (d.draft_data->>'updated_at')::timestamptz THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE = 'project_changed';
    END IF;
    v_project_id := current_project.id;
    UPDATE public.projects SET title = fields.title, year = fields.year,
      type = fields.type, description = fields.description, director = fields.director,
      poster_url = fields.poster_url, images = coalesce(fields.images, '{}'::text[]),
      place_country_code = fields.place_country_code, place_region_id = fields.place_region_id,
      place_city_id = fields.place_city_id, place_city_name = fields.place_city_name,
      place_region_name = fields.place_region_name, place_status = fields.place_status,
      place_original = fields.place_original, metadata = publication_metadata - 'draft_id',
      updated_at = clock_timestamp()
    WHERE id = v_project_id;
  ELSE
    -- Earlier non-transactional partial publications need explicit reconciliation.
    -- Never silently overwrite their potentially newer public edits.
    SELECT id INTO v_project_id FROM public.projects WHERE created_by = p_actor AND metadata->>'draft_id' = d.id::text FOR UPDATE NOWAIT;
    IF v_project_id IS NOT NULL THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE = 'legacy_publication_needs_review';
    END IF;
    IF v_project_id IS NULL THEN
      INSERT INTO public.projects (title, year, type, description, director, poster_url, images,
        created_by, metadata, place_country_code, place_region_id, place_city_id,
        place_city_name, place_region_name, place_status, place_original)
      VALUES (fields.title, fields.year, fields.type, fields.description, fields.director,
        fields.poster_url, coalesce(fields.images, '{}'::text[]), p_actor,
        publication_metadata || jsonb_build_object('draft_id', d.id),
        fields.place_country_code, fields.place_region_id, fields.place_city_id,
        fields.place_city_name, fields.place_region_name, fields.place_status, fields.place_original)
      RETURNING id INTO v_project_id;
    END IF;
  END IF;

  IF nullif(btrim(d.draft_data->>'myRole'), '') IS NOT NULL THEN
    INSERT INTO public.project_credits (project_id, user_id, role)
      VALUES (v_project_id, p_actor, btrim(d.draft_data->>'myRole'))
      ON CONFLICT ON CONSTRAINT project_credits_project_id_user_id_key DO UPDATE SET role = EXCLUDED.role;
  END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(d.draft_data->'crew_entries') = 'array' THEN d.draft_data->'crew_entries' ELSE '[]'::jsonb END) LIMIT 40
  LOOP
    crew_name := left(btrim(entry->>'name'), 100);
    crew_role := left(btrim(entry->>'role'), 100);
    IF nullif(crew_name, '') IS NULL OR nullif(crew_role, '') IS NULL THEN CONTINUE; END IF;
    -- Reuse only an already linked entry in this project. Equal names on
    -- unrelated projects are not sufficient evidence of the same identity.
    SELECT c.unclaimed_profile_id INTO profile_id FROM public.project_credits c
      JOIN public.unclaimed_profiles u ON u.id = c.unclaimed_profile_id
      WHERE c.project_id = v_project_id AND u.name = crew_name AND c.role = crew_role LIMIT 1;
    IF profile_id IS NULL THEN
      profile_id := gen_random_uuid();
      INSERT INTO public.unclaimed_profiles (id, name, slug, primary_role, created_by)
        VALUES (profile_id, crew_name, 'project-credit-' || profile_id::text, crew_role, p_actor);
      INSERT INTO public.project_credits (project_id, unclaimed_profile_id, role)
        VALUES (v_project_id, profile_id, crew_role);
    END IF;
  END LOOP;
  UPDATE public.project_drafts SET published_project_id = v_project_id, updated_at = clock_timestamp()
    WHERE id = d.id AND user_id = p_actor;
  RETURN v_project_id;
EXCEPTION WHEN lock_not_available THEN
  RAISE SQLSTATE 'PT409' USING MESSAGE = 'publication_busy';
END;
$$;
REVOKE ALL ON FUNCTION public.publish_project_draft(text, uuid, timestamptz, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_project_draft(text, uuid, timestamptz, jsonb, jsonb) TO service_role;
