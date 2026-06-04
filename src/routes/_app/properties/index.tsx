import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit3, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/properties/")({ component: PropertiesList });

const STATUS_LABEL: Record<string, string> = {
  available: "Disponível",
  sold: "Vendido",
  reserved: "Reservado",
  negotiation: "Negociação",
  rented: "Alugado",
};
const TYPE_LABEL: Record<string, string> = {
  house: "Casa",
  apartment: "Apartamento",
  land: "Terreno",
  lot: "Lote",
  commercial: "Comercial",
};
const WORKFLOW_LABEL: Record<string, string> = {
  capture_pending: "Captação recebida",
  registration_in_progress: "Cadastro em atendimento",
  awaiting_admin_review: "Aguardando aprovação",
  inspection_pending: "Aguardando vistoria",
  inspection_scheduled: "Vistoria agendada",
  awaiting_inspection_review: "Revisão da vistoria",
  ready_to_publish: "Apto para divulgação",
  rejected: "Reprovado",
};

function PropertiesList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [workflow, setWorkflow] = useState<string>("all");

  const {
    data: properties = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["properties", search, status, type, workflow],
    queryFn: async () => {
      let q = supabase
        .from("properties")
        .select("*, brokers(full_name)")
        .order("created_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status as any);
      if (type !== "all") q = q.eq("type", type as any);
      if (workflow !== "all") q = q.eq("workflow_status", workflow);
      if (search) q = q.or(`code.ilike.%${search}%,title.ilike.%${search}%,city.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Tem certeza que deseja excluir o imóvel ${code}?`)) return;
    try {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
      toast.success(`Imóvel ${code} excluído com sucesso!`);
      refetch();
    } catch (err: any) {
      toast.error(`Erro ao excluir imóvel: ${err.message}`);
    }
  }

  return (
    <div>
      <PageHeader
        title="Imóveis"
        description="Gerencie todo o portfólio"
        actions={
          <Button asChild>
            <Link to="/properties/$id" params={{ id: "new" }}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova captação
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 p-4 md:p-8">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por código, título, cidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={workflow} onValueChange={setWorkflow}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Etapa da captação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {Object.entries(WORKFLOW_LABEL).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Corretor</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && properties.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum imóvel cadastrado.
                  </td>
                </tr>
              )}
              {properties.map((p: any) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link to="/properties/$id" params={{ id: p.id }} className="hover:text-accent">
                      {p.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{TYPE_LABEL[p.type] ?? p.type}</td>
                  <td className="px-4 py-3">{p.title || "—"}</td>
                  <td className="px-4 py-3">{p.city ? `${p.city}/${p.state ?? ""}` : "—"}</td>
                  <td className="px-4 py-3">{p.brokers?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.price
                      ? Number(p.price).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 0,
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{STATUS_LABEL[p.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.workflow_status === "rejected" ? "destructive" : "secondary"}>
                      {WORKFLOW_LABEL[p.workflow_status] ?? "Legado"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8 text-primary"
                        title="Editar"
                      >
                        <Link to="/properties/$id" params={{ id: p.id }}>
                          <Edit3 className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Excluir"
                        onClick={() => handleDelete(p.id, p.code)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
