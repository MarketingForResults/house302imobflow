ALTER TABLE public.rental_payments
  ADD COLUMN IF NOT EXISTS deposit_refund_due_date date,
  ADD COLUMN IF NOT EXISTS deposit_refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_refund_amount numeric,
  ADD COLUMN IF NOT EXISTS deposit_refund_notes text,
  ADD COLUMN IF NOT EXISTS deposit_refund_receipt_file_path text,
  ADD COLUMN IF NOT EXISTS deposit_refund_receipt_file_name text,
  ADD COLUMN IF NOT EXISTS deposit_refund_uploaded_at timestamptz;

NOTIFY pgrst, 'reload schema';
