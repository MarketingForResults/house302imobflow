-- Normaliza perfis de clientes, fiadores e modalidades de seguro contratual.
alter table public.clients
  add column if not exists guarantor_for_client_id uuid references public.clients(id) on delete set null,
  add column if not exists contract_insurance_modalities text[] not null default '{}'::text[];

alter table public.rental_contracts
  add column if not exists guarantor_client_id uuid references public.clients(id) on delete set null,
  add column if not exists contract_insurance_modalities text[] not null default '{}'::text[];

alter table public.clients drop constraint if exists clients_client_roles_check;
alter table public.clients add constraint clients_client_roles_check
  check (client_roles is null or client_roles <@ array['owner','tenant','buyer','seller','guarantor']::text[]);

alter table public.clients drop constraint if exists clients_contract_insurance_modalities_check;
alter table public.clients add constraint clients_contract_insurance_modalities_check
  check (contract_insurance_modalities <@ array['security_deposit_insurance','guarantor_insurance','insurance_broker']::text[]);

alter table public.rental_contracts drop constraint if exists rental_contracts_contract_insurance_modalities_check;
alter table public.rental_contracts add constraint rental_contracts_contract_insurance_modalities_check
  check (contract_insurance_modalities <@ array['security_deposit_insurance','guarantor_insurance','insurance_broker']::text[]);

create index if not exists clients_client_roles_gin_idx on public.clients using gin (client_roles);
create index if not exists clients_contract_insurance_modalities_gin_idx on public.clients using gin (contract_insurance_modalities);
create index if not exists clients_guarantor_for_client_id_idx on public.clients (guarantor_for_client_id);
create index if not exists rental_contracts_guarantor_client_id_idx on public.rental_contracts (guarantor_client_id);

-- Adiciona role 'master' ao enum app_role (necessário para promover conta principal)
alter type public.app_role add value if not exists 'master';

notify pgrst, 'reload schema';