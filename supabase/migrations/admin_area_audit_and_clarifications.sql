-- Admin audit history and a narrowly scoped queue for pending company requests
-- that have no discoverable company owner profile or accepted company manager.
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) BETWEEN 5 AND 500),
  outcome TEXT NOT NULL DEFAULT 'started' CHECK (outcome IN ('started', 'succeeded', 'failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx
  ON public.admin_audit_log (entity_type, entity_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

CREATE OR REPLACE VIEW public.admin_company_membership_clarifications AS
SELECT
  cm.id,
  cm.company_id,
  cm.user_id,
  cm.title,
  cm.public_titles,
  cm.request_message,
  cm.created_at,
  c.name AS company_name,
  c.slug AS company_slug,
  c.owner_user_id,
  requester.display_name AS requester_name,
  owner_profile.display_name AS owner_name
FROM public.company_members cm
JOIN public.companies c ON c.id = cm.company_id
LEFT JOIN public.profiles requester ON requester.user_id = cm.user_id
LEFT JOIN public.profiles owner_profile ON owner_profile.user_id = c.owner_user_id
WHERE cm.status = 'pending'
  AND owner_profile.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_members manager
    WHERE manager.company_id = cm.company_id
      AND manager.status = 'accepted'
      AND manager.role IN ('owner', 'admin', 'manager')
  );

REVOKE ALL ON public.admin_company_membership_clarifications FROM anon, authenticated;
GRANT SELECT ON public.admin_company_membership_clarifications TO service_role;
