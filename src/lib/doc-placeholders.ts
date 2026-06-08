// Placeholder substitution for document templates.
// Syntax: {{group.field}} — e.g. {{property.code}}, {{client.full_name}}.

export const PLACEHOLDER_GROUPS = {
  Imóvel: [
    "property.code",
    "property.title",
    "property.type",
    "property.status",
    "property.address",
    "property.neighborhood",
    "property.city",
    "property.state",
    "property.area_m2",
    "property.bedrooms",
    "property.bathrooms",
    "property.suites",
    "property.parking_spaces",
    "property.price",
  ],
  Locador: [
    "owner.full_name",
    "owner.cpf",
    "owner.email",
    "owner.phone",
    "owner.address",
    "owner.zip_code",
    "owner.street",
    "owner.number",
    "owner.complement",
    "owner.neighborhood",
    "owner.city",
    "owner.state",
    "owner.birth_date",
  ],
  Inquilino: [
    "tenant.full_name",
    "tenant.cpf",
    "tenant.email",
    "tenant.phone",
    "tenant.address",
    "tenant.zip_code",
    "tenant.street",
    "tenant.number",
    "tenant.complement",
    "tenant.neighborhood",
    "tenant.city",
    "tenant.state",
    "tenant.birth_date",
  ],
  Comprador: [
    "buyer.full_name",
    "buyer.cpf",
    "buyer.email",
    "buyer.phone",
    "buyer.address",
    "buyer.zip_code",
    "buyer.street",
    "buyer.number",
    "buyer.complement",
    "buyer.neighborhood",
    "buyer.city",
    "buyer.state",
    "buyer.birth_date",
  ],
  Vendedor: [
    "seller.full_name",
    "seller.cpf",
    "seller.email",
    "seller.phone",
    "seller.address",
    "seller.zip_code",
    "seller.street",
    "seller.number",
    "seller.complement",
    "seller.neighborhood",
    "seller.city",
    "seller.state",
    "seller.birth_date",
  ],
  Corretor: [
    "broker.full_name",
    "broker.cpf",
    "broker.creci",
    "broker.registration_status",
    "broker.email",
    "broker.phone",
    "broker.address",
    "broker.birth_date",
  ],
  Institucional: [
    "company.person_type",
    "company.document_type",
    "company.legal_name",
    "company.trade_name",
    "company.cnpj",
    "company.creci",
    "company.address",
    "company.zip_code",
    "company.street",
    "company.number",
    "company.complement",
    "company.neighborhood",
    "company.city",
    "company.state",
    "company.phone",
    "company.email",
  ],
  Contratos: ["contract.rental_notes", "contract.sale_notes"],
  Datas: ["date.today", "date.today_long"],
  Valores: [
    "values.amount",
    "values.amount_words",
    "values.deadline_days",
    "values.commission_pct",
  ],
} as const;

export const ALL_PLACEHOLDERS = Object.values(PLACEHOLDER_GROUPS).flat();

