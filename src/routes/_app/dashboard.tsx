import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Home,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [props, clients, brokers, partnerReviews] = await Promise.all([
        supabase.from("properties").select("status, workflow_status", { count: "exact" }),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("brokers").select("id", { count: "exact", head: true }).eq("active", true),
        supabase
          .from("capture_partners")
          .select("id", { count: "exact", head: true })
          .eq("registration_status", "pending"),
      ]);
      const all = props.data ?? [];
      return {
        total: props.count ?? 0,
        available: all.filter((p) => p.status === "available").length,
        sold: all.filter((p) => p.status === "sold").length,
        negotiation: all.filter((p) => p.status === "negotiation").length,
        clients: clients.count ?? 0,
        brokers: brokers.count ?? 0,
        partnerReviews: partnerReviews.count ?? 0,
        capturePending: all.filter((p) => p.workflow_status === "capture_pending").length,
        registrationReviews: all.filter((p) => p.workflow_status === "awaiting_admin_review")
          .length,
        inspections: all.filter((p) =>
          ["inspection_pending", "inspection_scheduled"].includes(p.workflow_status),
        ).length,
        inspectionReviews: all.filter((p) => p.workflow_status === "awaiting_inspection_review")
          .length,
      };
    },
  });

  const cards = [
    { label: "Imoveis", value: data?.total ?? 0, icon: Home, color: "text-foreground" },
    {
      label: "Disponiveis",
      value: data?.available ?? 0,
      icon: CheckCircle2,
      color: "text-success",
    },
    { label: "Em negociacao", value: data?.negotiation ?? 0, icon: Clock, color: "text-warning" },
    { label: "Vendidos", value: data?.sold ?? 0, icon: XCircle, color: "text-muted-foreground" },
    { label: "Clientes", value: data?.clients ?? 0, icon: Users, color: "text-foreground" },
    {
      label: "Corretores ativos",
      value: data?.brokers ?? 0,
      icon: UserCog,
      color: "text-foreground",
    },
  ];

  const alerts = [
    { label: "Parceiros aguardando analise", value: data?.partnerReviews ?? 0, to: "/partners" },
    {
      label: "Captacoes aguardando atendimento",
      value: data?.capturePending ?? 0,
      to: "/properties",
    },
    {
      label: "Cadastros aguardando aprovacao",
      value: data?.registrationReviews ?? 0,
      to: "/properties",
    },
    {
      label: "Vistorias para agendar ou executar",
      value: data?.inspections ?? 0,
      to: "/inspections",
    },
    {
      label: "Vistorias aguardando aprovacao final",
      value: data?.inspectionReviews ?? 0,
      to: "/inspections",
    },
  ].filter((alert) => alert.value > 0);

  return (
    <div>
      <PageHeader title="Dashboard" description="Visao geral da operacao" />
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.label} className="rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <div className="mt-3 text-3xl font-semibold tabular-nums">{card.value}</div>
            </div>
          ))}
        </div>

        <section className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <BellRing className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Pendencias da operacao</h2>
          </div>
          {alerts.length === 0 ? (
            <div className="px-5 py-8 text-sm text-muted-foreground">
              Nenhuma pendencia no funil de captacao.
            </div>
          ) : (
            <div className="divide-y">
              {alerts.map((alert) => (
                <Link
                  key={alert.label}
                  to={alert.to as any}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    {alert.label}
                  </span>
                  <Badge>{alert.value}</Badge>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
