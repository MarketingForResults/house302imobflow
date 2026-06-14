-- === property_inspections refresh ===
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
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.property_inspections'::regclass AND conname = 'property_inspections_status_check') THEN
    ALTER TABLE public.property_inspections ADD CONSTRAINT property_inspections_status_check CHECK (status IN ('pending','scheduled','completed','approved','rejected')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.property_inspections'::regclass AND conname = 'property_inspections_assigned_broker_id_fkey') THEN
    ALTER TABLE public.property_inspections ADD CONSTRAINT property_inspections_assigned_broker_id_fkey FOREIGN KEY (assigned_broker_id) REFERENCES public.brokers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.property_inspections'::regclass AND conname = 'property_inspections_reviewed_by_fkey') THEN
    ALTER TABLE public.property_inspections ADD CONSTRAINT property_inspections_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_inspections TO authenticated;

-- === documents refresh ===
ALTER TABLE public.documents
  ALTER COLUMN kind TYPE text USING kind::text,
  ADD COLUMN IF NOT EXISTS rental_contract_id uuid REFERENCES public.rental_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_contract_id uuid,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guarantor_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS witness1_name text,
  ADD COLUMN IF NOT EXISTS witness1_cpf text,
  ADD COLUMN IF NOT EXISTS witness2_name text,
  ADD COLUMN IF NOT EXISTS witness2_cpf text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_file_url text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DO $$
BEGIN
  IF to_regclass('public.sale_contracts') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.documents'::regclass AND conname = 'documents_sale_contract_id_fkey') THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_sale_contract_id_fkey FOREIGN KEY (sale_contract_id) REFERENCES public.sale_contracts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_rental_contract ON public.documents(rental_contract_id);
CREATE INDEX IF NOT EXISTS idx_documents_sale_contract ON public.documents(sale_contract_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;

-- === rental discounts refresh ===
ALTER TABLE public.rental_contracts
  ADD COLUMN IF NOT EXISTS gross_monthly_rent numeric,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric;

UPDATE public.rental_contracts
SET gross_monthly_rent = COALESCE(gross_monthly_rent, monthly_rent),
    discount_type = COALESCE(discount_type, 'none'),
    discount_value = COALESCE(discount_value, 0),
    discount_amount = COALESCE(discount_amount, 0);

ALTER TABLE public.rental_contracts
  ALTER COLUMN discount_type SET DEFAULT 'none',
  ALTER COLUMN discount_value SET DEFAULT 0,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN discount_type SET NOT NULL,
  ALTER COLUMN discount_value SET NOT NULL,
  ALTER COLUMN discount_amount SET NOT NULL;

ALTER TABLE public.rental_contracts
  DROP CONSTRAINT IF EXISTS rental_contracts_discount_type_check,
  ADD CONSTRAINT rental_contracts_discount_type_check CHECK (discount_type IN ('none','percent','amount'));

ALTER TABLE public.rental_payments
  ADD COLUMN IF NOT EXISTS gross_amount_due numeric,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric;

UPDATE public.rental_payments
SET gross_amount_due = COALESCE(gross_amount_due, amount_due),
    discount_type = COALESCE(discount_type, 'none'),
    discount_value = COALESCE(discount_value, 0),
    discount_amount = COALESCE(discount_amount, 0);

ALTER TABLE public.rental_payments
  ALTER COLUMN discount_type SET DEFAULT 'none',
  ALTER COLUMN discount_value SET DEFAULT 0,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN discount_type SET NOT NULL,
  ALTER COLUMN discount_value SET NOT NULL,
  ALTER COLUMN discount_amount SET NOT NULL;

ALTER TABLE public.rental_payments
  DROP CONSTRAINT IF EXISTS rental_payments_discount_type_check,
  ADD CONSTRAINT rental_payments_discount_type_check CHECK (discount_type IN ('none','percent','amount'));

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
  last_day_of_month int;
  effective_day int;
BEGIN
  SELECT * INTO c FROM public.rental_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nao encontrado'; END IF;

  SELECT max(reference_month) INTO last_ref
    FROM public.rental_payments
   WHERE contract_id = _contract_id AND payment_kind = 'rent';

  IF last_ref IS NULL THEN
    next_ref := date_trunc('month', c.start_date)::date;
  ELSE
    next_ref := (last_ref + interval '1 month')::date;
  END IF;

  FOR i IN 1.._months LOOP
    last_day_of_month := extract(day from (next_ref + interval '1 month - 1 day'))::int;
    effective_day := least(coalesce(c.due_day, 5), last_day_of_month);
    due := make_date(extract(year from next_ref)::int, extract(month from next_ref)::int, effective_day);
    BEGIN
      INSERT INTO public.rental_payments(contract_id, reference_month, due_date, amount_due, gross_amount_due, discount_type, discount_value, discount_amount, payment_kind)
      VALUES (_contract_id, next_ref, due, c.monthly_rent, COALESCE(c.gross_monthly_rent, c.monthly_rent), COALESCE(c.discount_type,'none'), COALESCE(c.discount_value,0), COALESCE(c.discount_amount,0), 'rent');
      inserted := inserted + 1;
    EXCEPTION WHEN unique_violation THEN NULL; END;
    next_ref := (next_ref + interval '1 month')::date;
  END LOOP;
  RETURN inserted;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_contracts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_payments TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rental_payments(uuid, int) TO authenticated;

NOTIFY pgrst, 'reload schema';