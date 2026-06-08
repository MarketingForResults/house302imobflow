-- App settings: institutional/address fields
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS company_person_type text,
  ADD COLUMN IF NOT EXISTS company_zip_code text,
  ADD COLUMN IF NOT EXISTS company_street text,
  ADD COLUMN IF NOT EXISTS company_number text,
  ADD COLUMN IF NOT EXISTS company_complement text,
  ADD COLUMN IF NOT EXISTS company_neighborhood text,
  ADD COLUMN IF NOT EXISTS company_city text,
  ADD COLUMN IF NOT EXISTS company_state text;

UPDATE public.app_settings SET company_person_type = 'juridica' WHERE company_person_type IS NULL;

ALTER TABLE public.app_settings
  ALTER COLUMN company_person_type SET DEFAULT 'juridica',
  ALTER COLUMN company_person_type SET NOT NULL;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_company_person_type_check,
  ADD CONSTRAINT app_settings_company_person_type_check
    CHECK (company_person_type IN ('juridica', 'fisica'));

-- Rental payments: payment kind + receipt + deposit refund + late fee tracking
ALTER TABLE public.rental_payments
  ADD COLUMN IF NOT EXISTS payment_kind text NOT NULL DEFAULT 'rent',
  ADD COLUMN IF NOT EXISTS late_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_file_path text,
  ADD COLUMN IF NOT EXISTS receipt_file_name text,
  ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_refund_due_date date,
  ADD COLUMN IF NOT EXISTS deposit_refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_refund_amount numeric,
  ADD COLUMN IF NOT EXISTS deposit_refund_notes text,
  ADD COLUMN IF NOT EXISTS deposit_refund_receipt_file_path text,
  ADD COLUMN IF NOT EXISTS deposit_refund_receipt_file_name text,
  ADD COLUMN IF NOT EXISTS deposit_refund_uploaded_at timestamptz;

ALTER TABLE public.rental_payments
  DROP CONSTRAINT IF EXISTS rental_payments_payment_kind_check,
  ADD CONSTRAINT rental_payments_payment_kind_check
    CHECK (payment_kind IN ('rent', 'deposit'));

-- Drop old per-month unique (if any) and add (contract, ref month, kind)
ALTER TABLE public.rental_payments
  DROP CONSTRAINT IF EXISTS rental_payments_contract_id_reference_month_key;
ALTER TABLE public.rental_payments
  DROP CONSTRAINT IF EXISTS rental_payments_contract_id_reference_month_payment_kind_key;
ALTER TABLE public.rental_payments
  ADD CONSTRAINT rental_payments_contract_id_reference_month_payment_kind_key
    UNIQUE (contract_id, reference_month, payment_kind);

-- generate_rental_payments: handle months with fewer days than due_day
CREATE OR REPLACE FUNCTION public.generate_rental_payments(_contract_id uuid, _months integer DEFAULT 12)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  c public.rental_contracts%ROWTYPE;
  i int;
  next_ref date;
  last_ref date;
  inserted int := 0;
  due date;
  effective_day int;
  last_day_of_month int;
BEGIN
  SELECT * INTO c FROM public.rental_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nao encontrado'; END IF;

  SELECT max(reference_month) INTO last_ref
    FROM public.rental_payments
   WHERE contract_id = _contract_id AND payment_kind = 'rent';

  IF last_ref IS NULL THEN
    next_ref := date_trunc('month', c.start_date)::date;
  ELSE
    next_ref := (last_ref + INTERVAL '1 month')::date;
  END IF;

  FOR i IN 1.._months LOOP
    last_day_of_month := EXTRACT(DAY FROM (date_trunc('month', next_ref) + INTERVAL '1 month - 1 day'))::int;
    effective_day := LEAST(COALESCE(c.due_day, 5), last_day_of_month);
    due := (date_trunc('month', next_ref) + ((effective_day - 1) || ' days')::interval)::date;
    BEGIN
      INSERT INTO public.rental_payments(contract_id, reference_month, due_date, amount_due, payment_kind)
      VALUES (_contract_id, next_ref, due, c.monthly_rent, 'rent');
      inserted := inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
    next_ref := (next_ref + INTERVAL '1 month')::date;
  END LOOP;

  RETURN inserted;
END;
$function$;

NOTIFY pgrst, 'reload schema';