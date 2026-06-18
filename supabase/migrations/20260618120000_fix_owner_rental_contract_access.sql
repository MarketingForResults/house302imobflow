CREATE OR REPLACE FUNCTION public.can_access_rental_contract(_user_id uuid, _contract_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_operational_user(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.rental_contracts rc
      LEFT JOIN public.properties p ON p.id = rc.property_id
      JOIN public.portal_access_links pal
        ON (
          pal.client_id = rc.landlord_client_id
          OR pal.client_id = p.client_id
        )
      WHERE rc.id = _contract_id
        AND pal.user_id = _user_id
        AND pal.role = 'owner'
        AND pal.revoked_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.rental_contracts rc
      JOIN public.portal_access_links pal ON pal.client_id = rc.tenant_client_id
      WHERE rc.id = _contract_id
        AND pal.user_id = _user_id
        AND pal.role = 'tenant'
        AND pal.revoked_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_rental_contract(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_rental_contract(uuid, uuid) TO authenticated;
