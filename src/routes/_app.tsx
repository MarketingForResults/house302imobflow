import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Home,
  Users,
  UserCog,
  Plug,
  LogOut,
  FileText,
  KeyRound,
  Menu,
  ClipboardCheck,
  Handshake,
  PanelLeftClose,
  Landmark,
  BadgeDollarSign,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccessPath, formatRoles, hasAnyRole, ROUTE_ROLES } from "@/lib/permissions";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/logo-house302.png";
import logoIcon from "@/assets/logo-house302-icon.png";
import { AppTopbar } from "@/components/app-topbar";
import { ForcePasswordChange } from "@/components/force-password-change";
import { generateDocumentPdf } from "@/lib/pdf-utils";
import { richTextToPlainText } from "@/lib/doc-placeholders";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/properties", label: "Imóveis", icon: Home },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/brokers", label: "Corretores", icon: UserCog },
  { to: "/partners", label: "Parceiros", icon: Handshake },
  { to: "/inspections", label: "Vistorias", icon: ClipboardCheck },
  { to: "/documents", label: "Documentos", icon: FileText },
  { to: "/rentals", label: "Aluguéis", icon: KeyRound },
  { to: "/sales", label: "Vendas", icon: BadgeDollarSign },
  { to: "/finance", label: "Financeiro", icon: Landmark },
  { to: "/integration", label: "Integração WP", icon: Plug },
  { to: "/users", label: "Usuários", icon: UsersRound },
] as const;

const routeRoleMap = new Map(ROUTE_ROLES.map((route) => [route.prefix, route.roles]));
const PORTAL_ROLES = ["owner", "tenant"] as const;

function AppLayout() {
  const { user, loading, signOut, roles, mustChangePassword, refreshPasswordState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loginAt] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const canUseBackoffice = hasAnyRole(roles, ["admin", "manager", "financial", "broker"]);
  const portalOnly = !canUseBackoffice && hasAnyRole(roles, PORTAL_ROLES);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && !portalOnly && !canAccessPath(location.pathname, roles)) {
      navigate({ to: "/dashboard" });
    }
  }, [location.pathname, loading, navigate, portalOnly, roles, user]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (portalOnly) {
    return (
      <>
        <PortalOnlyLayout email={user.email} roles={roles} onSignOut={signOut} />
        {mustChangePassword && (
          <ForcePasswordChange
            userId={user.id}
            email={user.email}
            onDone={() => void refreshPasswordState()}
          />
        )}
      </>
    );
  }

  const roleLabel = formatRoles(roles);
  const loginLabel = formatDateTimeBR(loginAt);
  const elapsedLabel = formatElapsed(now.getTime() - loginAt.getTime());

  const SidebarBody = ({
    collapsed = false,
    mobile = false,
  }: {
    collapsed?: boolean;
    mobile?: boolean;
  }) => (
    <>
      <div
        className={cn(
          "flex h-16 items-center border-b",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="group flex h-11 w-11 items-center justify-center rounded-2xl bg-primary p-0.5 shadow-sm ring-1 ring-primary/15 transition hover:scale-[1.03] hover:shadow-md"
            title="Expandir menu"
          >
            <img src={logoIcon} alt="House302" className="h-full w-full rounded-xl object-cover" />
          </button>
        ) : (
          <>
            <img
              src={logo}
              alt="House302"
              className={cn(
                "h-auto w-auto object-contain",
                mobile ? "max-h-7 max-w-[180px]" : "max-h-6 max-w-[150px]",
              )}
            />
            {!mobile && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title="Recolher menu"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
      {!collapsed && !mobile && (
        <div className="border-b px-4 py-2 text-[11px] leading-5 text-muted-foreground">
          <div className="truncate">
            Nivel: <span className="font-medium text-foreground">{roleLabel}</span>
          </div>
          <div className="truncate">Login: {loginLabel}</div>
          <div className="truncate">Sessao: {elapsedLabel}</div>
        </div>
      )}
      <nav
        className={cn(
          "flex-1 overflow-y-auto",
          collapsed ? "space-y-2 px-2 py-3" : "space-y-0.5 p-3",
        )}
      >
        {nav
          .filter((item) => {
            const allowedRoles = routeRoleMap.get(item.to);
            return !allowedRoles || hasAnyRole(roles, allowedRoles);
          })
          .map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-xl text-sm font-medium transition",
                  collapsed ? "h-10 justify-center px-0" : "gap-2.5 px-3 py-2",
                  active
                    ? "bg-secondary text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className={cn("h-4 w-4", collapsed && "h-[18px] w-[18px]")} />
                {!collapsed && item.label}
              </Link>
            );
          })}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "hidden flex-col border-r bg-sidebar transition-[width] duration-200 md:flex",
          sidebarCollapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        <SidebarBody collapsed={sidebarCollapsed} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar onOpenMobileMenu={() => setMobileOpen(true)} />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <span className="hidden" />
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col p-0">
            <SidebarBody mobile />
          </SheetContent>
        </Sheet>
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      {mustChangePassword && (
        <ForcePasswordChange
          userId={user.id}
          email={user.email}
          onDone={() => void refreshPasswordState()}
        />
      )}
    </div>
  );
}

function formatDateTimeBR(value: Date) {
  return value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((item) => String(item).padStart(2, "0")).join(":");
}

