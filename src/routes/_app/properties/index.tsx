import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/properties/")({ component: PropertiesList });

const STATUS_LABEL: Record<string, string> = {
  available: "Disponível", sold: "Vendido", reserved: "Reservado", negotiation: "Negociação", rented: "Alugado",
};
const TYPE_LABEL: Record<string, string> = {
  house: "Casa", apartment: "Apartamento", land: "Terreno", lot: "Lote", commercial: "Comercial",
};

function PropertiesList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties", search, status, type],
    queryFn: async () => {
      let q = supabase.from("properties").select("*, brokers(full_name)").order("created_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status as any);
      if (type !== "all") q = q.eq("type", type as any);
      if (search) q = q.or(`code.ilike.%${search}%,title.ilike.%${search}%,city.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Imóveis"
        description="Gerencie todo o portfólio"
        actions={
          <Button asChild>
            <Link to="/properties/new"><Plus className="mr-1.5 h-4 w-4" /> Novo imóvel</Link>
          </Button>
        }
      />
      <div className="space-y-4 p-4 md:p-8">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por código, título, cidade…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && properties.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Nenhum imóvel cadastrado.</td></tr>
              )}
              {properties.map((p: any) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link to="/properties/$id" params={{ id: p.id }} className="hover:text-accent">{p.code}</Link>
                  </td>
                  <td className="px-4 py-3">{TYPE_LABEL[p.type] ?? p.type}</td>
                  <td className="px-4 py-3">{p.title || "—"}</td>
                  <td className="px-4 py-3">{p.city ? `${p.city}/${p.state ?? ""}` : "—"}</td>
                  <td className="px-4 py-3">{p.brokers?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.price ? Number(p.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—"}
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline">{STATUS_LABEL[p.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
