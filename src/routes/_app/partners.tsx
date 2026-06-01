import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ExternalLink, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/partners")({ component: PartnersPage });

const EMPTY = {
  full_name: "",
  cpf_cnpj: "",
  phone: "",
  email: "",
  address: "",
  pix_key: "",
  notes: "",
  active: false,
  registration_status: "pending",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Reprovado",
};

function PartnersPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [editing, setEditing] = useState<any | null>(null);

  const { data: partners = [] } = useQuery({
    queryKey: ["capture-partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("capture_partners").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["capture-partners"] });
  }

  async function save() {
    if (!editing.full_name?.trim()) return toast.error("Informe o nome do parceiro");
    const payload = { ...editing };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    const query = editing.id
      ? supabase.from("capture_partners").update(payload).eq("id", editing.id)
      : supabase.from("capture_partners").insert(payload);
    const { error } = await query;
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Parceiro atualizado" : "Parceiro cadastrado");
    setEditing(null);
    refresh();
  }

  async function review(id: string, registration_status: "approved" | "rejected") {
    const { error } = await supabase
      .from("capture_partners")
      .update({ registration_status, active: registration_status === "approved" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(registration_status === "approved" ? "Parceiro aprovado" : "Parceiro reprovado");
    refresh();
  }

  async function remove(partner: any) {
    if (!confirm(`Excluir o parceiro ${partner.full_name}?`)) return;
    const { error } = await supabase.from("capture_partners").delete().eq("id", partner.id);
    if (error) return toast.error(error.message);
    toast.success("Parceiro excluido");
    refresh();
  }

  return (
    <div>
      <PageHeader
        title="Parceiros"
        description="Indicadores de oportunidades de venda e aluguel"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/partner-registration" target="_blank">
                <ExternalLink className="mr-1.5 h-4 w-4" />Formulario publico
              </Link>
            </Button>
            <Button onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="mr-1.5 h-4 w-4" />Novo parceiro
            </Button>
          </div>
        }
      />
      <div className="p-4 md:p-8">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Parceiro</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">CPF / CNPJ</th>
                <th className="px-4 py-3">Analise</th>
                <th className="px-4 py-3">Ativo</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum parceiro cadastrado.</td></tr>
              )}
              {partners.map((partner: any) => (
                <tr key={partner.id} className="border-t">
                  <td className="px-4 py-3"><div className="font-medium">{partner.full_name}</div><div className="text-xs text-muted-foreground">{partner.email || "Sem e-mail"}</div></td>
                  <td className="px-4 py-3">{partner.phone || "-"}</td>
                  <td className="px-4 py-3">{partner.cpf_cnpj || "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={partner.registration_status === "rejected" ? "destructive" : partner.registration_status === "approved" ? "default" : "secondary"}>
                      {STATUS_LABEL[partner.registration_status] ?? partner.registration_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{partner.active ? "Sim" : "Nao"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {isAdmin && partner.registration_status !== "approved" && <Button variant="ghost" size="icon" title="Aprovar" onClick={() => review(partner.id, "approved")}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>}
                      {isAdmin && partner.registration_status !== "rejected" && <Button variant="ghost" size="icon" title="Reprovar" onClick={() => review(partner.id, "rejected")}><XCircle className="h-4 w-4 text-destructive" /></Button>}
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(partner)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Excluir" onClick={() => remove(partner)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(value) => { if (!value) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar parceiro" : "Novo parceiro"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo *"><Input value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} /></Field>
              <Field label="CPF ou CNPJ"><Input value={editing.cpf_cnpj ?? ""} onChange={(e) => setEditing({ ...editing, cpf_cnpj: e.target.value })} /></Field>
              <Field label="Telefone / WhatsApp"><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
              <Field label="E-mail"><Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label="Endereco"><Input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Chave Pix"><Input value={editing.pix_key ?? ""} onChange={(e) => setEditing({ ...editing, pix_key: e.target.value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Observacoes"><Textarea rows={3} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field></div>
              {isAdmin && editing.registration_status === "approved" && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch checked={editing.active} onCheckedChange={(active) => setEditing({ ...editing, active })} />
                  <Label>Parceiro ativo para novas indicacoes</Label>
                </div>
              )}
            </div>
          )}
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
