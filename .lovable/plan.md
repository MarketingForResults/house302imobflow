## Visão geral

Cinco frentes grandes. Logo House302 recebido (azul puro) — vou aplicar à identidade. Antes de implementar, preciso de duas decisões rápidas; o resto eu já organizei.

---

## 1. Upload de até 30 imagens por imóvel

A tabela `property_images` e o bucket `property-images` já existem. Mudanças no formulário:

- Input `multiple` + área de drag-and-drop, processando vários arquivos em paralelo.
- Limite de **30 imagens** por imóvel (validação client + check via count antes do insert).
- Reordenação por arrastar miniaturas (atualiza `sort_order`).
- Compressão leve no client (canvas, max 1920px) para evitar arquivos enormes.
- Ações já existentes (capa, excluir) preservadas.

---

## 2. Identidade visual House302

- Logo salvo em `src/assets/logo-house302.png`, favicon em `public/favicon.png`.
- Atualizar `src/styles.css`:
  - `--primary` = azul House302 (`oklch(0.45 0.30 265)` aprox)
  - `--accent` = mesmo azul para destaques
  - `--ring` idem
  - Light e dark coerentes.
- Substituir o ícone genérico do sidebar pelo logo real.
- Logo no cabeçalho dos PDFs e na página pública do imóvel.
- Atualizar `<title>` e meta para "House302 — ImobiFlow CRM".

---

## 3. Admin com poder total

Hoje as RLS usam `is_staff` (admin + manager). Para admin irrestrito:

- Política `admin all` em **todas** as tabelas (existentes + novas).
- Permitir admin **deletar** `profiles` e `wp_sync_logs` (hoje bloqueado).
- UI: garantir que botões editar/excluir aparecem para admin em qualquer registro de Clientes, Corretores, Parceiros, Imóveis, Documentos, Aluguéis.

---

## 4. Documentos automáticos com templates

### Banco
- `document_templates` — `name`, `kind` (visit_form | sale_contract | sale_authorization | sale_authorization_exclusive | brokerage_authorization | rental_residential | rental_commercial | custom), `body` (texto com placeholders `{{property.code}}`, `{{client.full_name}}` etc), `active`.
- `documents` — `code` (auto `DOC-AAAA-00001`), `template_id`, `kind`, `property_id`, `client_id`, `broker_id`, `partner_id`, `payload_snapshot` (jsonb), `body_rendered` (texto final), `status`, timestamps.

### Editor de templates (`/_app/documents/templates`)
- Lista por tipo + criar/editar.
- Editor de texto com painel lateral mostrando placeholders agrupados (Imóvel / Cliente / Corretor / Parceiro / Valores / Datas) — clicar insere no cursor.
- Pré-visualização com dados de exemplo.

### Geração (`/_app/documents/new`)
- Wizard: tipo → template → imóvel → cliente → corretor → campos extras (valor, prazo, exclusividade etc).
- Renderiza substituindo placeholders → grava em `documents` → gera PDF.
- **PDF**:
  - Cabeçalho com logo House302 + código `DOC-...` + **código de barras Code-128** do localizador (lib `jsbarcode`).
  - Corpo com texto formatado.
  - Rodapé com dados das partes e linha de assinatura.
- Listagem `/_app/documents` com filtros, reimpressão e cancelamento.

---

## 5. Gestão de aluguéis (`/_app/rentals`)

### Banco
- `rental_contracts` — `code` (auto `LOC-AAAA-00001`), `property_id`, `tenant_client_id`, `landlord_client_id`, `broker_id`, `kind` (residential|commercial), `start_date`, `end_date`, `monthly_rent`, `due_day`, `deposit_amount`, `readjustment_index`, `readjustment_month`, `status` (active|ended|cancelled|suspended), `notes`.
- `rental_payments` — `contract_id`, `reference_month`, `due_date`, `amount_due`, `amount_paid`, `paid_at`, `status` (pending|paid|late|partial|waived), `notes`.
- Função SQL `generate_rental_payments(contract_id, n_months)`.
- Função SQL `mark_late_rental_payments()` (chamada manual via botão por enquanto).

### UI
- **Lista de contratos** com filtros (status, vencimento próximo, inadimplentes).
- **Detalhe**: dados, parcelas (paid/pending/late), botões "Registrar pagamento", "Gerar próximas parcelas", "Reajustar valor", "Encerrar".
- **Aviso de cobrança**: gera PDF padronizado + link `wa.me` pré-formatado para WhatsApp.
- **Relatórios mensais**: pagos / a vencer / inadimplentes / receita prevista vs realizada — exportação PDF + XLSX.

---

## Dependências a instalar
- `jspdf` + `jspdf-autotable` — PDFs
- `jsbarcode` — código de barras Code-128
- `xlsx` — planilhas

---

## Ordem de execução

1. **Migração SQL única** — papéis estendidos (admin all em tudo), novas tabelas (document_templates, documents, rental_contracts, rental_payments), sequences de código, funções de geração de parcelas.
2. Instalar libs.
3. Identidade visual House302 (cores + logo no sidebar e topo).
4. Multi-upload de até 30 imagens.
5. Templates + gerador de documentos com barcode.
6. Módulo de aluguéis completo.
7. Revisão final de permissões admin em todas as telas.

---

## Pontos a confirmar antes de começar

1. **Editor de templates** — prefere editor de texto rico (negrito/itálico/listas, lib `@tiptap/react`) ou textarea simples? Para contratos formais, rico fica melhor mas adiciona uma dependência razoável.
2. **Aviso de cobrança de aluguel** — por enquanto via WhatsApp (`wa.me`) está ok, ou já quer e-mail (Resend) configurado agora? E-mail exige verificar domínio depois.