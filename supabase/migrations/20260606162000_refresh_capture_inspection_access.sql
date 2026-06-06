-- Keep partner registrations, inspection saves, and property image uploads
-- aligned with the current CRM roles after incremental Lovable deploys.

ALTER TABLE public.capture_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capture partners public registration" ON public.capture_partners;
CREATE POLICY "capture partners public registration"
  ON public.capture_partners
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    coalesce(registration_status, 'pending') = 'pending'
    AND coalesce(active, false) = false
  );

DROP POLICY IF EXISTS "capture partners operational read" ON public.capture_partners;
CREATE POLICY "capture partners operational read"
  ON public.capture_partners
  FOR SELECT TO authenticated
  USING (public.is_operational_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "capture partners operational manage" ON public.capture_partners;
CREATE POLICY "capture partners operational manage"
  ON public.capture_partners
  FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_operational_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "property inspections operational read" ON public.property_inspections;
CREATE POLICY "property inspections operational read"
  ON public.property_inspections
  FOR SELECT TO authenticated
  USING (public.is_operational_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "property inspections operational manage" ON public.property_inspections;
CREATE POLICY "property inspections operational manage"
  ON public.property_inspections
  FOR ALL TO authenticated
  USING (public.is_operational_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_operational_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "property image objects crm insert" ON storage.objects;
CREATE POLICY "property image objects crm insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-images'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "property images crm insert" ON public.property_images;
CREATE POLICY "property images crm insert"
  ON public.property_images
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
    )
  );

GRANT INSERT ON public.capture_partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_inspections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_images TO authenticated;

NOTIFY pgrst, 'reload schema';
