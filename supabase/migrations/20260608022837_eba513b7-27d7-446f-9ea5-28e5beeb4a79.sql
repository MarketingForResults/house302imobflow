ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'regular'
    CHECK (registration_status IN ('regular', 'irregular'));

UPDATE public.brokers SET registration_status = 'irregular' WHERE creci IS NULL OR btrim(creci) = '';

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
  property_title text, property_description text,
  owner_name text NOT NULL, owner_cpf text, owner_phone text, owner_email text, owner_address text,
  property_address text NOT NULL, neighborhood text, city text, state text,
  area_m2 numeric, bedrooms integer, bathrooms integer, suites integer, parking_spaces integer,
  sale_min_price numeric, sale_max_price numeric, rental_min_price numeric, rental_max_price numeric,
  notes text, review_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inspection_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  image_url text NOT NULL, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspections_status_idx ON public.inspections(status);
CREATE INDEX IF NOT EXISTS inspections_created_at_idx ON public.inspections(created_at DESC);
CREATE INDEX IF NOT EXISTS inspection_images_inspection_id_idx ON public.inspection_images(inspection_id);

DROP TRIGGER IF EXISTS inspections_updated ON public.inspections;
CREATE TRIGGER inspections_updated BEFORE UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.guard_inspection_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar ou reprovar vistorias';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_inspection_review ON public.inspections;
CREATE TRIGGER guard_inspection_review BEFORE UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.guard_inspection_review();

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspections read auth" ON public.inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspections staff insert" ON public.inspections FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "inspections staff update" ON public.inspections FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "inspections admin delete" ON public.inspections FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "inspection images read auth" ON public.inspection_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspection images staff manage" ON public.inspection_images FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_operational_user(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'manager', 'broker'));
$$;
REVOKE ALL ON FUNCTION public.is_operational_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_operational_user(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.capture_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL, cpf_cnpj text, phone text, email text, address text, pix_key text, notes text,
  registration_status text NOT NULL DEFAULT 'pending' CHECK (registration_status IN ('pending', 'approved', 'rejected')),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capture_partners_status_idx ON public.capture_partners(registration_status);

DROP TRIGGER IF EXISTS capture_partners_updated ON public.capture_partners;
CREATE TRIGGER capture_partners_updated BEFORE UPDATE ON public.capture_partners FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.guard_capture_partner_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.registration_status <> 'pending' AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar ou rejeitar parceiros';
  END IF;
  IF NEW.active AND NEW.registration_status <> 'approved' THEN
    RAISE EXCEPTION 'Somente parceiros aprovados podem ser ativados';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.registration_status IS DISTINCT FROM NEW.registration_status AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar ou rejeitar parceiros';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_capture_partner_review ON public.capture_partners;
CREATE TRIGGER guard_capture_partner_review BEFORE INSERT OR UPDATE ON public.capture_partners FOR EACH ROW EXECUTE FUNCTION public.guard_capture_partner_review();

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'capture_pending'
    CHECK (workflow_status IN ('capture_pending','registration_in_progress','awaiting_admin_review','inspection_pending','inspection_scheduled','awaiting_inspection_review','ready_to_publish','rejected')),
  ADD COLUMN IF NOT EXISTS listing_purpose text NOT NULL DEFAULT 'sale_rent' CHECK (listing_purpose IN ('sale','rent','sale_rent')),
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

UPDATE public.properties SET workflow_status = 'ready_to_publish' WHERE workflow_status = 'capture_pending' AND created_at < now() - interval '1 minute';

CREATE INDEX IF NOT EXISTS properties_workflow_status_idx ON public.properties(workflow_status);
CREATE INDEX IF NOT EXISTS properties_capture_partner_id_idx ON public.properties(capture_partner_id);

CREATE OR REPLACE FUNCTION public.guard_property_workflow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR OLD.workflow_status IS DISTINCT FROM NEW.workflow_status)
     AND NEW.workflow_status IN ('inspection_pending','ready_to_publish','rejected')
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar ou rejeitar imoveis';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_property_workflow ON public.properties;
CREATE TRIGGER guard_property_workflow BEFORE INSERT OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.guard_property_workflow();

