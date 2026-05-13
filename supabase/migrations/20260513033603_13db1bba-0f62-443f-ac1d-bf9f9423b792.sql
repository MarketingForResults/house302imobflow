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