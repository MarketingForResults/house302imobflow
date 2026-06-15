export type DocumentationSection = {
  id: string;
  title: string;
  audience: string;
  summary: string;
  items: string[];
};

export const SYSTEM_DOCUMENTATION_SECTIONS: DocumentationSection[] = [
  {
    id: "architecture",
    title: "Arquitetura Atual",
    audience: "Master, TI e lideranca tecnica",
    summary:
      "O ImobFlow e uma aplicacao TanStack Start/React com Supabase como backend operacional, RLS para seguranca de dados e modulos organizados por dominio imobiliario.",
    items: [
      "Frontend em React 19, TanStack Router, TanStack Query, Radix UI e Tailwind CSS.",
      "Backend de dados no Supabase: Postgres, Auth, Storage, RLS, migrations SQL e server functions pontuais.",
      "Rotas internas agrupadas em src/routes/_app, com modulos de imoveis, clientes, documentos, alugueis, vendas, financeiro, seguranca, backups e usuarios.",
      "Bibliotecas transversais em src/lib para permissoes, geracao de PDF, documentos, seguros de contrato, descontos, auth e integracoes.",
      "Documentos de negocio gerados por templates com placeholders centralizados em doc-placeholders.ts.",
    ],
  },
  {
    id: "access",
    title: "Acesso e Seguranca",
    audience: "Master e suporte autorizado",
    summary:
      "O acesso administrativo e separado por papeis. A documentacao tecnica interna deve permanecer restrita a master porque descreve arquitetura, fluxos sensiveis e pontos de risco.",
    items: [
      "Rotas operacionais: master, admin, manager e broker conforme o modulo.",
      "Rotas sensiveis: security para master/it_support; backups e documentacao tecnica somente para master.",
      "Portais externos: owner e tenant devem enxergar somente dados vinculados ao proprio cadastro/contrato.",
      "Toda nova tabela exposta ao app precisa nascer com RLS e policies minimas por papel ou vinculo.",
      "Migrations devem sempre terminar com refresh do schema quando alterarem colunas consumidas pelo PostgREST.",
    ],
  },
  {
    id: "domains",
    title: "Dominios de Negocio",
    audience: "Master, produto e operacao",
    summary:
      "Os dominios estao claros, mas alguns arquivos cresceram bastante. A proxima organizacao deve separar componentes, hooks e regras de dominio por modulo.",
    items: [
      "Clientes: cadastro unico para locador, locatario, comprador, vendedor e fiador.",
      "Imoveis: captacao, revisao, imagens, fluxo de vistoria e publicacao.",
      "Alugueis: contratos, parcelas, caucao, descontos, recibos, devolucoes e seguros contratuais.",
      "Documentos: modelos, importacao, placeholders, pre-visualizacao, geracao e historico.",
      "Financeiro: registros, conciliacao e relatorios.",
      "Seguranca: usuarios, papeis, auditoria, backups e controles sensiveis.",
    ],
  },
  {
    id: "roadmap",
    title: "Roadmap de Reorganizacao",
    audience: "Master e time tecnico",
    summary:
      "A recomendacao e evoluir a arquitetura em ciclos pequenos, preservando o fluxo comercial enquanto reduzimos risco tecnico.",
    items: [
      "Extrair arquivos grandes de rotas para componentes e hooks por dominio.",
      "Criar uma camada de servicos de dados para Supabase, reduzindo queries duplicadas nas telas.",
      "Padronizar fallbacks de schema pendente em helpers compartilhados.",
      "Adicionar testes de permissao por rota e testes de smoke para fluxos criticos: cliente, contrato, documento, pagamento e vistoria.",
      "Criar guias comerciais e operacionais separados da documentacao tecnica sensivel.",
      "Manter matriz de acesso e auditoria de seguranca versionadas junto das migrations.",
    ],
  },
];

export const DOCUMENTATION_REFERENCE_FILES = [
  "docs/architecture-audit.md",
  "docs/access-control-matrix.md",
  "docs/security-audit.md",
  "docs/documentation-governance.md",
];
