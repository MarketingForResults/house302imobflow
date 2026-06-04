-- Ensure deployed databases accept rental due days through the 31st.
-- Some environments still have the original 1..28 check constraint.

ALTER TABLE public.rental_contracts
  DROP CONSTRAINT IF EXISTS rental_contracts_due_day_check;

ALTER TABLE public.rental_contracts
  ADD CONSTRAINT rental_contracts_due_day_check
  CHECK (due_day BETWEEN 1 AND 31);

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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato nao encontrado';
  END IF;

  SELECT max(reference_month) INTO last_ref
    FROM public.rental_payments
    WHERE contract_id = _contract_id;

  IF last_ref IS NULL THEN
    next_ref := date_trunc('month', c.start_date)::date;
  ELSE
    next_ref := (last_ref + INTERVAL '1 month')::date;
  END IF;

  FOR i IN 1.._months LOOP
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
