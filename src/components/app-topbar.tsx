import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, LifeBuoy, LogOut, Settings as SettingsIcon, User, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { formatRoles } from "@/lib/permissions";

export function AppTopbar({ onOpenMobileMenu }: { onOpenMobileMenu?: () => void }) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: alerts = [] } = useQuery({
    queryKey: ["topbar-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("properties")
        .select("workflow_status");
      const all = data ?? [];
      const items: { label: string; value: number; to: string }[] = [
        {
          label: "Vistorias para agendar ou executar",
          value: all.filter((p: any) =>
            ["inspection_pending", "inspection_scheduled"].includes(p.workflow_status),
          ).length,
          to: "/inspections",
        },
        {
          label: "Cadastros aguardando aprovacao",
          value: all.filter((p: any) => p.workflow_status === "awaiting_admin_review").length,
          to: "/properties",
        },
        {
          label: "Captacoes aguardando atendimento",
          value: all.filter((p: any) => p.workflow_status === "capture_pending").length,
          to: "/properties",
        },
      ];
      return items.filter((i) => i.value > 0);
    },
    refetchInterval: 60_000,
  });

  const totalAlerts = alerts.reduce((sum, item) => sum + item.value, 0);
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const doSignOut = () => signOut().then(() => navigate({ to: "/" }));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background px-3 md:px-6">
      <div className="flex items-center gap-2">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Notificacoes"
              title="Notificacoes"
            >
              <Bell className="h-4 w-4" />
              {totalAlerts > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {totalAlerts}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <div className="border-b px-3 py-2 text-sm font-semibold">Pendencias da operacao</div>
            {alerts.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhuma pendencia no momento.
              </div>
            ) : (
              <div className="divide-y">
                {alerts.map((alert) => (
                  <Link
                    key={alert.label}
                    to={alert.to as any}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/60"
                  >
                    <span className="truncate">{alert.label}</span>
                    <Badge>{alert.value}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border px-2 py-1 pr-3 transition hover:bg-muted"
            title="Menu da conta"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </span>
            <span className="hidden text-xs text-muted-foreground md:inline">
              {user?.email ?? ""}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{user?.email}</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {formatRoles(roles)}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
            <User className="mr-2 h-4 w-4" /> Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
            <SettingsIcon className="mr-2 h-4 w-4" /> Configuracoes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/support" })}>
            <LifeBuoy className="mr-2 h-4 w-4" /> Suporte
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={doSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
