ALTER TABLE public.rental_payments
  ADD COLUMN IF NOT EXISTS payment_kind text NOT NULL DEFAULT 'rent';

ALTER TABLE public.rental_payments
  DROP CONSTRAINT IF EXISTS rental_payments_payment_kind_check;

ALTER TABLE public.rental_payments
  ADD CONSTRAINT rental_payments_payment_kind_check
  CHECK (payment_kind IN ('rent', 'deposit'));

ALTER TABLE public.rental_payments
  DROP CONSTRAINT IF EXISTS rental_payments_contract_id_reference_month_key;

ALTER TABLE public.rental_payments
  ADD CONSTRAINT rental_payments_contract_id_reference_month_payment_kind_key
  UNIQUE (contract_id, reference_month, payment_kind);

INSERT INTO public.rental_payments (
  contract_id,
  reference_month,
  due_date,
  amount_due,
  amount_paid,
  paid_at,
  status,
  notes,
  payment_kind
)
SELECT
  c.id,
  date_trunc('month', COALESCE(c.deposit_paid_at, c.start_date))::date,
  COALESCE(c.deposit_paid_at, c.start_date)::date,
  c.deposit_amount,
  CASE WHEN c.deposit_paid_at IS NOT NULL THEN c.deposit_amount ELSE NULL END,
  CASE WHEN c.deposit_paid_at IS NOT NULL THEN (c.deposit_paid_at::date + time '12:00')::timestamptz ELSE NULL END,
  CASE WHEN c.deposit_paid_at IS NOT NULL THEN 'paid'::public.rental_payment_status ELSE 'pending'::public.rental_payment_status END,
  'Caução migrada do contrato',
  'deposit'
FROM public.rental_contracts c
WHERE c.deposit_amount IS NOT NULL
  AND c.deposit_amount > 0
ON CONFLICT (contract_id, reference_month, payment_kind) DO NOTHING;
