ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financial';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tenant';
NOTIFY pgrst, 'reload schema';