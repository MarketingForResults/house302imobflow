-- Allow authenticated users to manage custom document modalities.
-- System modalities remain protected at the database level.

ALTER TABLE public.document_kinds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document kinds read auth" ON public.document_kinds;
CREATE POLICY "document kinds read auth"
  ON public.document_kinds
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "document kinds staff manage" ON public.document_kinds;
DROP POLICY IF EXISTS "document kinds operational manage" ON public.document_kinds;
DROP POLICY IF EXISTS "document kinds custom insert" ON public.document_kinds;
CREATE POLICY "document kinds custom insert"
  ON public.document_kinds
  FOR INSERT TO authenticated
  WITH CHECK (system_kind = false);

DROP POLICY IF EXISTS "document kinds custom update" ON public.document_kinds;
CREATE POLICY "document kinds custom update"
  ON public.document_kinds
  FOR UPDATE TO authenticated
  USING (system_kind = false)
  WITH CHECK (system_kind = false);

DROP POLICY IF EXISTS "document kinds custom delete" ON public.document_kinds;
CREATE POLICY "document kinds custom delete"
  ON public.document_kinds
  FOR DELETE TO authenticated
  USING (system_kind = false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_kinds TO authenticated;

NOTIFY pgrst, 'reload schema';
