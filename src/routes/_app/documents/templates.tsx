import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_KIND_LABEL, PLACEHOLDER_GROUPS } from "@/lib/doc-placeholders";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/documents/templates")({ component: TemplatesPage });

function TemplatesPage() {
  const qc = useQueryClient();
  const { data: templates = [], refetch } = useQuery({
    queryKey: ["document_templates"],
    queryFn: async () => (await supabase.from("document_templates").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const [editing, setEditing] = useState<any | null>(null);

  function newTemplate() {
    setEditing({ name: "", kind: "custom", body: "", active: true });
  }

  async function save() {
    if (!editing.name?.trim()) return toast.error("Informe um nome");
    const payload = { ...editing };
    if (payload.id) {
      const { error } = await supabase.from("document_templates").update(payload).eq("id", payload.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("document_templates").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Modelo salvo");
    setEditing(null);
    refetch();
    qc.invalidateQueries({ queryKey: ["document_templates"] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir este modelo?")) return;
    const { error } = await supabase.from("document_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refetch();
  }

  function insertPlaceholder(p: string) {
    setEditing((e: any) => ({ ...e, body: (e.body ?? "") + ` {{${p}}}` }));
  }

  return (
    <div>
      <PageHeader
        title="Modelos de documentos"
        description="Texto padrão para fichas, contratos e autorizações"
        actions={
          <>
            <Button variant="outline" asChild><Link to="/documents"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar</Link></Button>
            <Button onClick={newTemplate}><Plus className="mr-1.5 h-4 w-4" />Novo modelo</Button>
          </>
        }
      />

      <div className="grid gap-6 p-4 md:p-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {editing ? (
            <div className="rounded-lg border bg-card p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block text-xs">Nome</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Tipo</Label>
                  <Select value={editing.kind} onValueChange={(v) => setEditing({ ...editing, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DOCUMENT_KIND_LABEL).map(([k, l]) => (
                        <SelectItem key={k} value={k}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3">
                <Label className="mb-1.5 block text-xs">Corpo (use placeholders <code>{"{{grupo.campo}}"}</code>)</Label>
                <Textarea rows={16} value={editing.body ?? ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="font-mono text-xs" />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={save}>Salvar modelo</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              {templates.length === 0 ? (
                <div className="p-4 md:p-8 text-center text-sm text-muted-foreground">Nenhum modelo criado.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr><th className="px-4 py-2 text-left">Nome</th><th className="px-4 py-2 text-left">Tipo</th><th className="px-4 py-2"></th></tr>
                  </thead>
                  <tbody>
                    {templates.map((t: any) => (
                      <tr key={t.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2">{t.name}</td>
                        <td className="px-4 py-2 text-xs">{DOCUMENT_KIND_LABEL[t.kind] ?? t.kind}</td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>Editar</Button>
                          <Button variant="ghost" size="sm" onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Placeholders disponíveis</h3>
          <p className="mb-3 text-xs text-muted-foreground">Clique para inserir no corpo do modelo em edição.</p>
          {Object.entries(PLACEHOLDER_GROUPS).map(([group, items]) => (
            <div key={group} className="mb-3">
              <div className="mb-1 text-xs font-medium text-muted-foreground">{group}</div>
              <div className="flex flex-wrap gap-1">
                {items.map((p) => (
                  <button
                    key={p}
                    onClick={() => editing && insertPlaceholder(p)}
                    disabled={!editing}
                    className="rounded border bg-muted/40 px-2 py-0.5 font-mono text-[10px] hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                  >
                    {`{{${p}}}`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
