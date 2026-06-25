-- Public, link-based inspection photo gallery for printed inspection reports.
-- The function returns only the requested property summary and its public image URLs.

CREATE OR REPLACE FUNCTION public.get_inspection_photo_gallery(gallery_property_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'title', p.title,
    'address', p.address,
    'neighborhood', p.neighborhood,
    'city', p.city,
    'state', p.state,
    'property_images', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', pi.id,
          'image_url', pi.image_url,
          'sort_order', pi.sort_order,
          'is_cover', pi.is_cover,
          'created_at', pi.created_at
        )
        ORDER BY COALESCE(pi.sort_order, 0), pi.created_at, pi.id
      ) FILTER (WHERE pi.id IS NOT NULL),
      '[]'::jsonb
    )
  )
  FROM public.properties p
  LEFT JOIN public.property_images pi ON pi.property_id = p.id
  WHERE p.id = gallery_property_id
  GROUP BY p.id, p.code, p.title, p.address, p.neighborhood, p.city, p.state;
$$;

REVOKE ALL ON FUNCTION public.get_inspection_photo_gallery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inspection_photo_gallery(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
