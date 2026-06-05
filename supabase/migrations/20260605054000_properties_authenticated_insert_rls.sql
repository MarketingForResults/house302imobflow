-- Make property registration possible for any authenticated user.
-- Ownership is still recorded in created_by and used by scoped update/delete policies.

ALTER TABLE public.properties
  ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "properties user scoped insert" ON public.properties;
DROP POLICY IF EXISTS "properties authenticated insert" ON public.properties;
CREATE POLICY "properties authenticated insert"
  ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;

NOTIFY pgrst, 'reload schema';
