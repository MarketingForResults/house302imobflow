import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DEFAULT_DOCUMENT_KINDS, DOCUMENT_KIND_LABEL } from "@/lib/doc-placeholders";
import { FileText, Plus, Settings2, Pencil, Trash2 } from "lucide-react";
import { formatDateBR } from "@/lib/format-date";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/documents/")({ component: DocumentsList });

function DocumentsList() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => (await supabase.from("documents").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["document_templates"],
    queryFn: async () => (await supabase.from("document_templates").select("*").order("name")).data ?? [],
  });
  const { data: documentKinds = DEFAULT_DOCUMENT_KINDS } = useQuery({
    queryKey: ["document_kinds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("document_kinds").select("*").eq("active", true).order("sort_order").order("label");
      if (error) return DEFAULT_DOCUMENT_KINDS;
      return data?.length ? data : DEFAULT_DOCUMENT_KINDS;
    },
  });
  const kindLabelById = Object.fromEntries(documentKinds.map((kind: any) => [kind.id, kind.label]));
  const kindLabel = (kind: string) => kindLabelById[kind] ?? DOCUMENT_KIND_LABEL[kind] ?? kind;

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase.from("documents").update({
      title: editing.title, status: editing.status, notes: editing.notes,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Documento atualizado");
  }
  async function remove(id: string) {
    if (!confirm("Excluir este documento?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Documento excluído");
  }

  return (
    <div>
      <PageHeader
        title="Documentos"
        description="Modelos e geração de fichas, contratos e autorizações"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/documents/templates"><Settings2 className="mr-1.5 h-4 w-4" />Modelos ({templates.length})</Link>
            </Button>
            <Button asChild>
              <Link to="/documents/new"><Plus className="mr-1.5 h-4 w-4" />Novo documento</Link>
            </Button>
          </>
        }
      />
      <div className="p-4 md:p-8">
        {docs.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Nenhum documento gerado ainda</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Crie um modelo primeiro em <strong>Modelos</strong> e depois gere um documento.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Código</th>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-left">Título</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Criado em</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d: any) => (
                  <tr key={d.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{d.code}</td>
                    <td className="px-4 py-2">{kindLabel(d.kind)}</td>
                    <td className="px-4 py-2">{d.title ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{d.status}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDateBR(d.created_at)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ ...d })} title="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(d.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar documento {editing?.code}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="issued">Emitido</SelectItem>
                    <SelectItem value="signed">Assinado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Observações</Label><Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
