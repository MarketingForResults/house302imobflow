import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clients")({ component: ClientsPage });

const INTEREST_LABEL: Record<string, string> = { buy: "Compra", sell: "Venda", rent: "Aluguel", buy_rent: "Compra/Aluguel" };
const EMPTY = { interest_type: "buy" } as any;

function ClientsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const isEdit = !!form.id;

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  function openNew() { setForm(EMPTY); setOpen(true); }
  function openEdit(c: any) { setForm({ ...c }); setOpen(true); }

  async function save() {
    if (!form.full_name) return toast.error("Informe o nome");
    if (isEdit) {
      const { id, created_at, updated_at, ...patch } = form;
      const { error } = await supabase.from("clients").update(patch).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Cliente atualizado");
    } else {
      const { error } = await supabase.from("clients").insert(form);
      if (error) return toast.error(error.message);
      toast.success("Cliente cadastrado");
    }
    setOpen(false); setForm(EMPTY);
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
      <PageHeader title="Clientes" description="Leads e clientes ativos" actions={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(EMPTY); }}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Novo cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{isEdit ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome completo</Label><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CPF</Label><Input value={form.cpf ?? ""} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div>
                <Label>Interesse</Label>
                <Select value={form.interest_type ?? "buy"} onValueChange={(v) => setForm({ ...form, interest_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INTEREST_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
      } />
      <div className="p-4 md:p-8">
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Interesse</th><th className="px-4 py-3 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {clients.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Nenhum cliente.</td></tr>}
              {clients.map((c: any) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{c.full_name}</td>
                  <td className="px-4 py-3">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3">{c.email ?? "—"}</td>
                  <td className="px-4 py-3">{INTEREST_LABEL[c.interest_type] ?? "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
