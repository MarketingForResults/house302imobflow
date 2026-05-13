import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DOCUMENT_KIND_LABEL } from "@/lib/doc-placeholders";
import { FileText, Plus, Settings2 } from "lucide-react";
import { formatDateBR } from "@/lib/format-date";

export const Route = createFileRoute("/_app/documents/")({ component: DocumentsList });

function DocumentsList() {
  const { data: docs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => (await supabase.from("documents").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["document_templates"],
    queryFn: async () => (await supabase.from("document_templates").select("*").order("name")).data ?? [],
  });

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
      <div className="p-8">
        {docs.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Nenhum documento gerado ainda</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Crie um modelo primeiro em <strong>Modelos</strong> e depois gere um documento.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Código</th>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-left">Título</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d: any) => (
                  <tr key={d.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{d.code}</td>
                    <td className="px-4 py-2">{DOCUMENT_KIND_LABEL[d.kind] ?? d.kind}</td>
                    <td className="px-4 py-2">{d.title ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{d.status}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDateBR(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
