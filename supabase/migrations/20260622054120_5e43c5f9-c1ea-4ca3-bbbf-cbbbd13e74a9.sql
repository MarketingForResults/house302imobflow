alter type public.app_role add value if not exists 'master';
alter type public.app_role add value if not exists 'it_support';
alter type public.app_role add value if not exists 'financial';

create or replace function public.has_any_role(_user_id uuid, _roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role::text = any(_roles))
  or (('master' = any(_roles) or 'admin' = any(_roles)) and lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com');
$$;
create or replace function public.is_security_operator(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(_user_id, array['master', 'it_support', 'admin']);
$$;
create or replace function public.is_master_operator(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(_user_id, array['master', 'admin']);
$$;

create table if not exists public.security_settings (
  id boolean primary key default true,
  require_mfa boolean not null default false,
  allow_totp boolean not null default true,
  allow_sms boolean not null default false,
  login_lockout_enabled boolean not null default true,
  max_failed_attempts integer not null default 5 check (max_failed_attempts between 1 and 20),
  audit_retention_days integer not null default 180 check (audit_retention_days between 7 and 3650),
  backup_retention_days integer not null default 30 check (backup_retention_days between 1 and 3650),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.security_settings to authenticated;
grant all on public.security_settings to service_role;
insert into public.security_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id),
  actor_email text,
  event_type text not null,
  severity text not null default 'low' check (severity in ('low', 'medium', 'high', 'critical')),
  source text not null default 'app',
  ip_address text, user_agent text, target_table text, target_id text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'blocked', 'revoked', 'deleted', 'resolved')),
  resolved_at timestamptz, resolved_by uuid references auth.users(id), resolution_notes text
);
grant select, insert, update, delete on public.security_audit_events to authenticated;
grant all on public.security_audit_events to service_role;
create index if not exists security_audit_events_created_at_idx on public.security_audit_events (created_at desc);
create index if not exists security_audit_events_actor_user_id_idx on public.security_audit_events (actor_user_id);
create index if not exists security_audit_events_status_idx on public.security_audit_events (status);

create table if not exists public.security_user_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id), email text, reason text not null,
  blocked_at timestamptz not null default now(),
  blocked_by uuid references auth.users(id),
  active boolean not null default true,
  revoked_at timestamptz, revoked_by uuid references auth.users(id)
);
grant select, insert, update, delete on public.security_user_blocks to authenticated;
grant all on public.security_user_blocks to service_role;
create index if not exists security_user_blocks_user_id_idx on public.security_user_blocks (user_id) where active;
create index if not exists security_user_blocks_email_idx on public.security_user_blocks (lower(email)) where active;

create table if not exists public.physical_backups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  label text not null, scope text not null default 'core',
  file_name text not null,
  table_count integer not null default 0,
  record_count integer not null default 0,
  byte_size integer not null default 0,
  checksum text, notes text
);
grant select, insert, update, delete on public.physical_backups to authenticated;
grant all on public.physical_backups to service_role;
create index if not exists physical_backups_created_at_idx on public.physical_backups (created_at desc);

alter table public.security_settings enable row level security;
alter table public.security_audit_events enable row level security;
alter table public.security_user_blocks enable row level security;
alter table public.physical_backups enable row level security;

