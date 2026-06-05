-- Re-ensure receipt metadata columns and storage bucket for rental payment receipts.
-- This is idempotent and refreshes PostgREST's schema cache for environments
-- that missed the original receipts migration.

ALTER TABLE public.rental_payments
  ADD COLUMN IF NOT EXISTS receipt_file_path text,
  ADD COLUMN IF NOT EXISTS receipt_file_name text,
  ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamptz;

INSERT INTO storage.buckets (id, name, public)
VALUES ('rental-payment-receipts', 'rental-payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "rental payment receipts staff read" ON storage.objects;
DROP POLICY IF EXISTS "rental payment receipts staff insert" ON storage.objects;
DROP POLICY IF EXISTS "rental payment receipts staff update" ON storage.objects;
DROP POLICY IF EXISTS "rental payment receipts staff delete" ON storage.objects;

CREATE POLICY "rental payment receipts staff read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'rental-payment-receipts' AND public.is_staff(auth.uid()));

CREATE POLICY "rental payment receipts staff insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'rental-payment-receipts' AND public.is_staff(auth.uid()));

CREATE POLICY "rental payment receipts staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'rental-payment-receipts' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'rental-payment-receipts' AND public.is_staff(auth.uid()));

CREATE POLICY "rental payment receipts staff delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'rental-payment-receipts' AND public.is_staff(auth.uid()));

NOTIFY pgrst, 'reload schema';
