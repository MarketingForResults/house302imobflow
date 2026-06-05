-- Let operational users manage document modalities from the templates screen.

ALTER TABLE public.document_kinds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document kinds read auth" ON public.document_kinds;
CREATE POLICY "document kinds read auth"
  ON public.document_kinds
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "document kinds staff manage" ON public.document_kinds;
DROP POLICY IF EXISTS "document kinds operational manage" ON public.document_kinds;
CREATE POLICY "document kinds operational manage"
  ON public.document_kinds
  FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()))
  WITH CHECK (public.is_operational_user(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_kinds TO authenticated;

NOTIFY pgrst, 'reload schema';
