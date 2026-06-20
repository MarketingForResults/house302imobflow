export type IntegrationStatus = "enabled" | "available" | "planned";

export type IntegrationCategory =
  | "Core"
  | "Assinatura digital"
  | "Comunicação"
  | "Marketing"
  | "Pagamentos"
  | "Produtividade"
  | "Dados e automação"
  | "Imobiliário"
  | "Fiscal e validações";

export type IntegrationConnector = {
  id: string;
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  tagline: string;
  overview: string;
  icon: string;
  accent: string;
  createdBy: string;
  docsUrl?: string;
  keyFeatures: string[];
  setupChecklist: string[];
  adminNotes?: string[];
};

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  "Core",
  "Assinatura digital",
  "Comunicação",
  "Marketing",
  "Pagamentos",
  "Produtividade",
  "Dados e automação",
  "Imobiliário",
  "Fiscal e validações",
];

export const INTEGRATION_CONNECTORS: IntegrationConnector[] = [
  {
    id: "supabase",
    name: "Supabase",
    category: "Core",
    status: "enabled",
    tagline: "Banco, autenticação, storage e APIs do ImobiFlow.",
    overview:
      "Back-end principal do sistema, responsável por autenticação, dados operacionais, RLS, storage e migrations.",
    icon: "S",
    accent: "bg-emerald-500",
    createdBy: "ImobiFlow",
    docsUrl: "https://supabase.com/docs",
    keyFeatures: [
      "PostgreSQL com RLS para dados sensíveis.",
      "Storage para imagens e documentos.",
      "Auth e papéis de acesso do backoffice.",
      "Migrations versionadas no repositório.",
    ],
    setupChecklist: [
      "Manter migrations aplicadas no projeto Supabase.",
      "Nunca expor service_role no front-end.",
      "Revisar políticas RLS antes de liberar novos módulos.",
    ],
  },
  {
    id: "autentique",
    name: "Autentique",
    category: "Assinatura digital",
    status: "enabled",
    tagline: "Assinatura digital de documentos por e-mail, WhatsApp ou link.",
    overview:
      "Integração GraphQL server-side para envio de PDFs, geração de links manuais, refresh de status e webhook de eventos.",
    icon: "A",
    accent: "bg-violet-600",
    createdBy: "Autentique",
    docsUrl: "https://docs.autentique.com.br/api",
    keyFeatures: [
      "Envio de documentos em modo sandbox ou produção.",
      "Signatários por e-mail, WhatsApp ou link manual.",
      "Webhook em /api/autentique/webhook.",
      "Painel de status no módulo Documentos.",
    ],
    setupChecklist: [
      "Configurar AUTENTIQUE_API_KEY como secret no Lovable.",
      "Apontar o webhook da Autentique para /api/autentique/webhook.",
      "Testar primeiro em sandbox:true.",
    ],
    adminNotes: ["A API key nunca deve ser commitada no GitHub."],
  },
  {
    id: "wordpress",
    name: "WordPress / JetEngine",
    category: "Marketing",
    status: "enabled",
    tagline: "Sincronização de imóveis para site institucional.",
    overview:
      "Conector operacional para publicar ou atualizar imóveis no WordPress via plugin ImobiFlow Sync.",
    icon: "W",
    accent: "bg-sky-600",
    createdBy: "ImobiFlow",
    keyFeatures: [
      "Download do plugin PHP do WordPress.",
      "Sincronização manual de imóveis.",
      "Registro de logs de envio.",
      "Preparado para CPT e campos JetEngine.",
    ],
    setupChecklist: [
      "Instalar e ativar o plugin imobiflow-sync.php.",
      "Configurar a API Key no WordPress e no ImobiFlow.",
      "Validar slug do CPT e campos meta do JetEngine.",
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    category: "Comunicação",
    status: "planned",
    tagline: "Disparos transacionais, avisos e atendimento.",
    overview:
      "Espaço reservado para integração com WhatsApp Cloud API, provedores BSP ou gateways de mensagens.",
    icon: "WA",
    accent: "bg-green-500",
    createdBy: "Meta / BSP",
    keyFeatures: [
      "Templates aprovados para mensagens transacionais.",
      "Notificações de assinatura, cobrança e vistoria.",
      "Histórico de conversas por cliente.",
    ],
    setupChecklist: [
      "Definir provedor: Meta Cloud API, Z-API, Twilio ou BSP.",
      "Criar templates por jornada.",
      "Adicionar webhooks de entrega e leitura.",
    ],
  },
  {
    id: "gmail",
    name: "Gmail / Google Workspace",
    category: "Produtividade",
    status: "planned",
    tagline: "Envio e leitura assistida de e-mails operacionais.",
    overview:
      "Base para conectar caixas corporativas, anexar documentos e registrar comunicação com clientes.",
    icon: "G",
    accent: "bg-red-500",
    createdBy: "Google",
    keyFeatures: [
      "Envio de e-mails por templates.",
      "Registro de conversas no histórico do cliente.",
      "Anexos de contratos, recibos e vistorias.",
    ],
    setupChecklist: [
      "Criar OAuth app no Google Cloud.",
      "Definir escopos mínimos.",
      "Configurar callback seguro no servidor.",
    ],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "Produtividade",
    status: "planned",
    tagline: "Arquivamento externo de contratos e documentos.",
    overview:
      "Área preparada para sincronizar documentos gerados, assinados e comprovantes em pastas compartilhadas.",
    icon: "D",
    accent: "bg-yellow-500",
    createdBy: "Google",
    keyFeatures: [
      "Pastas por imóvel, cliente ou contrato.",
      "Upload automático de PDFs assinados.",
      "Links compartilháveis controlados.",
    ],
    setupChecklist: [
      "Definir estrutura de pastas.",
      "Configurar OAuth ou service account.",
      "Mapear permissões por equipe.",
    ],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "Produtividade",
    status: "planned",
    tagline: "Agenda de visitas, vistorias e follow-ups.",
    overview:
      "Integração futura para criar eventos a partir de visitas, vistorias, vencimentos e tarefas comerciais.",
    icon: "C",
    accent: "bg-blue-500",
    createdBy: "Google",
    keyFeatures: [
      "Eventos de vistoria e visita.",
      "Convites para clientes e corretores.",
      "Lembretes automáticos.",
    ],
    setupChecklist: [
      "Criar projeto OAuth.",
      "Definir calendários por equipe.",
      "Padronizar eventos do CRM.",
    ],
  },
  {
    id: "asaas",
    name: "Asaas",
    category: "Pagamentos",
    status: "planned",
    tagline: "Boletos, PIX, cobranças e webhooks financeiros.",
    overview:
      "Preparado para cobranças de aluguéis, repasses, taxas e conciliação de pagamentos.",
    icon: "R$",
    accent: "bg-cyan-600",
    createdBy: "Asaas",
    docsUrl: "https://docs.asaas.com",
    keyFeatures: [
      "Cobranças PIX/boleto/cartão.",
      "Webhooks de pagamento.",
      "Conciliação no financeiro.",
    ],
    setupChecklist: [
      "Configurar API key em secret.",
      "Cadastrar webhook financeiro.",
      "Mapear contas e centros de custo.",
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Pagamentos",
    status: "planned",
    tagline: "Pagamentos internacionais e assinaturas.",
    overview:
      "Conector reservado para cenários de checkout, assinatura recorrente e pagamentos com cartão.",
    icon: "S",
    accent: "bg-indigo-600",
    createdBy: "Stripe",
    docsUrl: "https://stripe.com/docs",
    keyFeatures: [
      "Checkout seguro.",
      "Assinaturas e planos.",
      "Webhooks de cobrança.",
    ],
    setupChecklist: [
      "Criar chaves secret/public.",
      "Configurar webhooks no servidor.",
      "Definir produtos e preços.",
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "Dados e automação",
    status: "planned",
    tagline: "IA para documentos, atendimento e automações internas.",
    overview:
      "Espaço reservado para recursos de IA: classificação de leads, resumo de contratos e assistentes operacionais.",
    icon: "AI",
    accent: "bg-slate-900",
    createdBy: "OpenAI",
    docsUrl: "https://platform.openai.com/docs",
    keyFeatures: [
      "Geração e revisão de textos.",
      "Extração de dados de documentos.",
      "Assistentes internos por módulo.",
    ],
    setupChecklist: [
      "Configurar OPENAI_API_KEY em secret.",
      "Definir limites de uso.",
      "Registrar auditoria de prompts sensíveis.",
    ],
  },
  {
    id: "n8n",
    name: "n8n",
    category: "Dados e automação",
    status: "planned",
    tagline: "Automação visual entre sistemas externos.",
    overview:
      "Ponto de conexão para fluxos externos, webhooks e integrações de baixa fricção com ferramentas no-code.",
    icon: "n8n",
    accent: "bg-orange-600",
    createdBy: "n8n",
    keyFeatures: [
      "Webhooks de entrada e saída.",
      "Automações sem deploy.",
      "Integração com CRM, planilhas e mensageria.",
    ],
    setupChecklist: [
      "Definir instância n8n.",
      "Criar token para webhooks.",
      "Catalogar fluxos por módulo.",
    ],
  },
  {
    id: "zapier-make",
    name: "Zapier / Make",
    category: "Dados e automação",
    status: "planned",
    tagline: "Conectar eventos do ImobiFlow a centenas de apps.",
    overview:
      "Estrutura futura para emitir eventos padronizados que possam alimentar cenários no Zapier ou Make.",
    icon: "Z",
    accent: "bg-purple-600",
    createdBy: "Zapier / Make",
    keyFeatures: [
      "Eventos de lead, contrato e pagamento.",
      "Webhooks assinados.",
      "Payloads versionados.",
    ],
    setupChecklist: [
      "Criar camada de eventos internos.",
      "Definir assinatura HMAC.",
      "Documentar payloads públicos.",
    ],
  },
  {
    id: "maps",
    name: "Google Maps",
    category: "Imobiliário",
    status: "planned",
    tagline: "Geolocalização, rotas e mapas de imóveis.",
    overview:
      "Reservado para autocomplete de endereços, geocoding, mapas e rotas para visitas.",
    icon: "M",
    accent: "bg-lime-600",
    createdBy: "Google",
    keyFeatures: [
      "Autocomplete de endereço.",
      "Geocoding por imóvel.",
      "Mapas e rotas de visita.",
    ],
    setupChecklist: [
      "Configurar Google Maps API key.",
      "Restringir domínio e APIs habilitadas.",
      "Normalizar latitude/longitude dos imóveis.",
    ],
  },
  {
    id: "viacep",
    name: "ViaCEP",
    category: "Fiscal e validações",
    status: "available",
    tagline: "Consulta de endereço por CEP.",
    overview:
      "Base para preencher endereços de clientes, imóveis e parceiros a partir do CEP.",
    icon: "CEP",
    accent: "bg-amber-600",
    createdBy: "ViaCEP",
    docsUrl: "https://viacep.com.br",
    keyFeatures: [
      "Busca de logradouro, bairro, cidade e UF.",
      "Redução de erro de cadastro.",
      "Fallback para preenchimento manual.",
    ],
    setupChecklist: [
      "Criar helper de consulta com timeout.",
      "Adicionar cache leve por CEP.",
      "Aplicar em formulários de cadastro.",
    ],
  },
  {
    id: "receita",
    name: "Receita Federal / CNPJ",
    category: "Fiscal e validações",
    status: "planned",
    tagline: "Validação cadastral de CPF/CNPJ e empresas.",
    overview:
      "Preparação para consulta cadastral via provedores autorizados e validações fiscais no onboarding.",
    icon: "RF",
    accent: "bg-blue-800",
    createdBy: "Gov / Provedores",
    keyFeatures: [
      "Validação de CNPJ.",
      "Pré-preenchimento de razão social.",
      "Checagens de cadastro.",
    ],
    setupChecklist: [
      "Escolher provedor de dados.",
      "Configurar credenciais em secret.",
      "Adicionar auditoria de consultas.",
    ],
  },
];

export function integrationStats() {
  return {
    total: INTEGRATION_CONNECTORS.length,
    enabled: INTEGRATION_CONNECTORS.filter((connector) => connector.status === "enabled").length,
    available: INTEGRATION_CONNECTORS.filter((connector) => connector.status === "available").length,
    planned: INTEGRATION_CONNECTORS.filter((connector) => connector.status === "planned").length,
  };
}
