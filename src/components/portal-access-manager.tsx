/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase types are regenerated after the new portal_access_links migration is applied. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, MailPlus, MessageCircle, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  generateManualPortalAccessLink,
  invitePortalAccess,
  revokePortalAccess,
} from "@/lib/access-management.functions";
import { translatedErrorMessage } from "@/lib/error-messages";
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
  phone?: string | null;
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
  message?: string;
}

export function PortalAccessManager({
  entity,
  entityId,
  email,
  fullName,
  phone,
  roles,
}: PortalAccessManagerProps) {
  const qc = useQueryClient();
  const inviteAccess = useServerFn(invitePortalAccess);
  const generateManualAccessLink = useServerFn(generateManualPortalAccessLink);
  const revokeAccess = useServerFn(revokePortalAccess);
  const queryKey = ["portal_access_links", entity, entityId];
  const [manualInvite, setManualInvite] = useState<ManualInvite | null>(null);
  const [generatingRole, setGeneratingRole] = useState<AccessRole | null>(null);

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
      })) as unknown as ManualInvite | null;


      if (result?.actionLink) {
        const invite = withMessage({ ...result, role });
        setManualInvite(invite);
        navigator.clipboard
          ?.writeText(invite.message ?? invite.actionLink)
          .then(() => toast.success("Texto de acesso gerado e copiado"))
          .catch(() => toast.success("Link de acesso gerado"));
        if (!result.emailSent) {
          toast.warning("E-mail nao enviado — use o link ou WhatsApp abaixo para compartilhar o acesso.");
        }
      } else {
        setManualInvite(null);
        toast.success(`Convite de ${ROLE_LABEL[role].toLowerCase()} enviado por e-mail`);
      }

      if (result && result.emailSent === false && !result.actionLink) {
        toast.warning(result.emailError ?? "O e-mail nao foi enviado; use o link manual");
      }

      qc.invalidateQueries({ queryKey });
    } catch (error: any) {
      toast.error(translatedErrorMessage(error, "Nao foi possivel gerar o acesso."));
      qc.invalidateQueries({ queryKey });
    }
  }

  function buildInviteMessage(role: AccessRole, actionLink: string) {
    const name = fullName?.trim() || "tudo bem";
    const roleLabel = ROLE_LABEL[role].toLowerCase();
    return [
      `Olá, ${name}!`,
      "",
      `Seu acesso de ${roleLabel} ao ImobFlow/House302 foi gerado.`,
      `Acesse pelo link: ${actionLink}`,
      "",
      "Ao abrir, confirme seus dados e cadastre sua senha de acesso.",
    ].join("\n");
  }

  function withMessage(invite: ManualInvite): ManualInvite {
    return {
      ...invite,
      message: buildInviteMessage(invite.role, invite.actionLink),
    };
  }

  async function generateManual(role: AccessRole) {
    if (!email?.trim()) {
      toast.error("Cadastre um e-mail antes de gerar o link manual");
      return;
    }

    setGeneratingRole(role);
    try {
      const result = (await generateManualAccessLink({
        data: {
          email,
          fullName,
          role,
          clientId: entity === "client" ? entityId : null,
          brokerId: entity === "broker" ? entityId : null,
        },
      })) as unknown as ManualInvite | null;

      if (!result?.actionLink) {
        toast.error("Nao foi possivel gerar o link manual");
        return;
      }

      const invite = withMessage({ ...result, role, emailSent: false });
      setManualInvite(invite);
      try {
        await navigator.clipboard.writeText(invite.message ?? invite.actionLink);
        toast.success("Texto para WhatsApp copiado");
      } catch {
        toast.success("Texto para WhatsApp gerado");
      }
      qc.invalidateQueries({ queryKey });
    } catch (error: any) {
      toast.error(translatedErrorMessage(error, "Nao foi possivel gerar o link manual."));
    } finally {
      setGeneratingRole(null);
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

  async function copyManualMessage() {
    if (!manualInvite?.message) return;
    try {
      await navigator.clipboard.writeText(manualInvite.message);
      toast.success("Texto copiado");
    } catch {
      toast.error("Nao foi possivel copiar o texto");
    }
  }

  function openWhatsapp() {
    if (!manualInvite?.message) return;
    const cleanPhone = phone?.replace(/\D/g, "") ?? "";
    if (!cleanPhone) {
      toast.error("Cadastre um telefone/WhatsApp antes de abrir o app");
      return;
    }
    const targetPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    window.open(
      `https://wa.me/${targetPhone}?text=${encodeURIComponent(manualInvite.message)}`,
      "_blank",
    );
  }

  async function revoke(accessId: string) {
    if (!confirm("Revogar este acesso?")) return;
    try {
      await revokeAccess({ data: { accessId } });
      toast.success("Acesso revogado");
      qc.invalidateQueries({ queryKey });
    } catch (error: any) {
      toast.error(translatedErrorMessage(error, "Nao foi possivel revogar o acesso."));
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
            const active = !!link.accepted_at;
            return (
              <div
                key={role}
                className="inline-flex items-center gap-2 rounded-md border bg-card px-2 py-1"
              >
                <Badge variant={active ? "default" : "outline"}>
                  {ROLE_LABEL[role]} {active ? "ativo" : "convidado"}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={generatingRole === role}
                  onClick={() => generateManual(role)}
                  title="Gerar link manual para WhatsApp"
                >
                  <MessageCircle className="mr-1 h-3.5 w-3.5" />
                  Link WhatsApp
                </Button>
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
            <div key={role} className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading || linkedRoles.has(role)}
                onClick={() => invite(role)}
              >
                <MailPlus className="mr-1.5 h-4 w-4" />
                Gerar acesso {ROLE_LABEL[role].toLowerCase()}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading || generatingRole === role}
                onClick={() => generateManual(role)}
              >
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Link WhatsApp
              </Button>
            </div>
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
              Link
            </Button>
          </div>
          {manualInvite.message && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyManualMessage}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copiar texto
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={openWhatsapp}>
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                Abrir WhatsApp
              </Button>
            </div>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        O convite pode ser enviado por e-mail ou compartilhado manualmente por WhatsApp. O
        administrador pode revogar o acesso a qualquer momento.
      </p>
    </div>
  );
}
