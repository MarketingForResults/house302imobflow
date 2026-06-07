ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS company_person_type text,
  ADD COLUMN IF NOT EXISTS company_zip_code text,
  ADD COLUMN IF NOT EXISTS company_street text,
  ADD COLUMN IF NOT EXISTS company_number text,
  ADD COLUMN IF NOT EXISTS company_complement text,
  ADD COLUMN IF NOT EXISTS company_neighborhood text,
  ADD COLUMN IF NOT EXISTS company_city text,
  ADD COLUMN IF NOT EXISTS company_state text;

UPDATE public.app_settings
SET company_person_type = 'juridica'
WHERE company_person_type IS NULL;

ALTER TABLE public.app_settings
  ALTER COLUMN company_person_type SET DEFAULT 'juridica',
  ALTER COLUMN company_person_type SET NOT NULL;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_company_person_type_check,
  ADD CONSTRAINT app_settings_company_person_type_check
    CHECK (company_person_type IN ('juridica', 'fisica'));
