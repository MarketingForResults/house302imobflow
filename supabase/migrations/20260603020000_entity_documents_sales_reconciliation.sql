-- Reconcile client marketing interests, private entity documents, and sales workflow.
-- This migration is intentionally idempotent because version 20260603000000
-- was used by parallel work during the same project recovery.

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

DROP POLICY IF EXISTS "document kinds read auth" ON public.document_kinds;
CREATE POLICY "document kinds read auth" ON public.document_kinds
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "document kinds staff manage" ON public.document_kinds;
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
ALTER TABLE public.clients
  ADD CONSTRAINT clients_interest_types_valid
  CHECK (interest_types <@ ARRAY['buy', 'sell', 'rent']::text[]);

CREATE INDEX IF NOT EXISTS clients_interest_types_idx
  ON public.clients USING gin (interest_types);

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

INSERT INTO storage.buckets (id, name, public)
VALUES ('business-documents', 'business-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE TABLE IF NOT EXISTS public.entity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN (
    'client', 'broker', 'capture_partner', 'property', 'rental_contract', 'sale_contract'
  )),
  entity_id uuid NOT NULL,
  document_kind text NOT NULL DEFAULT 'other',
  label text,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_documents_entity_idx
  ON public.entity_documents (entity_type, entity_id, created_at DESC);

ALTER TABLE public.entity_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entity documents operational read" ON public.entity_documents;
CREATE POLICY "entity documents operational read"
  ON public.entity_documents FOR SELECT TO authenticated
  USING (public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "entity documents operational manage" ON public.entity_documents;
CREATE POLICY "entity documents operational manage"
  ON public.entity_documents FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()))
  WITH CHECK (public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "business documents operational read" ON storage.objects;
CREATE POLICY "business documents operational read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'business-documents' AND public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "business documents operational write" ON storage.objects;
CREATE POLICY "business documents operational write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-documents' AND public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "business documents operational update" ON storage.objects;
CREATE POLICY "business documents operational update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'business-documents' AND public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "business documents operational delete" ON storage.objects;
CREATE POLICY "business documents operational delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'business-documents' AND public.is_operational_user(auth.uid()));

CREATE SEQUENCE IF NOT EXISTS public.sale_contract_code_seq;

CREATE TABLE IF NOT EXISTS public.sale_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT (
    'VEN-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('public.sale_contract_code_seq')::text, 5, '0')
  ),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  buyer_client_id uuid NOT NULL REFERENCES public.clients(id),
  seller_client_id uuid REFERENCES public.clients(id),
  broker_id uuid REFERENCES public.brokers(id),
  contract_date date NOT NULL DEFAULT current_date,
  expected_closing_date date,
  total_amount numeric(14,2) NOT NULL CHECK (total_amount > 0),
  down_payment_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (down_payment_amount >= 0),
  commission_pct numeric(7,4) CHECK (commission_pct IS NULL OR commission_pct >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.sale_contracts(id) ON DELETE CASCADE,
  description text NOT NULL,
  due_date date NOT NULL,
  amount_due numeric(14,2) NOT NULL CHECK (amount_due > 0),
  amount_paid numeric(14,2),
  paid_at date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sale_contracts_property_idx ON public.sale_contracts (property_id);
CREATE INDEX IF NOT EXISTS sale_contracts_buyer_idx ON public.sale_contracts (buyer_client_id);
CREATE INDEX IF NOT EXISTS sale_payments_contract_idx ON public.sale_payments (contract_id, due_date);

DROP TRIGGER IF EXISTS sale_contracts_updated ON public.sale_contracts;
CREATE TRIGGER sale_contracts_updated
  BEFORE UPDATE ON public.sale_contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS sale_payments_updated ON public.sale_payments;
CREATE TRIGGER sale_payments_updated
  BEFORE UPDATE ON public.sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.sale_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales operational read" ON public.sale_contracts;
CREATE POLICY "sales operational read"
  ON public.sale_contracts FOR SELECT TO authenticated
  USING (public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "sales operational manage" ON public.sale_contracts;
CREATE POLICY "sales operational manage"
  ON public.sale_contracts FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()))
  WITH CHECK (public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "sale payments operational read" ON public.sale_payments;
CREATE POLICY "sale payments operational read"
  ON public.sale_payments FOR SELECT TO authenticated
  USING (public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "sale payments operational manage" ON public.sale_payments;
CREATE POLICY "sale payments operational manage"
  ON public.sale_payments FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()))
  WITH CHECK (public.is_operational_user(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_contracts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_payments TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.sale_contract_code_seq TO authenticated;
