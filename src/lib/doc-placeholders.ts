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
  Cliente: [
    "client.full_name",
    "client.cpf",
    "client.email",
    "client.phone",
    "client.address",
    "client.zip_code",
    "client.street",
    "client.number",
    "client.complement",
    "client.neighborhood",
    "client.city",
    "client.state",
    "client.birth_date",
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
  "client.full_name": "Nome completo do cliente",
  "client.cpf": "CPF do cliente",
  "client.email": "E-mail do cliente",
  "client.phone": "Telefone do cliente",
  "client.address": "Endereço do cliente",
  "client.zip_code": "CEP do cliente",
  "client.street": "Rua do cliente",
  "client.number": "Numero do endereco do cliente",
  "client.complement": "Complemento do endereco do cliente",
  "client.neighborhood": "Bairro do cliente",
  "client.city": "Cidade do cliente",
  "client.state": "Estado (UF) do cliente",
  "client.birth_date": "Data de nascimento do cliente",
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
  client?: any;
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
    client: {
      full_name: input.client?.full_name ?? "",
      cpf: input.client?.cpf ?? "",
      email: input.client?.email ?? "",
      phone: input.client?.phone ?? "",
      address: input.client?.address ?? "",
      zip_code: input.client?.zip_code ?? "",
      street: input.client?.street ?? "",
      number: input.client?.number ?? "",
      complement: input.client?.complement ?? "",
      neighborhood: input.client?.neighborhood ?? "",
      city: input.client?.city ?? "",
      state: input.client?.state ?? "",
      birth_date: fmtDate(input.client?.birth_date),
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
