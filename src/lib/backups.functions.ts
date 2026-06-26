/* eslint-disable @typescript-eslint/no-explicit-any -- Backup metadata is operational/audit data with JSON snapshots. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const admin = supabaseAdmin as any;
const MASTER_ROLES = ["master", "admin"] as const;

const BackupMetadataSchema = z.object({
  label: z.string().trim().min(1).max(200),
  scope: z.string().trim().min(1).max(80).default("core"),
  fileName: z.string().trim().min(1).max(240),
  tableCount: z.number().int().min(0),
  recordCount: z.number().int().min(0),
  byteSize: z.number().int().min(0),
  checksum: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const ScheduleSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  runAt: z.string().regex(/^\d{2}:\d{2}$/),
  weekday: z.number().int().min(0).max(6).optional().nullable(),
  monthDay: z.number().int().min(1).max(28).optional().nullable(),
  retentionDays: z.number().int().min(1).max(3650),
  notes: z.string().trim().max(1000).optional().nullable(),
});

function isSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const current = error as { code?: string; message?: string; details?: string; hint?: string };
  const text = [current.message, current.details, current.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    current.code === "42P01" ||
    current.code === "42703" ||
    current.code === "PGRST204" ||
    current.code === "PGRST205" ||
    text.includes("schema cache") ||
    text.includes("does not exist") ||
    text.includes("could not find")
  );
}

async function assertMaster(userId: string, email?: string | null) {
  if ((email ?? "").toLowerCase() === "house302imob@gmail.com") return;
  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Nao foi possivel validar sua permissao para backups.");
  if (!(data ?? []).some((row: any) => MASTER_ROLES.includes(String(row.role) as any))) {
    throw new Error("Backups fisicos sao restritos ao administrador master.");
  }
}

function nextRunAt(input: z.infer<typeof ScheduleSchema>) {
  const [hour, minute] = input.runAt.split(":").map(Number);
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);

  if (input.frequency === "weekly") {
    const targetWeekday = input.weekday ?? 1;
    const daysUntil = (targetWeekday - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + daysUntil);
    if (next <= new Date()) next.setDate(next.getDate() + 7);
  }

  if (input.frequency === "monthly") {
    const targetDay = input.monthDay ?? 1;
    next.setDate(Math.min(targetDay, 28));
    if (next <= new Date()) next.setMonth(next.getMonth() + 1, Math.min(targetDay, 28));
  }

  return next.toISOString();
}

export const getBackupDashboardState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context.userId, context.claims?.email);

    const [backupsResult, schedulesResult] = await Promise.all([
      admin
        .from("physical_backups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
      admin
        .from("backup_schedules")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (backupsResult.error && !isSchemaError(backupsResult.error)) {
      throw new Error(backupsResult.error.message);
    }
    if (schedulesResult.error && !isSchemaError(schedulesResult.error)) {
      throw new Error(schedulesResult.error.message);
    }

    return {
      backups: backupsResult.error ? [] : (backupsResult.data ?? []),
      schedules: schedulesResult.error ? [] : (schedulesResult.data ?? []),
      schemaReady: !backupsResult.error,
      scheduleSchemaReady: !schedulesResult.error,
    };
  });

export const registerPhysicalBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BackupMetadataSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId, context.claims?.email);

    const { data: backup, error } = await admin
      .from("physical_backups")
      .insert({
        created_by: context.userId,
        label: data.label,
        scope: data.scope,
        file_name: data.fileName,
        table_count: data.tableCount,
        record_count: data.recordCount,
        byte_size: data.byteSize,
        checksum: data.checksum ?? null,
        notes: data.notes ?? null,
      })
      .select("*")
      .maybeSingle();

    if (error && isSchemaError(error)) {
      throw new Error(
        "A estrutura de backups ainda nao foi aplicada no Supabase. Aplique as migrations.",
      );
    }
    if (error) throw new Error(error.message);

    return { ok: true, backup };
  });

export const saveBackupSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScheduleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId, context.claims?.email);

    const { data: schedule, error } = await admin
      .from("backup_schedules")
      .upsert(
        {
          id: true,
          enabled: data.enabled,
          frequency: data.frequency,
          run_at: data.runAt,
          weekday: data.frequency === "weekly" ? (data.weekday ?? 1) : null,
          month_day: data.frequency === "monthly" ? (data.monthDay ?? 1) : null,
          retention_days: data.retentionDays,
          next_run_at: data.enabled ? nextRunAt(data) : null,
          notes: data.notes ?? null,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select("*")
      .maybeSingle();

    if (error && isSchemaError(error)) {
      throw new Error("A migration de agenda de backups ainda precisa ser aplicada.");
    }
    if (error) throw new Error(error.message);

    return { ok: true, schedule };
  });
