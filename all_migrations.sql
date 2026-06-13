
-- Roles enum + table (separado de profiles por seguranÃ§a)
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'broker');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  cpf TEXT,
  phone TEXT,
  birth_date DATE,
  avatar_url TEXT,
  address TEXT,
  creci TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- FunÃ§Ã£o has_role (security definer evita recursÃ£o)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager'))
$$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Auto-create profile on signup; primeiro usuÃ¡rio vira admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'broker');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Brokers (corretores parceiros - registros, nÃ£o necessariamente usuÃ¡rios do sistema)
CREATE TABLE public.brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  phone TEXT,
  creci TEXT,
  birth_date DATE,
  avatar_url TEXT,
  address TEXT,
  commission_pct NUMERIC(5,2),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER brokers_updated BEFORE UPDATE ON public.brokers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Clients
CREATE TYPE public.interest_type AS ENUM ('buy','sell','rent','buy_rent');

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  avatar_url TEXT,
  address TEXT,
  interest_type public.interest_type,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Properties
CREATE TYPE public.property_type AS ENUM ('house','apartment','land','lot','commercial');
CREATE TYPE public.property_status AS ENUM ('available','sold','reserved','negotiation','rented');

CREATE SEQUENCE public.property_code_seq START 1;

CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL DEFAULT ('IMB-' || lpad(nextval('public.property_code_seq')::text, 5, '0')),
  title TEXT,
  description TEXT,
  type public.property_type NOT NULL,
  status public.property_status NOT NULL DEFAULT 'available',
  area_m2 NUMERIC(10,2),
  bedrooms INT,
  bathrooms INT,
  suites INT,
  parking_spaces INT,
  planned_furniture BOOLEAN DEFAULT FALSE,
  furnished BOOLEAN DEFAULT FALSE,
  financed BOOLEAN DEFAULT FALSE,
  accepts_trade BOOLEAN DEFAULT FALSE,
  trade_notes TEXT,
  exclusive BOOLEAN DEFAULT FALSE,
  price NUMERIC(15,2),
  commission_pct NUMERIC(5,2),
  country TEXT DEFAULT 'Brasil',
  state TEXT,
  city TEXT,
  neighborhood TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  broker_id UUID REFERENCES public.brokers(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  video_url TEXT,
  tour_url TEXT,
  wp_post_id BIGINT,
  wp_synced_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX ON public.properties (status);
CREATE INDEX ON public.properties (type);
CREATE INDEX ON public.properties (city);

CREATE TABLE public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.property_images (property_id);

CREATE TABLE public.wp_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  status_code INT,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Storage bucket para imagens de imÃ³veis
INSERT INTO storage.buckets (id, name, public) VALUES ('property-images','property-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wp_sync_logs ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_staff(auth.uid()));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles policies
CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- brokers policies
CREATE POLICY "brokers read auth" ON public.brokers FOR SELECT TO authenticated USING (true);
CREATE POLICY "brokers staff manage" ON public.brokers FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- clients policies
CREATE POLICY "clients read auth" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients staff manage" ON public.clients FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- properties policies
CREATE POLICY "properties read auth" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "properties staff manage" ON public.properties FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- property_images policies
CREATE POLICY "images read auth" ON public.property_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "images staff manage" ON public.property_images FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- wp_sync_logs policies
CREATE POLICY "logs admin read" ON public.wp_sync_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- storage policies para property-images bucket
CREATE POLICY "property images public read" ON storage.objects FOR SELECT USING (bucket_id = 'property-images');
CREATE POLICY "property images staff write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'property-images' AND public.is_staff(auth.uid()));
CREATE POLICY "property images staff update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'property-images' AND public.is_staff(auth.uid()));
CREATE POLICY "property images staff delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'property-images' AND public.is_staff(auth.uid()));

ALTER FUNCTION public.touch_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY "property images public read" ON storage.objects;
CREATE POLICY "property images public file read" ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images' AND (storage.foldername(name))[1] IS NOT NULL);
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon;

-- ============ ENUMS ============
CREATE TYPE public.document_kind AS ENUM (
  'visit_form',
  'sale_contract',
  'sale_authorization',
  'sale_authorization_exclusive',
  'brokerage_authorization',
  'rental_residential',
  'rental_commercial',
  'custom'
);

CREATE TYPE public.document_status AS ENUM ('draft','signed','cancelled');

CREATE TYPE public.rental_kind AS ENUM ('residential','commercial');
CREATE TYPE public.rental_status AS ENUM ('active','ended','cancelled','suspended');
CREATE TYPE public.rental_payment_status AS ENUM ('pending','paid','late','partial','waived');

-- ============ SEQUENCES ============
CREATE SEQUENCE IF NOT EXISTS public.document_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.rental_code_seq START 1;

-- ============ DOCUMENT TEMPLATES ============
CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.document_kind NOT NULL,
  body text NOT NULL DEFAULT '',
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates read auth" ON public.document_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates staff manage" ON public.document_templates
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ DOCUMENTS ============
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT (
    'DOC-' || to_char(now(),'YYYY') || '-' ||
    lpad(nextval('public.document_code_seq')::text, 5, '0')
  ),
  template_id uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
  kind public.document_kind NOT NULL,
  title text,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL,
  partner_id uuid,
  payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_rendered text NOT NULL DEFAULT '',
  status public.document_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents read auth" ON public.documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents staff manage" ON public.documents
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_documents_property ON public.documents(property_id);
CREATE INDEX idx_documents_client ON public.documents(client_id);
CREATE INDEX idx_documents_kind ON public.documents(kind);

-- ============ RENTAL CONTRACTS ============
CREATE TABLE public.rental_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT (
    'LOC-' || to_char(now(),'YYYY') || '-' ||
    lpad(nextval('public.rental_code_seq')::text, 5, '0')
  ),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  tenant_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  landlord_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL,
  kind public.rental_kind NOT NULL DEFAULT 'residential',
  start_date date NOT NULL,
  end_date date,
  monthly_rent numeric(12,2) NOT NULL,
  due_day int NOT NULL DEFAULT 5 CHECK (due_day BETWEEN 1 AND 28),
  deposit_amount numeric(12,2),
  readjustment_index text,
  readjustment_month int CHECK (readjustment_month BETWEEN 1 AND 12),
  status public.rental_status NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rental_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rentals read auth" ON public.rental_contracts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rentals staff manage" ON public.rental_contracts
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER rental_contracts_updated_at
  BEFORE UPDATE ON public.rental_contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RENTAL PAYMENTS ============
CREATE TABLE public.rental_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.rental_contracts(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  due_date date NOT NULL,
  amount_due numeric(12,2) NOT NULL,
  amount_paid numeric(12,2),
  paid_at timestamptz,
  status public.rental_payment_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, reference_month)
);
ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rental_payments read auth" ON public.rental_payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rental_payments staff manage" ON public.rental_payments
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER rental_payments_updated_at
  BEFORE UPDATE ON public.rental_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_rental_payments_contract ON public.rental_payments(contract_id);
CREATE INDEX idx_rental_payments_status ON public.rental_payments(status);
CREATE INDEX idx_rental_payments_due ON public.rental_payments(due_date);

-- ============ FUNCTIONS ============

-- Gera N parcelas mensais a partir do mÃªs corrente (ou da Ãºltima gerada)
CREATE OR REPLACE FUNCTION public.generate_rental_payments(_contract_id uuid, _months int DEFAULT 12)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.rental_contracts%ROWTYPE;
  i int;
  next_ref date;
  last_ref date;
  inserted int := 0;
  due date;
BEGIN
  SELECT * INTO c FROM public.rental_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nÃ£o encontrado'; END IF;

  SELECT max(reference_month) INTO last_ref
    FROM public.rental_payments WHERE contract_id = _contract_id;

  IF last_ref IS NULL THEN
    next_ref := date_trunc('month', c.start_date)::date;
  ELSE
    next_ref := (last_ref + INTERVAL '1 month')::date;
  END IF;

  FOR i IN 1.._months LOOP
    due := (next_ref + ((c.due_day - 1) || ' days')::interval)::date;
    BEGIN
      INSERT INTO public.rental_payments(contract_id, reference_month, due_date, amount_due)
      VALUES (_contract_id, next_ref, due, c.monthly_rent);
      inserted := inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
    next_ref := (next_ref + INTERVAL '1 month')::date;
  END LOOP;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_rental_payments(uuid, int) TO authenticated;

-- Marca como atrasadas as parcelas pendentes vencidas
CREATE OR REPLACE FUNCTION public.mark_late_rental_payments()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated int;
BEGIN
  UPDATE public.rental_payments
  SET status = 'late'
  WHERE status = 'pending' AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_late_rental_payments() TO authenticated;

-- ============ ADMIN TOTAL (poder irrestrito) ============

-- profiles: hoje admin nÃ£o consegue deletar
CREATE POLICY "profiles admin all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- wp_sync_logs: hoje admin nÃ£o consegue inserir/atualizar/deletar
CREATE POLICY "wp_sync_logs admin all" ON public.wp_sync_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON FUNCTION public.generate_rental_payments(uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_late_rental_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_rental_payments(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_late_rental_payments() TO authenticated;
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  rental_late_fee_pct numeric NOT NULL DEFAULT 2.0,
  rental_daily_interest_pct numeric NOT NULL DEFAULT 0.033,
  rental_grace_days integer NOT NULL DEFAULT 0,
  rental_default_due_day integer NOT NULL DEFAULT 5,
  rental_default_readjustment_index text DEFAULT 'IGPM',
  rental_default_readjustment_month integer,
  contract_default_commission_pct numeric DEFAULT 6.0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings read auth" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.app_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_app_settings_touch BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS rental_default_term_months integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS rental_default_contract_type text NOT NULL DEFAULT 'pessoa_fisica';

CREATE TABLE IF NOT EXISTS public.economic_indexes (
  code text NOT NULL,
  name text NOT NULL,
  reference_month date NOT NULL,
  monthly_value numeric NOT NULL,
  accumulated_12m numeric,
  source_url text,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (code, reference_month)
);

ALTER TABLE public.economic_indexes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "indexes read auth" ON public.economic_indexes;
CREATE POLICY "indexes read auth" ON public.economic_indexes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "indexes admin write" ON public.economic_indexes;
CREATE POLICY "indexes admin write" ON public.economic_indexes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
ALTER TABLE public.rental_contracts ADD COLUMN IF NOT EXISTS deposit_paid_at date;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS savings_monthly_rate_pct numeric NOT NULL DEFAULT 0.5;
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS sale_default_commission_pct numeric NOT NULL DEFAULT 6.0,
  ADD COLUMN IF NOT EXISTS sale_itbi_pct numeric NOT NULL DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS sale_default_payment_method text NOT NULL DEFAULT 'a_vista',
  ADD COLUMN IF NOT EXISTS sale_deed_type text NOT NULL DEFAULT 'escritura_publica',
  ADD COLUMN IF NOT EXISTS sale_default_down_payment_pct numeric NOT NULL DEFAULT 20.0;
-- Drop the old constraint
ALTER TABLE public.rental_contracts DROP CONSTRAINT IF EXISTS rental_contracts_due_day_check;

-- Add the new constraint
ALTER TABLE public.rental_contracts ADD CONSTRAINT rental_contracts_due_day_check CHECK (due_day BETWEEN 1 AND 31);

-- Update the generate_rental_payments function to handle months with fewer days than due_day
CREATE OR REPLACE FUNCTION public.generate_rental_payments(_contract_id uuid, _months int DEFAULT 12)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.rental_contracts%ROWTYPE;
  i int;
  next_ref date;
  last_ref date;
  inserted int := 0;
  due date;
BEGIN
  SELECT * INTO c FROM public.rental_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nÃ£o encontrado'; END IF;

  SELECT max(reference_month) INTO last_ref
    FROM public.rental_payments WHERE contract_id = _contract_id;

  IF last_ref IS NULL THEN
    next_ref := date_trunc('month', c.start_date)::date;
  ELSE
    next_ref := (last_ref + INTERVAL '1 month')::date;
  END IF;

  FOR i IN 1.._months LOOP
    -- Calcula o vencimento garantindo que nÃ£o ultrapasse o Ãºltimo dia do mÃªs corrente
    due := make_date(
      EXTRACT(YEAR FROM next_ref)::int,
      EXTRACT(MONTH FROM next_ref)::int,
      LEAST(c.due_day, EXTRACT(DAY FROM (next_ref + INTERVAL '1 month - 1 day'))::int)
    );
    BEGIN
      INSERT INTO public.rental_payments(contract_id, reference_month, due_date, amount_due)
      VALUES (_contract_id, next_ref, due, c.monthly_rent);
      inserted := inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
    next_ref := (next_ref + INTERVAL '1 month')::date;
  END LOOP;

  RETURN inserted;
END;
$$;