CREATE TABLE IF NOT EXISTS public.property_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  assigned_broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scheduled','completed','approved','rejected')),
  scheduled_at timestamptz, contact_notes text, technical_notes text, review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_inspections_status_idx ON public.property_inspections(status);
CREATE INDEX IF NOT EXISTS property_inspections_assigned_broker_idx ON public.property_inspections(assigned_broker_id);

DROP TRIGGER IF EXISTS property_inspections_updated ON public.property_inspections;
CREATE TRIGGER property_inspections_updated BEFORE UPDATE ON public.property_inspections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.guard_property_inspection_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status IN ('approved','rejected')
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar ou rejeitar vistorias';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_property_inspection_review ON public.property_inspections;
CREATE TRIGGER guard_property_inspection_review BEFORE INSERT OR UPDATE ON public.property_inspections FOR EACH ROW EXECUTE FUNCTION public.guard_property_inspection_review();

ALTER TABLE public.capture_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capture partners public registration" ON public.capture_partners;
CREATE POLICY "capture partners public registration" ON public.capture_partners FOR INSERT TO anon, authenticated WITH CHECK (registration_status = 'pending' AND active = false);
DROP POLICY IF EXISTS "capture partners operational read" ON public.capture_partners;
CREATE POLICY "capture partners operational read" ON public.capture_partners FOR SELECT TO authenticated USING (public.is_operational_user(auth.uid()));
DROP POLICY IF EXISTS "capture partners operational manage" ON public.capture_partners;
CREATE POLICY "capture partners operational manage" ON public.capture_partners FOR ALL TO authenticated USING (public.is_operational_user(auth.uid())) WITH CHECK (public.is_operational_user(auth.uid()));
DROP POLICY IF EXISTS "property inspections operational read" ON public.property_inspections;
CREATE POLICY "property inspections operational read" ON public.property_inspections FOR SELECT TO authenticated USING (public.is_operational_user(auth.uid()));
DROP POLICY IF EXISTS "property inspections operational manage" ON public.property_inspections;
CREATE POLICY "property inspections operational manage" ON public.property_inspections FOR ALL TO authenticated USING (public.is_operational_user(auth.uid())) WITH CHECK (public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "properties staff manage" ON public.properties;
DROP POLICY IF EXISTS "properties operational manage" ON public.properties;
CREATE POLICY "properties operational manage" ON public.properties FOR ALL TO authenticated USING (public.is_operational_user(auth.uid())) WITH CHECK (public.is_operational_user(auth.uid()));
DROP POLICY IF EXISTS "images staff manage" ON public.property_images;
DROP POLICY IF EXISTS "images operational manage" ON public.property_images;
CREATE POLICY "images operational manage" ON public.property_images FOR ALL TO authenticated USING (public.is_operational_user(auth.uid())) WITH CHECK (public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "property images staff write" ON storage.objects;
DROP POLICY IF EXISTS "property images staff update" ON storage.objects;
DROP POLICY IF EXISTS "property images staff delete" ON storage.objects;
DROP POLICY IF EXISTS "property images operational write" ON storage.objects;
DROP POLICY IF EXISTS "property images operational update" ON storage.objects;
DROP POLICY IF EXISTS "property images operational delete" ON storage.objects;
CREATE POLICY "property images operational write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'property-images' AND public.is_operational_user(auth.uid()));
CREATE POLICY "property images operational update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'property-images' AND public.is_operational_user(auth.uid()));
CREATE POLICY "property images operational delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'property-images' AND public.is_operational_user(auth.uid()));

GRANT INSERT ON public.capture_partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_inspections TO authenticated;

CREATE TABLE IF NOT EXISTS public.document_kinds (
  id text PRIMARY KEY,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  system_kind boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.document_kinds (id, label, system_kind, sort_order) VALUES
  ('visit_form', 'Ficha de visita', true, 10),
  ('sale_contract', 'Contrato de compra e venda', true, 20),
  ('sale_authorization', 'Autorizacao de venda (sem exclusividade)', true, 30),
  ('sale_authorization_exclusive', 'Autorizacao de venda com exclusividade', true, 40),
  ('brokerage_authorization', 'Autorizacao de intermediacao', true, 50),
  ('rental_residential', 'Contrato de locacao residencial', true, 60),
  ('rental_commercial', 'Contrato de locacao comercial', true, 70),
  ('custom', 'Personalizado', true, 80)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, system_kind = true, sort_order = EXCLUDED.sort_order;

ALTER TABLE public.document_templates ALTER COLUMN kind TYPE text USING kind::text;
ALTER TABLE public.documents ALTER COLUMN kind TYPE text USING kind::text;

DROP TRIGGER IF EXISTS document_kinds_updated_at ON public.document_kinds;
CREATE TRIGGER document_kinds_updated_at BEFORE UPDATE ON public.document_kinds FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.document_kinds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "document kinds read auth" ON public.document_kinds;
CREATE POLICY "document kinds read auth" ON public.document_kinds FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "document kinds staff manage" ON public.document_kinds;
CREATE POLICY "document kinds staff manage" ON public.document_kinds FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_kinds TO authenticated;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS cnh text,
  ADD COLUMN IF NOT EXISTS interest_types text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.clients
SET interest_types = CASE interest_type::text
  WHEN 'buy' THEN ARRAY['buy']::text[]
  WHEN 'sell' THEN ARRAY['sell']::text[]
  WHEN 'rent' THEN ARRAY['rent']::text[]
  WHEN 'buy_rent' THEN ARRAY['buy', 'rent']::text[]
  ELSE '{}'::text[]
END
WHERE cardinality(interest_types) = 0;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_interest_types_valid;
ALTER TABLE public.clients ADD CONSTRAINT clients_interest_types_valid CHECK (interest_types <@ ARRAY['buy','sell','rent']::text[]);
CREATE INDEX IF NOT EXISTS clients_interest_types_idx ON public.clients USING gin (interest_types);

ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS cnh text;

ALTER TABLE public.capture_partners
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS cnh text,
  ADD COLUMN IF NOT EXISTS property_owner_name text,
  ADD COLUMN IF NOT EXISTS property_owner_phone text,
  ADD COLUMN IF NOT EXISTS property_owner_email text,
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS property_zip_code text,
  ADD COLUMN IF NOT EXISTS property_street text,
  ADD COLUMN IF NOT EXISTS property_number text,
  ADD COLUMN IF NOT EXISTS property_complement text,
  ADD COLUMN IF NOT EXISTS property_neighborhood text,
  ADD COLUMN IF NOT EXISTS property_city text,
  ADD COLUMN IF NOT EXISTS property_state text,
  ADD COLUMN IF NOT EXISTS property_notes text,
  ADD COLUMN IF NOT EXISTS payment_preference text,
  ADD COLUMN IF NOT EXISTS payment_details text;

CREATE INDEX IF NOT EXISTS clients_zip_code_idx ON public.clients(zip_code);
CREATE INDEX IF NOT EXISTS clients_city_idx ON public.clients(city);
CREATE INDEX IF NOT EXISTS brokers_zip_code_idx ON public.brokers(zip_code);
CREATE INDEX IF NOT EXISTS capture_partners_zip_code_idx ON public.capture_partners(zip_code);
CREATE INDEX IF NOT EXISTS capture_partners_property_zip_code_idx ON public.capture_partners(property_zip_code);

NOTIFY pgrst, 'reload schema';