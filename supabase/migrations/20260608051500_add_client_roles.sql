ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS client_roles text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.clients.client_roles IS 'Tipos/Perfis do cliente: owner, tenant, buyer, seller';
