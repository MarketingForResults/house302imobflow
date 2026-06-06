CREATE OR REPLACE FUNCTION public.can_access_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_operational_user(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.portal_access_links pal
      WHERE pal.user_id = _user_id
        AND pal.client_id = _client_id
        AND pal.revoked_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_broker(_user_id uuid, _broker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_operational_user(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.portal_access_links pal
      WHERE pal.user_id = _user_id
        AND pal.broker_id = _broker_id
        AND pal.role = 'broker'
        AND pal.revoked_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_property(_user_id uuid, _property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_operational_user(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.portal_access_links pal ON pal.client_id = p.client_id
      WHERE p.id = _property_id
        AND pal.user_id = _user_id
        AND pal.role = 'owner'
        AND pal.revoked_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.rental_contracts rc
      JOIN public.portal_access_links pal ON pal.client_id = rc.tenant_client_id
      WHERE rc.property_id = _property_id
        AND pal.user_id = _user_id
        AND pal.role = 'tenant'
        AND pal.revoked_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_rental_contract(_user_id uuid, _contract_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_operational_user(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.rental_contracts rc
      JOIN public.properties p ON p.id = rc.property_id
      JOIN public.portal_access_links pal ON pal.client_id = p.client_id
      WHERE rc.id = _contract_id
        AND pal.user_id = _user_id
        AND pal.role = 'owner'
        AND pal.revoked_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.rental_contracts rc
      JOIN public.portal_access_links pal ON pal.client_id = rc.tenant_client_id
      WHERE rc.id = _contract_id
        AND pal.user_id = _user_id
        AND pal.role = 'tenant'
        AND pal.revoked_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_document_entity(
  _user_id uuid,
  _entity_type text,
  _entity_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_operational_user(_user_id)
    OR CASE
      WHEN _entity_type = 'client' THEN public.can_access_client(_user_id, _entity_id)
      WHEN _entity_type = 'broker' THEN public.can_access_broker(_user_id, _entity_id)
      WHEN _entity_type = 'property' THEN public.can_access_property(_user_id, _entity_id)
      WHEN _entity_type = 'rental_contract' THEN public.can_access_rental_contract(_user_id, _entity_id)
      ELSE false
    END;
$$;

REVOKE ALL ON FUNCTION public.can_access_client(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_broker(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_property(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_rental_contract(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_document_entity(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_client(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_broker(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_property(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_rental_contract(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_document_entity(uuid, text, uuid) TO authenticated;

DROP POLICY IF EXISTS "clients read auth" ON public.clients;
DROP POLICY IF EXISTS "clients portal read" ON public.clients;
CREATE POLICY "clients portal read" ON public.clients
  FOR SELECT TO authenticated
  USING (public.can_access_client(auth.uid(), id));

DROP POLICY IF EXISTS "brokers read auth" ON public.brokers;
DROP POLICY IF EXISTS "brokers portal read" ON public.brokers;
CREATE POLICY "brokers portal read" ON public.brokers
  FOR SELECT TO authenticated
  USING (public.can_access_broker(auth.uid(), id));

DROP POLICY IF EXISTS "properties read auth" ON public.properties;
DROP POLICY IF EXISTS "properties portal read" ON public.properties;
CREATE POLICY "properties portal read" ON public.properties
  FOR SELECT TO authenticated
  USING (public.can_access_property(auth.uid(), id));

DROP POLICY IF EXISTS "documents read auth" ON public.documents;
DROP POLICY IF EXISTS "documents portal read" ON public.documents;
CREATE POLICY "documents portal read" ON public.documents
  FOR SELECT TO authenticated
  USING (
    public.is_operational_user(auth.uid())
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
    OR (broker_id IS NOT NULL AND public.can_access_broker(auth.uid(), broker_id))
    OR (property_id IS NOT NULL AND public.can_access_property(auth.uid(), property_id))
  );

DROP POLICY IF EXISTS "rentals read auth" ON public.rental_contracts;
DROP POLICY IF EXISTS "rentals portal read" ON public.rental_contracts;
CREATE POLICY "rentals portal read" ON public.rental_contracts
  FOR SELECT TO authenticated
  USING (public.can_access_rental_contract(auth.uid(), id));

DROP POLICY IF EXISTS "rental_payments read auth" ON public.rental_payments;
DROP POLICY IF EXISTS "rental_payments portal read" ON public.rental_payments;
CREATE POLICY "rental_payments portal read" ON public.rental_payments
  FOR SELECT TO authenticated
  USING (public.can_access_rental_contract(auth.uid(), contract_id));

DROP POLICY IF EXISTS "inspections read auth" ON public.inspections;
DROP POLICY IF EXISTS "inspections operational read" ON public.inspections;
CREATE POLICY "inspections operational read" ON public.inspections
  FOR SELECT TO authenticated
  USING (public.is_operational_user(auth.uid()));

DROP POLICY IF EXISTS "inspection images read auth" ON public.inspection_images;
DROP POLICY IF EXISTS "inspection images operational read" ON public.inspection_images;
CREATE POLICY "inspection images operational read" ON public.inspection_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inspections i
      WHERE i.id = inspection_images.inspection_id
        AND public.is_operational_user(auth.uid())
    )
  );

DROP POLICY IF EXISTS "financial records read auth" ON public.financial_records;
DROP POLICY IF EXISTS "financial records read finance" ON public.financial_records;
CREATE POLICY "financial records read finance" ON public.financial_records
  FOR SELECT TO authenticated
  USING (public.is_finance_user(auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "entity documents operational read" ON public.entity_documents;
DROP POLICY IF EXISTS "entity documents portal read" ON public.entity_documents;
CREATE POLICY "entity documents portal read"
  ON public.entity_documents FOR SELECT TO authenticated
  USING (public.can_access_document_entity(auth.uid(), entity_type, entity_id));

DROP POLICY IF EXISTS "business documents operational read" ON storage.objects;
DROP POLICY IF EXISTS "business documents portal read" ON storage.objects;
CREATE POLICY "business documents portal read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'business-documents'
    AND EXISTS (
      SELECT 1
      FROM public.entity_documents d
      WHERE d.storage_path = storage.objects.name
        AND public.can_access_document_entity(auth.uid(), d.entity_type, d.entity_id)
    )
  );

NOTIFY pgrst, 'reload schema';
