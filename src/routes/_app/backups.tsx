/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, DatabaseBackup, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";
import { translatedErrorMessage } from "@/lib/error-messages";
import {
  getBackupDashboardState,
  registerPhysicalBackup,
  saveBackupSchedule,
} from "@/lib/backups.functions";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app/backups")({ component: BackupsPage });

const BACKUP_TABLES = [
  "profiles",
  "user_roles",
  "clients",
  "brokers",
  "capture_partners",
  "properties",
  "rental_contracts",
  "rental_payments",
  "sale_contracts",
  "sale_payments",
  "documents",
  "document_templates",
  "document_kinds",
  "entity_documents",
  "app_settings",
  "security_settings",
  "security_audit_events",
] as const;

type BackupResult = {
  fileName: string;
  recordCount: number;
  tableCount: number;
  skippedTables: string[];
};

function BackupsPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [label, setLabel] = useState(
    () => `Backup fisico ${new Date().toLocaleDateString("pt-BR")}`,
  );
  const [notes, setNotes] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<"daily" | "weekly" | "monthly">(
    "daily",
  );
  const [scheduleRunAt, setScheduleRunAt] = useState("02:00");
  const [scheduleWeekday, setScheduleWeekday] = useState("1");
  const [scheduleMonthDay, setScheduleMonthDay] = useState("1");
  const [scheduleRetentionDays, setScheduleRetentionDays] = useState("30");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const isMaster = hasAnyRole(roles, ["master"]);
  const listBackups = useServerFn(getBackupDashboardState);
  const registerBackup = useServerFn(registerPhysicalBackup);
  const saveSchedule = useServerFn(saveBackupSchedule);

  const dashboardQuery = useQuery({
    queryKey: ["backup-dashboard-state"],
    enabled: isMaster,
    queryFn: async () => (await (listBackups as any)()) as any,
    retry: false,
  });
  const activeSchedule = dashboardQuery.data?.schedules?.[0] ?? null;

  useEffect(() => {
    if (!activeSchedule) return;
    setScheduleEnabled(!!activeSchedule.enabled);
    setScheduleFrequency(activeSchedule.frequency ?? "daily");
    setScheduleRunAt(activeSchedule.run_at ?? "02:00");
    setScheduleWeekday(String(activeSchedule.weekday ?? 1));
    setScheduleMonthDay(String(activeSchedule.month_day ?? 1));
    setScheduleRetentionDays(String(activeSchedule.retention_days ?? 30));
    setScheduleNotes(activeSchedule.notes ?? "");
  }, [activeSchedule]);

  const createBackup = useMutation<BackupResult>({
    mutationFn: async () => {
      const generatedAt = new Date();
      const tables: Record<string, any[]> = {};
      const skippedTables: string[] = [];
      let recordCount = 0;

      for (const table of BACKUP_TABLES) {
        const { data, error } = await (supabase as any).from(table).select("*");
        if (error && isSupabaseStructureError(error)) {
          skippedTables.push(table);
          continue;
        }
        if (error)
          throw new Error(
            `${table}: ${translatedErrorMessage(error, "Falha ao exportar a tabela.")}`,
          );
        tables[table] = data ?? [];
        recordCount += tables[table].length;
      }

      const payload = {
        generated_at: generatedAt.toISOString(),
        generated_by: user?.email ?? user?.id ?? null,
        scope: "core",
        table_count: Object.keys(tables).length,
        record_count: recordCount,
        skipped_tables: skippedTables,
        tables,
      };
      const json = JSON.stringify(payload, null, 2);
      const checksum = await sha256(json);
      const fileName = `house302-backup-${generatedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;

      await (registerBackup as any)({
        data: {
          label: label.trim() || fileName,
          scope: "core",
          fileName,
          tableCount: Object.keys(tables).length,
          recordCount,
          byteSize: new Blob([json]).size,
          checksum,
          notes: notes.trim() || null,
        },
      });
      downloadText(fileName, json);

      return {
        fileName,
        recordCount,
        tableCount: Object.keys(tables).length,
        skippedTables,
      };
    },
    onSuccess: (result) => {
      toast.success("Backup fisico baixado e registrado no historico.");
      if (result.skippedTables.length > 0) {
        toast.warning(
          `Backup gerado sem ${result.skippedTables.length} tabela(s) ainda indisponivel(is): ${result.skippedTables.join(", ")}.`,
        );
      }
      qc.invalidateQueries({ queryKey: ["backup-dashboard-state"] });
    },
    onError: (error) =>
      toast.error(translatedErrorMessage(error, "Nao foi possivel gerar o backup.")),
  });

  const scheduleBackup = useMutation({
    mutationFn: async () => {
      await (saveSchedule as any)({
        data: {
          enabled: scheduleEnabled,
          frequency: scheduleFrequency,
          runAt: scheduleRunAt,
          weekday: Number(scheduleWeekday),
          monthDay: Number(scheduleMonthDay),
          retentionDays: Number(scheduleRetentionDays),
          notes: scheduleNotes.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Agenda de backups salva");
      qc.invalidateQueries({ queryKey: ["backup-dashboard-state"] });
    },
    onError: (error) =>
      toast.error(translatedErrorMessage(error, "Nao foi possivel salvar a agenda.")),
  });

  if (!isMaster) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Backup fisico restrito ao administrador master.
      </div>
    );
  }

  const backups = dashboardQuery.data?.backups ?? [];

  return (
    <div>
      <PageHeader
        title="Backups fisicos"
        description="Exportacao local rastreavel das principais tabelas do sistema"
        actions={
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["backup-dashboard-state"] })}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Atualizar
          </Button>
        }
      />
      <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-lg border bg-card p-5">
            <div className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Gerar novo backup</h2>
            </div>
            <div>
              <Label>Identificacao</Label>
              <Input value={label} onChange={(event) => setLabel(event.target.value)} />
            </div>
            <div>
              <Label>Observacoes</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              O arquivo JSON sera baixado neste computador e apenas os metadados ficam registrados
              no sistema. Mantenha o arquivo fisico em midia segura e fora do navegador.
            </div>
            <Button
              className="w-full"
              onClick={() => createBackup.mutate()}
              disabled={createBackup.isPending}
            >
              <Download className="mr-1.5 h-4 w-4" />
              {createBackup.isPending ? "Gerando..." : "Gerar e baixar backup"}
            </Button>
          </section>

          <section className="space-y-4 rounded-lg border bg-card p-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Agendamento automatico</h2>
            </div>
            {activeSchedule && (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                Proxima execucao:{" "}
                {activeSchedule.next_run_at
                  ? new Date(activeSchedule.next_run_at).toLocaleString("pt-BR")
                  : "agenda desativada"}
              </div>
            )}
            {!dashboardQuery.data?.scheduleSchemaReady && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                A migration de agenda precisa ser aplicada para salvar backups automaticos.
              </div>
            )}
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Ativar agenda</div>
                <div className="text-xs text-muted-foreground">
                  Define a periodicidade para o job externo.
                </div>
              </div>
              <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Frequencia</Label>
                <Select
                  value={scheduleFrequency}
                  onValueChange={(value) => setScheduleFrequency(value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diaria</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Horario</Label>
                <Input
                  type="time"
                  value={scheduleRunAt}
                  onChange={(event) => setScheduleRunAt(event.target.value)}
                />
              </div>
              {scheduleFrequency === "weekly" && (
                <div>
                  <Label>Dia da semana</Label>
                  <Select value={scheduleWeekday} onValueChange={setScheduleWeekday}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Segunda-feira</SelectItem>
                      <SelectItem value="2">Terca-feira</SelectItem>
                      <SelectItem value="3">Quarta-feira</SelectItem>
                      <SelectItem value="4">Quinta-feira</SelectItem>
                      <SelectItem value="5">Sexta-feira</SelectItem>
                      <SelectItem value="6">Sabado</SelectItem>
                      <SelectItem value="0">Domingo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {scheduleFrequency === "monthly" && (
                <div>
                  <Label>Dia do mes</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={scheduleMonthDay}
                    onChange={(event) => setScheduleMonthDay(event.target.value)}
                  />
                </div>
              )}
              <div>
                <Label>Retencao (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={scheduleRetentionDays}
                  onChange={(event) => setScheduleRetentionDays(event.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Observacoes da agenda</Label>
              <Textarea
                value={scheduleNotes}
                onChange={(event) => setScheduleNotes(event.target.value)}
                rows={3}
              />
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => scheduleBackup.mutate()}
              disabled={scheduleBackup.isPending}
            >
              {scheduleBackup.isPending ? "Salvando..." : "Salvar agenda"}
            </Button>
          </section>
        </div>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Historico de backups</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Arquivo</th>
                  <th className="py-2 pr-3">Tabelas</th>
                  <th className="py-2 pr-3">Registros</th>
                  <th className="py-2 pr-3">Hash</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup: any) => (
                  <tr key={backup.id} className="border-b">
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {new Date(backup.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-medium">{backup.label}</div>
                      <div className="text-xs text-muted-foreground">{backup.file_name}</div>
                    </td>
                    <td className="py-3 pr-3">{backup.table_count}</td>
                    <td className="py-3 pr-3">{backup.record_count}</td>
                    <td className="py-3 pr-3">
                      <Badge variant="secondary" className="font-mono">
                        {backup.checksum?.slice(0, 12) ?? "-"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {backups.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum backup fisico registrado.
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

async function sha256(text: string) {
  const encoded = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function downloadText(fileName: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isSupabaseStructureError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const current = error as {
    code?: string | number | null;
    message?: string;
    details?: string;
    hint?: string;
  };
  const text = [current.message, current.details, current.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    current.code === "PGRST204" ||
    current.code === "PGRST205" ||
    current.code === "42P01" ||
    text.includes("schema cache") ||
    text.includes("could not find") ||
    text.includes("does not exist")
  );
}
