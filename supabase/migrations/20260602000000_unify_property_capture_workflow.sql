-- Unified capture pipeline:
-- partner indication -> property registration -> admin review -> inspection -> publishing.

CREATE OR REPLACE FUNCTION public.is_operational_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager', 'broker')
  );
$$;

REVOKE ALL ON FUNCTION public.is_operational_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_operational_user(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.capture_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  cpf_cnpj text,
  phone text,
  email text,
  address text,
  pix_key text,
  notes text,
  registration_status text NOT NULL DEFAULT 'pending'
    CHECK (registration_status IN ('pending', 'approved', 'rejected')),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capture_partners_status_idx
  ON public.capture_partners(registration_status);

DROP TRIGGER IF EXISTS capture_partners_updated ON public.capture_partners;
CREATE TRIGGER capture_partners_updated
  BEFORE UPDATE ON public.capture_partners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.guard_capture_partner_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     AND NEW.registration_status <> 'pending'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar ou rejeitar parceiros';
  END IF;

  IF NEW.active AND NEW.registration_status <> 'approved' THEN
    RAISE EXCEPTION 'Somente parceiros aprovados podem ser ativados';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.registration_status IS DISTINCT FROM NEW.registration_status
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar ou rejeitar parceiros';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_capture_partner_review ON public.capture_partners;
CREATE TRIGGER guard_capture_partner_review
  BEFORE INSERT OR UPDATE ON public.capture_partners
  FOR EACH ROW EXECUTE FUNCTION public.guard_capture_partner_review();

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'capture_pending'
    CHECK (workflow_status IN (
      'capture_pending',
      'registration_in_progress',
      'awaiting_admin_review',
      'inspection_pending',
      'inspection_scheduled',
      'awaiting_inspection_review',
      'ready_to_publish',
      'rejected'
    )),
  ADD COLUMN IF NOT EXISTS listing_purpose text NOT NULL DEFAULT 'sale_rent'
    CHECK (listing_purpose IN ('sale', 'rent', 'sale_rent')),
  ADD COLUMN IF NOT EXISTS capture_partner_id uuid REFERENCES public.capture_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_cpf text,
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS owner_address text,
  ADD COLUMN IF NOT EXISTS capture_notes text,
  ADD COLUMN IF NOT EXISTS sale_min_price numeric,
  ADD COLUMN IF NOT EXISTS sale_max_price numeric,
  ADD COLUMN IF NOT EXISTS rental_min_price numeric,
  ADD COLUMN IF NOT EXISTS rental_max_price numeric,
  ADD COLUMN IF NOT EXISTS admin_review_notes text,
  ADD COLUMN IF NOT EXISTS admin_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_reviewed_at timestamptz;

-- Existing portfolio entries predate the capture workflow and stay publishable.
UPDATE public.properties
SET workflow_status = 'ready_to_publish'
WHERE workflow_status = 'capture_pending'
  AND created_at < now() - interval '1 minute';

CREATE INDEX IF NOT EXISTS properties_workflow_status_idx
  ON public.properties(workflow_status);
CREATE INDEX IF NOT EXISTS properties_capture_partner_id_idx
  ON public.properties(capture_partner_id);

CREATE OR REPLACE FUNCTION public.guard_property_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    TG_OP = 'INSERT'
    OR OLD.workflow_status IS DISTINCT FROM NEW.workflow_status
  )
  AND NEW.workflow_status IN ('inspection_pending', 'ready_to_publish', 'rejected')
  AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar ou rejeitar imoveis';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_property_workflow ON public.properties;
CREATE TRIGGER guard_property_workflow
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.guard_property_workflow();

CREATE TABLE IF NOT EXISTS public.property_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  assigned_broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'completed', 'approved', 'rejected')),
  scheduled_at timestamptz,
  contact_notes text,
  technical_notes text,
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_inspections_status_idx
  ON public.property_inspections(status);
CREATE INDEX IF NOT EXISTS property_inspections_assigned_broker_idx
  ON public.property_inspections(assigned_broker_id);

DROP TRIGGER IF EXISTS property_inspections_updated ON public.property_inspections;
CREATE TRIGGER property_inspections_updated
  BEFORE UPDATE ON public.property_inspections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.guard_property_inspection_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    TG_OP = 'INSERT'
    OR OLD.status IS DISTINCT FROM NEW.status
  )
  AND NEW.status IN ('approved', 'rejected')
  AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar ou rejeitar vistorias';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_property_inspection_review ON public.property_inspections;
CREATE TRIGGER guard_property_inspection_review
  BEFORE INSERT OR UPDATE ON public.property_inspections
  FOR EACH ROW EXECUTE FUNCTION public.guard_property_inspection_review();

ALTER TABLE public.capture_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capture partners public registration"
  ON public.capture_partners
  FOR INSERT TO anon
  WITH CHECK (registration_status = 'pending' AND active = false);

CREATE POLICY "capture partners operational read"
  ON public.capture_partners
  FOR SELECT TO authenticated
  USING (public.is_operational_user(auth.uid()));

CREATE POLICY "capture partners operational manage"
  ON public.capture_partners
  FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()))
  WITH CHECK (public.is_operational_user(auth.uid()));

CREATE POLICY "property inspections operational read"
  ON public.property_inspections
  FOR SELECT TO authenticated
  USING (public.is_operational_user(auth.uid()));

CREATE POLICY "property inspections operational manage"
  ON public.property_inspections
  FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()))
  WITH CHECK (public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "properties staff manage" ON public.properties;
CREATE POLICY "properties operational manage"
  ON public.properties
  FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()))
  WITH CHECK (public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "images staff manage" ON public.property_images;
CREATE POLICY "images operational manage"
  ON public.property_images
  FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()))
  WITH CHECK (public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "property images staff write" ON storage.objects;
DROP POLICY IF EXISTS "property images staff update" ON storage.objects;
DROP POLICY IF EXISTS "property images staff delete" ON storage.objects;

CREATE POLICY "property images operational write"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-images' AND public.is_operational_user(auth.uid()));

CREATE POLICY "property images operational update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'property-images' AND public.is_operational_user(auth.uid()));

CREATE POLICY "property images operational delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'property-images' AND public.is_operational_user(auth.uid()));

GRANT INSERT ON public.capture_partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_inspections TO authenticated;
