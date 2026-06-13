ALTER TABLE public.documents
  ALTER COLUMN kind TYPE text USING kind::text,
  ADD COLUMN IF NOT EXISTS rental_contract_id uuid REFERENCES public.rental_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_contract_id uuid,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guarantor_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS witness1_name text,
  ADD COLUMN IF NOT EXISTS witness1_cpf text,
  ADD COLUMN IF NOT EXISTS witness2_name text,
  ADD COLUMN IF NOT EXISTS witness2_cpf text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_file_url text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DO $$
BEGIN
  IF to_regclass('public.sale_contracts') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.documents'::regclass
        AND conname = 'documents_sale_contract_id_fkey'
    ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_sale_contract_id_fkey
      FOREIGN KEY (sale_contract_id) REFERENCES public.sale_contracts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_rental_contract ON public.documents(rental_contract_id);
CREATE INDEX IF NOT EXISTS idx_documents_sale_contract ON public.documents(sale_contract_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;

NOTIFY pgrst, 'reload schema';
