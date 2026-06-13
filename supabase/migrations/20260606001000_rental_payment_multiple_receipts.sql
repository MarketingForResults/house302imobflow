ALTER TABLE public.rental_payments
  ADD COLUMN IF NOT EXISTS receipt_attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.rental_payments
SET receipt_attachments = jsonb_build_array(
  jsonb_build_object(
    'file_path', receipt_file_path,
    'file_name', coalesce(receipt_file_name, 'Comprovante'),
    'uploaded_at', receipt_uploaded_at
  )
)
WHERE receipt_file_path IS NOT NULL
  AND receipt_attachments = '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