drop policy if exists "security settings managed by master" on public.security_settings;
create policy "security settings managed by master" on public.security_settings for all to authenticated using (public.is_master_operator(auth.uid())) with check (public.is_master_operator(auth.uid()));
drop policy if exists "audit events visible to security operators" on public.security_audit_events;
create policy "audit events visible to security operators" on public.security_audit_events for select to authenticated using (public.is_security_operator(auth.uid()));
drop policy if exists "audit events writable by security operators" on public.security_audit_events;
create policy "audit events writable by security operators" on public.security_audit_events for all to authenticated using (public.is_security_operator(auth.uid())) with check (public.is_security_operator(auth.uid()));
drop policy if exists "security user blocks managed by security operators" on public.security_user_blocks;
create policy "security user blocks managed by security operators" on public.security_user_blocks for all to authenticated using (public.is_security_operator(auth.uid())) with check (public.is_security_operator(auth.uid()));
drop policy if exists "physical backups managed by master" on public.physical_backups;
create policy "physical backups managed by master" on public.physical_backups for all to authenticated using (public.is_master_operator(auth.uid())) with check (public.is_master_operator(auth.uid()));
drop policy if exists "portal access revocable by security operators" on public.portal_access_links;
create policy "portal access revocable by security operators" on public.portal_access_links for update to authenticated using (public.is_security_operator(auth.uid())) with check (public.is_security_operator(auth.uid()));

