-- Allow portal users to read the process information tied to their client record.
-- This complements the existing portal policies so owners/tenants can see status
-- before a rental contract is fully active.

DROP POLICY IF EXISTS "property inspections portal read" ON public.property_inspections;
CREATE POLICY "property inspections portal read"
  ON public.property_inspections
  FOR SELECT TO authenticated
  USING (
    public.is_operational_user(auth.uid())
    OR public.can_access_property(auth.uid(), property_id)
  );

DROP POLICY IF EXISTS "documents portal read" ON public.documents;
CREATE POLICY "documents portal read" ON public.documents
  FOR SELECT TO authenticated
  USING (
    public.is_operational_user(auth.uid())
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
    OR (owner_id IS NOT NULL AND public.can_access_client(auth.uid(), owner_id))
    OR (tenant_id IS NOT NULL AND public.can_access_client(auth.uid(), tenant_id))
    OR (buyer_id IS NOT NULL AND public.can_access_client(auth.uid(), buyer_id))
    OR (seller_id IS NOT NULL AND public.can_access_client(auth.uid(), seller_id))
    OR (guarantor_id IS NOT NULL AND public.can_access_client(auth.uid(), guarantor_id))
    OR (broker_id IS NOT NULL AND public.can_access_broker(auth.uid(), broker_id))
    OR (property_id IS NOT NULL AND public.can_access_property(auth.uid(), property_id))
    OR (rental_contract_id IS NOT NULL AND public.can_access_rental_contract(auth.uid(), rental_contract_id))
  );

NOTIFY pgrst, 'reload schema';
