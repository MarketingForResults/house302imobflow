drop policy if exists "rental payment receipts operational read" on storage.objects;
drop policy if exists "rental payment receipts operational insert" on storage.objects;
drop policy if exists "rental payment receipts operational update" on storage.objects;
drop policy if exists "rental payment receipts operational delete" on storage.objects;

create policy "rental payment receipts operational read" on storage.objects for select to authenticated using (bucket_id = 'rental-payment-receipts' and public.can_manage_rental_payment_receipts(auth.uid()));
create policy "rental payment receipts operational insert" on storage.objects for insert to authenticated with check (bucket_id = 'rental-payment-receipts' and public.can_manage_rental_payment_receipts(auth.uid()));
create policy "rental payment receipts operational update" on storage.objects for update to authenticated using (bucket_id = 'rental-payment-receipts' and public.can_manage_rental_payment_receipts(auth.uid())) with check (bucket_id = 'rental-payment-receipts' and public.can_manage_rental_payment_receipts(auth.uid()));
create policy "rental payment receipts operational delete" on storage.objects for delete to authenticated using (bucket_id = 'rental-payment-receipts' and public.can_manage_rental_payment_receipts(auth.uid()));
