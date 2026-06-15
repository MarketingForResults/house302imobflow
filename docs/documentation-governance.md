# Governanca de documentacao - ImobFlow

Data: 14/06/2026

## Objetivo

Definir como a documentacao do ImobFlow deve ser organizada para apoiar manutencao tecnica, operacao interna, treinamento e comercializacao sem expor informacoes sensiveis.

## Publicos e niveis de acesso

## Master

Pode acessar documentacao tecnica completa:

- arquitetura;
- schema e migrations;
- RLS e matriz de acesso;
- seguranca;
- backups;
- riscos e roadmap tecnico.

## Administrador operacional

Deve acessar documentacao de uso e configuracao:

- cadastro de usuarios;
- configuracoes comerciais;
- fluxos de aprovacao;
- modelos de documentos;
- operacao diaria.

Nao deve acessar detalhes de RLS, estrutura interna do banco, riscos tecnicos ou chaves de integracao.

## Gerente, financeiro e corretor

Devem acessar manuais por funcao:

- atendimento e captacao;
- contratos;
- pagamentos;
- vistorias;
- documentos;
- relatorios pertinentes ao papel.

## Proprietario, inquilino e parceiro

Devem acessar guias simples de portal/app, sem informacao tecnica.

## Estrutura recomendada no repositorio

- `docs/architecture-audit.md`: arquitetura e recomendacoes tecnicas.
- `docs/security-audit.md`: seguranca, backups e riscos sensiveis.
- `docs/access-control-matrix.md`: matriz de acesso por papel.
- `docs/documentation-governance.md`: regras de documentacao e publicacao.
- `docs/user-guides/`: futuros manuais por perfil.
- `docs/release-notes/`: historico funcional por versao.

## Estrutura recomendada dentro do sistema

- Area "Documentacao do sistema": somente `master`.
- Futuro "Central de ajuda": administradores e operadores, com manuais de uso.
- Futuro "Ajuda do portal": proprietario, inquilino e parceiro.

## Regras editoriais

- Documentacao tecnica deve ser versionada junto ao codigo.
- Mudanca de schema deve atualizar migrations, tipos e documentacao de arquitetura quando afetar dominio importante.
- Mudanca de permissao deve atualizar `access-control-matrix.md`.
- Mudanca de seguranca deve atualizar `security-audit.md`.
- Guias comerciais nao devem citar nomes internos de tabelas, RLS, migrations, policies ou segredos.

## Checklist antes da comercializacao

- Manual do administrador.
- Manual do corretor.
- Manual financeiro.
- Manual de documentos/modelos.
- Manual de contratos de aluguel.
- Manual de vistoria tecnica.
- Manual de portal do proprietario.
- Manual de portal do inquilino.
- Termos de uso, politica de privacidade e politica de backup.
- Plano de suporte e SLA.

