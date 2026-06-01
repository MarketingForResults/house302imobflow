import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ImagePlus, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateBR } from "@/lib/format-date";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inspections")({ component: InspectionsPage });

const EMPTY = { status: "pending", property_type: "house" } as any;
const TYPE_LABEL: Record<string, string> = { house: "Casa", apartment: "Apartamento", land: "Terreno", lot: "Lote", commercial: "Comercial" };
const STATUS_LABEL: Record<string, string> = { pending: "Pendente", approved: "Aprovada", rejected: "Reprovada" };
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = { pending: "secondary", approved: "default", rejected: "destructive" };
const NUMERIC_FIELDS = ["area_m2", "bedrooms", "bathrooms", "suites", "parking_spaces", "sale_min_price", "sale_max_price", "rental_min_price", "rental_max_price"];

function InspectionsPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const isEdit = !!form.id;

  const { data: inspections = [] } = useQuery({
    queryKey: ["inspections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspections").select("*, inspection_images(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(inspection: any) {
    setForm({ ...inspection });
    setOpen(true);
  }

  function set(key: string, value: any) {
    setForm((current: any) => ({ ...current, [key]: value }));
  }

  function normalizedPayload() {
    const { id, inspection_images, created_at, updated_at, reviewed_at, reviewed_by, ...payload } = form;
    for (const field of NUMERIC_FIELDS) payload[field] = payload[field] === "" || payload[field] == null ? null : Number(payload[field]);
    return payload;
  }

  async function save() {
    if (!form.owner_name?.trim()) return toast.error("Informe o nome do proprietário");
    if (!form.property_address?.trim()) return toast.error("Informe o endereço do imóvel");
    const payload = normalizedPayload();
    if (isEdit) {
      const { error } = await supabase.from("inspections").update(payload).eq("id", form.id);
      if (error) return toast.error(error.message);
      toast.success("Vistoria atualizada");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("inspections").insert({ ...payload, created_by: user?.id }).select("*, inspection_images(*)").single();
      if (error) return toast.error(error.message);
      setForm(data);
      toast.success("Captação salva. Agora você pode incluir fotos.");
    }
    qc.invalidateQueries({ queryKey: ["inspections"] });
  }

  async function uploadImages(files: FileList | null) {
    if (!form.id || !files?.length) return toast.error("Salve a captação antes de enviar fotos");
    setUploading(true);
    let success = 0;
    for (const [index, file] of Array.from(files).entries()) {
      const path = `inspections/${form.id}/${Date.now()}-${index}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage.from("property-images").upload(path, file);
      if (uploadError) {
        toast.error(`${file.name}: ${uploadError.message}`);
        continue;
      }
      const { data: { publicUrl } } = supabase.storage.from("property-images").getPublicUrl(path);
      const { error } = await supabase.from("inspection_images").insert({ inspection_id: form.id, image_url: publicUrl, sort_order: (form.inspection_images?.length ?? 0) + success });
      if (!error) success++;
    }
    const { data } = await supabase.from("inspections").select("*, inspection_images(*)").eq("id", form.id).single();
    setForm(data ?? form);
    setUploading(false);
    if (success) toast.success(`${success} foto(s) enviada(s)`);
    qc.invalidateQueries({ queryKey: ["inspections"] });
  }

  async function deleteImage(id: string) {
    const { error } = await supabase.from("inspection_images").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setForm({ ...form, inspection_images: (form.inspection_images ?? []).filter((image: any) => image.id !== id) });
    qc.invalidateQueries({ queryKey: ["inspections"] });
  }

  async function review(status: "approved" | "rejected") {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("inspections").update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq("id", form.id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Vistoria aprovada" : "Vistoria reprovada");
    setOpen(false);
    setForm(EMPTY);
    qc.invalidateQueries({ queryKey: ["inspections"] });
  }

  return (
    <div>
      <PageHeader title="Vistorias" description="Captações de imóveis aguardando análise administrativa" actions={
        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setForm(EMPTY); }}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Nova vistoria</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader><DialogTitle>{isEdit ? "Editar vistoria" : "Nova vistoria"}</DialogTitle></DialogHeader>
            <div className="space-y-5">
              <Section title="Proprietário">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Nome completo"><Input value={form.owner_name ?? ""} onChange={(e) => set("owner_name", e.target.value)} /></Field>
                  <Field label="CPF"><Input value={form.owner_cpf ?? ""} onChange={(e) => set("owner_cpf", e.target.value)} /></Field>
                  <Field label="Telefone"><Input value={form.owner_phone ?? ""} onChange={(e) => set("owner_phone", e.target.value)} /></Field>
                  <Field label="E-mail"><Input type="email" value={form.owner_email ?? ""} onChange={(e) => set("owner_email", e.target.value)} /></Field>
                  <div className="md:col-span-2"><Field label="Endereço"><Input value={form.owner_address ?? ""} onChange={(e) => set("owner_address", e.target.value)} /></Field></div>
                </div>
              </Section>

              <Section title="Imóvel captado">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Título"><Input value={form.property_title ?? ""} onChange={(e) => set("property_title", e.target.value)} /></Field>
                  <Field label="Tipo">
                    <Select value={form.property_type ?? "house"} onValueChange={(value) => set("property_type", value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(TYPE_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <div className="md:col-span-2"><Field label="Endereço"><Input value={form.property_address ?? ""} onChange={(e) => set("property_address", e.target.value)} /></Field></div>
                  <Field label="Bairro"><Input value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} /></Field>
                  <Field label="Cidade"><Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
                  <Field label="Estado (UF)"><Input maxLength={2} value={form.state ?? ""} onChange={(e) => set("state", e.target.value.toUpperCase())} /></Field>
                  <Field label="Área (m²)"><Input type="number" value={form.area_m2 ?? ""} onChange={(e) => set("area_m2", e.target.value)} /></Field>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
                  <Field label="Quartos"><Input type="number" value={form.bedrooms ?? ""} onChange={(e) => set("bedrooms", e.target.value)} /></Field>
                  <Field label="Banheiros"><Input type="number" value={form.bathrooms ?? ""} onChange={(e) => set("bathrooms", e.target.value)} /></Field>
                  <Field label="Suítes"><Input type="number" value={form.suites ?? ""} onChange={(e) => set("suites", e.target.value)} /></Field>
                  <Field label="Vagas"><Input type="number" value={form.parking_spaces ?? ""} onChange={(e) => set("parking_spaces", e.target.value)} /></Field>
                </div>
                <div className="mt-3"><Field label="Descrição"><Textarea rows={3} value={form.property_description ?? ""} onChange={(e) => set("property_description", e.target.value)} /></Field></div>
              </Section>

              <Section title="Faixas propostas">
                <div className="grid gap-3 md:grid-cols-2">
                  <MoneyField label="Venda mínima" value={form.sale_min_price} onChange={(value) => set("sale_min_price", value)} />
                  <MoneyField label="Venda máxima" value={form.sale_max_price} onChange={(value) => set("sale_max_price", value)} />
                  <MoneyField label="Aluguel mínimo" value={form.rental_min_price} onChange={(value) => set("rental_min_price", value)} />
                  <MoneyField label="Aluguel máximo" value={form.rental_max_price} onChange={(value) => set("rental_max_price", value)} />
                </div>
                <div className="mt-3"><Field label="Observações da captação"><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field></div>
              </Section>

              {isEdit && (
                <Section title={`Fotos (${form.inspection_images?.length ?? 0})`}>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {(form.inspection_images ?? []).map((image: any) => (
                      <div key={image.id} className="group relative aspect-square overflow-hidden rounded-md border">
                        <img src={image.image_url} alt="" className="h-full w-full object-cover" />
                        <button onClick={() => deleteImage(image.id)} className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100" title="Excluir foto"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted">
                      <ImagePlus className="h-5 w-5" />{uploading ? "Enviando..." : "Adicionar fotos"}
                      <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(e) => { uploadImages(e.target.files); e.target.value = ""; }} />
                    </label>
                  </div>
                </Section>
              )}

              {isAdmin && isEdit && (
                <Section title="Análise administrativa">
                  <Field label="Parecer"><Textarea rows={3} value={form.review_notes ?? ""} onChange={(e) => set("review_notes", e.target.value)} /></Field>
                  <p className="mt-2 text-xs text-muted-foreground">Salve o parecer antes de aprovar ou reprovar a captação.</p>
                </Section>
              )}
            </div>
            <DialogFooter className="mt-4 flex-wrap">
              {isAdmin && isEdit && <Button variant="outline" onClick={() => review("rejected")}><XCircle className="mr-1.5 h-4 w-4" />Reprovar</Button>}
              {isAdmin && isEdit && <Button variant="outline" onClick={() => review("approved")}><CheckCircle2 className="mr-1.5 h-4 w-4" />Aprovar</Button>}
              <Button onClick={save}>{isEdit ? "Salvar alterações" : "Salvar captação"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <div className="p-4 md:p-8">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Imóvel</th><th className="px-4 py-3">Proprietário</th><th className="px-4 py-3">Localização</th><th className="px-4 py-3">Fotos</th><th className="px-4 py-3">Cadastro</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {inspections.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Nenhuma vistoria cadastrada.</td></tr>}
              {inspections.map((inspection: any) => (
                <tr key={inspection.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{inspection.property_title || TYPE_LABEL[inspection.property_type]}</td>
                  <td className="px-4 py-3">{inspection.owner_name}</td>
                  <td className="px-4 py-3">{[inspection.neighborhood, inspection.city, inspection.state].filter(Boolean).join(" - ") || inspection.property_address}</td>
                  <td className="px-4 py-3">{inspection.inspection_images?.length ?? 0}</td>
                  <td className="px-4 py-3">{formatDateBR(inspection.created_at)}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[inspection.status]}>{STATUS_LABEL[inspection.status]}</Badge></td>
                  <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => openEdit(inspection)} title="Editar"><Pencil className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-md border bg-muted/10 p-4"><h3 className="mb-3 text-sm font-semibold">{title}</h3>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}

function MoneyField({ label, value, onChange }: { label: string; value: string | number | null; onChange: (value: string) => void }) {
  return <Field label={`${label} (R$)`}><Input type="number" step="0.01" value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></Field>;
}
