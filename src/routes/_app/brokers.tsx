import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { composeAddress, lookupCepAddress, maskCep, maskCnh, maskCpf, maskPhone, maskRg } from "@/lib/form-utils";

export const Route = createFileRoute("/_app/brokers")({ component: BrokersPage });

const EMPTY = { active: true, registration_status: "regular" } as any;

function BrokersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [searchingCep, setSearchingCep] = useState(false);
  const isEdit = !!form.id;

  const { data: brokers = [] } = useQuery({
    queryKey: ["brokers"],
    queryFn: async () => (await supabase.from("brokers").select("*").order("full_name")).data ?? [],
  });

  function set(field: string, value: any) {
    setForm((current: any) => ({ ...current, [field]: value }));
  }

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(broker: any) {
    setForm({ ...broker, registration_status: broker.registration_status ?? (broker.creci ? "regular" : "irregular") });
    setOpen(true);
  }

  async function lookupCep() {
    setSearchingCep(true);
    try {
      const address = await lookupCepAddress(form.zip_code ?? "");
      setForm((current: any) => {
        const next = { ...current, ...address };
        return { ...next, address: composeAddress(next) };
      });
      toast.success("Endereco preenchido pelo CEP");
    } catch (error: any) {
      toast.error(error.message ?? "Nao foi possivel buscar o CEP");
    } finally {
      setSearchingCep(false);
    }
  }

  async function save() {
    if (!form.full_name) return toast.error("Informe o nome");
    if (form.registration_status === "regular" && !form.creci?.trim()) return toast.error("Informe o numero do registro CRECI");
    const normalizedForm = {
      ...form,
      address: composeAddress(form),
      creci: form.registration_status === "irregular" ? null : form.creci,
      commission_pct: form.commission_pct === "" ? null : form.commission_pct,
    };

    if (isEdit) {
      const { id, created_at, updated_at, ...patch } = normalizedForm;
      const { error } = await supabase.from("brokers").update(patch).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Corretor atualizado");
    } else {
      const { error } = await supabase.from("brokers").insert(normalizedForm);
      if (error) return toast.error(error.message);
      toast.success("Corretor cadastrado");
    }
    setOpen(false);
    setForm(EMPTY);
    qc.invalidateQueries({ queryKey: ["brokers"] });
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from("brokers").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["brokers"] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir corretor?")) return;
    const { error } = await supabase.from("brokers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["brokers"] });
  }

  return (
    <div>
      <PageHeader title="Corretores" description="Parceiros e captadores" actions={
        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setForm(EMPTY); }}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Novo corretor</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader><DialogTitle>{isEdit ? "Editar corretor" : "Novo corretor"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome completo</Label><Input autoComplete="name" value={form.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CPF</Label><Input value={form.cpf ?? ""} onChange={(e) => set("cpf", maskCpf(e.target.value))} /></div>
                <div><Label>Telefone</Label><Input autoComplete="tel" value={form.phone ?? ""} onChange={(e) => set("phone", maskPhone(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>RG</Label><Input value={form.rg ?? ""} onChange={(e) => set("rg", maskRg(e.target.value))} /></div>
                <div><Label>CNH</Label><Input inputMode="numeric" value={form.cnh ?? ""} onChange={(e) => set("cnh", maskCnh(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Situacao do registro profissional</Label>
                  <Select value={form.registration_status ?? "regular"} onValueChange={(value) => setForm({ ...form, registration_status: value, creci: value === "irregular" ? null : form.creci })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Corretor regular com registro profissional</SelectItem>
                      <SelectItem value="irregular">Corretor sem registro profissional (Autonomo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Comissao padrao (%)</Label><Input type="number" step="0.01" value={form.commission_pct ?? ""} onChange={(e) => set("commission_pct", e.target.value)} /></div>
              </div>
              {form.registration_status !== "irregular" && (
                <div><Label>Numero do registro CRECI</Label><Input value={form.creci ?? ""} onChange={(e) => set("creci", e.target.value.toUpperCase())} /></div>
              )}
              <div><Label>Email</Label><Input type="email" autoComplete="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>

              <AddressFields form={form} set={set} searchingCep={searchingCep} lookupCep={lookupCep} />

              <div><Label>Data de nascimento</Label><Input type="date" value={form.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value || null)} /></div>
            </div>
            <DialogFooter>
              {isEdit && <Button variant="ghost" onClick={() => { setOpen(false); setForm(EMPTY); }}>Cancelar</Button>}
              <Button onClick={save}>{isEdit ? "Atualizar" : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-4 md:p-8">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">CRECI</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Comissao</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Acoes</th></tr>
            </thead>
            <tbody>
              {brokers.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum corretor.</td></tr>}
              {brokers.map((broker: any) => (
                <tr key={broker.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{broker.full_name}</td>
                  <td className="px-4 py-3">{broker.registration_status === "irregular" ? "Autonomo sem registro" : (broker.creci ?? "-")}</td>
                  <td className="px-4 py-3">{broker.phone ?? "-"}</td>
                  <td className="px-4 py-3">{broker.commission_pct ? `${broker.commission_pct}%` : "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={broker.active} onCheckedChange={(value) => toggleActive(broker.id, value)} />
                      <Badge variant={broker.active ? "default" : "outline"}>{broker.active ? "Ativo" : "Inativo"}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(broker)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(broker.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AddressFields({ form, set, searchingCep, lookupCep }: { form: any; set: (field: string, value: any) => void; searchingCep: boolean; lookupCep: () => void }) {
  return (
    <section className="rounded-md border bg-muted/10 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium"><MapPin className="h-4 w-4 text-primary" />Endereco com busca por CEP</div>
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <div>
          <Label>CEP</Label>
          <div className="flex gap-2">
            <Input autoComplete="postal-code" placeholder="00000-000" value={form.zip_code ?? ""} onChange={(e) => set("zip_code", maskCep(e.target.value))} onBlur={() => { if (String(form.zip_code ?? "").replace(/\D/g, "").length === 8) lookupCep(); }} />
            <Button type="button" variant="outline" onClick={lookupCep} disabled={searchingCep}>{searchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}</Button>
          </div>
        </div>
        <div><Label>Rua / Logradouro</Label><Input autoComplete="address-line1" value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} /></div>
        <div><Label>Numero</Label><Input autoComplete="address-line2" value={form.number ?? ""} onChange={(e) => set("number", e.target.value)} /></div>
        <div><Label>Complemento</Label><Input value={form.complement ?? ""} onChange={(e) => set("complement", e.target.value)} /></div>
        <div><Label>Bairro</Label><Input value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} /></div>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <div><Label>Cidade</Label><Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></div>
          <div><Label>UF</Label><Input maxLength={2} value={form.state ?? ""} onChange={(e) => set("state", e.target.value.toUpperCase())} /></div>
        </div>
      </div>
      <div className="mt-3"><Label>Endereco completo</Label><Input value={form.address ?? composeAddress(form)} onChange={(e) => set("address", e.target.value)} /></div>
    </section>
  );
}