function PortalOnlyLayout({
  email,
  roles,
  onSignOut,
}: {
  email?: string;
  roles: string[];
  onSignOut: () => Promise<void>;
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b px-4 md:px-8">
        <img src={logo} alt="House302" className="h-auto max-h-7 max-w-[170px] object-contain" />
        <button
          onClick={() => onSignOut().then(() => navigate({ to: "/" }))}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-4 p-4 md:p-8">
        <section className="rounded-md border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Portal House302
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Acesso criado com sucesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu perfil esta vinculado ao atendimento da House302. As areas de documentos,
            pagamentos, vistorias, chamados e formularios ficarao disponiveis conforme os processos
            forem liberados pelo administrador.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border px-2 py-1">{email}</span>
            <span className="rounded-md border px-2 py-1">{roles.join(", ")}</span>
          </div>
        </section>
        <PortalContractsArea />
      </main>
    </div>
  );
}

function PortalContractsArea() {
  const { user, roles } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["portal-contracts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: access } = await (supabase as any)
        .from("portal_access_links")
        .select("client_id, broker_id")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      const clientId = access?.client_id;
      if (!clientId) return { contracts: [], paymentsByContract: {}, documentsByContract: {} };

      const { data: contracts = [] } = await (supabase as any)
        .from("rental_contracts")
        .select(
          "*, properties(code, title), tenant:clients!rental_contracts_tenant_client_id_fkey(full_name), landlord:clients!rental_contracts_landlord_client_id_fkey(full_name)",
        )
        .or(`tenant_client_id.eq.${clientId},landlord_client_id.eq.${clientId}`)
        .order("created_at", { ascending: false });

      const contractIds = contracts.map((contract: any) => contract.id);
      if (contractIds.length === 0)
        return { contracts, paymentsByContract: {}, documentsByContract: {} };

      const [{ data: payments = [] }, { data: documents = [] }] = await Promise.all([
        (supabase as any)
          .from("rental_payments")
          .select("*")
          .in("contract_id", contractIds)
          .order("due_date", { ascending: true }),
        (supabase as any)
          .from("documents")
          .select("*")
          .in("rental_contract_id", contractIds)
          .order("created_at", { ascending: false }),
      ]);

      return {
        contracts,
        paymentsByContract: payments.reduce((map: Record<string, any[]>, payment: any) => {
          (map[payment.contract_id] ??= []).push(payment);
          return map;
        }, {}),
        documentsByContract: documents.reduce((map: Record<string, any[]>, document: any) => {
          (map[document.rental_contract_id] ??= []).push(document);
          return map;
        }, {}),
      };
    },
  });

  async function downloadDocument(document: any, contract: any) {
    const pdf = await generateDocumentPdf({
      code: document.code,
      locator: contract.properties?.code ?? contract.code,
      title: document.title ?? document.code,
      bodyHtml: document.body_rendered ?? "",
      bodyText: richTextToPlainText(document.body_rendered ?? ""),
    });
    pdf.save(`${document.code}.pdf`);
  }

  const roleLabel = roles.includes("owner")
    ? "proprietario"
    : roles.includes("tenant")
      ? "inquilino"
      : "usuario";

  return (
    <section className="rounded-md border bg-card p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Contratos e documentos
          </div>
          <h2 className="text-lg font-semibold">Area do {roleLabel}</h2>
        </div>
        <a
          className="text-sm text-primary hover:underline"
          href="mailto:house302imob@gmail.com?subject=Solicitacao%20de%20correcao%20de%20documento"
        >
          Solicitar correcao
        </a>
      </div>
      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando contratos vinculados...</p>
      ) : !data?.contracts.length ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum contrato vinculado ao seu acesso ainda.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {data.contracts.map((contract: any) => {
            const payments = data.paymentsByContract[contract.id] ?? [];
            const documents = data.documentsByContract[contract.id] ?? [];
            return (
              <article key={contract.id} className="rounded-md border p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold">{contract.code}</h3>
                    <p className="text-sm text-muted-foreground">
                      {contract.properties?.code} - {contract.properties?.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Locador: {contract.landlord?.full_name ?? "-"} | Locatario:{" "}
                      {contract.tenant?.full_name ?? "-"}
                    </p>
                  </div>
                  <span className="rounded-full border px-2 py-1 text-xs">{contract.status}</span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Mensalidades
                    </h4>
                    <div className="max-h-40 overflow-auto rounded border">
                      {payments.slice(0, 8).map((payment: any) => (
                        <div
                          key={payment.id}
                          className="flex justify-between gap-2 border-b px-2 py-1 text-xs last:border-b-0"
                        >
                          <span>{payment.reference_month}</span>
                          <span>
                            {Number(payment.amount_due ?? 0).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                          <span>{payment.status}</span>
                        </div>
                      ))}
                      {payments.length === 0 && (
                        <div className="px-2 py-2 text-xs text-muted-foreground">
                          Nenhuma mensalidade gerada.
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Documentos gerados
                    </h4>
                    <div className="max-h-40 overflow-auto rounded border">
                      {documents.map((document: any) => (
                        <div
                          key={document.id}
                          className="flex items-center justify-between gap-2 border-b px-2 py-1 text-xs last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {document.title ?? document.code}
                            </div>
                            <div className="text-muted-foreground">
                              {document.code} - {document.status}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded border px-2 py-1 text-[11px] text-primary hover:bg-muted"
                            onClick={() => downloadDocument(document, contract)}
                          >
                            Baixar PDF
                          </button>
                        </div>
                      ))}
                      {documents.length === 0 && (
                        <div className="px-2 py-2 text-xs text-muted-foreground">
                          Nenhum documento vinculado.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
