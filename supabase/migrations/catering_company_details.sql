-- Structured optional details for catering and set-catering company profiles.
-- Existing company records are preserved and receive an empty details object.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS catering_details JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN companies.catering_details IS
  'Optional public set-catering details: offered service types, service regions, capacity, dietary options, and mobile equipment.';
