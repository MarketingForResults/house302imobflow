
ALTER TABLE public.sale_contracts
  ADD COLUMN IF NOT EXISTS gross_total_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric(14,4),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2);

ALTER TABLE public.sale_payments
  ADD COLUMN IF NOT EXISTS gross_amount_due numeric(14,2),
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric(14,4),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2);
