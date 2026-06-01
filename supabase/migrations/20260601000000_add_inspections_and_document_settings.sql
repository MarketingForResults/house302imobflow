ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'regular'
    CHECK (registration_status IN ('regular', 'irregular'));

UPDATE public.brokers
SET registration_status = 'irregular'
WHERE creci IS NULL OR btrim(creci) = '';

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS company_legal_name text,
  ADD COLUMN IF NOT EXISTS company_trade_name text,
  ADD COLUMN IF NOT EXISTS company_cnpj text,
  ADD COLUMN IF NOT EXISTS company_creci text,
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_phone text,
  ADD COLUMN IF NOT EXISTS company_email text,
  ADD COLUMN IF NOT EXISTS rental_contract_notes text,
  ADD COLUMN IF NOT EXISTS sale_contract_notes text;

CREATE TABLE IF NOT EXISTS public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  property_type public.property_type NOT NULL DEFAULT 'house',
  property_title text,
  property_description text,
  owner_name text NOT NULL,
  owner_cpf text,
  owner_phone text,
  owner_email text,
  owner_address text,
  property_address text NOT NULL,
  neighborhood text,
  city text,
  state text,
  area_m2 numeric,
  bedrooms integer,
  bathrooms integer,
  suites integer,
  parking_spaces integer,
  sale_min_price numeric,
  sale_max_price numeric,
  rental_min_price numeric,
  rental_max_price numeric,
  notes text,
  review_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inspection_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspections_status_idx ON public.inspections(status);
CREATE INDEX IF NOT EXISTS inspections_created_at_idx ON public.inspections(created_at DESC);
CREATE INDEX IF NOT EXISTS inspection_images_inspection_id_idx ON public.inspection_images(inspection_id);

DROP TRIGGER IF EXISTS inspections_updated ON public.inspections;
CREATE TRIGGER inspections_updated
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.guard_inspection_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar ou reprovar vistorias';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_inspection_review ON public.inspections;
CREATE TRIGGER guard_inspection_review
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.guard_inspection_review();

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspections read auth" ON public.inspections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspections staff insert" ON public.inspections
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "inspections staff update" ON public.inspections
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "inspections admin delete" ON public.inspections
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "inspection images read auth" ON public.inspection_images
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspection images staff manage" ON public.inspection_images
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