-- Property inspections
ALTER TABLE public.property_inspections
  ADD COLUMN IF NOT EXISTS assigned_broker_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_notes text,
  ADD COLUMN IF NOT EXISTS technical_notes text,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.property_inspections'::regclass AND conname='property_inspections_status_check') THEN
    ALTER TABLE public.property_inspections ADD CONSTRAINT property_inspections_status_check CHECK (status IN ('pending','scheduled','completed','approved','rejected')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.property_inspections'::regclass AND conname='property_inspections_assigned_broker_id_fkey') THEN
    ALTER TABLE public.property_inspections ADD CONSTRAINT property_inspections_assigned_broker_id_fkey FOREIGN KEY (assigned_broker_id) REFERENCES public.brokers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.property_inspections'::regclass AND conname='property_inspections_reviewed_by_fkey') THEN
    ALTER TABLE public.property_inspections ADD CONSTRAINT property_inspections_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_inspections TO authenticated;

-- Documents
ALTER TABLE public.documents
  ALTER COLUMN kind TYPE text USING kind::text,
  ADD COLUMN IF NOT EXISTS rental_contract_id uuid REFERENCES public.rental_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_contract_id uuid,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guarantor_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS witness1_name text,
  ADD COLUMN IF NOT EXISTS witness1_cpf text,
  ADD COLUMN IF NOT EXISTS witness2_name text,
  ADD COLUMN IF NOT EXISTS witness2_cpf text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_file_url text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
DO $$ BEGIN
  IF to_regclass('public.sale_contracts') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.documents'::regclass AND conname='documents_sale_contract_id_fkey') THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_sale_contract_id_fkey FOREIGN KEY (sale_contract_id) REFERENCES public.sale_contracts(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_documents_rental_contract ON public.documents(rental_contract_id);
CREATE INDEX IF NOT EXISTS idx_documents_sale_contract ON public.documents(sale_contract_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;

-- Rental discounts
ALTER TABLE public.rental_contracts
  ADD COLUMN IF NOT EXISTS gross_monthly_rent numeric,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric;
UPDATE public.rental_contracts SET gross_monthly_rent = COALESCE(gross_monthly_rent, monthly_rent), discount_type = COALESCE(discount_type, 'none'), discount_value = COALESCE(discount_value, 0), discount_amount = COALESCE(discount_amount, 0);
ALTER TABLE public.rental_contracts
  ALTER COLUMN discount_type SET DEFAULT 'none',
  ALTER COLUMN discount_value SET DEFAULT 0,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN discount_type SET NOT NULL,
  ALTER COLUMN discount_value SET NOT NULL,
  ALTER COLUMN discount_amount SET NOT NULL;
ALTER TABLE public.rental_contracts DROP CONSTRAINT IF EXISTS rental_contracts_discount_type_check;
ALTER TABLE public.rental_contracts ADD CONSTRAINT rental_contracts_discount_type_check CHECK (discount_type IN ('none','percent','amount'));

ALTER TABLE public.rental_payments
  ADD COLUMN IF NOT EXISTS gross_amount_due numeric,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric,
  ADD COLUMN IF NOT EXISTS receipt_file_path text,
  ADD COLUMN IF NOT EXISTS receipt_file_name text,
  ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deposit_refund_receipt_file_path text,
  ADD COLUMN IF NOT EXISTS deposit_refund_receipt_file_name text,
  ADD COLUMN IF NOT EXISTS deposit_refund_uploaded_at timestamptz;
UPDATE public.rental_payments SET gross_amount_due=COALESCE(gross_amount_due,amount_due), discount_type=COALESCE(discount_type,'none'), discount_value=COALESCE(discount_value,0), discount_amount=COALESCE(discount_amount,0);
ALTER TABLE public.rental_payments
  ALTER COLUMN discount_type SET DEFAULT 'none',
  ALTER COLUMN discount_value SET DEFAULT 0,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN discount_type SET NOT NULL,
  ALTER COLUMN discount_value SET NOT NULL,
  ALTER COLUMN discount_amount SET NOT NULL;
ALTER TABLE public.rental_payments DROP CONSTRAINT IF EXISTS rental_payments_discount_type_check;
ALTER TABLE public.rental_payments ADD CONSTRAINT rental_payments_discount_type_check CHECK (discount_type IN ('none','percent','amount'));

UPDATE public.rental_payments
SET receipt_attachments = jsonb_build_array(jsonb_build_object('file_path', receipt_file_path, 'file_name', coalesce(receipt_file_name, 'Comprovante'), 'uploaded_at', receipt_uploaded_at))
WHERE receipt_file_path IS NOT NULL AND receipt_attachments = '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.generate_rental_payments(_contract_id uuid, _months int DEFAULT 12)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.rental_contracts%ROWTYPE; i int; next_ref date; last_ref date; inserted int := 0; due date; last_day_of_month int; effective_day int;
BEGIN
  SELECT * INTO c FROM public.rental_contracts WHERE id=_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nao encontrado'; END IF;
  SELECT max(reference_month) INTO last_ref FROM public.rental_payments WHERE contract_id=_contract_id AND payment_kind='rent';
  IF last_ref IS NULL THEN next_ref := date_trunc('month', c.start_date)::date; ELSE next_ref := (last_ref + interval '1 month')::date; END IF;
  FOR i IN 1.._months LOOP
    last_day_of_month := extract(day from (next_ref + interval '1 month - 1 day'))::int;
    effective_day := least(coalesce(c.due_day,5), last_day_of_month);
    due := make_date(extract(year from next_ref)::int, extract(month from next_ref)::int, effective_day);
    BEGIN
      INSERT INTO public.rental_payments(contract_id, reference_month, due_date, amount_due, gross_amount_due, discount_type, discount_value, discount_amount, payment_kind)
      VALUES (_contract_id, next_ref, due, c.monthly_rent, COALESCE(c.gross_monthly_rent,c.monthly_rent), COALESCE(c.discount_type,'none'), COALESCE(c.discount_value,0), COALESCE(c.discount_amount,0), 'rent');
      inserted := inserted + 1;
    EXCEPTION WHEN unique_violation THEN NULL; END;
    next_ref := (next_ref + interval '1 month')::date;
  END LOOP;
  RETURN inserted;
END; $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_contracts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_payments TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rental_payments(uuid, int) TO authenticated;

-- Clients/guarantor/insurance
alter table public.clients
  add column if not exists guarantor_for_client_id uuid references public.clients(id) on delete set null,
  add column if not exists contract_insurance_modalities text[] not null default '{}'::text[];
alter table public.rental_contracts
  add column if not exists guarantor_client_id uuid references public.clients(id) on delete set null,
  add column if not exists contract_insurance_modalities text[] not null default '{}'::text[];
alter table public.clients drop constraint if exists clients_client_roles_check;
alter table public.clients add constraint clients_client_roles_check check (client_roles is null or client_roles <@ array['owner','tenant','buyer','seller','guarantor']::text[]);
alter table public.clients drop constraint if exists clients_contract_insurance_modalities_check;
alter table public.clients add constraint clients_contract_insurance_modalities_check check (contract_insurance_modalities <@ array['security_deposit_insurance','guarantor_insurance','insurance_broker']::text[]);
alter table public.rental_contracts drop constraint if exists rental_contracts_contract_insurance_modalities_check;
alter table public.rental_contracts add constraint rental_contracts_contract_insurance_modalities_check check (contract_insurance_modalities <@ array['security_deposit_insurance','guarantor_insurance','insurance_broker']::text[]);
create index if not exists clients_client_roles_gin_idx on public.clients using gin (client_roles);
create index if not exists clients_contract_insurance_modalities_gin_idx on public.clients using gin (contract_insurance_modalities);
create index if not exists clients_guarantor_for_client_id_idx on public.clients (guarantor_for_client_id);
create index if not exists rental_contracts_guarantor_client_id_idx on public.rental_contracts (guarantor_client_id);

-- Promote House302
insert into public.user_roles (user_id, role)
select u.id, role_value::public.app_role
from auth.users u cross join (values ('master'),('admin')) as roles(role_value)
where lower(u.email) = 'house302imob@gmail.com'
on conflict (user_id, role) do nothing;

-- App locale
alter table public.app_settings
  add column if not exists locale_country text not null default 'BR',
  add column if not exists locale_language text not null default 'pt-BR',
  add column if not exists locale_timezone text not null default 'America/Sao_Paulo';
alter table public.app_settings drop constraint if exists app_settings_locale_country_check;
alter table public.app_settings add constraint app_settings_locale_country_check check (locale_country in ('BR','PT','US'));
alter table public.app_settings drop constraint if exists app_settings_locale_language_check;
alter table public.app_settings add constraint app_settings_locale_language_check check (locale_language in ('pt-BR','pt-PT','en-US'));
alter table public.app_settings drop constraint if exists app_settings_locale_timezone_check;
alter table public.app_settings add constraint app_settings_locale_timezone_check check (locale_timezone in ('America/Sao_Paulo','America/Manaus','America/Recife','America/Cuiaba','Europe/Lisbon','UTC'));

-- Owner rental contract access
CREATE OR REPLACE FUNCTION public.can_access_rental_contract(_user_id uuid, _contract_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_operational_user(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.rental_contracts rc
      LEFT JOIN public.properties p ON p.id = rc.property_id
      JOIN public.portal_access_links pal ON (pal.client_id = rc.landlord_client_id OR pal.client_id = p.client_id)
      WHERE rc.id = _contract_id AND pal.user_id = _user_id AND pal.role = 'owner' AND pal.revoked_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.rental_contracts rc
      JOIN public.portal_access_links pal ON pal.client_id = rc.tenant_client_id
      WHERE rc.id = _contract_id AND pal.user_id = _user_id AND pal.role = 'tenant' AND pal.revoked_at IS NULL
    );
$$;
REVOKE ALL ON FUNCTION public.can_access_rental_contract(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_rental_contract(uuid, uuid) TO authenticated;

-- document_signatures
CREATE TABLE IF NOT EXISTS public.document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  autentique_document_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'created',
  signers jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_file_url text, signed_file_url text, audit_file_url text,
  sandbox boolean NOT NULL DEFAULT true,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_signatures TO authenticated;
GRANT ALL ON public.document_signatures TO service_role;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "document signatures read staff" ON public.document_signatures;
CREATE POLICY "document signatures read staff" ON public.document_signatures FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('master','admin','manager')));
DROP POLICY IF EXISTS "document signatures manage staff" ON public.document_signatures;
CREATE POLICY "document signatures manage staff" ON public.document_signatures FOR ALL TO authenticated USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('master','admin','manager'))) WITH CHECK (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('master','admin','manager')));
CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id ON public.document_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_status ON public.document_signatures(status);
CREATE INDEX IF NOT EXISTS idx_document_signatures_created_at ON public.document_signatures(created_at DESC);
DROP TRIGGER IF EXISTS document_signatures_updated_at ON public.document_signatures;
CREATE TRIGGER document_signatures_updated_at BEFORE UPDATE ON public.document_signatures FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- integration tables
CREATE TABLE IF NOT EXISTS public.integration_connector_settings (
  connector_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled','disabled')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  disabled_reason text, disabled_at timestamptz,
  disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connector_settings TO authenticated;
GRANT ALL ON public.integration_connector_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','error','pending')),
  auth_type text NOT NULL DEFAULT 'manual' CHECK (auth_type IN ('oauth','api_key','webhook','server_secret','manual')),
  external_account_id text, account_label text,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref text, last_checked_at timestamptz, last_error text,
  disabled_reason text, disabled_at timestamptz,
  disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT ALL ON public.integration_connections TO service_role;

ALTER TABLE public.integration_connector_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integration connector settings staff read" ON public.integration_connector_settings;
CREATE POLICY "integration connector settings staff read" ON public.integration_connector_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('master','admin','manager')));
DROP POLICY IF EXISTS "integration connector settings staff manage" ON public.integration_connector_settings;
CREATE POLICY "integration connector settings staff manage" ON public.integration_connector_settings FOR ALL TO authenticated USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('master','admin','manager'))) WITH CHECK (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('master','admin','manager')));
DROP POLICY IF EXISTS "integration connections staff read" ON public.integration_connections;
CREATE POLICY "integration connections staff read" ON public.integration_connections FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('master','admin','manager')));
DROP POLICY IF EXISTS "integration connections staff manage" ON public.integration_connections;
CREATE POLICY "integration connections staff manage" ON public.integration_connections FOR ALL TO authenticated USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('master','admin','manager'))) WITH CHECK (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('master','admin','manager')));
CREATE INDEX IF NOT EXISTS idx_integration_connections_connector_id ON public.integration_connections(connector_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON public.integration_connections(status);
CREATE INDEX IF NOT EXISTS idx_integration_connections_created_at ON public.integration_connections(created_at DESC);
DROP TRIGGER IF EXISTS integration_connector_settings_updated_at ON public.integration_connector_settings;
CREATE TRIGGER integration_connector_settings_updated_at BEFORE UPDATE ON public.integration_connector_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS integration_connections_updated_at ON public.integration_connections;
CREATE TRIGGER integration_connections_updated_at BEFORE UPDATE ON public.integration_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Repair receipts/staff functions
create or replace function public.can_manage_rental_payment_receipts(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role::text in ('master','admin','manager','financial','broker'))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com';
$$;
revoke all on function public.can_manage_rental_payment_receipts(uuid) from public;
grant execute on function public.can_manage_rental_payment_receipts(uuid) to authenticated;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role::text in ('master','admin','manager','financial','broker'))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com';
$$;
create or replace function public.is_operational_user(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role::text in ('master','admin','manager','broker'))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com';
$$;
grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.is_operational_user(uuid) to authenticated;

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users where lower(email) = 'house302imob@gmail.com'
on conflict (user_id, role) do nothing;

alter table public.rental_payments enable row level security;
drop policy if exists "rental payments operational read" on public.rental_payments;
create policy "rental payments operational read" on public.rental_payments for select to authenticated using (public.can_manage_rental_payment_receipts(auth.uid()));
drop policy if exists "rental payments operational insert" on public.rental_payments;
create policy "rental payments operational insert" on public.rental_payments for insert to authenticated with check (public.can_manage_rental_payment_receipts(auth.uid()));
drop policy if exists "rental payments operational update" on public.rental_payments;
create policy "rental payments operational update" on public.rental_payments for update to authenticated using (public.can_manage_rental_payment_receipts(auth.uid())) with check (public.can_manage_rental_payment_receipts(auth.uid()));
drop policy if exists "rental payments operational delete" on public.rental_payments;
create policy "rental payments operational delete" on public.rental_payments for delete to authenticated using (public.can_manage_rental_payment_receipts(auth.uid()));
