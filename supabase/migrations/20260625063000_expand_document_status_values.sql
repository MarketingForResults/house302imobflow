ALTER TYPE public.document_status ADD VALUE IF NOT EXISTS 'issued';
ALTER TYPE public.document_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE public.document_status ADD VALUE IF NOT EXISTS 'created';
ALTER TYPE public.document_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.document_status ADD VALUE IF NOT EXISTS 'viewed';
ALTER TYPE public.document_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.document_status ADD VALUE IF NOT EXISTS 'pending_approval';

NOTIFY pgrst, 'reload schema';
