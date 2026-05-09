import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_KIND_LABEL, buildPlaceholderContext, renderTemplate } from "@/lib/doc-placeholders";
import { generateDocumentPdf } from "@/lib/pdf-utils";
import { toast } from "sonner";
import { ArrowLeft, Download } from "lucide-react";

export const Route = createFileRoute("/_app/documents/new")({ component: NewDocumentPage });

function NewDocumentPage() {
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState<string>("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [brokerId, setBrokerId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [deadlineDays, setDeadlineDays] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-active"],
    queryFn: async () => (await supabase.from("document_templates").select("*").eq("active", true).order("name")).data ?? [],
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-min"],
    queryFn: async () => (await supabase.from("properties").select("id, code, title, address, neighborhood, city, state, type, status, area_m2, bedrooms, bathrooms, suites, parking_spaces, price").order("code", { ascending: false })).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("*").order("full_name")).data ?? [],
  });
  const { data: brokers = [] } = useQuery({
    queryKey: ["brokers-min"],
    queryFn: async () => (await supabase.from("brokers").select("*").eq("active", true).order("full_name")).data ?? [],
  });

  const template = useMemo(() => templates.find((t: any) => t.id === templateId), [templates, templateId]);
  const property = useMemo(() => properties.find((p: any) => p.id === propertyId), [properties, propertyId]);
  const client = useMemo(() => clients.find((c: any) => c.id === clientId), [clients, clientId]);
  const broker = useMemo(() => brokers.find((b: any) => b.id === brokerId), [brokers, brokerId]);

  const ctx = useMemo(() =>
    buildPlaceholderContext({
      property, client, broker,
      values: { amount: amount ? Number(amount) : undefined, deadline_days: deadlineDays ? Number(deadlineDays) : undefined },
    }),
  [property, client, broker, amount, deadlineDays]);

  const rendered = useMemo(() => template ? renderTemplate(template.body ?? "", ctx) : "", [template, ctx]);

  async function generate() {
    if (!template) return toast.error("Selecione um modelo");
    setSaving(true);
    const title = `${DOCUMENT_KIND_LABEL[template.kind] ?? template.kind}${property ? ` — ${property.code}` : ""}`;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase.from("documents").insert({
      template_id: template.id,
      kind: template.kind,
      title,
      property_id: propertyId || null,
      client_id: clientId || null,
      broker_id: brokerId || null,
      payload_snapshot: { ctx, amount, deadlineDays },
      body_rendered: rendered,
      created_by: user?.id,
    }).select("*").single();

    if (error) { setSaving(false); return toast.error(error.message); }

    const pdf = await generateDocumentPdf({
      code: inserted.code,
      locator: property?.code ?? inserted.code,
      title,
      bodyText: rendered,
      parties: [
        client && { label: "CLIENTE", name: client.full_name, doc: client.cpf },
        broker && { label: "CORRETOR", name: broker.full_name, doc: broker.creci ? `CRECI ${broker.creci}` : broker.cpf },
      ].filter(Boolean) as any,
    });
    pdf.save(`${inserted.code}.pdf`);
    setSaving(false);
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
            <Button variant="outline" asChild><Link to="/documents"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar</Link></Button>
            <Button onClick={generate} disabled={saving || !template}><Download className="mr-1.5 h-4 w-4" />{saving ? "Gerando…" : "Gerar e baixar PDF"}</Button>
          </>
        }
      />
      <div className="grid gap-6 p-8 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg border bg-card p-5 space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs">Modelo</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {templates.length === 0 && <p className="mt-1 text-[11px] text-muted-foreground">Nenhum modelo ativo. Crie em Modelos.</p>}
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Imóvel</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} — {p.title ?? p.address}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Corretor</Label>
              <Select value={brokerId} onValueChange={setBrokerId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {brokers.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.full_name}</SelectItem>)}
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
                <Input type="number" value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 rounded-lg border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Pré-visualização</h3>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-muted/30 p-4 font-sans text-sm leading-relaxed">{rendered || "Selecione um modelo para ver o conteúdo."}</pre>
        </div>
      </div>
    </div>
  );
}
