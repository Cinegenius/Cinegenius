-- Keep public company functions under company approval. Existing accepted and
-- pending memberships remain intact; the message is attached to pending joins.
ALTER TABLE company_members
  ADD COLUMN IF NOT EXISTS request_message TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS company_member_title_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_member_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  requested_public_titles TEXT[] NOT NULL CHECK (cardinality(requested_public_titles) BETWEEN 1 AND 5),
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  approved_public_titles TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(approved_public_titles) <= 5),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_title_change_requests_company_pending
  ON company_member_title_change_requests(company_id, created_at DESC)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_title_change_requests_member_pending
  ON company_member_title_change_requests(company_member_id)
  WHERE status = 'pending';

ALTER TABLE company_member_title_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE company_member_title_change_requests FROM anon, authenticated;
GRANT ALL ON TABLE company_member_title_change_requests TO service_role;

CREATE OR REPLACE FUNCTION resolve_company_member_title_change_request(
  p_request_id UUID,
  p_status TEXT,
  p_reviewed_by TEXT,
  p_approved_public_titles TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  request_row company_member_title_change_requests%ROWTYPE;
  membership_row company_members%ROWTYPE;
  approved_titles TEXT[];
BEGIN
  IF p_status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'invalid request status';
  END IF;

  SELECT * INTO request_row
  FROM company_member_title_change_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND OR request_row.status <> 'pending' THEN
    RAISE EXCEPTION 'request is not pending';
  END IF;

  IF request_row.user_id = p_reviewed_by THEN
    RAISE EXCEPTION 'requester cannot review their own request';
  END IF;

  IF p_status = 'accepted' THEN
    approved_titles := COALESCE(p_approved_public_titles, '{}');
    IF cardinality(approved_titles) = 0 OR cardinality(approved_titles) > 5 THEN
      RAISE EXCEPTION 'one to five public titles are required';
    END IF;
    SELECT * INTO membership_row
    FROM company_members
    WHERE id = request_row.company_member_id
      AND company_id = request_row.company_id
      AND user_id = request_row.user_id
      AND status = 'accepted'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'accepted team membership not found';
    END IF;
    UPDATE company_members
    SET public_titles = approved_titles, title = approved_titles[1]
    WHERE id = membership_row.id;
  ELSE
    approved_titles := '{}';
  END IF;

  UPDATE company_member_title_change_requests
  SET status = p_status,
      approved_public_titles = approved_titles,
      reviewed_by = p_reviewed_by,
      reviewed_at = now()
  WHERE id = request_row.id;

  RETURN jsonb_build_object(
    'id', request_row.id,
    'company_id', request_row.company_id,
    'company_member_id', request_row.company_member_id,
    'user_id', request_row.user_id,
    'requested_public_titles', request_row.requested_public_titles,
    'approved_public_titles', approved_titles,
    'status', p_status
  );
END;
$$;

REVOKE ALL ON FUNCTION resolve_company_member_title_change_request(UUID, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION resolve_company_member_title_change_request(UUID, TEXT, TEXT, TEXT[]) TO service_role;
