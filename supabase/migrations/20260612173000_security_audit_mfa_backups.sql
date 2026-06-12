-- Security hardening foundation: privileged roles, audit trail, MFA controls and backup metadata.

alter type public.app_role add value if not exists 'master';
alter type public.app_role add value if not exists 'it_support';

create or replace function public.has_any_role(_user_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role::text = any(_roles)
  )
  or (
    'master' = any(_roles)
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com'
  );
$$;

create or replace function public.is_security_operator(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(_user_id, array['master', 'it_support']);
$$;

create or replace function public.is_master_operator(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(_user_id, array['master']);
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

insert into public.security_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id),
  actor_email text,
  event_type text not null,
  severity text not null default 'low' check (severity in ('low', 'medium', 'high', 'critical')),
  source text not null default 'app',
  ip_address text,
  user_agent text,
  target_table text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'blocked', 'revoked', 'deleted', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution_notes text
);

create index if not exists security_audit_events_created_at_idx
  on public.security_audit_events (created_at desc);
create index if not exists security_audit_events_actor_user_id_idx
  on public.security_audit_events (actor_user_id);
create index if not exists security_audit_events_status_idx
  on public.security_audit_events (status);

create table if not exists public.security_user_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  email text,
  reason text not null,
  blocked_at timestamptz not null default now(),
  blocked_by uuid references auth.users(id),
  active boolean not null default true,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id)
);

create index if not exists security_user_blocks_user_id_idx
  on public.security_user_blocks (user_id)
  where active;
create index if not exists security_user_blocks_email_idx
  on public.security_user_blocks (lower(email))
  where active;

create table if not exists public.physical_backups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  label text not null,
  scope text not null default 'core',
  file_name text not null,
  table_count integer not null default 0,
  record_count integer not null default 0,
  byte_size integer not null default 0,
  checksum text,
  notes text
);

create index if not exists physical_backups_created_at_idx
  on public.physical_backups (created_at desc);

alter table public.documents
  add column if not exists guarantor_id uuid references public.clients(id),
  add column if not exists witness1_name text,
  add column if not exists witness1_cpf text,
  add column if not exists witness2_name text,
  add column if not exists witness2_cpf text;

alter table public.security_settings enable row level security;
alter table public.security_audit_events enable row level security;
alter table public.security_user_blocks enable row level security;
alter table public.physical_backups enable row level security;

drop policy if exists "security settings managed by master" on public.security_settings;
create policy "security settings managed by master"
on public.security_settings
for all
to authenticated
using (public.is_master_operator(auth.uid()))
with check (public.is_master_operator(auth.uid()));

drop policy if exists "audit events visible to security operators" on public.security_audit_events;
create policy "audit events visible to security operators"
on public.security_audit_events
for select
to authenticated
using (public.is_security_operator(auth.uid()));

drop policy if exists "audit events writable by security operators" on public.security_audit_events;
create policy "audit events writable by security operators"
on public.security_audit_events
for all
to authenticated
using (public.is_security_operator(auth.uid()))
with check (public.is_security_operator(auth.uid()));

drop policy if exists "security user blocks managed by security operators" on public.security_user_blocks;
create policy "security user blocks managed by security operators"
on public.security_user_blocks
for all
to authenticated
using (public.is_security_operator(auth.uid()))
with check (public.is_security_operator(auth.uid()));

drop policy if exists "physical backups managed by master" on public.physical_backups;
create policy "physical backups managed by master"
on public.physical_backups
for all
to authenticated
using (public.is_master_operator(auth.uid()))
with check (public.is_master_operator(auth.uid()));

drop policy if exists "portal access revocable by security operators" on public.portal_access_links;
create policy "portal access revocable by security operators"
on public.portal_access_links
for update
to authenticated
using (public.is_security_operator(auth.uid()))
with check (public.is_security_operator(auth.uid()));

grant select, insert, update, delete on public.security_settings to authenticated;
grant select, insert, update, delete on public.security_audit_events to authenticated;
grant select, insert, update, delete on public.security_user_blocks to authenticated;
grant select, insert, update, delete on public.physical_backups to authenticated;

notify pgrst, 'reload schema';
