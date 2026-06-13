ALTER TABLE public.property_inspections
  ADD COLUMN IF NOT EXISTS assigned_broker_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_notes text,
  ADD COLUMN IF NOT EXISTS technical_notes text,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.property_inspections'::regclass
      AND conname = 'property_inspections_status_check'
  ) THEN
    ALTER TABLE public.property_inspections
      ADD CONSTRAINT property_inspections_status_check
      CHECK (status IN ('pending', 'scheduled', 'completed', 'approved', 'rejected')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.property_inspections'::regclass
      AND conname = 'property_inspections_assigned_broker_id_fkey'
  ) THEN
    ALTER TABLE public.property_inspections
      ADD CONSTRAINT property_inspections_assigned_broker_id_fkey
      FOREIGN KEY (assigned_broker_id) REFERENCES public.brokers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.property_inspections'::regclass
      AND conname = 'property_inspections_reviewed_by_fkey'
  ) THEN
    ALTER TABLE public.property_inspections
      ADD CONSTRAINT property_inspections_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_inspections TO authenticated;

NOTIFY pgrst, 'reload schema';
