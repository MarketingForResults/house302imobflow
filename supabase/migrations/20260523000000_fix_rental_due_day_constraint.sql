ALTER TABLE public.rental_contracts DROP CONSTRAINT IF EXISTS rental_contracts_due_day_check;
ALTER TABLE public.rental_contracts ADD CONSTRAINT rental_contracts_due_day_check CHECK (due_day BETWEEN 1 AND 31);
