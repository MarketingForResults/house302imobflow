// Placeholder substitution for document templates.
// Syntax: {{group.field}} — e.g. {{property.code}}, {{client.full_name}}.

export const PLACEHOLDER_GROUPS = {
  Imóvel: [
    "property.code", "property.title", "property.type", "property.status",
    "property.address", "property.neighborhood", "property.city", "property.state",
    "property.area_m2", "property.bedrooms", "property.bathrooms", "property.suites",
    "property.parking_spaces", "property.price",
  ],
  Cliente: [
    "client.full_name", "client.cpf", "client.email", "client.phone", "client.address",
  ],
  Corretor: [
    "broker.full_name", "broker.cpf", "broker.creci", "broker.email", "broker.phone",
  ],
  Datas: ["date.today", "date.today_long"],
  Valores: ["values.amount", "values.amount_words", "values.deadline_days", "values.commission_pct"],
} as const;

export const ALL_PLACEHOLDERS = Object.values(PLACEHOLDER_GROUPS).flat();

export function buildPlaceholderContext(input: {
  property?: any;
  client?: any;
  broker?: any;
  values?: { amount?: number; amount_words?: string; deadline_days?: number; commission_pct?: number };
}) {
  const fmtMoney = (v: any) =>
    v == null || v === "" ? "" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const today = new Date();
  const todayLong = today.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

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
    },
    broker: {
      full_name: input.broker?.full_name ?? "",
      cpf: input.broker?.cpf ?? "",
      creci: input.broker?.creci ?? "",
      email: input.broker?.email ?? "",
      phone: input.broker?.phone ?? "",
    },
    date: {
      today: today.toLocaleDateString("pt-BR"),
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
