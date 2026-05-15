ALTER TABLE public.rental_contracts ADD COLUMN IF NOT EXISTS deposit_paid_at date;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS savings_monthly_rate_pct numeric NOT NULL DEFAULT 0.5;