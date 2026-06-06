/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase types are regenerated after the new portal_access_links migration is applied. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, MailPlus, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { invitePortalAccess, revokePortalAccess } from "@/lib/access-management.functions";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AccessRole = "owner" | "tenant" | "broker";

interface PortalAccessManagerProps {
  entity: "client" | "broker";
  entityId: string;
  email?: string | null;
  fullName?: string | null;
  roles: AccessRole[];
}

const ROLE_LABEL: Record<AccessRole, string> = {
  owner: "Proprietario",
  tenant: "Inquilino",
  broker: "Corretor",
};
const db = supabase as any;

interface ManualInvite {
  role: AccessRole;
  actionLink: string;
  emailSent: boolean;
  emailError?: string | null;
}

export function PortalAccessManager({
  entity,
  entityId,
  email,
  fullName,
  roles,
}: PortalAccessManagerProps) {
  const qc = useQueryClient();
  const inviteAccess = useServerFn(invitePortalAccess);
  const revokeAccess = useServerFn(revokePortalAccess);
  const queryKey = ["portal_access_links", entity, entityId];
  const [manualInvite, setManualInvite] = useState<ManualInvite | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const query = db
        .from("portal_access_links")
        .select("*")
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      const { data, error } =
        entity === "client"
          ? await query.eq("client_id", entityId)
          : await query.eq("broker_id", entityId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!entityId,
  });

  async function invite(role: AccessRole) {
    if (!email?.trim()) {
      toast.error("Cadastre um e-mail antes de gerar o acesso");
      return;
    }

    try {
      const result = (await inviteAccess({
        data: {
          email,
          fullName,
          role,
          clientId: entity === "client" ? entityId : null,
          brokerId: entity === "broker" ? entityId : null,
        },
      })) as ManualInvite | null;

      if (result?.actionLink) {
        setManualInvite({ ...result, role });
        navigator.clipboard
          ?.writeText(result.actionLink)
          .then(() => toast.success("Link de acesso gerado e copiado"))
          .catch(() => toast.success("Link de acesso gerado"));
      } else {
        setManualInvite(null);
        toast.success(`Convite de ${ROLE_LABEL[role].toLowerCase()} enviado`);
      }

      if (result && !result.emailSent) {
        toast.warning(result.emailError ?? "O e-mail nao foi enviado; use o link manual");
      }

      qc.invalidateQueries({ queryKey });
    } catch (error: any) {
      toast.error(error.message ?? "Nao foi possivel gerar o acesso");
    }
  }

  async function copyManualLink() {
    if (!manualInvite?.actionLink) return;
    try {
      await navigator.clipboard.writeText(manualInvite.actionLink);
      toast.success("Link copiado");
    } catch {
      toast.error("Nao foi possivel copiar o link");
    }
  }

  async function revoke(accessId: string) {
    if (!confirm("Revogar este acesso?")) return;
    try {
      await revokeAccess({ data: { accessId } });
      toast.success("Acesso revogado");
      qc.invalidateQueries({ queryKey });
    } catch (error: any) {
      toast.error(error.message ?? "Nao foi possivel revogar o acesso");
    }
  }

  const linkedRoles = new Set(links.map((link: any) => link.role));

  return (
    <div className="rounded-md border bg-muted/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <KeyRound className="h-4 w-4 text-primary" />
        Acesso ao sistema e app
      </div>
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => {
          const link = links.find((item: any) => item.role === role);
          if (link) {
            return (
              <div
                key={role}
                className="inline-flex items-center gap-2 rounded-md border bg-card px-2 py-1"
              >
                <Badge variant={link.user_id ? "default" : "outline"}>
                  {ROLE_LABEL[role]} {link.user_id ? "ativo" : "convidado"}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => revoke(link.id)}
                  title="Revogar acesso"
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          }

          return (
            <Button
              key={role}
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading || linkedRoles.has(role)}
              onClick={() => invite(role)}
            >
              <MailPlus className="mr-1.5 h-4 w-4" />
              Gerar acesso {ROLE_LABEL[role].toLowerCase()}
            </Button>
          );
        })}
      </div>
      {manualInvite?.actionLink && (
        <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
          <div className="mb-2 font-medium text-foreground">
            Link manual de {ROLE_LABEL[manualInvite.role].toLowerCase()}
          </div>
          <div className="flex gap-2">
            <Input readOnly value={manualInvite.actionLink} className="h-8 text-xs" />
            <Button type="button" variant="outline" size="sm" onClick={copyManualLink}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copiar
            </Button>
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        O convite e enviado para o e-mail cadastrado. O administrador pode revogar o acesso a
        qualquer momento.
      </p>
    </div>
  );
}
