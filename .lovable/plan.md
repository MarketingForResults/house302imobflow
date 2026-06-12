
## Diagnóstico

**1. Erro PGRST204 ao gerar PDF de contrato**
O formulário `documents/new.tsx` faz `insert` em `owner_id`, `tenant_id`, `buyer_id`, `seller_id` — colunas que não existem na tabela `documents` (que só tem `client_id`, `broker_id`, `partner_id`, `property_id`, `rental_contract_id`). Daí o erro de cache de schema.

**2. Tags automáticas desatualizadas**
Novos campos foram criados em `clients` (`marital_status`, `nationality`, `profession`, `father_name`, `mother_name`, `bank_name`, `bank_agency`, `bank_account`, `pix_key`) e em `brokers`/`capture_partners` (estado civil, nacionalidade, profissão). Os placeholders em `src/lib/doc-placeholders.ts` ainda não expõem esses campos.

**3. Contratos de venda incompletos**
As tabelas `sale_contracts` e `sale_payments` **não existem** no banco (a página `/sales` quebra silenciosamente nas queries). Além disso, o formulário é mínimo — sem entrada por %/valor, sem modalidades (à vista, financiamento próprio, financiamento bancário), sem fiador, sem geração de parcelas com índice/multa/juros.

---

## Plano de execução

### A) Migration (banco)

1. **`documents`** — acrescentar `owner_id`, `tenant_id`, `buyer_id`, `seller_id`, `sale_contract_id` (uuid, FK opcional) para suportar múltiplas partes no mesmo documento.
2. **`sale_contracts`** (nova) — campos:
   - `code` (auto, ex. `VEN-0001`), `property_id`, `buyer_client_id`, `seller_client_id`, `broker_id`
   - `total_amount`, `down_payment_amount`, `down_payment_pct`, `down_payment_mode` (`percent`/`amount`)
   - `payment_mode` (`cash`/`owner_financing`/`bank_financing`)
   - `installments_count`, `first_installment_date`, `installment_amount`
   - `readjustment_index` (IGPM/IPCA/INCC/none — reaproveita os mesmos do contrato de aluguel)
   - `late_fee_pct`, `daily_interest_pct`, `monthly_interest_pct`
   - `bank_name`, `bank_financing_amount`, `bank_financing_term_months`, `bank_approval_status`
   - `guarantor_client_id` (FK clientes) p/ fiador
   - `contract_date`, `expected_closing_date`, `closed_at`
   - `commission_pct`, `status`, `notes`
3. **`sale_payments`** (nova) — `contract_id`, `installment_number`, `description`, `due_date`, `amount_due`, `amount_paid`, `paid_at`, `status`, `payment_method`, `late_fee`, `interest`, `notes`.
4. Função `generate_sale_installments(contract_id, n)` espelho da `generate_rental_payments` para gerar parcelas mensais.
5. GRANTs + RLS (`is_operational_user` p/ leitura/escrita, `is_finance_user` p/ pagamentos) seguindo o padrão dos contratos de aluguel.

### B) Frontend — correções pontuais

1. **`documents/new.tsx`**: ajustar payload do `insert` para os novos campos (após migração). Sem migração, o erro persiste.
2. **`doc-placeholders.ts`**: adicionar nas seções Locador/Inquilino/Comprador/Vendedor as tags `marital_status`, `nationality`, `profession`, `father_name`, `mother_name`, `bank_name`, `bank_agency`, `bank_account`, `pix_key`. Em Corretor adicionar estado civil/nacionalidade/profissão. Atualizar `PLACEHOLDER_LABELS` e `buildPlaceholderContext` para preencher.

### C) Frontend — formulário de venda (`sales/index.tsx`)

Reestruturar o diálogo "Novo contrato de venda" em **abas**:

```text
[ Dados básicos ] [ Pagamento ] [ Financiamento bancário ] [ Fiador ] [ Documentos ]
```

- **Dados básicos**: imóvel, comprador, vendedor, corretor, data, previsão de conclusão, comissão, observações.
- **Pagamento**:
  - Toggle "Modalidade": À vista / Financiamento próprio / Financiamento bancário.
  - Valor total + **Entrada**: input com botões `%` / `R$` (recalcula automaticamente o outro).
  - Se *Financiamento próprio*: nº de parcelas, data 1ª parcela, índice de reajuste (reaproveita lista de `economic_indexes`), multa (%), juros diários/mensais. Botão "Gerar parcelas" chama `generate_sale_installments`.
  - Se *À vista*: apenas valor, data e forma (PIX/TED/dinheiro).
  - Se *Financiamento bancário*: ver aba dedicada.
- **Financiamento bancário** (visível só se modo = bancário): banco, valor financiado, prazo (meses), status de aprovação, observações p/ envio. Layout segue padrões usados em CAIXA/BB/Itaú/Santander/Bradesco (campos: renda, score, tipo de imóvel, FGTS, sistema SAC/PRICE).
- **Fiador**: select de cliente existente OU botão "Cadastrar novo" (abre fluxo curto que cria registro em `clients` com `client_roles` contendo `guarantor`).
- **Documentos**: usa `EntityDocuments` (já existente).

Na listagem (página `/sales`) acrescentar colunas: modalidade, entrada (%/R$), parcelas pagas/total, status do financiamento bancário.

### D) Ordem

1. Migration (A) — exige aprovação.
2. Após aprovada: atualizar `doc-placeholders.ts` (B2), corrigir insert em `documents/new.tsx` (B1).
3. Reestruturar formulário de venda (C).
4. QA: gerar PDF, gerar parcelas de venda, alternar modalidades.

---

## Perguntas antes de prosseguir

1. **Fiador** — quer fluxo de cadastro novo dentro do diálogo, ou apenas vincular cliente já existente?
2. **Geração de parcelas** — gerar todas de uma vez na criação do contrato, ou sob demanda como nos aluguéis (botão "Gerar próximos N meses")?
3. **Recibos de venda** — replicar o mesmo modelo de recibo do aluguel para cada parcela paga?
