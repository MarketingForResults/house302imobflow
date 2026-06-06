CREATE TABLE IF NOT EXISTS public.portal_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  role public.app_role NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  broker_id uuid REFERENCES public.brokers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_access_email_normalized_check CHECK (email = lower(email)),
  CONSTRAINT portal_access_role_target_check CHECK (
    (role IN ('owner', 'tenant') AND client_id IS NOT NULL AND broker_id IS NULL)
    OR (role = 'broker' AND broker_id IS NOT NULL AND client_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_access_active_email_role_client_idx
  ON public.portal_access_links (email, role, client_id)
  WHERE client_id IS NOT NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS portal_access_active_email_role_broker_idx
  ON public.portal_access_links (email, role, broker_id)
  WHERE broker_id IS NOT NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS portal_access_user_idx
  ON public.portal_access_links (user_id)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS portal_access_links_updated_at ON public.portal_access_links;
CREATE TRIGGER portal_access_links_updated_at
  BEFORE UPDATE ON public.portal_access_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.portal_access_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal access admin manage" ON public.portal_access_links;
CREATE POLICY "portal access admin manage" ON public.portal_access_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "portal access self read" ON public.portal_access_links;
CREATE POLICY "portal access self read" ON public.portal_access_links
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND revoked_at IS NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_access_links TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count int;
  link record;
  assigned_from_invite boolean := false;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  FOR link IN
    SELECT *
    FROM public.portal_access_links
    WHERE email = lower(NEW.email)
      AND revoked_at IS NULL
      AND user_id IS NULL
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, link.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.portal_access_links
    SET user_id = NEW.id,
        accepted_at = now()
    WHERE id = link.id;

    IF link.role = 'broker' AND link.broker_id IS NOT NULL THEN
      UPDATE public.brokers
      SET user_id = NEW.id
      WHERE id = link.broker_id;
    END IF;

    assigned_from_invite := true;
  END LOOP;

  IF NOT assigned_from_invite THEN
    SELECT count(*) INTO user_count FROM auth.users;
    IF user_count = 1 THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'broker')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
