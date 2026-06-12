# Auditoria de seguranca - ImobFlow

Data: 12/06/2026

## Achados corrigidos nesta rodada

- Ausencia de papeis privilegiados separados para rotinas sensiveis.
  - Adicionados `master` e `it_support`.
  - Rotas `/security` e `/backups` foram isoladas por permissao.

- Ausencia de trilha de auditoria para acoes sensiveis.
  - Criadas tabelas `security_audit_events` e `security_user_blocks`.
  - A tela de seguranca registra alteracoes de configuracao, bloqueios, revogacoes e resolucoes.

- Ausencia de configuracao operacional para MFA/2FA.
  - Criada tabela `security_settings`.
  - Criada UI para ativar/desativar exigencia operacional de 2FA, permitir TOTP e iniciar cadastro TOTP do usuario logado.

- Ausencia de controle de backup fisico rastreavel.
  - Criada tabela `physical_backups`.
  - Criada tela `/backups` para gerar exportacao JSON local, hash SHA-256 e metadados de auditoria.

- Documentos sem papeis juridicos opcionais para fiador e testemunhas.
  - Adicionados campos opcionais de fiador e ate duas testemunhas na geracao de documentos.
  - Adicionados placeholders `{{guarantor.*}}`, `{{witness1.*}}` e `{{witness2.*}}`.

## Riscos mapeados

- MFA ainda precisa de rollout gradual.
  - A UI e a estrutura foram preparadas, mas a exigencia forte em RLS deve ser aplicada apenas depois que usuarios-chave tiverem fatores cadastrados.
  - Recomendacao: usar o claim `aal` do JWT para regras restritivas quando a adesao estiver completa.

- Revogacao total de usuario Auth depende de funcao administrativa.
  - A tela atual bloqueia e revoga links do portal, mas exclusao/desativacao real no Supabase Auth deve continuar em server functions com `service_role`.

- Backup fisico no navegador depende das policies do usuario logado.
  - Esta e uma medida operacional segura para master, mas nao substitui backup de banco gerenciado pelo provedor.

- Tabelas publicas e uploads exigem revisao continua de RLS.
  - Qualquer nova tabela ou bucket deve nascer com RLS e policy minima por papel.

## Proximos endurecimentos recomendados

- Criar Edge Function/server function para bloquear usuario Auth, invalidar sessoes e registrar o motivo.
- Aplicar enforcement de `aal2` em rotas e RLS depois do cadastramento massivo de 2FA.
- Adicionar monitoramento automatico de eventos suspeitos: muitas falhas de login, downloads em massa, uploads recusados por RLS.
- Criar job de limpeza conforme `audit_retention_days`.
- Criar rotina de backup administrada fora do navegador para dump completo PostgreSQL e storage.
- Incluir teste automatizado de permissao para cada rota sensivel.