export const PLACEHOLDER_LABELS: Record<string, string> = {
  "property.code": "Código do imóvel",
  "property.title": "Título do imóvel",
  "property.type": "Tipo do imóvel",
  "property.status": "Status do imóvel",
  "property.address": "Endereço do imóvel",
  "property.neighborhood": "Bairro do imóvel",
  "property.city": "Cidade do imóvel",
  "property.state": "Estado (UF) do imóvel",
  "property.area_m2": "Área do imóvel (m²)",
  "property.bedrooms": "Quantidade de quartos",
  "property.bathrooms": "Quantidade de banheiros",
  "property.suites": "Quantidade de suítes",
  "property.parking_spaces": "Vagas de garagem",
  "property.price": "Preço do imóvel",
  "owner.full_name": "Nome completo do locador",
  "owner.cpf": "CPF do locador",
  "owner.email": "E-mail do locador",
  "owner.phone": "Telefone do locador",
  "owner.address": "Endereço do locador",
  "owner.zip_code": "CEP do locador",
  "owner.street": "Rua do locador",
  "owner.number": "Numero do endereco do locador",
  "owner.complement": "Complemento do endereco do locador",
  "owner.neighborhood": "Bairro do locador",
  "owner.city": "Cidade do locador",
  "owner.state": "Estado (UF) do locador",
  "owner.birth_date": "Data de nascimento do locador",
  "tenant.full_name": "Nome completo do inquilino",
  "tenant.cpf": "CPF do inquilino",
  "tenant.email": "E-mail do inquilino",
  "tenant.phone": "Telefone do inquilino",
  "tenant.address": "Endereço do inquilino",
  "tenant.zip_code": "CEP do inquilino",
  "tenant.street": "Rua do inquilino",
  "tenant.number": "Numero do endereco do inquilino",
  "tenant.complement": "Complemento do endereco do inquilino",
  "tenant.neighborhood": "Bairro do inquilino",
  "tenant.city": "Cidade do inquilino",
  "tenant.state": "Estado (UF) do inquilino",
  "tenant.birth_date": "Data de nascimento do inquilino",
  "buyer.full_name": "Nome completo do comprador",
  "buyer.cpf": "CPF do comprador",
  "buyer.email": "E-mail do comprador",
  "buyer.phone": "Telefone do comprador",
  "buyer.address": "Endereço do comprador",
  "buyer.zip_code": "CEP do comprador",
  "buyer.street": "Rua do comprador",
  "buyer.number": "Numero do endereco do comprador",
  "buyer.complement": "Complemento do endereco do comprador",
  "buyer.neighborhood": "Bairro do comprador",
  "buyer.city": "Cidade do comprador",
  "buyer.state": "Estado (UF) do comprador",
  "buyer.birth_date": "Data de nascimento do comprador",
  "seller.full_name": "Nome completo do vendedor",
  "seller.cpf": "CPF do vendedor",
  "seller.email": "E-mail do vendedor",
  "seller.phone": "Telefone do vendedor",
  "seller.address": "Endereço do vendedor",
  "seller.zip_code": "CEP do vendedor",
  "seller.street": "Rua do vendedor",
  "seller.number": "Numero do endereco do vendedor",
  "seller.complement": "Complemento do endereco do vendedor",
  "seller.neighborhood": "Bairro do vendedor",
  "seller.city": "Cidade do vendedor",
  "seller.state": "Estado (UF) do vendedor",
  "seller.birth_date": "Data de nascimento do vendedor",
  "broker.full_name": "Nome completo do corretor",
  "broker.cpf": "CPF do corretor",
  "broker.creci": "CRECI do corretor",
  "broker.registration_status": "Situação profissional do corretor",
  "broker.email": "E-mail do corretor",
  "broker.phone": "Telefone do corretor",
  "broker.address": "Endereço do corretor",
  "broker.birth_date": "Data de nascimento do corretor",
  "company.person_type": "Tipo de cadastro institucional",
  "company.document_type": "Tipo de documento institucional",
  "company.legal_name": "Razão social ou nome completo",
  "company.trade_name": "Nome fantasia ou nome profissional",
  "company.cnpj": "CNPJ ou CPF",
  "company.creci": "CRECI institucional",
  "company.address": "Endereço institucional",
  "company.zip_code": "CEP institucional",
  "company.street": "Rua institucional",
  "company.number": "Número institucional",
  "company.complement": "Complemento institucional",
  "company.neighborhood": "Bairro institucional",
  "company.city": "Cidade institucional",
  "company.state": "UF institucional",
  "company.phone": "Telefone institucional",
  "company.email": "E-mail institucional",
  "contract.rental_notes": "Cláusulas padrão para aluguel",
  "contract.sale_notes": "Cláusulas padrão para compra e venda",
  "date.today": "Data atual",
  "date.today_long": "Data atual por extenso",
  "values.amount": "Valor informado",
  "values.amount_words": "Valor por extenso",
  "values.deadline_days": "Prazo em dias",
  "values.commission_pct": "Percentual de comissão",
};

