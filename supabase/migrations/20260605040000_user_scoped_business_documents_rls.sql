-- Allow authenticated users to attach business documents under their own
-- storage prefix. Operational users keep broad access to existing documents.

INSERT INTO storage.buckets (id, name, public)
VALUES ('business-documents', 'business-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE TABLE IF NOT EXISTS public.entity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN (
    'client', 'broker', 'capture_partner', 'property', 'rental_contract', 'sale_contract'
  )),
  entity_id uuid NOT NULL,
  document_kind text NOT NULL DEFAULT 'other',
  label text,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_documents_entity_idx
  ON public.entity_documents (entity_type, entity_id, created_at DESC);

ALTER TABLE public.entity_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entity documents user scoped read" ON public.entity_documents;
CREATE POLICY "entity documents user scoped read"
  ON public.entity_documents FOR SELECT TO authenticated
  USING (public.is_operational_user(auth.uid()) OR created_by = auth.uid());

DROP POLICY IF EXISTS "entity documents user scoped insert" ON public.entity_documents;
CREATE POLICY "entity documents user scoped insert"
  ON public.entity_documents FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "entity documents user scoped update" ON public.entity_documents;
CREATE POLICY "entity documents user scoped update"
  ON public.entity_documents FOR UPDATE TO authenticated
  USING (public.is_operational_user(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_operational_user(auth.uid()) OR created_by = auth.uid());

DROP POLICY IF EXISTS "entity documents user scoped delete" ON public.entity_documents;
CREATE POLICY "entity documents user scoped delete"
  ON public.entity_documents FOR DELETE TO authenticated
  USING (public.is_operational_user(auth.uid()) OR created_by = auth.uid());

DROP POLICY IF EXISTS "business documents user scoped read" ON storage.objects;
CREATE POLICY "business documents user scoped read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'business-documents'
    AND (
      public.is_operational_user(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "business documents user scoped insert" ON storage.objects;
CREATE POLICY "business documents user scoped insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "business documents user scoped update" ON storage.objects;
CREATE POLICY "business documents user scoped update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business-documents'
    AND (
      public.is_operational_user(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  )
  WITH CHECK (
    bucket_id = 'business-documents'
    AND (
      public.is_operational_user(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "business documents user scoped delete" ON storage.objects;
CREATE POLICY "business documents user scoped delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-documents'
    AND (
      public.is_operational_user(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_documents TO authenticated;

NOTIFY pgrst, 'reload schema';
