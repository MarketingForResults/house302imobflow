
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY "property images public read" ON storage.objects;
CREATE POLICY "property images public file read" ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images' AND (storage.foldername(name))[1] IS NOT NULL);
