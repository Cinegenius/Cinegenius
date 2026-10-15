-- Private, owner-scoped working copies. Published projects remain in projects.
-- Project metadata is used by existing project views for linked records and by
-- the draft publish idempotency marker. Add it here for older installations.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.project_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  source_project_id uuid NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  published_project_id uuid NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  draft_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_drafts_owner_source_idx
  ON public.project_drafts (user_id, source_project_id)
  WHERE source_project_id IS NOT NULL AND published_project_id IS NULL;
CREATE INDEX IF NOT EXISTS project_drafts_owner_updated_idx
  ON public.project_drafts (user_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS projects_published_from_draft_idx
  ON public.projects ((metadata->>'draft_id'))
  WHERE metadata ? 'draft_id';

ALTER TABLE public.project_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.project_drafts FROM anon, authenticated;
GRANT ALL ON TABLE public.project_drafts TO service_role;
