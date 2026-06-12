-- Keeps the app schema aligned with the document generator and commercial flows.

alter table public.documents
  add column if not exists owner_id uuid references public.clients(id) on delete set null,
  add column if not exists tenant_id uuid references public.clients(id) on delete set null,
  add column if not exists buyer_id uuid references public.clients(id) on delete set null,
  add column if not exists seller_id uuid references public.clients(id) on delete set null;

create index if not exists idx_documents_owner_id on public.documents(owner_id);
create index if not exists idx_documents_tenant_id on public.documents(tenant_id);
create index if not exists idx_documents_buyer_id on public.documents(buyer_id);
create index if not exists idx_documents_seller_id on public.documents(seller_id);

alter table public.rental_contracts
  add column if not exists gross_monthly_rent numeric,
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric not null default 0,
  add column if not exists discount_amount numeric not null default 0;

alter table public.rental_contracts
  drop constraint if exists rental_contracts_discount_type_check,
  add constraint rental_contracts_discount_type_check
    check (discount_type in ('none', 'percent', 'amount'));

update public.rental_contracts
set gross_monthly_rent = monthly_rent
where gross_monthly_rent is null;

alter table public.rental_payments
  add column if not exists gross_amount_due numeric,
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric not null default 0,
  add column if not exists discount_amount numeric not null default 0;

alter table public.rental_payments
  drop constraint if exists rental_payments_discount_type_check,
  add constraint rental_payments_discount_type_check
    check (discount_type in ('none', 'percent', 'amount'));

update public.rental_payments
set gross_amount_due = amount_due
where gross_amount_due is null;

alter table public.sale_contracts
  add column if not exists gross_total_amount numeric,
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric not null default 0,
  add column if not exists discount_amount numeric not null default 0;

alter table public.sale_contracts
  drop constraint if exists sale_contracts_discount_type_check,
  add constraint sale_contracts_discount_type_check
    check (discount_type in ('none', 'percent', 'amount'));

update public.sale_contracts
set gross_total_amount = total_amount
where gross_total_amount is null;

alter table public.sale_payments
  add column if not exists gross_amount_due numeric,
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric not null default 0,
  add column if not exists discount_amount numeric not null default 0;

alter table public.sale_payments
  drop constraint if exists sale_payments_discount_type_check,
  add constraint sale_payments_discount_type_check
    check (discount_type in ('none', 'percent', 'amount'));

update public.sale_payments
set gross_amount_due = amount_due
where gross_amount_due is null;

alter table public.property_inspections
  add column if not exists reminder_minutes integer not null default 60,
  add column if not exists calendar_event_url text;

alter table public.property_inspections
  drop constraint if exists property_inspections_reminder_minutes_check,
  add constraint property_inspections_reminder_minutes_check
    check (reminder_minutes in (0, 15, 30, 60, 120, 1440));

grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.rental_contracts to authenticated;
grant select, insert, update, delete on public.rental_payments to authenticated;
grant select, insert, update, delete on public.sale_contracts to authenticated;
grant select, insert, update, delete on public.sale_payments to authenticated;
grant select, insert, update, delete on public.property_inspections to authenticated;

notify pgrst, 'reload schema';
