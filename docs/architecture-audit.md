# Auditoria de arquitetura - ImobFlow

Data: 14/06/2026

## Objetivo

Registrar a arquitetura atual do ImobFlow, seus dominios principais, decisoes tecnicas, riscos e recomendacoes de evolucao para preparar o sistema para validacao, operacao e futura comercializacao.

## Visao geral

O ImobFlow e uma aplicacao web operacional para gestao imobiliaria. A base atual combina:

- React 19 com TanStack Start e TanStack Router.
- TanStack Query para leitura e invalidacao de dados.
- Supabase para Postgres, Auth, Storage, RLS e migrations.
- Tailwind CSS, Radix UI e lucide-react para interface.
- jsPDF, html2canvas, mammoth e pdfjs para documentos, pre-visualizacao e geracao de PDFs.
- Server functions pontuais em `src/lib/*.functions.ts`.

## Organizacao atual

- `src/routes`: rotas publicas e autenticadas.
- `src/routes/_app`: area autenticada do backoffice.
- `src/components`: componentes reutilizaveis e componentes de dominio compartilhados.
- `src/lib`: regras transversais, integracoes, helpers de dominio e server functions.
- `src/integrations/supabase`: cliente e tipos gerados/maintidos do Supabase.
- `supabase/migrations`: evolucao do schema, RLS, funcoes e indices.
- `docs`: documentacao tecnica versionada.

## Dominios de negocio

- Clientes: cadastro unico para locador, locatario, comprador, vendedor e fiador.
- Imoveis: captacao, workflow, imagens, revisao e publicacao.
- Vistorias: agendamento, fotos, registros, parecer tecnico e parecer administrativo.
- Documentos: modelos, importacao, placeholders, pre-visualizacao, geracao e assinaturas.
- Alugueis: contratos, parcelas, caucao, descontos, recibos, devolucoes, fiador e modalidades de seguro.
- Vendas: contratos e pagamentos de venda.
- Financeiro: contas, lancamentos, conciliacao e relatorios.
- Seguranca: usuarios, papeis, MFA, auditoria e backups.
- Integracoes: WordPress/portal externo e funcoes de sincronizacao.

## Pontos fortes

- Separacao clara de rotas por modulo de negocio.
- Uso de RLS no banco como camada de protecao adicional.
- Migrations idempotentes com `if not exists` em varias evolucoes recentes.
- Centralizacao de permissoes de rota em `src/lib/permissions.ts`.
- Centralizacao de placeholders de documentos em `src/lib/doc-placeholders.ts`.
- Uso de helpers especificos para dominio, como `contract-insurance.ts` e `discounts.ts`.
- Documentacao inicial de seguranca e matriz de acesso ja versionadas.

## Riscos tecnicos

- Algumas rotas cresceram muito e concentram UI, queries, regras de negocio e side effects no mesmo arquivo.
- Queries Supabase ainda estao espalhadas em componentes, o que dificulta testes e padronizacao de fallback.
- Alguns fallbacks para schema cache pendente foram implementados por tela; a tendencia deve ser extrair helpers compartilhados.
- `src/integrations/supabase/types.ts` precisa permanecer sincronizado com migrations para evitar lacunas de tipagem.
- Documentacao tecnica nao deve ser exposta para perfis operacionais ou usuarios externos.
- Geracao de documentos e PDFs e fluxo critico comercial; precisa de testes de smoke antes de comercializacao.

## Recomendacoes de reorganizacao

1. Separar cada modulo grande em subpastas:
   - `components`
   - `hooks`
   - `services`
   - `types`
   - `utils`

2. Criar uma camada de dados por dominio:
   - `src/lib/clients-service.ts`
   - `src/lib/rentals-service.ts`
   - `src/lib/documents-service.ts`
   - `src/lib/properties-service.ts`

3. Padronizar respostas e fallback:
   - helper unico para detectar `PGRST204`;
   - helper unico para payload compativel quando migration ainda nao aplicou;
   - mensagens padronizadas para usuario final.

4. Criar testes minimos por fluxo:
   - login e bloqueio de rota;
   - cadastro de cliente;
   - contrato de aluguel com fiador/seguro;
   - geracao de documento;
   - baixa de pagamento;
   - vistoria com fotos e parecer.

5. Separar documentacao por publico:
   - documentacao tecnica master;
   - manual administrador;
   - manual corretor;
   - manual financeiro;
   - portal proprietario;
   - portal inquilino;
   - material comercial.

## Regras para novas features

- Toda nova tabela deve ter RLS desde a migration inicial.
- Toda nova rota deve entrar em `ROUTE_ROLES`.
- Todo campo novo consumido pelo app deve ter migration, tipos Supabase e fallback quando necessario.
- Regras reutilizaveis devem ir para `src/lib` ou service de dominio, nao ficar presas a uma tela.
- Dados sensiveis de contrato, fiador, pagamentos e arquitetura devem ficar restritos a papeis adequados.

