# Plano de execução

## 1. Bug — Anexar documentos (erro 400 "Registro nao encontrado ou sem permissao de leitura")
- Investigar `src/components/entity-documents.tsx` + `src/lib/entity-documents.ts`. O insert em `documents` provavelmente está falhando por RLS ou por coluna obrigatória (após as migrations recentes que adicionaram `rental_contract_id`, `signed_at`, `archived_at`).
- Verificar políticas RLS de `documents` e ajustar payload de insert (campos faltantes/extras) e o bucket de storage usado.
- Garantir que `client_id`/`broker_id`/`property_id` estão sendo passados corretamente do formulário.

## 2. Bug — Gerar acesso (e-mail e WhatsApp)
- Revisar `src/lib/access-management.functions.ts` e `src/components/portal-access-manager.tsx`.
- Capturar a mensagem real retornada pelo servidor (toast). Provável causa: `inviteUserByEmail` falhando porque o domínio de e-mail não está configurado, ou `portal_access_links` não tem GRANT/policies para o admin executar via auth-middleware.
- Adicionar tratamento que sempre retorne o `actionLink` manual quando o invite falhar, e melhorar a mensagem mostrada ao usuário.
- Para "Link WhatsApp", garantir que chama a função de gerar link manual e abre o `wa.me` com o link encurtado.

## 3. Bug — Recibos com dados errados
- Revisar geração do recibo em `src/routes/_app/rentals/index.tsx` (botão "Recibo"). Provavelmente está pegando o registro errado por causa de chave reusada/`map` por índice em vez de id, ou usando o último pagamento ao invés do clicado.
- Corrigir para usar o `payment.id` específico e renderizar os dados corretos (valor, mês, multa, juros, total).

## 4. Nova aba "Usuários" com senha temporária
- Adicionar entrada **Usuários** no menu lateral (apenas admin).
- Página `src/routes/_app/users.tsx`:
  - Listar usuários cadastrados (join `auth.users` + `profiles` + `user_roles`).
  - "Adicionar usuário": e-mail, nome, categoria (role: admin/manager/financial/broker/owner/tenant) → cria usuário via `supabase.auth.admin.createUser` com senha temporária padrão (ex.: `House302@temp`) + flag `must_change_password=true` em `profiles`.
  - Ações: redefinir senha temporária, alterar categoria, desativar.
- Migration: adicionar coluna `must_change_password boolean default false` em `profiles`.
- Fluxo de primeiro login:
  - Após login, `AuthProvider` lê `profiles.must_change_password`. Se true → renderiza modal bloqueante (não fecha) pedindo nova senha + confirmação.
  - Ao salvar: `supabase.auth.updateUser({ password })` + envia e-mail de confirmação (`supabase.auth.reauthenticate` ou simples notificação). Marca `must_change_password=false`.
  - Só libera a UI após sucesso.

## 5. Reorganização do layout — barra superior
- Criar componente `src/components/app-topbar.tsx` visível em todas as páginas autenticadas (desktop e mobile), no topo:
  - **Esquerda**: sino de alertas (movido do dashboard "Pendencias da operacao" — manter o card no dashboard mas espelhar contador no sino do topo).
  - **Direita**: botão-menu (avatar/iniciais) com dropdown estilo Lovable contendo:
    - Perfil (nome + e-mail no topo)
    - Configurações (move de `src/routes/_app/settings.tsx`)
    - Suporte (ícone bóia `LifeBuoy`) → rota placeholder `/support`
    - Sair
- Remover itens **Configurações** e **Sair** do menu lateral (`src/routes/_app.tsx`).
- Criar rota placeholder `src/routes/_app/support.tsx` ("em construção").

## Detalhes técnicos
- Reusar shadcn `DropdownMenu` para o menu superior.
- Sino: novo componente `NotificationsBell` que consulta vistorias pendentes (mesma query do dashboard) e exibe popover com lista + link.
- Senha temporária: gerada server-side e exibida uma única vez ao admin (com botão copiar + link WhatsApp).
- Todas as ações de gerenciar usuários ficam em server function com `requireSupabaseAuth` + checagem `has_role(admin)`.

## Ordem de execução
1. Migration (`must_change_password`) — aguarda aprovação.
2. Corrigir bugs (anexo, gerar acesso, recibo).
3. Implementar topbar + dropdown + remover do sidebar.
4. Criar área Usuários + fluxo de troca de senha forçada.
5. Rota placeholder de Suporte.