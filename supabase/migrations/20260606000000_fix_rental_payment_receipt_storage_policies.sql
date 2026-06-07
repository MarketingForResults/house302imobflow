-- Allow every role that can manage rentals to attach and open payment receipts.
-- Also re-seed the owner role so production environments that missed the
-- previous normalization migration do not fail storage RLS checks.

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'house302imob@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

DROP POLICY IF EXISTS "rental payment receipts staff read" ON storage.objects;
DROP POLICY IF EXISTS "rental payment receipts staff insert" ON storage.objects;
DROP POLICY IF EXISTS "rental payment receipts staff update" ON storage.objects;
DROP POLICY IF EXISTS "rental payment receipts staff delete" ON storage.objects;
DROP POLICY IF EXISTS "rental payment receipts manage read" ON storage.objects;
DROP POLICY IF EXISTS "rental payment receipts manage insert" ON storage.objects;
DROP POLICY IF EXISTS "rental payment receipts manage update" ON storage.objects;
DROP POLICY IF EXISTS "rental payment receipts manage delete" ON storage.objects;

CREATE POLICY "rental payment receipts manage read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'rental-payment-receipts'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'financial'::public.app_role)
      OR public.has_role(auth.uid(), 'broker'::public.app_role)
      OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com'
    )
  );

CREATE POLICY "rental payment receipts manage insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'rental-payment-receipts'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'financial'::public.app_role)
      OR public.has_role(auth.uid(), 'broker'::public.app_role)
      OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com'
    )
  );

CREATE POLICY "rental payment receipts manage update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'rental-payment-receipts'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'financial'::public.app_role)
      OR public.has_role(auth.uid(), 'broker'::public.app_role)
      OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com'
    )
  )
  WITH CHECK (
    bucket_id = 'rental-payment-receipts'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'financial'::public.app_role)
      OR public.has_role(auth.uid(), 'broker'::public.app_role)
      OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com'
    )
  );

CREATE POLICY "rental payment receipts manage delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'rental-payment-receipts'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'financial'::public.app_role)
      OR public.has_role(auth.uid(), 'broker'::public.app_role)
      OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com'
    )
  );

NOTIFY pgrst, 'reload schema';
