-- Editable document modalities and structured client addresses.

CREATE TABLE IF NOT EXISTS public.document_kinds (
  id text PRIMARY KEY,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  system_kind boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.document_kinds (id, label, system_kind, sort_order)
VALUES
  ('visit_form', 'Ficha de visita', true, 10),
  ('sale_contract', 'Contrato de compra e venda', true, 20),
  ('sale_authorization', 'Autorizacao de venda (sem exclusividade)', true, 30),
  ('sale_authorization_exclusive', 'Autorizacao de venda com exclusividade', true, 40),
  ('brokerage_authorization', 'Autorizacao de intermediacao', true, 50),
  ('rental_residential', 'Contrato de locacao residencial', true, 60),
  ('rental_commercial', 'Contrato de locacao comercial', true, 70),
  ('custom', 'Personalizado', true, 80)
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label,
    system_kind = true,
    sort_order = EXCLUDED.sort_order;

ALTER TABLE public.document_templates
  ALTER COLUMN kind TYPE text USING kind::text;

ALTER TABLE public.documents
  ALTER COLUMN kind TYPE text USING kind::text;

DROP TRIGGER IF EXISTS document_kinds_updated_at ON public.document_kinds;
CREATE TRIGGER document_kinds_updated_at
  BEFORE UPDATE ON public.document_kinds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.document_kinds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document kinds read auth" ON public.document_kinds
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "document kinds staff manage" ON public.document_kinds
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS cnh text;

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
