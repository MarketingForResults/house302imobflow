CREATE TABLE IF NOT EXISTS public.integration_connector_settings (
  connector_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  disabled_reason text,
  disabled_at timestamptz,
  disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'error', 'pending')),
  auth_type text NOT NULL DEFAULT 'manual' CHECK (auth_type IN ('oauth', 'api_key', 'webhook', 'server_secret', 'manual')),
  external_account_id text,
  account_label text,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref text,
  last_checked_at timestamptz,
  last_error text,
  disabled_reason text,
  disabled_at timestamptz,
  disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_connector_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration connector settings staff read" ON public.integration_connector_settings;
CREATE POLICY "integration connector settings staff read" ON public.integration_connector_settings
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('master', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "integration connector settings staff manage" ON public.integration_connector_settings;
CREATE POLICY "integration connector settings staff manage" ON public.integration_connector_settings
  FOR ALL TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('master', 'admin', 'manager')
    )
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('master', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "integration connections staff read" ON public.integration_connections;
CREATE POLICY "integration connections staff read" ON public.integration_connections
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('master', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "integration connections staff manage" ON public.integration_connections;
CREATE POLICY "integration connections staff manage" ON public.integration_connections
  FOR ALL TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('master', 'admin', 'manager')
    )
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('master', 'admin', 'manager')
    )
  );

CREATE INDEX IF NOT EXISTS idx_integration_connections_connector_id
  ON public.integration_connections(connector_id);

CREATE INDEX IF NOT EXISTS idx_integration_connections_status
  ON public.integration_connections(status);

CREATE INDEX IF NOT EXISTS idx_integration_connections_created_at
  ON public.integration_connections(created_at DESC);

DROP TRIGGER IF EXISTS integration_connector_settings_updated_at ON public.integration_connector_settings;
CREATE TRIGGER integration_connector_settings_updated_at
  BEFORE UPDATE ON public.integration_connector_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS integration_connections_updated_at ON public.integration_connections;
CREATE TRIGGER integration_connections_updated_at
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

NOTIFY pgrst, 'reload schema';
