
REVOKE ALL ON FUNCTION public.generate_rental_payments(uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_late_rental_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_rental_payments(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_late_rental_payments() TO authenticated;
