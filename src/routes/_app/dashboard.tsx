import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Home, Users, UserCog, CheckCircle2, Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [props, clients, brokers] = await Promise.all([
        supabase.from("properties").select("status", { count: "exact" }),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("brokers").select("id", { count: "exact", head: true }).eq("active", true),
      ]);
      const all = props.data ?? [];
      return {
        total: props.count ?? 0,
        available: all.filter((p) => p.status === "available").length,
        sold: all.filter((p) => p.status === "sold").length,
        negotiation: all.filter((p) => p.status === "negotiation").length,
        clients: clients.count ?? 0,
        brokers: brokers.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "Imóveis", value: data?.total ?? 0, icon: Home, color: "text-foreground" },
    { label: "Disponíveis", value: data?.available ?? 0, icon: CheckCircle2, color: "text-success" },
    { label: "Em negociação", value: data?.negotiation ?? 0, icon: Clock, color: "text-warning" },
    { label: "Vendidos", value: data?.sold ?? 0, icon: XCircle, color: "text-muted-foreground" },
    { label: "Clientes", value: data?.clients ?? 0, icon: Users, color: "text-foreground" },
    { label: "Corretores ativos", value: data?.brokers ?? 0, icon: UserCog, color: "text-foreground" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral da operação" />
      <div className="grid gap-4 p-4 md:p-8 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
