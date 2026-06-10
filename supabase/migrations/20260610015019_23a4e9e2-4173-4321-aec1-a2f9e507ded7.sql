
CREATE POLICY "Staff read business documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'business-documents' AND public.is_operational_user(auth.uid()));
CREATE POLICY "Staff upload business documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-documents' AND public.is_operational_user(auth.uid()));
CREATE POLICY "Staff update business documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'business-documents' AND public.is_operational_user(auth.uid()))
  WITH CHECK (bucket_id = 'business-documents' AND public.is_operational_user(auth.uid()));
CREATE POLICY "Staff delete business documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'business-documents' AND public.is_operational_user(auth.uid()));
