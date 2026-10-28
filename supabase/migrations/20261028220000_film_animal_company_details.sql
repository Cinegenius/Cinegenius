-- Optional public service/species attributes. Existing firms, memberships, media,
-- publications and personal data are unchanged. All writes stay on server APIs.
BEGIN;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS animal_details jsonb;
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_animal_details_object;
ALTER TABLE public.companies ADD CONSTRAINT companies_animal_details_object CHECK (animal_details IS NULL OR jsonb_typeof(animal_details)='object');
REVOKE SELECT(animal_details),INSERT(animal_details),UPDATE(animal_details) ON public.companies FROM PUBLIC,anon,authenticated;
GRANT SELECT(animal_details),INSERT(animal_details),UPDATE(animal_details) ON public.companies TO service_role;
DO $$ BEGIN
 IF has_column_privilege('anon','public.companies','animal_details','UPDATE') OR has_column_privilege('authenticated','public.companies','animal_details','UPDATE') THEN
  RAISE EXCEPTION 'Unexpected direct animal-details write permission';
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
