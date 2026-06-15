-- Keep the primary House302 account as master and admin.
-- Master is the most privileged role, while admin is preserved for legacy RLS
-- policies and modules that still check admin directly.

insert into public.user_roles (user_id, role)
select u.id, role_value::public.app_role
from auth.users u
cross join (
  values ('master'), ('admin')
) as roles(role_value)
where lower(u.email) = 'house302imob@gmail.com'
on conflict (user_id, role) do nothing;
