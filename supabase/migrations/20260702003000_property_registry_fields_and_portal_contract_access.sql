-- Structured property registry fields and safer portal contract visibility.

alter table public.properties
  add column if not exists registry_office text,
  add column if not exists registry_number text,
  add column if not exists registry_book text,
  add column if not exists registry_pages text,
  add column if not exists registry_issue_date date,
  add column if not exists registry_region text,
  add column if not exists lot_number text,
  add column if not exists block_number text,
  add column if not exists total_area_m2 numeric,
  add column if not exists width_m numeric,
  add column if not exists length_m numeric;

create or replace function public.can_access_rental_contract(_user_id uuid, _contract_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_operational_user(_user_id)
    or exists (
      select 1
      from public.rental_contracts rc
      left join public.properties p on p.id = rc.property_id
      join public.portal_access_links pal
        on pal.client_id in (rc.landlord_client_id, p.client_id)
      where rc.id = _contract_id
        and pal.user_id = _user_id
        and pal.role = 'owner'
        and pal.revoked_at is null
    )
    or exists (
      select 1
      from public.rental_contracts rc
      join public.portal_access_links pal on pal.client_id = rc.tenant_client_id
      where rc.id = _contract_id
        and pal.user_id = _user_id
        and pal.role = 'tenant'
        and pal.revoked_at is null
    )
    or exists (
      select 1
      from public.rental_contracts rc
      join public.portal_access_links pal on pal.client_id = rc.guarantor_client_id
      where rc.id = _contract_id
        and pal.user_id = _user_id
        and pal.role in ('tenant', 'owner')
        and pal.revoked_at is null
    );
$$;

revoke all on function public.can_access_rental_contract(uuid, uuid) from public;
grant execute on function public.can_access_rental_contract(uuid, uuid) to authenticated;

drop policy if exists "rentals portal read" on public.rental_contracts;
create policy "rentals portal read"
on public.rental_contracts
for select
to authenticated
using (public.can_access_rental_contract(auth.uid(), id));

drop policy if exists "rental payments portal read" on public.rental_payments;
drop policy if exists "rental payments operational read" on public.rental_payments;
create policy "rental payments portal read"
on public.rental_payments
for select
to authenticated
using (
  public.can_access_rental_contract(auth.uid(), contract_id)
  or public.can_manage_rental_payment_receipts(auth.uid())
);

drop policy if exists "documents portal read" on public.documents;
create policy "documents portal read"
on public.documents
for select
to authenticated
using (
  public.is_operational_user(auth.uid())
  or (client_id is not null and public.can_access_client(auth.uid(), client_id))
  or (broker_id is not null and public.can_access_broker(auth.uid(), broker_id))
  or (property_id is not null and public.can_access_property(auth.uid(), property_id))
  or (
    rental_contract_id is not null
    and public.can_access_rental_contract(auth.uid(), rental_contract_id)
  )
);
