import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { composeAddress, lookupCepAddress, maskCep, maskCnh, maskCpf, maskPhone, maskRg } from "@/lib/form-utils";

export const Route = createFileRoute("/_app/clients")({ component: ClientsPage });

const INTEREST_LABEL: Record<string, string> = {
  buy: "Compra",
  sell: "Venda",
  rent: "Aluguel",
  buy_rent: "Compra/Aluguel",
};
const EMPTY = { interest_type: "buy" } as any;

function ClientsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [searchingCep, setSearchingCep] = useState(false);
  const isEdit = !!form.id;

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  function set(field: string, value: any) {
    setForm((current: any) => ({ ...current, [field]: value }));
  }

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(client: any) {
    setForm({ ...client });
    setOpen(true);
  }

  async function lookupCep() {
    const cep = String(form.zip_code ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return toast.error("Informe um CEP com 8 digitos");

    setSearchingCep(true);
    try {
      const address = await lookupCepAddress(cep);
      setForm((current: any) => {
        const next = {
          ...current,
          ...address,
        };
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
    const payloadBase = { ...form, address: composeAddress(form) };

    if (isEdit) {
      const { id, created_at, updated_at, ...patch } = payloadBase;
      const { error } = await supabase.from("clients").update(patch).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Cliente atualizado");
    } else {
      const { error } = await supabase.from("clients").insert(payloadBase);
      if (error) return toast.error(error.message);
      toast.success("Cliente cadastrado");
    }

    setOpen(false);
    setForm(EMPTY);
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir cliente?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Leads e clientes ativos"
        actions={
          <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setForm(EMPTY); }}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Novo cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
              <DialogHeader><DialogTitle>{isEdit ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome completo</Label><Input autoComplete="name" value={form.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>CPF</Label><Input autoComplete="off" value={form.cpf ?? ""} onChange={(e) => set("cpf", maskCpf(e.target.value))} /></div>
                  <div><Label>Telefone</Label><Input autoComplete="tel" value={form.phone ?? ""} onChange={(e) => set("phone", maskPhone(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>RG</Label><Input autoComplete="off" value={form.rg ?? ""} onChange={(e) => set("rg", maskRg(e.target.value))} /></div>
                  <div><Label>CNH</Label><Input autoComplete="off" inputMode="numeric" value={form.cnh ?? ""} onChange={(e) => set("cnh", maskCnh(e.target.value))} /></div>
                </div>
                <div><Label>Email</Label><Input autoComplete="email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>

                <section className="rounded-md border bg-muted/10 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-medium"><MapPin className="h-4 w-4 text-primary" />Endereco com busca por CEP</div>
                  <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                    <div>
                      <Label>CEP</Label>
                      <div className="flex gap-2">
                        <Input
                          autoComplete="postal-code"
                          inputMode="numeric"
                          placeholder="00000-000"
                          value={form.zip_code ?? ""}
                          onBlur={() => { if (String(form.zip_code ?? "").replace(/\D/g, "").length === 8) lookupCep(); }}
                          onChange={(e) => set("zip_code", maskCep(e.target.value))}
                        />
                        <Button type="button" variant="outline" onClick={lookupCep} disabled={searchingCep}>
                          {searchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                        </Button>
                      </div>
                    </div>
                    <div><Label>Rua / Logradouro</Label><Input autoComplete="address-line1" value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} /></div>
                    <div><Label>Numero</Label><Input autoComplete="address-line2" value={form.number ?? ""} onChange={(e) => set("number", e.target.value)} /></div>
                    <div><Label>Complemento</Label><Input value={form.complement ?? ""} onChange={(e) => set("complement", e.target.value)} /></div>
                    <div><Label>Bairro</Label><Input value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} /></div>
                    <div className="grid grid-cols-[1fr_90px] gap-3">
                      <div><Label>Cidade</Label><Input autoComplete="address-level2" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></div>
                      <div><Label>UF</Label><Input autoComplete="address-level1" maxLength={2} value={form.state ?? ""} onChange={(e) => set("state", e.target.value.toUpperCase())} /></div>
                    </div>
                  </div>
                  <div className="mt-3"><Label>Endereco completo</Label><Input value={form.address ?? composeAddress(form)} onChange={(e) => set("address", e.target.value)} /></div>
                </section>

                <div><Label>Data de nascimento</Label><Input type="date" value={form.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value || null)} /></div>
                <div>
                  <Label>Interesse</Label>
                  <Select value={form.interest_type ?? "buy"} onValueChange={(value) => set("interest_type", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INTEREST_LABEL).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                {isEdit && <Button variant="ghost" onClick={() => { setOpen(false); setForm(EMPTY); }}>Cancelar</Button>}
                <Button onClick={save}>{isEdit ? "Atualizar" : "Salvar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-4 md:p-8">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Interesse</th><th className="px-4 py-3 text-right">Acoes</th></tr>
            </thead>
            <tbody>
              {clients.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Nenhum cliente.</td></tr>}
              {clients.map((client: any) => (
                <tr key={client.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{client.full_name}</td>
                  <td className="px-4 py-3">{client.phone ?? "-"}</td>
                  <td className="px-4 py-3">{client.email ?? "-"}</td>
                  <td className="px-4 py-3">{INTEREST_LABEL[client.interest_type] ?? "-"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(client)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(client.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
