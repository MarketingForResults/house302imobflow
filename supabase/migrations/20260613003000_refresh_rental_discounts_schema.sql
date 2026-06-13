-- Refresh rental discounts schema for environments that missed the 20260612120000 migration.

ALTER TABLE public.rental_contracts
  ADD COLUMN IF NOT EXISTS gross_monthly_rent numeric,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric;

UPDATE public.rental_contracts
SET
  gross_monthly_rent = COALESCE(gross_monthly_rent, monthly_rent),
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
  ADD CONSTRAINT rental_contracts_discount_type_check
    CHECK (discount_type IN ('none', 'percent', 'amount'));

ALTER TABLE public.rental_payments
  ADD COLUMN IF NOT EXISTS gross_amount_due numeric,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric;

UPDATE public.rental_payments
SET
  gross_amount_due = COALESCE(gross_amount_due, amount_due),
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
  ADD CONSTRAINT rental_payments_discount_type_check
    CHECK (discount_type IN ('none', 'percent', 'amount'));

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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato nao encontrado';
  END IF;

  SELECT max(reference_month)
    INTO last_ref
    FROM public.rental_payments
   WHERE contract_id = _contract_id
     AND payment_kind = 'rent';

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
      INSERT INTO public.rental_payments(
        contract_id,
        reference_month,
        due_date,
        amount_due,
        gross_amount_due,
        discount_type,
        discount_value,
        discount_amount,
        payment_kind
      )
      VALUES (
        _contract_id,
        next_ref,
        due,
        c.monthly_rent,
        COALESCE(c.gross_monthly_rent, c.monthly_rent),
        COALESCE(c.discount_type, 'none'),
        COALESCE(c.discount_value, 0),
        COALESCE(c.discount_amount, 0),
        'rent'
      );
      inserted := inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;

    next_ref := (next_ref + interval '1 month')::date;
  END LOOP;

  RETURN inserted;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_contracts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_payments TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rental_payments(uuid, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
