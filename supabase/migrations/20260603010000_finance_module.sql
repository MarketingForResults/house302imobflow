DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financial';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.is_finance_user(_user_id uuid)
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
      AND role::text IN ('admin', 'manager', 'financial')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_finance_user(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'expense' CHECK (kind IN ('income', 'expense', 'transfer', 'commission', 'tax', 'other')),
  description text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.financial_cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  responsible text,
  budget_monthly numeric(14,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.financial_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  agency text,
  account_number text,
  account_type text,
  holder_name text,
  holder_document text,
  initial_balance numeric(14,2) NOT NULL DEFAULT 0,
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  integration_provider text,
  integration_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL CHECK (module_key IN (
    'accounts_receivable',
    'accounts_payable',
    'cash_flow',
    'commissions',
    'owner_transfers',
    'rent_receipts',
    'collections',
    'bank_reconciliation',
    'reports'
  )),
  direction text NOT NULL DEFAULT 'neutral' CHECK (direction IN ('income', 'expense', 'transfer', 'neutral')),
  title text NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  due_date date,
  payment_date date,
  competence_month date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'scheduled', 'pending', 'paid', 'overdue', 'cancelled', 'reconciled')),
  payment_method text,
  document_number text,
  person_name text,
  person_document text,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.financial_cost_centers(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.financial_bank_accounts(id) ON DELETE SET NULL,
  rental_contract_id uuid REFERENCES public.rental_contracts(id) ON DELETE SET NULL,
  rental_payment_id uuid REFERENCES public.rental_payments(id) ON DELETE SET NULL,
  owner_name text,
  owner_document text,
  commission_rate numeric(8,4),
  recurrence_rule text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  integration_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.financial_bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES public.financial_bank_accounts(id) ON DELETE SET NULL,
  record_id uuid REFERENCES public.financial_records(id) ON DELETE SET NULL,
  statement_date date NOT NULL,
  statement_description text NOT NULL,
  statement_amount numeric(14,2) NOT NULL DEFAULT 0,
  match_status text NOT NULL DEFAULT 'pending' CHECK (match_status IN ('pending', 'matched', 'ignored', 'divergent')),
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.financial_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  file_name text,
  file_type text,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'default',
  pix_enabled boolean NOT NULL DEFAULT false,
  open_finance_enabled boolean NOT NULL DEFAULT false,
  boleto_enabled boolean NOT NULL DEFAULT false,
  gateway_enabled boolean NOT NULL DEFAULT false,
  gateway_provider text,
  default_late_fee_percent numeric(8,4) NOT NULL DEFAULT 2,
  default_daily_interest_percent numeric(8,4) NOT NULL DEFAULT 0.033,
  owner_transfer_day integer NOT NULL DEFAULT 10 CHECK (owner_transfer_day BETWEEN 1 AND 31),
  commission_payment_day integer NOT NULL DEFAULT 10 CHECK (commission_payment_day BETWEEN 1 AND 31),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (name)
);

INSERT INTO public.financial_settings (name)
VALUES ('default')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS financial_records_module_status_idx ON public.financial_records(module_key, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS financial_records_due_date_idx ON public.financial_records(due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS financial_records_payment_date_idx ON public.financial_records(payment_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS financial_records_category_idx ON public.financial_records(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS financial_records_cost_center_idx ON public.financial_records(cost_center_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS financial_categories_kind_idx ON public.financial_categories(kind) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS financial_audit_logs_table_record_idx ON public.financial_audit_logs(table_name, record_id);

CREATE OR REPLACE FUNCTION public.set_financial_user_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      NEW.deleted_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_financial_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
  old_payload jsonb;
  new_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target_id := NEW.id;
    old_payload := NULL;
    new_payload := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    target_id := NEW.id;
    old_payload := to_jsonb(OLD);
    new_payload := to_jsonb(NEW);
  ELSE
    target_id := OLD.id;
    old_payload := to_jsonb(OLD);
    new_payload := NULL;
  END IF;

  INSERT INTO public.financial_audit_logs(table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (TG_TABLE_NAME, target_id, TG_OP, old_payload, new_payload, auth.uid());
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'financial_categories',
    'financial_cost_centers',
    'financial_bank_accounts',
    'financial_records',
    'financial_bank_reconciliations',
    'financial_settings'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%1$s_user_columns ON public.%1$s', table_name);
    EXECUTE format('CREATE TRIGGER set_%1$s_user_columns BEFORE INSERT OR UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.set_financial_user_columns()', table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$s', table_name);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.audit_financial_table()', table_name);
  END LOOP;
END $$;

ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial audit read finance"
  ON public.financial_audit_logs FOR SELECT TO authenticated
  USING (public.is_finance_user(auth.uid()));

CREATE POLICY "financial categories read auth"
  ON public.financial_categories FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "financial cost centers read auth"
  ON public.financial_cost_centers FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "financial bank accounts read finance"
  ON public.financial_bank_accounts FOR SELECT TO authenticated
  USING (public.is_finance_user(auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "financial records read auth"
  ON public.financial_records FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "financial reconciliations read finance"
  ON public.financial_bank_reconciliations FOR SELECT TO authenticated
  USING (public.is_finance_user(auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "financial imports read finance"
  ON public.financial_import_batches FOR SELECT TO authenticated
  USING (public.is_finance_user(auth.uid()));

CREATE POLICY "financial settings read finance"
  ON public.financial_settings FOR SELECT TO authenticated
  USING (public.is_finance_user(auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "financial categories manage finance"
  ON public.financial_categories FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));

CREATE POLICY "financial cost centers manage finance"
  ON public.financial_cost_centers FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));

CREATE POLICY "financial bank accounts manage finance"
  ON public.financial_bank_accounts FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));

CREATE POLICY "financial records manage finance"
  ON public.financial_records FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));

CREATE POLICY "financial reconciliations manage finance"
  ON public.financial_bank_reconciliations FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));

CREATE POLICY "financial imports manage finance"
  ON public.financial_import_batches FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));

CREATE POLICY "financial settings manage finance"
  ON public.financial_settings FOR ALL TO authenticated
  USING (public.is_finance_user(auth.uid()))
  WITH CHECK (public.is_finance_user(auth.uid()));

GRANT SELECT ON public.financial_categories TO authenticated;
GRANT SELECT ON public.financial_cost_centers TO authenticated;
GRANT SELECT ON public.financial_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_cost_centers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_bank_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_bank_reconciliations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_settings TO authenticated;
GRANT SELECT ON public.financial_audit_logs TO authenticated;
