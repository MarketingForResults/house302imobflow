CREATE TABLE IF NOT EXISTS public.document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  autentique_document_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'created',
  signers jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_file_url text,
  signed_file_url text,
  audit_file_url text,
  sandbox boolean NOT NULL DEFAULT true,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_signatures TO authenticated;
GRANT ALL ON public.document_signatures TO service_role;

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document signatures read staff" ON public.document_signatures;
CREATE POLICY "document signatures read staff" ON public.document_signatures
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('master','admin','manager')
    )
  );

DROP POLICY IF EXISTS "document signatures manage staff" ON public.document_signatures;
CREATE POLICY "document signatures manage staff" ON public.document_signatures
  FOR ALL TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('master','admin','manager')
    )
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('master','admin','manager')
    )
  );

CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id ON public.document_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_status ON public.document_signatures(status);
CREATE INDEX IF NOT EXISTS idx_document_signatures_created_at ON public.document_signatures(created_at DESC);

DROP TRIGGER IF EXISTS document_signatures_updated_at ON public.document_signatures;
CREATE TRIGGER document_signatures_updated_at
  BEFORE UPDATE ON public.document_signatures
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

NOTIFY pgrst, 'reload schema';