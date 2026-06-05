-- Allow authenticated users without an operational role to manage properties
-- they created, while keeping operational users with broad access.

ALTER TABLE public.properties
  ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "properties user scoped insert" ON public.properties;
CREATE POLICY "properties user scoped insert"
  ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_operational_user(auth.uid())
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "properties user scoped update" ON public.properties;
CREATE POLICY "properties user scoped update"
  ON public.properties
  FOR UPDATE TO authenticated
  USING (
    public.is_operational_user(auth.uid())
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_operational_user(auth.uid())
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "properties user scoped delete" ON public.properties;
CREATE POLICY "properties user scoped delete"
  ON public.properties
  FOR DELETE TO authenticated
  USING (
    public.is_operational_user(auth.uid())
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "property images user scoped insert" ON public.property_images;
CREATE POLICY "property images user scoped insert"
  ON public.property_images
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_operational_user(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property images user scoped update" ON public.property_images;
CREATE POLICY "property images user scoped update"
  ON public.property_images
  FOR UPDATE TO authenticated
  USING (
    public.is_operational_user(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.is_operational_user(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property images user scoped delete" ON public.property_images;
CREATE POLICY "property images user scoped delete"
  ON public.property_images
  FOR DELETE TO authenticated
  USING (
    public.is_operational_user(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property image objects user scoped insert" ON storage.objects;
CREATE POLICY "property image objects user scoped insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-images'
    AND (
      public.is_operational_user(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.properties p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "property image objects user scoped update" ON storage.objects;
CREATE POLICY "property image objects user scoped update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'property-images'
    AND (
      public.is_operational_user(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.properties p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'property-images'
    AND (
      public.is_operational_user(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.properties p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "property image objects user scoped delete" ON storage.objects;
CREATE POLICY "property image objects user scoped delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-images'
    AND (
      public.is_operational_user(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.properties p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.created_by = auth.uid()
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_images TO authenticated;

NOTIFY pgrst, 'reload schema';
