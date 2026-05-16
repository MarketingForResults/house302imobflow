ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS sale_default_commission_pct numeric NOT NULL DEFAULT 6.0,
  ADD COLUMN IF NOT EXISTS sale_itbi_pct numeric NOT NULL DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS sale_default_payment_method text NOT NULL DEFAULT 'a_vista',
  ADD COLUMN IF NOT EXISTS sale_deed_type text NOT NULL DEFAULT 'escritura_publica',
  ADD COLUMN IF NOT EXISTS sale_default_down_payment_pct numeric NOT NULL DEFAULT 20.0;