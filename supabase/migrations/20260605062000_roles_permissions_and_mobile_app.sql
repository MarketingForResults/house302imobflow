-- Normalize application roles for existing users and keep role checks aligned.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financial';

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_operational_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager', 'broker')
  )
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'house302imob@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'broker'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_roles r
  WHERE r.user_id = u.id
)
ON CONFLICT (user_id, role) DO NOTHING;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_operational_user(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
