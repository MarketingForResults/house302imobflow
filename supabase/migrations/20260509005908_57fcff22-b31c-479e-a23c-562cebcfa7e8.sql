
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

-- Gera N parcelas mensais a partir do mês corrente (ou da última gerada)
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
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;

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

-- profiles: hoje admin não consegue deletar
CREATE POLICY "profiles admin all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- wp_sync_logs: hoje admin não consegue inserir/atualizar/deletar
CREATE POLICY "wp_sync_logs admin all" ON public.wp_sync_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
