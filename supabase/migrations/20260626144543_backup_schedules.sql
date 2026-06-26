create table if not exists public.backup_schedules (
  id boolean primary key default true,
  enabled boolean not null default false,
  frequency text not null default 'daily',
  run_at text not null default '02:00',
  weekday integer,
  month_day integer,
  retention_days integer not null default 30,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint backup_schedules_frequency_check check (frequency in ('daily', 'weekly', 'monthly')),
  constraint backup_schedules_run_at_check check (run_at ~ '^[0-2][0-9]:[0-5][0-9]$'),
  constraint backup_schedules_weekday_check check (weekday is null or weekday between 0 and 6),
  constraint backup_schedules_month_day_check check (month_day is null or month_day between 1 and 28),
  constraint backup_schedules_retention_days_check check (retention_days between 1 and 3650),
  constraint backup_schedules_last_status_check check (
    last_status is null or last_status in ('success', 'error', 'skipped')
  )
);

insert into public.backup_schedules (id)
values (true)
on conflict (id) do nothing;

alter table public.backup_schedules enable row level security;

drop policy if exists "backup schedules managed by master" on public.backup_schedules;
create policy "backup schedules managed by master"
on public.backup_schedules
for all
to authenticated
using (public.is_master_operator(auth.uid()))
with check (public.is_master_operator(auth.uid()));

grant select, insert, update, delete on public.backup_schedules to authenticated;
grant all on public.backup_schedules to service_role;

create index if not exists backup_schedules_next_run_at_idx
  on public.backup_schedules (next_run_at)
  where enabled;

notify pgrst, 'reload schema';
