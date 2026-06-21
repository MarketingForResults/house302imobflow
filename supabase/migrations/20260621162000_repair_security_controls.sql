-- Repair and harden the Security/MFA controls used by /security.
-- This migration is intentionally idempotent because some Lovable workspaces may
-- have missed or partially applied the first security foundation migration.

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
    ('master' = any(_roles) or 'admin' = any(_roles))
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
  select public.has_any_role(_user_id, array['master', 'it_support', 'admin']);
$$;

create or replace function public.is_master_operator(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(_user_id, array['master', 'admin']);
$$;

create table if not exists public.security_settings (
  id boolean primary key default true
);

alter table public.security_settings
  add column if not exists require_mfa boolean not null default false,
  add column if not exists allow_totp boolean not null default true,
  add column if not exists allow_sms boolean not null default false,
  add column if not exists login_lockout_enabled boolean not null default true,
  add column if not exists max_failed_attempts integer not null default 5,
  add column if not exists audit_retention_days integer not null default 180,
  add column if not exists backup_retention_days integer not null default 30,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'security_settings_max_failed_attempts_check'
  ) then
    alter table public.security_settings
      add constraint security_settings_max_failed_attempts_check
      check (max_failed_attempts between 1 and 20);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'security_settings_audit_retention_days_check'
  ) then
    alter table public.security_settings
      add constraint security_settings_audit_retention_days_check
      check (audit_retention_days between 7 and 3650);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'security_settings_backup_retention_days_check'
  ) then
    alter table public.security_settings
      add constraint security_settings_backup_retention_days_check
      check (backup_retention_days between 1 and 3650);
  end if;
end $$;

insert into public.security_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid()
);

alter table public.security_audit_events
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists actor_user_id uuid references auth.users(id),
  add column if not exists actor_email text,
  add column if not exists event_type text not null default 'security.action',
  add column if not exists severity text not null default 'low',
  add column if not exists source text not null default 'app',
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists target_table text,
  add column if not exists target_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'open',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id),
  add column if not exists resolution_notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'security_audit_events_severity_check'
  ) then
    alter table public.security_audit_events
      add constraint security_audit_events_severity_check
      check (severity in ('low', 'medium', 'high', 'critical'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'security_audit_events_status_check'
  ) then
    alter table public.security_audit_events
      add constraint security_audit_events_status_check
      check (status in ('open', 'blocked', 'revoked', 'deleted', 'resolved'));
  end if;
end $$;

create index if not exists security_audit_events_created_at_idx
  on public.security_audit_events (created_at desc);
create index if not exists security_audit_events_actor_user_id_idx
  on public.security_audit_events (actor_user_id);
create index if not exists security_audit_events_status_idx
  on public.security_audit_events (status);

create table if not exists public.security_user_blocks (
  id uuid primary key default gen_random_uuid()
);

alter table public.security_user_blocks
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists email text,
  add column if not exists reason text not null default 'Bloqueio manual',
  add column if not exists blocked_at timestamptz not null default now(),
  add column if not exists blocked_by uuid references auth.users(id),
  add column if not exists active boolean not null default true,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id);

create index if not exists security_user_blocks_user_id_idx
  on public.security_user_blocks (user_id)
  where active;
create index if not exists security_user_blocks_email_idx
  on public.security_user_blocks (lower(email))
  where active;

alter table public.security_settings enable row level security;
alter table public.security_audit_events enable row level security;
alter table public.security_user_blocks enable row level security;

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

grant select, insert, update, delete on public.security_settings to authenticated;
grant select, insert, update, delete on public.security_audit_events to authenticated;
grant select, insert, update, delete on public.security_user_blocks to authenticated;

notify pgrst, 'reload schema';
