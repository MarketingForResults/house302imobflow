/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Undo2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";
import { translatedErrorMessage } from "@/lib/error-messages";

export const Route = createFileRoute("/_app/security")({ component: SecurityPage });

const DEFAULT_SETTINGS = {
  id: true,
  require_mfa: false,
  allow_totp: true,
  allow_sms: false,
  login_lockout_enabled: true,
  max_failed_attempts: 5,
  audit_retention_days: 180,
  backup_retention_days: 30,
};

function SecurityPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [manualReason, setManualReason] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [pendingFactor, setPendingFactor] = useState<any>(null);
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(null);
  const canManageSecurity = hasAnyRole(roles, ["master", "it_support"]);
  const isMaster = hasAnyRole(roles, ["master"]);

  const settingsQuery = useQuery({
    queryKey: ["security-settings"],
    enabled: canManageSecurity,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("security_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data ?? DEFAULT_SETTINGS;
    },
  });

  const eventsQuery = useQuery({
    queryKey: ["security-audit-events"],
    enabled: canManageSecurity,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("security_audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const blocksQuery = useQuery({
    queryKey: ["security-user-blocks"],
    enabled: canManageSecurity,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("security_user_blocks")
        .select("*")
        .eq("active", true)
        .order("blocked_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const factorsQuery = useQuery({
    queryKey: ["mfa-factors"],
    enabled: canManageSecurity,
    queryFn: async () => {
      const { data, error } = await (supabase.auth as any).mfa.listFactors();
      if (error) throw error;
      return data ?? {};
    },
  });

  const totpFactors = useMemo(() => factorsQuery.data?.totp ?? [], [factorsQuery.data]);

  async function recordAudit(event: Partial<any>) {
    await (supabase as any).from("security_audit_events").insert({
      actor_user_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      event_type: event.event_type ?? "security.action",
      severity: event.severity ?? "medium",
      source: "app.security",
      user_agent: navigator.userAgent,
      target_table: event.target_table ?? null,
      target_id: event.target_id ?? null,
      metadata: event.metadata ?? {},
      status: event.status ?? "open",
    });
  }

  const updateSettings = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await (supabase as any)
        .from("security_settings")
        .upsert({ ...settingsQuery.data, ...patch, id: true, updated_by: user?.id, updated_at: new Date().toISOString() });
      if (error) throw error;
      await recordAudit({
        event_type: "security.settings.updated",
        severity: "high",
        target_table: "security_settings",
        target_id: "singleton",
        metadata: patch,
      });
    },
    onSuccess: () => {
      toast.success("Configuracao de seguranca atualizada");
      qc.invalidateQueries({ queryKey: ["security-settings"] });
      qc.invalidateQueries({ queryKey: ["security-audit-events"] });
    },
    onError: (error) => toast.error(translatedErrorMessage(error, "Nao foi possivel salvar a seguranca.")),
  });

  const eventAction = useMutation({
    mutationFn: async (input: { event: any; action: "blocked" | "revoked" | "resolved" | "deleted" }) => {
      const now = new Date().toISOString();
      if (input.action === "blocked") {
        const { error } = await (supabase as any).from("security_user_blocks").insert({
          user_id: input.event.actor_user_id,
          email: input.event.actor_email,
          reason: manualReason || `Bloqueio originado pelo evento ${input.event.event_type}`,
          blocked_by: user?.id,
        });
        if (error) throw error;
      }

      if (input.action === "revoked" && input.event.actor_user_id) {
        const { error } = await (supabase as any)
          .from("portal_access_links")
          .update({ revoked_at: now })
          .eq("user_id", input.event.actor_user_id)
          .is("revoked_at", null);
        if (error) throw error;
      }

      const { error } = await (supabase as any)
        .from("security_audit_events")
        .update({
          status: input.action,
          resolved_at: now,
          resolved_by: user?.id,
          resolution_notes: manualReason || null,
        })
        .eq("id", input.event.id);
      if (error) throw error;

      await recordAudit({
        event_type: `security.event.${input.action}`,
        severity: input.action === "deleted" ? "critical" : "high",
        target_table: "security_audit_events",
        target_id: input.event.id,
        metadata: { originalEventType: input.event.event_type },
        status: "resolved",
      });
    },
    onSuccess: () => {
      setManualReason("");
      toast.success("Acao de seguranca registrada");
      qc.invalidateQueries({ queryKey: ["security-audit-events"] });
      qc.invalidateQueries({ queryKey: ["security-user-blocks"] });
    },
    onError: (error) => toast.error(translatedErrorMessage(error, "Nao foi possivel executar a acao.")),
  });

  const unblock = useMutation({
    mutationFn: async (block: any) => {
      const { error } = await (supabase as any)
        .from("security_user_blocks")
        .update({ active: false, revoked_at: new Date().toISOString(), revoked_by: user?.id })
        .eq("id", block.id);
      if (error) throw error;
      await recordAudit({
        event_type: "security.user.unblocked",
        severity: "high",
        target_table: "security_user_blocks",
        target_id: block.id,
        metadata: { email: block.email, userId: block.user_id },
        status: "resolved",
      });
    },
    onSuccess: () => {
      toast.success("Bloqueio removido");
      qc.invalidateQueries({ queryKey: ["security-user-blocks"] });
      qc.invalidateQueries({ queryKey: ["security-audit-events"] });
    },
    onError: (error) => toast.error(translatedErrorMessage(error)),
  });

  async function startTotpEnroll() {
    const { data, error } = await (supabase.auth as any).mfa.enroll({
      factorType: "totp",
      friendlyName: "ImobFlow",
    });
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel iniciar o 2FA."));
    const factorId = data?.id;
    const { data: challenge, error: challengeError } = await (supabase.auth as any).mfa.challenge({
      factorId,
    });
    if (challengeError) return toast.error(translatedErrorMessage(challengeError));
    setPendingFactor(data);
    setPendingChallengeId(challenge?.id ?? null);
  }

  async function verifyTotp() {
    if (!pendingFactor?.id || !pendingChallengeId || !totpCode.trim()) return;
    const { error } = await (supabase.auth as any).mfa.verify({
      factorId: pendingFactor.id,
      challengeId: pendingChallengeId,
      code: totpCode.trim(),
    });
    if (error) return toast.error(translatedErrorMessage(error, "Codigo 2FA invalido."));
    await recordAudit({
      event_type: "security.mfa.enrolled",
      severity: "high",
      metadata: { factorType: "totp" },
      status: "resolved",
    });
    setPendingFactor(null);
    setPendingChallengeId(null);
    setTotpCode("");
    toast.success("2FA ativado para este usuario");
    qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    qc.invalidateQueries({ queryKey: ["security-audit-events"] });
  }

  if (!canManageSecurity) {
    return <div className="p-8 text-sm text-muted-foreground">Acesso restrito ao master e Suporte de TI.</div>;
  }

  const settings = settingsQuery.data ?? DEFAULT_SETTINGS;
  const events = eventsQuery.data ?? [];
  const blocks = blocksQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Seguranca e auditoria"
        description="Eventos sensiveis, bloqueios, revogacoes e controles de autenticacao"
        actions={
          <Button
            variant="outline"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["security-audit-events"] });
              qc.invalidateQueries({ queryKey: ["security-user-blocks"] });
            }}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Atualizar
          </Button>
        }
      />

      <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4 rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Login e 2FA</h2>
          </div>
          <SettingSwitch
            label="Exigir 2FA no login"
            description="Ativa a politica operacional de MFA. A obrigatoriedade por RLS deve ser aplicada depois da adesao dos usuarios."
            checked={!!settings.require_mfa}
            disabled={!isMaster || updateSettings.isPending}
            onChange={(checked) => updateSettings.mutate({ require_mfa: checked })}
          />
          <SettingSwitch
            label="Permitir autenticador TOTP"
            description="Apps como Google Authenticator, Microsoft Authenticator, 1Password ou similares."
            checked={!!settings.allow_totp}
            disabled={!isMaster || updateSettings.isPending}
            onChange={(checked) => updateSettings.mutate({ allow_totp: checked })}
          />
          <SettingSwitch
            label="Bloqueio por tentativas"
            description="Parametro de seguranca para futuras regras de bloqueio automatico."
            checked={!!settings.login_lockout_enabled}
            disabled={!isMaster || updateSettings.isPending}
            onChange={(checked) => updateSettings.mutate({ login_lockout_enabled: checked })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tentativas antes de alerta</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={settings.max_failed_attempts}
                disabled={!isMaster}
                onChange={(event) => updateSettings.mutate({ max_failed_attempts: Number(event.target.value) })}
              />
            </div>
            <div>
              <Label>Retencao dos logs (dias)</Label>
              <Input
                type="number"
                min={7}
                max={3650}
                value={settings.audit_retention_days}
                disabled={!isMaster}
                onChange={(event) => updateSettings.mutate({ audit_retention_days: Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Meu autenticador</h3>
                <p className="text-xs text-muted-foreground">
                  Cadastre um fator TOTP antes de exigir 2FA para toda a equipe.
                </p>
              </div>
              <Button size="sm" onClick={startTotpEnroll} disabled={!settings.allow_totp}>
                <KeyRound className="mr-1.5 h-4 w-4" />
                Ativar 2FA
              </Button>
            </div>
            {totpFactors.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {totpFactors.map((factor: any) => (
                  <Badge key={factor.id} variant={factor.status === "verified" ? "default" : "secondary"}>
                    TOTP {factor.status === "verified" ? "verificado" : factor.status}
                  </Badge>
                ))}
              </div>
            )}
            {pendingFactor && (
              <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
                {pendingFactor.totp?.qr_code && (
                  <img
                    src={pendingFactor.totp.qr_code}
                    alt="QR Code 2FA"
                    className="h-40 w-40 rounded border bg-white p-2"
                  />
                )}
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Escaneie o QR Code no aplicativo autenticador e confirme o codigo de 6 digitos.
                  </p>
                  <Input value={totpCode} onChange={(event) => setTotpCode(event.target.value)} placeholder="Codigo 2FA" />
                  <Button onClick={verifyTotp}>Confirmar 2FA</Button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold">Bloqueios ativos</h2>
          </div>
          {blocks.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum usuario bloqueado manualmente.
            </p>
          ) : (
            <div className="space-y-2">
              {blocks.map((block: any) => (
                <div key={block.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{block.email || block.user_id || "Usuario sem identificacao"}</div>
                    <div className="text-xs text-muted-foreground">{block.reason}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => unblock.mutate(block)}>
                    <Undo2 className="mr-1.5 h-4 w-4" />
                    Desbloquear
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Textarea
            value={manualReason}
            onChange={(event) => setManualReason(event.target.value)}
            placeholder="Motivo para bloqueio, revogacao ou resolucao..."
            rows={3}
          />
        </section>

        <section className="rounded-lg border bg-card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Eventos de auditoria</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Evento</th>
                  <th className="py-2 pr-3">Usuario</th>
                  <th className="py-2 pr-3">Risco</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event: any) => (
                  <tr key={event.id} className="border-b align-top">
                    <td className="py-3 pr-3 whitespace-nowrap">{new Date(event.created_at).toLocaleString("pt-BR")}</td>
                    <td className="py-3 pr-3">
                      <div className="font-medium">{event.event_type}</div>
                      <div className="max-w-[360px] truncate text-xs text-muted-foreground">
                        {event.target_table || "app"} {event.target_id ? `#${event.target_id}` : ""}
                      </div>
                    </td>
                    <td className="py-3 pr-3">{event.actor_email || event.actor_user_id || "-"}</td>
                    <td className="py-3 pr-3">
                      <Badge variant={event.severity === "critical" ? "destructive" : "secondary"}>{event.severity}</Badge>
                    </td>
                    <td className="py-3 pr-3">{event.status}</td>
                    <td className="py-3 pr-3">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="outline" title="Resolver" onClick={() => eventAction.mutate({ event, action: "resolved" })}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" title="Revogar acessos do portal" onClick={() => eventAction.mutate({ event, action: "revoked" })}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" title="Bloquear usuario" onClick={() => eventAction.mutate({ event, action: "blocked" })}>
                          <Ban className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="destructive" title="Marcar como excluido" onClick={() => eventAction.mutate({ event, action: "deleted" })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum evento de auditoria registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingSwitch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