export function richTextToPlainText(body: string): string {
  if (!body) return "";
  if (!/<[a-z][\s\S]*>/i.test(body)) return body;

  const container = document.createElement("div");
  container.innerHTML = body;
  container.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  container.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6").forEach((element) => {
    element.insertAdjacentText("beforeend", "\n");
  });
  return (container.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

export function sanitizeRichTextHtml(body: string): string {
  if (!body || !/<[a-z][\s\S]*>/i.test(body)) return body;

  const container = document.createElement("div");
  container.innerHTML = body;
  const allowedTags = new Set([
    "P",
    "BR",
    "DIV",
    "SPAN",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "OL",
    "UL",
    "LI",
    "H1",
    "H2",
    "H3",
    "H4",
  ]);

  for (const element of Array.from(container.querySelectorAll("*"))) {
    if (!allowedTags.has(element.tagName)) {
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(element.tagName))
        element.remove();
      else element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name !== "style") element.removeAttribute(attribute.name);
    }
    const style = (element as HTMLElement).style;
    const textAlign = style.textAlign;
    const fontWeight = style.fontWeight;
    const fontStyle = style.fontStyle;
    const textDecoration = style.textDecorationLine || style.textDecoration;
    element.removeAttribute("style");
    if (["left", "center", "right", "justify"].includes(textAlign))
      (element as HTMLElement).style.textAlign = textAlign;
    if (
      fontWeight === "bold" ||
      fontWeight === "bolder" ||
      Number.parseInt(fontWeight, 10) >= 600
    ) {
      (element as HTMLElement).style.fontWeight = "700";
    }
    if (fontStyle === "italic") (element as HTMLElement).style.fontStyle = "italic";
    if (textDecoration.includes("underline"))
      (element as HTMLElement).style.textDecoration = "underline";
  }
  return container.innerHTML;
}

