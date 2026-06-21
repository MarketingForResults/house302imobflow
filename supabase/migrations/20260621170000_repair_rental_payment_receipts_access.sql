-- Repair rental payment receipt uploads in environments with partial migrations.
-- Ensures the private bucket exists, receipt columns are exposed, and every
-- operational/finance role can upload, read and link receipt files.

alter type public.app_role add value if not exists 'master';
alter type public.app_role add value if not exists 'financial';

create or replace function public.can_manage_rental_payment_receipts(_user_id uuid)
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
      and role::text in ('master', 'admin', 'manager', 'financial', 'broker')
  )
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com';
$$;

revoke all on function public.can_manage_rental_payment_receipts(uuid) from public;
grant execute on function public.can_manage_rental_payment_receipts(uuid) to authenticated;

create or replace function public.is_staff(_user_id uuid)
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
      and role::text in ('master', 'admin', 'manager', 'financial', 'broker')
  )
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com';
$$;

create or replace function public.is_operational_user(_user_id uuid)
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
      and role::text in ('master', 'admin', 'manager', 'broker')
  )
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'house302imob@gmail.com';
$$;

grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.is_operational_user(uuid) to authenticated;

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where lower(email) = 'house302imob@gmail.com'
on conflict (user_id, role) do nothing;

alter table public.rental_payments
  add column if not exists receipt_file_path text,
  add column if not exists receipt_file_name text,
  add column if not exists receipt_uploaded_at timestamptz,
  add column if not exists receipt_attachments jsonb not null default '[]'::jsonb,
  add column if not exists deposit_refund_receipt_file_path text,
  add column if not exists deposit_refund_receipt_file_name text,
  add column if not exists deposit_refund_uploaded_at timestamptz;

update public.rental_payments
set receipt_attachments = jsonb_build_array(
  jsonb_build_object(
    'file_path', receipt_file_path,
    'file_name', coalesce(receipt_file_name, 'Comprovante'),
    'uploaded_at', receipt_uploaded_at
  )
)
where receipt_file_path is not null
  and receipt_attachments = '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('rental-payment-receipts', 'rental-payment-receipts', false)
on conflict (id) do update set public = excluded.public;

alter table public.rental_payments enable row level security;

drop policy if exists "rental payments operational read" on public.rental_payments;
create policy "rental payments operational read"
on public.rental_payments
for select
to authenticated
using (public.can_manage_rental_payment_receipts(auth.uid()));

drop policy if exists "rental payments operational insert" on public.rental_payments;
create policy "rental payments operational insert"
on public.rental_payments
for insert
to authenticated
with check (public.can_manage_rental_payment_receipts(auth.uid()));

drop policy if exists "rental payments operational update" on public.rental_payments;
create policy "rental payments operational update"
on public.rental_payments
for update
to authenticated
using (public.can_manage_rental_payment_receipts(auth.uid()))
with check (public.can_manage_rental_payment_receipts(auth.uid()));

drop policy if exists "rental payments operational delete" on public.rental_payments;
create policy "rental payments operational delete"
on public.rental_payments
for delete
to authenticated
using (public.can_manage_rental_payment_receipts(auth.uid()));

grant select, insert, update, delete on public.rental_payments to authenticated;

drop policy if exists "rental payment receipts staff read" on storage.objects;
drop policy if exists "rental payment receipts staff insert" on storage.objects;
drop policy if exists "rental payment receipts staff update" on storage.objects;
drop policy if exists "rental payment receipts staff delete" on storage.objects;
drop policy if exists "rental payment receipts manage read" on storage.objects;
drop policy if exists "rental payment receipts manage insert" on storage.objects;
drop policy if exists "rental payment receipts manage update" on storage.objects;
drop policy if exists "rental payment receipts manage delete" on storage.objects;
drop policy if exists "rental payment receipts operational read" on storage.objects;
drop policy if exists "rental payment receipts operational insert" on storage.objects;
drop policy if exists "rental payment receipts operational update" on storage.objects;
drop policy if exists "rental payment receipts operational delete" on storage.objects;

create policy "rental payment receipts operational read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'rental-payment-receipts'
  and public.can_manage_rental_payment_receipts(auth.uid())
);

create policy "rental payment receipts operational insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'rental-payment-receipts'
  and public.can_manage_rental_payment_receipts(auth.uid())
);

create policy "rental payment receipts operational update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'rental-payment-receipts'
  and public.can_manage_rental_payment_receipts(auth.uid())
)
with check (
  bucket_id = 'rental-payment-receipts'
  and public.can_manage_rental_payment_receipts(auth.uid())
);

create policy "rental payment receipts operational delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'rental-payment-receipts'
  and public.can_manage_rental_payment_receipts(auth.uid())
);

notify pgrst, 'reload schema';
