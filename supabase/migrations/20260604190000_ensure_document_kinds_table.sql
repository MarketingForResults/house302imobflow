-- Ensure document modalities exist in environments that missed the earlier migrations.
-- The PostgREST schema cache needs this table before the app can add new document kinds.

CREATE TABLE IF NOT EXISTS public.document_kinds (
  id text PRIMARY KEY,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  system_kind boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.document_kinds (id, label, system_kind, sort_order)
VALUES
  ('visit_form', 'Ficha de visita', true, 10),
  ('sale_contract', 'Contrato de compra e venda', true, 20),
  ('sale_authorization', 'Autorizacao de venda (sem exclusividade)', true, 30),
  ('sale_authorization_exclusive', 'Autorizacao de venda com exclusividade', true, 40),
  ('brokerage_authorization', 'Autorizacao de intermediacao', true, 50),
  ('rental_residential', 'Contrato de locacao residencial', true, 60),
  ('rental_commercial', 'Contrato de locacao comercial', true, 70),
  ('custom', 'Personalizado', true, 80)
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label,
    system_kind = true,
    sort_order = EXCLUDED.sort_order,
    active = true;

DROP TRIGGER IF EXISTS document_kinds_updated_at ON public.document_kinds;
CREATE TRIGGER document_kinds_updated_at
  BEFORE UPDATE ON public.document_kinds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.document_kinds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document kinds read auth" ON public.document_kinds;
CREATE POLICY "document kinds read auth" ON public.document_kinds
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "document kinds staff manage" ON public.document_kinds;
CREATE POLICY "document kinds staff manage" ON public.document_kinds
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_kinds TO authenticated;

NOTIFY pgrst, 'reload schema';
