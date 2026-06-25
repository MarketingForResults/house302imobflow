ALTER TYPE public.document_status ADD VALUE IF NOT EXISTS 'issued' AFTER 'draft';

NOTIFY pgrst, 'reload schema';
