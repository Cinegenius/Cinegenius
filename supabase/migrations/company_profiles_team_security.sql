-- Company media and team-management additions. Existing companies and memberships are preserved.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE company_members
  ADD COLUMN IF NOT EXISTS public_titles TEXT[] NOT NULL DEFAULT '{}';

-- Preserve existing public titles in the new multi-title field.
UPDATE company_members
SET public_titles = ARRAY[trim(title)]
WHERE title IS NOT NULL
  AND trim(title) <> ''
  AND COALESCE(array_length(public_titles, 1), 0) = 0;

-- Public job titles are separate from permission roles. Keep legacy `manager`
-- values valid while adding the new least-privilege admin/editor roles.
DO $$
DECLARE role_check RECORD;
BEGIN
  FOR role_check IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'company_members'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
      AND array_length(conkey, 1) = 1
      AND (
        SELECT attname FROM pg_attribute
        WHERE attrelid = conrelid AND attnum = conkey[1]
      ) = 'role'
  LOOP
    EXECUTE format('ALTER TABLE company_members DROP CONSTRAINT %I', role_check.conname);
  END LOOP;
END $$;

ALTER TABLE company_members
  ALTER COLUMN role DROP DEFAULT;
ALTER TABLE company_members
  ALTER COLUMN role TYPE TEXT USING role::text;
ALTER TABLE company_members
  ALTER COLUMN role SET DEFAULT 'member';

ALTER TABLE company_members
  ADD CONSTRAINT company_members_role_check
    CHECK (role IN ('owner', 'admin', 'editor', 'manager', 'member'));

CREATE TABLE IF NOT EXISTS company_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  permission_role TEXT NOT NULL DEFAULT 'member'
    CHECK (permission_role IN ('admin', 'editor', 'member')),
  public_titles TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'revoked')),
  created_by TEXT NOT NULL,
  claimed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_company_invitations_company_pending
  ON company_invitations(company_id, expires_at DESC)
  WHERE status = 'pending';

ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE company_invitations FROM anon, authenticated;