export function buildPlaceholderContext(input: {
  property?: any;
  owner?: any;
  tenant?: any;
  buyer?: any;
  seller?: any;
  broker?: any;
  settings?: any;
  values?: {
    amount?: number;
    amount_words?: string;
    deadline_days?: number;
    commission_pct?: number;
  };
}) {
  const fmtMoney = (v: any) =>
    v == null || v === ""
      ? ""
      : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (v: any) => {
    if (!v) return "";
    const [year, month, day] = String(v).slice(0, 10).split("-");
    return day && month && year ? `${day}/${month}/${year}` : String(v);
  };
  const today = new Date();
  const todayLong = today.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const companyIsIndividual = input.settings?.company_person_type === "fisica";

  return {
    property: {
      code: input.property?.code ?? "",
      title: input.property?.title ?? "",
      type: input.property?.type ?? "",
      status: input.property?.status ?? "",
      address: input.property?.address ?? "",
      neighborhood: input.property?.neighborhood ?? "",
      city: input.property?.city ?? "",
      state: input.property?.state ?? "",
      area_m2: input.property?.area_m2 ?? "",
      bedrooms: input.property?.bedrooms ?? "",
      bathrooms: input.property?.bathrooms ?? "",
      suites: input.property?.suites ?? "",
      parking_spaces: input.property?.parking_spaces ?? "",
      price: fmtMoney(input.property?.price),
    },
    owner: {
      full_name: input.owner?.full_name ?? "",
      cpf: input.owner?.cpf ?? "",
      email: input.owner?.email ?? "",
      phone: input.owner?.phone ?? "",
      address: input.owner?.address ?? "",
      zip_code: input.owner?.zip_code ?? "",
      street: input.owner?.street ?? "",
      number: input.owner?.number ?? "",
      complement: input.owner?.complement ?? "",
      neighborhood: input.owner?.neighborhood ?? "",
      city: input.owner?.city ?? "",
      state: input.owner?.state ?? "",
      birth_date: fmtDate(input.owner?.birth_date),
    },
    tenant: {
      full_name: input.tenant?.full_name ?? "",
      cpf: input.tenant?.cpf ?? "",
      email: input.tenant?.email ?? "",
      phone: input.tenant?.phone ?? "",
      address: input.tenant?.address ?? "",
      zip_code: input.tenant?.zip_code ?? "",
      street: input.tenant?.street ?? "",
      number: input.tenant?.number ?? "",
      complement: input.tenant?.complement ?? "",
      neighborhood: input.tenant?.neighborhood ?? "",
      city: input.tenant?.city ?? "",
      state: input.tenant?.state ?? "",
      birth_date: fmtDate(input.tenant?.birth_date),
    },
    buyer: {
      full_name: input.buyer?.full_name ?? "",
      cpf: input.buyer?.cpf ?? "",
      email: input.buyer?.email ?? "",
      phone: input.buyer?.phone ?? "",
      address: input.buyer?.address ?? "",
      zip_code: input.buyer?.zip_code ?? "",
      street: input.buyer?.street ?? "",
      number: input.buyer?.number ?? "",
      complement: input.buyer?.complement ?? "",
      neighborhood: input.buyer?.neighborhood ?? "",
      city: input.buyer?.city ?? "",
      state: input.buyer?.state ?? "",
      birth_date: fmtDate(input.buyer?.birth_date),
    },
    seller: {
      full_name: input.seller?.full_name ?? "",
      cpf: input.seller?.cpf ?? "",
      email: input.seller?.email ?? "",
      phone: input.seller?.phone ?? "",
      address: input.seller?.address ?? "",
      zip_code: input.seller?.zip_code ?? "",
      street: input.seller?.street ?? "",
      number: input.seller?.number ?? "",
      complement: input.seller?.complement ?? "",
      neighborhood: input.seller?.neighborhood ?? "",
      city: input.seller?.city ?? "",
      state: input.seller?.state ?? "",
      birth_date: fmtDate(input.seller?.birth_date),
    },
    broker: {
      full_name: input.broker?.full_name ?? "",
      cpf: input.broker?.cpf ?? "",
      creci: input.broker?.creci ?? "",
      registration_status:
        input.broker?.registration_status === "irregular"
          ? "Corretor sem registro profissional (Autônomo)"
          : "Corretor regular com registro profissional",
      email: input.broker?.email ?? "",
      phone: input.broker?.phone ?? "",
      address: input.broker?.address ?? "",
      birth_date: fmtDate(input.broker?.birth_date),
    },
    company: {
      person_type: companyIsIndividual ? "Pessoa física" : "Pessoa jurídica",
      document_type: companyIsIndividual ? "CPF" : "CNPJ",
      legal_name: input.settings?.company_legal_name ?? "",
      trade_name: input.settings?.company_trade_name ?? "",
      cnpj: input.settings?.company_cnpj ?? "",
      creci: input.settings?.company_creci ?? "",
      address: input.settings?.company_address ?? "",
      zip_code: input.settings?.company_zip_code ?? "",
      street: input.settings?.company_street ?? "",
      number: input.settings?.company_number ?? "",
      complement: input.settings?.company_complement ?? "",
      neighborhood: input.settings?.company_neighborhood ?? "",
      city: input.settings?.company_city ?? "",
      state: input.settings?.company_state ?? "",
      phone: input.settings?.company_phone ?? "",
      email: input.settings?.company_email ?? "",
    },
    contract: {
      rental_notes: input.settings?.rental_contract_notes ?? "",
      sale_notes: input.settings?.sale_contract_notes ?? "",
    },
    date: {
      today: `${today.getDate()}/${today.getMonth() + 1}/${String(today.getFullYear()).slice(-2)}`,
      today_long: todayLong,
    },
    values: {
      amount: fmtMoney(input.values?.amount),
      amount_words: input.values?.amount_words ?? "",
      deadline_days: input.values?.deadline_days ?? "",
      commission_pct: input.values?.commission_pct != null ? `${input.values.commission_pct}%` : "",
    },
  };
}

export function renderTemplate(body: string, ctx: Record<string, any>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) => {
    const parts = path.split(".");
    let v: any = ctx;
    for (const p of parts) v = v?.[p];
    return v == null || v === "" ? `[${path}]` : String(v);
  });
}

export const DOCUMENT_KIND_LABEL: Record<string, string> = {
  visit_form: "Ficha de visita",
  sale_contract: "Contrato de compra e venda",
  sale_authorization: "Autorização de venda (sem exclusividade)",
  sale_authorization_exclusive: "Autorização de venda com exclusividade",
  brokerage_authorization: "Autorização de intermediação",
  rental_residential: "Contrato de locação residencial",
  rental_commercial: "Contrato de locação comercial",
  custom: "Personalizado",
};

export const DEFAULT_DOCUMENT_KINDS = Object.entries(DOCUMENT_KIND_LABEL).map(
  ([id, label], index) => ({
    id,
    label,
    active: true,
    system_kind: true,
    sort_order: (index + 1) * 10,
  }),
);
