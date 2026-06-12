
-- 1) Documents: novas FKs para múltiplas partes
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- 2) sale_contracts
CREATE TABLE IF NOT EXISTS public.sale_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  buyer_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  seller_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL,
  guarantor_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,

  total_amount numeric(14,2) NOT NULL,
  down_payment_amount numeric(14,2) DEFAULT 0,
  down_payment_pct numeric(6,3),
  down_payment_mode text DEFAULT 'amount' CHECK (down_payment_mode IN ('amount','percent')),
  down_payment_method text,
  down_payment_paid_at date,

  payment_mode text NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash','owner_financing','bank_financing')),
  installments_count int,
  first_installment_date date,
  installment_amount numeric(14,2),
  readjustment_index text,
  readjustment_period_months int DEFAULT 12,
  late_fee_pct numeric(6,3) DEFAULT 2,
  daily_interest_pct numeric(6,4) DEFAULT 0.033,
  monthly_interest_pct numeric(6,3) DEFAULT 1,

  bank_name text,
  bank_financing_amount numeric(14,2),
  bank_financing_term_months int,
  bank_amortization_system text CHECK (bank_amortization_system IN ('SAC','PRICE') OR bank_amortization_system IS NULL),
  bank_approval_status text DEFAULT 'pending' CHECK (bank_approval_status IN ('pending','submitted','approved','rejected','disbursed')),
  bank_notes text,

  contract_date date NOT NULL,
  expected_closing_date date,
  closed_at date,
  commission_pct numeric(6,3),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- code generator
CREATE SEQUENCE IF NOT EXISTS public.sale_contracts_code_seq;
CREATE OR REPLACE FUNCTION public.set_sale_contract_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'VEN-' || lpad(nextval('public.sale_contracts_code_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sale_contract_code ON public.sale_contracts;
CREATE TRIGGER trg_sale_contract_code BEFORE INSERT ON public.sale_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_sale_contract_code();

DROP TRIGGER IF EXISTS trg_sale_contracts_updated_at ON public.sale_contracts;
CREATE TRIGGER trg_sale_contracts_updated_at BEFORE UPDATE ON public.sale_contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_contracts TO authenticated;
GRANT ALL ON public.sale_contracts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sale_contracts_code_seq TO authenticated, service_role;

ALTER TABLE public.sale_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operational read sale_contracts" ON public.sale_contracts
  FOR SELECT TO authenticated USING (public.is_operational_user(auth.uid()));
CREATE POLICY "operational write sale_contracts" ON public.sale_contracts
  FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()))
  WITH CHECK (public.is_operational_user(auth.uid()));

-- 3) sale_payments
CREATE TABLE IF NOT EXISTS public.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.sale_contracts(id) ON DELETE CASCADE,
  installment_number int,
  description text NOT NULL DEFAULT 'Parcela',
  due_date date NOT NULL,
  amount_due numeric(14,2) NOT NULL,
  amount_paid numeric(14,2),
  paid_at date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','late','cancelled')),
  payment_method text,
  late_fee numeric(14,2) DEFAULT 0,
  interest numeric(14,2) DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, installment_number)
);
DROP TRIGGER IF EXISTS trg_sale_payments_updated_at ON public.sale_payments;
CREATE TRIGGER trg_sale_payments_updated_at BEFORE UPDATE ON public.sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_payments TO authenticated;
GRANT ALL ON public.sale_payments TO service_role;

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operational read sale_payments" ON public.sale_payments
  FOR SELECT TO authenticated USING (public.is_operational_user(auth.uid()));
CREATE POLICY "finance write sale_payments" ON public.sale_payments
  FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()) OR public.is_operational_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()) OR public.is_operational_user(auth.uid()));

-- 4) FK do sale_contract_id em documents (depende da tabela)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS sale_contract_id uuid REFERENCES public.sale_contracts(id) ON DELETE SET NULL;

-- 5) Gerador de parcelas
CREATE OR REPLACE FUNCTION public.generate_sale_installments(_contract_id uuid, _months int DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.sale_contracts%ROWTYPE;
  i int;
  total int;
  next_due date;
  inserted int := 0;
  per_amount numeric(14,2);
BEGIN
  SELECT * INTO c FROM public.sale_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato de venda nao encontrado'; END IF;
  total := COALESCE(_months, c.installments_count, 0);
  IF total <= 0 THEN RETURN 0; END IF;
  per_amount := COALESCE(c.installment_amount,
                ROUND((c.total_amount - COALESCE(c.down_payment_amount,0)) / total, 2));
  next_due := COALESCE(c.first_installment_date, (c.contract_date + INTERVAL '1 month')::date);

  FOR i IN 1..total LOOP
    BEGIN
      INSERT INTO public.sale_payments(contract_id, installment_number, description, due_date, amount_due)
      VALUES (_contract_id, i, 'Parcela ' || i || '/' || total, next_due, per_amount);
      inserted := inserted + 1;
    EXCEPTION WHEN unique_violation THEN NULL; END;
    next_due := (next_due + INTERVAL '1 month')::date;
  END LOOP;
  RETURN inserted;
END $$;
GRANT EXECUTE ON FUNCTION public.generate_sale_installments(uuid, int) TO authenticated, service_role;
