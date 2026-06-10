
CREATE TABLE public.entity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('client','broker','capture_partner','property','rental_contract','sale_contract')),
  entity_id uuid NOT NULL,
  document_kind text NOT NULL DEFAULT 'other',
  label text,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entity_documents_entity_idx ON public.entity_documents(entity_type, entity_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_documents TO authenticated;
GRANT ALL ON public.entity_documents TO service_role;
ALTER TABLE public.entity_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage entity documents" ON public.entity_documents
  FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()))
  WITH CHECK (public.is_operational_user(auth.uid()));
CREATE TRIGGER entity_documents_touch BEFORE UPDATE ON public.entity_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.portal_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  role text NOT NULL CHECK (role IN ('owner','tenant','broker')),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  broker_id uuid REFERENCES public.brokers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portal_access_links_email_idx ON public.portal_access_links(email);
CREATE INDEX portal_access_links_user_idx ON public.portal_access_links(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_access_links TO authenticated;
GRANT ALL ON public.portal_access_links TO service_role;
ALTER TABLE public.portal_access_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage portal access" ON public.portal_access_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Invitee can read own portal access" ON public.portal_access_links
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER portal_access_links_touch BEFORE UPDATE ON public.portal_access_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email text;
