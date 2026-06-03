import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Home, Users, UserCog, Plug, LogOut, FileText, KeyRound, Settings, Menu, ClipboardCheck, Handshake, PanelLeftClose, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
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
  { to: "/finance", label: "Financeiro", icon: Landmark },
  { to: "/integration", label: "Integração WP", icon: Plug },
  { to: "/settings", label: "Configurações", icon: Settings },
] as const;

function AppLayout() {
  const { user, loading, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando…</div>;
  }

  const SidebarBody = ({ collapsed = false, mobile = false }: { collapsed?: boolean; mobile?: boolean }) => (
    <>
      <div className={cn("flex h-16 items-center border-b", collapsed ? "justify-center px-2" : "justify-between px-4")}>
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
            <img src={logo} alt="House302" className={cn("h-auto w-auto object-contain", mobile ? "max-h-7 max-w-[180px]" : "max-h-6 max-w-[150px]")} />
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
      <nav className={cn("flex-1 overflow-y-auto", collapsed ? "space-y-2 px-2 py-3" : "space-y-0.5 p-3")}>
        {nav.map((item) => {
          const active = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-xl text-sm font-medium transition",
                collapsed ? "h-10 justify-center px-0" : "gap-2.5 px-3 py-2",
                active ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4", collapsed && "h-[18px] w-[18px]")} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      <div className={cn("border-t", collapsed ? "p-2" : "p-3")}>
        {!collapsed && <div className="mb-2 px-2 text-xs">
          <div className="truncate font-medium">{user.email}</div>
          <div className="text-muted-foreground">{roles.join(", ") || "sem papel"}</div>
        </div>}
        <button
          onClick={() => signOut().then(() => navigate({ to: "/" }))}
          title={collapsed ? "Sair" : undefined}
          className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground", collapsed && "h-10 justify-center px-0")}
        >
          <LogOut className="h-4 w-4" /> {!collapsed && "Sair"}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={cn("hidden flex-col border-r bg-sidebar transition-[width] duration-200 md:flex", sidebarCollapsed ? "w-[4.5rem]" : "w-60")}>
        <SidebarBody collapsed={sidebarCollapsed} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-3 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border" aria-label="Abrir menu">
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
