import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/brokers")({ component: BrokersPage });

const EMPTY = { active: true } as any;

function BrokersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const isEdit = !!form.id;

  const { data: brokers = [] } = useQuery({
    queryKey: ["brokers"],
    queryFn: async () => (await supabase.from("brokers").select("*").order("full_name")).data ?? [],
  });

  function openNew() { setForm(EMPTY); setOpen(true); }
  function openEdit(b: any) { setForm({ ...b }); setOpen(true); }

  async function save() {
    if (!form.full_name) return toast.error("Informe o nome");
    if (isEdit) {
      const { id, created_at, updated_at, ...patch } = form;
      if (patch.commission_pct === "") patch.commission_pct = null;
      const { error } = await supabase.from("brokers").update(patch).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Corretor atualizado");
    } else {
      const { error } = await supabase.from("brokers").insert(form);
      if (error) return toast.error(error.message);
      toast.success("Corretor cadastrado");
    }
    setOpen(false); setForm(EMPTY);
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
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(EMPTY); }}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Novo corretor</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{isEdit ? "Editar corretor" : "Novo corretor"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome completo</Label><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CRECI</Label><Input value={form.creci ?? ""} onChange={(e) => setForm({ ...form, creci: e.target.value })} /></div>
                <div><Label>Comissão padrão (%)</Label><Input type="number" step="0.01" value={form.commission_pct ?? ""} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
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
              <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">CRECI</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Comissão</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {brokers.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum corretor.</td></tr>}
              {brokers.map((b: any) => (
                <tr key={b.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{b.full_name}</td>
                  <td className="px-4 py-3">{b.creci ?? "—"}</td>
                  <td className="px-4 py-3">{b.phone ?? "—"}</td>
                  <td className="px-4 py-3">{b.commission_pct ? `${b.commission_pct}%` : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={b.active} onCheckedChange={(v) => toggleActive(b.id, v)} />
                      <Badge variant={b.active ? "default" : "outline"}>{b.active ? "Ativo" : "Inativo"}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(b)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(b.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
