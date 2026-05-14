
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
