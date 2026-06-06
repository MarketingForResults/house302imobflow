-- Reconcile property image policies with the CRM property workflow.
-- Uploads are stored under <property_id>/<file>, so the folder prefix must
-- reference a property row visible to the authenticated user.

INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

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

DROP POLICY IF EXISTS "property image objects crm update" ON storage.objects;
CREATE POLICY "property image objects crm update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'property-images'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'property-images'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "property image objects crm delete" ON storage.objects;
CREATE POLICY "property image objects crm delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
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

DROP POLICY IF EXISTS "property images crm update" ON public.property_images;
CREATE POLICY "property images crm update"
  ON public.property_images
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
    )
  );

DROP POLICY IF EXISTS "property images crm delete" ON public.property_images;
CREATE POLICY "property images crm delete"
  ON public.property_images
  FOR DELETE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
    )
  );

NOTIFY pgrst, 'reload schema';
