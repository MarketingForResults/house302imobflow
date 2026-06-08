import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Home,
  Users,
  UserCog,
  Plug,
  LogOut,
  FileText,
  KeyRound,
  Settings,
  Menu,
  ClipboardCheck,
  Handshake,
  PanelLeftClose,
  Landmark,
  BadgeDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccessPath, formatRoles, hasAnyRole, ROUTE_ROLES } from "@/lib/permissions";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/logo-house302.png";
import logoIcon from "@/assets/logo-house302-icon.png";

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
  { to: "/settings", label: "Configurações", icon: Settings },
] as const;

const routeRoleMap = new Map(ROUTE_ROLES.map((route) => [route.prefix, route.roles]));
const PORTAL_ROLES = ["owner", "tenant"] as const;

function AppLayout() {
  const { user, loading, signOut, roles } = useAuth();
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
    return <PortalOnlyLayout email={user.email} roles={roles} onSignOut={signOut} />;
  }

  const roleLabel = formatRoles(roles);
  const loginLabel = formatDateTimeBR(loginAt);
  const elapsedLabel = formatElapsed(now.getTime() - loginAt.getTime());
  const doSignOut = () => signOut().then(() => navigate({ to: "/" }));

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
      <div className={cn("border-t", collapsed ? "p-2" : "p-3")}>
        <button
          onClick={doSignOut}
          title={collapsed ? "Sair" : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
            collapsed && "h-10 justify-center px-0",
          )}
        >
          <LogOut className="h-4 w-4" /> {!collapsed && "Sair"}
        </button>
      </div>
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
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-3 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col p-0">
              <SidebarBody mobile />
            </SheetContent>
          </Sheet>
          <img src={logo} alt="House302" className="h-auto max-h-6 max-w-[150px] object-contain" />
        </header>
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
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

function SessionAccount({
  email,
  roleLabel,
  elapsedLabel,
  onSignOut,
  compact = false,
}: {
  email?: string;
  roleLabel: string;
  elapsedLabel: string;
  onSignOut: () => void;
  compact?: boolean;
}) {
  const initials = (email?.[0] ?? "H").toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border bg-card shadow-sm",
        compact ? "px-1.5 py-1" : "py-1.5 pl-3 pr-1.5",
      )}
    >
      {!compact && (
        <div className="min-w-0 text-right text-xs">
          <div className="truncate font-medium">{email}</div>
          <div className="truncate text-muted-foreground">
            {roleLabel} | {elapsedLabel}
          </div>
        </div>
      )}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {initials}
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title="Sair"
        aria-label="Sair"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
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
      </main>
    </div>
  );
}
