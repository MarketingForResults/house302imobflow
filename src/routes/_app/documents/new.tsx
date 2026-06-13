import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_DOCUMENT_KINDS,
  DOCUMENT_KIND_LABEL,
  buildPlaceholderContext,
  renderTemplate,
  richTextToPlainText,
  sanitizeRichTextHtml,
} from "@/lib/doc-placeholders";
import { generateDocumentPdf } from "@/lib/pdf-utils";
import { translatedErrorMessage } from "@/lib/error-messages";
import { calculateDiscount, formatDiscountLabel } from "@/lib/discounts";
import { toast } from "sonner";
import { ArrowLeft, Download } from "lucide-react";

export const Route = createFileRoute("/_app/documents/new")({ component: NewDocumentPage });

function NewDocumentPage() {
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");
  const [buyerId, setBuyerId] = useState<string>("");
  const [sellerId, setSellerId] = useState<string>("");
  const [guarantorId, setGuarantorId] = useState<string>("");
  const [brokerId, setBrokerId] = useState<string>("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [rentalContractId, setRentalContractId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [discountType, setDiscountType] = useState<string>("none");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [deadlineDays, setDeadlineDays] = useState<string>("");
  const [witness1Name, setWitness1Name] = useState("");
  const [witness1Cpf, setWitness1Cpf] = useState("");
  const [witness2Name, setWitness2Name] = useState("");
  const [witness2Cpf, setWitness2Cpf] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-active"],
    queryFn: async () =>
      (await supabase.from("document_templates").select("*").eq("active", true).order("name"))
        .data ?? [],
  });
  const { data: documentKinds = DEFAULT_DOCUMENT_KINDS } = useQuery({
    queryKey: ["document_kinds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_kinds")
        .select("*")
        .eq("active", true)
        .order("sort_order")
        .order("label");
      if (error) return DEFAULT_DOCUMENT_KINDS;
      return data?.length ? data : DEFAULT_DOCUMENT_KINDS;
    },
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-min"],
    queryFn: async () =>
      (
        await supabase
          .from("properties")
          .select(
            "id, code, title, address, neighborhood, city, state, type, status, area_m2, bedrooms, bathrooms, suites, parking_spaces, price",
          )
          .order("code", { ascending: false })
      ).data ?? [],
  });
  const { data: rentalContracts = [] } = useQuery({
    queryKey: ["rental-contracts-doc"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("rental_contracts")
          .select(
            "id, code, property_id, tenant_client_id, landlord_client_id, properties(code, title), tenant:clients!rental_contracts_tenant_client_id_fkey(full_name)",
          )
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("*").order("full_name")).data ?? [],
  });
  const { data: brokers = [] } = useQuery({
    queryKey: ["brokers-min"],
    queryFn: async () =>
      (await supabase.from("brokers").select("*").eq("active", true).order("full_name")).data ?? [],
  });
  const { data: settings } = useQuery({
    queryKey: ["app-settings-documents"],
    queryFn: async () =>
      (await supabase.from("app_settings").select("*").eq("id", true).maybeSingle()).data,
  });

  const template = useMemo(
    () => templates.find((t: any) => t.id === templateId),
    [templates, templateId],
  );
  const property = useMemo(
    () => properties.find((p: any) => p.id === propertyId),
    [properties, propertyId],
  );
  const owner = useMemo(() => clients.find((c: any) => c.id === ownerId), [clients, ownerId]);
  const tenant = useMemo(() => clients.find((c: any) => c.id === tenantId), [clients, tenantId]);
  const buyer = useMemo(() => clients.find((c: any) => c.id === buyerId), [clients, buyerId]);
  const seller = useMemo(() => clients.find((c: any) => c.id === sellerId), [clients, sellerId]);
  const guarantor = useMemo(
    () => clients.find((c: any) => c.id === guarantorId),
    [clients, guarantorId],
  );
  const broker = useMemo(() => brokers.find((b: any) => b.id === brokerId), [brokers, brokerId]);

  const ctx = useMemo(() => {
    const discount = calculateDiscount(amount, discountType, discountValue);
    return buildPlaceholderContext({
      property,
      owner,
      tenant,
      buyer,
      seller,
      guarantor,
      broker,
      witness1: { name: witness1Name, cpf: witness1Cpf },
      witness2: { name: witness2Name, cpf: witness2Cpf },
      settings,
      values: {
        amount: discount.net || undefined,
        gross_amount: amount ? discount.gross : undefined,
        discount_type: discount.type,
        discount_value: discount.value,
        discount_amount: discount.amount,
        amount_after_discount: discount.net || undefined,
        deadline_days: deadlineDays ? Number(deadlineDays) : undefined,
      },
    });
  }, [
    property,
    owner,
    tenant,
    buyer,
    seller,
    guarantor,
    broker,
    witness1Name,
    witness1Cpf,
    witness2Name,
    witness2Cpf,
    settings,
    amount,
    discountType,
    discountValue,
    deadlineDays,
  ]);
  const discount = useMemo(
    () => calculateDiscount(amount, discountType, discountValue),
    [amount, discountType, discountValue],
  );

  const rendered = useMemo(
    () => (template ? renderTemplate(template.body ?? "", ctx) : ""),
    [template, ctx],
  );
  const kindLabelById = useMemo(
    () => Object.fromEntries(documentKinds.map((kind: any) => [kind.id, kind.label])),
    [documentKinds],
  );
  const kindLabel = (kind: string) => kindLabelById[kind] ?? DOCUMENT_KIND_LABEL[kind] ?? kind;

  function safeFilePart(value: string, max = 48) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function isSchemaCacheError(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const current = error as {
      code?: string | null;
      message?: string | null;
      details?: string | null;
      hint?: string | null;
    };
    const text = [current.message, current.details, current.hint]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return current.code === "PGRST204" || text.includes("schema cache") || text.includes("could not find");
  }

  function buildPdfFileName(code: string) {
    const date = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    const modelName = safeFilePart(template?.name || kindLabel(template?.kind ?? ""), 42);
    const left = owner?.full_name || seller?.full_name || broker?.full_name || "Parte 1";
    const right = tenant?.full_name || buyer?.full_name || "Parte 2";
    return `Cod. ${safeFilePart(code, 24)} - ${date} - ${modelName} - ${safeFilePart(left, 32)} x ${safeFilePart(right, 32)}.pdf`;
  }

  async function insertDocumentWithFallback(payload: Record<string, any>) {
    const insert = async (currentPayload: Record<string, any>) =>
      await (supabase.from("documents") as any)
        .insert(currentPayload)
        .select("*")
        .maybeSingle();

    const result = await insert(payload);
    if (!isSchemaCacheError(result.error)) return { ...result, usedFallback: false };

    const compatiblePayload = {
      template_id: payload.template_id,
      kind: payload.kind,
      title: payload.title,
      property_id: payload.property_id,
      client_id:
        payload.owner_id ??
        payload.tenant_id ??
        payload.buyer_id ??
        payload.seller_id ??
        payload.guarantor_id ??
        null,
      broker_id: payload.broker_id,
      payload_snapshot: payload.payload_snapshot,
      body_rendered: payload.body_rendered,
      created_by: payload.created_by,
    };

    const fallbackResult = await insert(compatiblePayload);
    return { ...fallbackResult, usedFallback: !fallbackResult.error };
  }

  async function generate() {
    if (!template) return toast.error("Selecione um modelo");
    setSaving(true);
    const title = `${kindLabel(template.kind)}${property ? ` — ${property.code}` : ""}`;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const payload = {
      template_id: template.id,
      kind: template.kind,
      title,
      property_id: propertyId || null,
      rental_contract_id: rentalContractId || null,
      owner_id: ownerId || null,
      tenant_id: tenantId || null,
      buyer_id: buyerId || null,
      seller_id: sellerId || null,
      guarantor_id: guarantorId || null,
      witness1_name: witness1Name.trim() || null,
      witness1_cpf: witness1Cpf.trim() || null,
      witness2_name: witness2Name.trim() || null,
      witness2_cpf: witness2Cpf.trim() || null,
      broker_id: brokerId || null,
      payload_snapshot: {
        ctx,
        amount: discount.net,
        grossAmount: discount.gross,
        discountType: discount.type,
        discountValue: discount.value,
        discountAmount: discount.amount,
        deadlineDays,
        guarantorId,
        rentalContractId,
        parties: { ownerId, tenantId, buyerId, sellerId, brokerId },
        witnesses: [
          { name: witness1Name.trim(), cpf: witness1Cpf.trim() },
          { name: witness2Name.trim(), cpf: witness2Cpf.trim() },
        ].filter((witness) => witness.name || witness.cpf),
      },
      body_rendered: rendered,
      created_by: user?.id,
    };
    const { data: inserted, error, usedFallback } = await insertDocumentWithFallback(payload);

    if (error || !inserted) {
      setSaving(false);
      return toast.error(translatedErrorMessage(error, "Nao foi possivel gerar o documento."));
    }

    const pdf = await generateDocumentPdf({
      code: inserted.code,
      locator: property?.code ?? inserted.code,
      title,
      bodyHtml: rendered,
      bodyText: richTextToPlainText(rendered),
      parties: [
        owner && { label: "LOCADOR", name: owner.full_name, doc: owner.cpf },
        tenant && { label: "LOCATÁRIO", name: tenant.full_name, doc: tenant.cpf },
        buyer && { label: "COMPRADOR", name: buyer.full_name, doc: buyer.cpf },
        seller && { label: "VENDEDOR", name: seller.full_name, doc: seller.cpf },
        guarantor && { label: "FIADOR", name: guarantor.full_name, doc: guarantor.cpf },
        witness1Name.trim() && {
          label: "TESTEMUNHA 1",
          name: witness1Name.trim(),
          doc: witness1Cpf.trim(),
        },
        witness2Name.trim() && {
          label: "TESTEMUNHA 2",
          name: witness2Name.trim(),
          doc: witness2Cpf.trim(),
        },
        broker && {
          label: "CORRETOR",
          name: broker.full_name,
          doc: broker.creci ? `CRECI ${broker.creci}` : broker.cpf,
        },
      ].filter(Boolean) as any,
    });
    pdf.save(buildPdfFileName(inserted.code));
    setSaving(false);
    if (usedFallback) {
      toast.warning("Documento gerado, mas alguns vínculos ficaram apenas no histórico porque o Supabase ainda precisa aplicar as migrations.");
    }
    toast.success("Documento gerado");
    navigate({ to: "/documents" });
  }

  return (
    <div>
      <PageHeader
        title="Novo documento"
        description="Selecione o modelo e os dados para gerar o PDF"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/documents">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <Button onClick={generate} disabled={saving || !template}>
              <Download className="mr-1.5 h-4 w-4" />
              {saving ? "Gerando…" : "Gerar e baixar PDF"}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 p-4 md:p-8 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg border bg-card p-5 space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs">Modelo</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Nenhum modelo ativo. Crie em Modelos.
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Imóvel</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.title ?? p.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-xs">Proprietário / Locador</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Locatário / Inquilino</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Comprador</Label>
                <Select value={buyerId} onValueChange={setBuyerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Vendedor</Label>
                <Select value={sellerId} onValueChange={setSellerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-md border p-3 space-y-3">
              <div>
                <Label className="mb-1.5 block text-xs">Fiador</Label>
                <Select value={guarantorId} onValueChange={setGuarantorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs">Testemunha 1</Label>
                  <Input
                    value={witness1Name}
                    onChange={(event) => setWitness1Name(event.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">CPF testemunha 1</Label>
                  <Input
                    value={witness1Cpf}
                    onChange={(event) => setWitness1Cpf(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Testemunha 2</Label>
                  <Input
                    value={witness2Name}
                    onChange={(event) => setWitness2Name(event.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">CPF testemunha 2</Label>
                  <Input
                    value={witness2Cpf}
                    onChange={(event) => setWitness2Cpf(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Corretor</Label>
              <Select value={brokerId} onValueChange={setBrokerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Contrato vinculado</Label>
              <Select value={rentalContractId} onValueChange={setRentalContractId}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {rentalContracts.map((contract: any) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.code} - {contract.properties?.code ?? "Imovel"} -{" "}
                      {contract.tenant?.full_name ?? "Inquilino"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1.5 block text-xs">Valor (R$)</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Prazo (dias)</Label>
                <Input
                  type="number"
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1.5 block text-xs">Desconto</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem desconto</SelectItem>
                    <SelectItem value="percent">Percentual (%)</SelectItem>
                    <SelectItem value="amount">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Valor do desconto</Label>
                <Input
                  type="number"
                  step="0.01"
                  disabled={discountType === "none"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </div>
            </div>
            {formatDiscountLabel(discount) && (
              <div className="rounded border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {formatDiscountLabel(discount)}. Valor final:{" "}
                {discount.net.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            )}
          </div>
        </div>
        <div className="lg:col-span-2 rounded-lg border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Pré-visualização</h3>
          {rendered ? (
            <div
              className="max-h-[60vh] overflow-auto rounded bg-muted/30 p-4 text-sm leading-relaxed [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(rendered) }}
            />
          ) : (
            <div className="rounded bg-muted/30 p-4 text-sm text-muted-foreground">
              Selecione um modelo para ver o conteúdo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
