-- Fix entity_documents RLS: the latest migration (20260610014952) recreated the table
-- without DEFAULT auth.uid() on created_by, breaking the user-scoped INSERT policy.
-- This migration consolidates all policies, ensuring operational staff can always insert.

-- Drop all conflicting policies from previous migrations
DROP POLICY IF EXISTS "entity documents user scoped read"   ON public.entity_documents;
DROP POLICY IF EXISTS "entity documents user scoped insert" ON public.entity_documents;
DROP POLICY IF EXISTS "entity documents user scoped update" ON public.entity_documents;
DROP POLICY IF EXISTS "entity documents user scoped delete" ON public.entity_documents;
DROP POLICY IF EXISTS "Staff can manage entity documents"   ON public.entity_documents;

-- Re-enable RLS (idempotent)
ALTER TABLE public.entity_documents ENABLE ROW LEVEL SECURITY;

-- SELECT: operational staff OR own documents
CREATE POLICY "entity_docs_select" ON public.entity_documents
  FOR SELECT TO authenticated
  USING (
    public.is_operational_user(auth.uid())
    OR created_by = auth.uid()
  );

-- INSERT: operational staff always allowed; non-staff only their own docs
CREATE POLICY "entity_docs_insert" ON public.entity_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_operational_user(auth.uid())
    OR created_by = auth.uid()
    OR created_by IS NULL
  );

-- UPDATE: operational staff OR own documents
CREATE POLICY "entity_docs_update" ON public.entity_documents
  FOR UPDATE TO authenticated
  USING (
    public.is_operational_user(auth.uid())
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_operational_user(auth.uid())
    OR created_by = auth.uid()
  );

-- DELETE: operational staff OR own documents
CREATE POLICY "entity_docs_delete" ON public.entity_documents
  FOR DELETE TO authenticated
  USING (
    public.is_operational_user(auth.uid())
    OR created_by = auth.uid()
  );

-- Also fix storage: drop duplicate/conflicting policies for business-documents bucket
DROP POLICY IF EXISTS "business documents user scoped read"   ON storage.objects;
DROP POLICY IF EXISTS "business documents user scoped insert" ON storage.objects;
DROP POLICY IF EXISTS "business documents user scoped update" ON storage.objects;
DROP POLICY IF EXISTS "business documents user scoped delete" ON storage.objects;
DROP POLICY IF EXISTS "Staff read business documents"   ON storage.objects;
DROP POLICY IF EXISTS "Staff upload business documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff update business documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete business documents" ON storage.objects;

-- Unified storage policies: operational staff can do everything
CREATE POLICY "biz_docs_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'business-documents'
    AND (
      public.is_operational_user(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "biz_docs_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-documents'
    AND (
      public.is_operational_user(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "biz_docs_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
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

CREATE POLICY "biz_docs_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-documents'
    AND (
      public.is_operational_user(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

NOTIFY pgrst, 'reload schema';
