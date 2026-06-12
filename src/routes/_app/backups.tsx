/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseBackup, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";
import { translatedErrorMessage } from "@/lib/error-messages";
import { useState } from "react";

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

function BackupsPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [label, setLabel] = useState(() => `Backup fisico ${new Date().toLocaleDateString("pt-BR")}`);
  const [notes, setNotes] = useState("");
  const isMaster = hasAnyRole(roles, ["master"]);

  const backupsQuery = useQuery({
    queryKey: ["physical-backups"],
    enabled: isMaster,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("physical_backups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createBackup = useMutation({
    mutationFn: async () => {
      const generatedAt = new Date();
      const tables: Record<string, any[]> = {};
      let recordCount = 0;

      for (const table of BACKUP_TABLES) {
        const { data, error } = await (supabase as any).from(table).select("*");
        if (error) throw new Error(`${table}: ${error.message}`);
        tables[table] = data ?? [];
        recordCount += tables[table].length;
      }

      const payload = {
        generated_at: generatedAt.toISOString(),
        generated_by: user?.email ?? user?.id ?? null,
        scope: "core",
        table_count: BACKUP_TABLES.length,
        record_count: recordCount,
        tables,
      };
      const json = JSON.stringify(payload, null, 2);
      const checksum = await sha256(json);
      const fileName = `house302-backup-${generatedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      downloadText(fileName, json);

      const { error } = await (supabase as any).from("physical_backups").insert({
        created_by: user?.id ?? null,
        label: label.trim() || fileName,
        scope: "core",
        file_name: fileName,
        table_count: BACKUP_TABLES.length,
        record_count: recordCount,
        byte_size: new Blob([json]).size,
        checksum,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Backup fisico gerado e registrado");
      qc.invalidateQueries({ queryKey: ["physical-backups"] });
    },
    onError: (error) => toast.error(translatedErrorMessage(error, "Nao foi possivel gerar o backup.")),
  });

  if (!isMaster) {
    return <div className="p-8 text-sm text-muted-foreground">Backup fisico restrito ao administrador master.</div>;
  }

  const backups = backupsQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Backups fisicos"
        description="Exportacao local rastreavel das principais tabelas do sistema"
        actions={
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["physical-backups"] })}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Atualizar
          </Button>
        }
      />
      <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-[420px_1fr]">
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
            O arquivo JSON sera baixado neste computador e apenas os metadados ficam registrados no sistema.
            Mantenha o arquivo fisico em midia segura e fora do navegador.
          </div>
          <Button className="w-full" onClick={() => createBackup.mutate()} disabled={createBackup.isPending}>
            <Download className="mr-1.5 h-4 w-4" />
            {createBackup.isPending ? "Gerando..." : "Gerar e baixar backup"}
          </Button>
        </section>

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
                    <td className="py-3 pr-3 whitespace-nowrap">{new Date(backup.created_at).toLocaleString("pt-BR")}</td>
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
