/* eslint-disable @typescript-eslint/no-explicit-any -- Security audit records contain flexible metadata. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const admin = supabaseAdmin as any;
const OWNER_EMAILS = new Set(["house302imob@gmail.com"]);
const SECURITY_ROLES = ["master", "it_support", "admin"] as const;
const SECURITY_ADMIN_ROLES = ["master", "admin"] as const;

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

const SettingsPatchSchema = z
  .object({
    require_mfa: z.boolean().optional(),
    allow_totp: z.boolean().optional(),
    allow_sms: z.boolean().optional(),
    login_lockout_enabled: z.boolean().optional(),
    max_failed_attempts: z.number().int().min(1).max(20).optional(),
    audit_retention_days: z.number().int().min(7).max(3650).optional(),
    backup_retention_days: z.number().int().min(1).max(3650).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos uma configuração.");

const AuditEventSchema = z.object({
  event_type: z.string().trim().min(1).max(160),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  target_table: z.string().trim().max(120).optional().nullable(),
  target_id: z.string().trim().max(120).optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
  status: z.enum(["open", "blocked", "revoked", "deleted", "resolved"]).default("open"),
});

const EventActionSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().trim().min(1).max(160),
  actorUserId: z.string().uuid().optional().nullable(),
  actorEmail: z.string().trim().max(320).optional().nullable(),
  action: z.enum(["blocked", "revoked", "resolved", "deleted"]),
  reason: z.string().trim().max(1000).optional().nullable(),
});

const UnblockSchema = z.object({
  blockId: z.string().uuid(),
  email: z.string().trim().email().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
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

function schemaMessage() {
  return "A estrutura de seguranca ainda nao foi aplicada no Supabase. Aplique as migrations e tente novamente.";
}

async function rolesFor(userId: string) {
  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Nao foi possivel validar sua permissao de seguranca.");
  return (data ?? []).map((row: any) => String(row.role));
}

async function assertRoles(
  userId: string,
  email: string | null | undefined,
  allowedRoles: readonly string[],
) {
  if (OWNER_EMAILS.has((email ?? "").toLowerCase())) return;
  const roles = await rolesFor(userId);
  if (!roles.some((role: string) => allowedRoles.includes(role))) {
    throw new Error("Apenas administradores ou Suporte de TI podem gerenciar seguranca.");
  }
}

async function recordSecurityAudit(
  adminClient: any,
  context: any,
  event: z.infer<typeof AuditEventSchema>,
) {
  const { error } = await adminClient.from("security_audit_events").insert({
    actor_user_id: context.userId,
    actor_email: context.claims?.email ?? null,
    event_type: event.event_type,
    severity: event.severity,
    source: "app.security",
    target_table: event.target_table ?? null,
    target_id: event.target_id ?? null,
    metadata: event.metadata,
    status: event.status,
  });

  if (error && !isSchemaError(error)) throw new Error(error.message);
}

export const getSecurityDashboardState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRoles(context.userId, context.claims?.email, SECURITY_ROLES);

    const [settingsResult, eventsResult, blocksResult] = await Promise.all([
      admin.from("security_settings").select("*").eq("id", true).maybeSingle(),
      admin
        .from("security_audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("security_user_blocks")
        .select("*")
        .eq("active", true)
        .order("blocked_at", { ascending: false })
        .limit(100),
    ]);

    if (settingsResult.error && !isSchemaError(settingsResult.error)) {
      throw new Error(settingsResult.error.message);
    }
    if (eventsResult.error && !isSchemaError(eventsResult.error)) {
      throw new Error(eventsResult.error.message);
    }
    if (blocksResult.error && !isSchemaError(blocksResult.error)) {
      throw new Error(blocksResult.error.message);
    }

    return {
      settings: settingsResult.error ? DEFAULT_SETTINGS : (settingsResult.data ?? DEFAULT_SETTINGS),
      events: eventsResult.error ? [] : (eventsResult.data ?? []),
      blocks: blocksResult.error ? [] : (blocksResult.data ?? []),
      schemaReady: !settingsResult.error && !eventsResult.error && !blocksResult.error,
    };
  });

export const updateSecuritySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SettingsPatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertRoles(context.userId, context.claims?.email, SECURITY_ADMIN_ROLES);

    const { data: settings, error } = await admin
      .from("security_settings")
      .upsert(
        {
          ...data,
          id: true,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select("*")
      .maybeSingle();

    if (error && isSchemaError(error)) throw new Error(schemaMessage());
    if (error) throw new Error(error.message);

    await recordSecurityAudit(admin, context, {
      event_type: "security.settings.updated",
      severity: "high",
      target_table: "security_settings",
      target_id: "singleton",
      metadata: data,
      status: "resolved",
    });

    return { ok: true, settings };
  });

export const recordSecurityAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AuditEventSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertRoles(context.userId, context.claims?.email, SECURITY_ROLES);
    await recordSecurityAudit(admin, context, data);
    return { ok: true };
  });

export const resolveSecurityEventAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EventActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertRoles(context.userId, context.claims?.email, SECURITY_ROLES);
    const now = new Date().toISOString();

    if (data.action === "blocked") {
      const { error } = await admin.from("security_user_blocks").insert({
        user_id: data.actorUserId ?? null,
        email: data.actorEmail ?? null,
        reason: data.reason || `Bloqueio originado pelo evento ${data.eventType}`,
        blocked_by: context.userId,
      });
      if (error) throw new Error(error.message);
    }

    if (data.action === "revoked" && data.actorUserId) {
      const { error } = await admin
        .from("portal_access_links")
        .update({ revoked_at: now })
        .eq("user_id", data.actorUserId)
        .is("revoked_at", null);
      if (error && !isSchemaError(error)) throw new Error(error.message);
    }

    const { error } = await admin
      .from("security_audit_events")
      .update({
        status: data.action,
        resolved_at: now,
        resolved_by: context.userId,
        resolution_notes: data.reason || null,
      })
      .eq("id", data.eventId);
    if (error && isSchemaError(error)) throw new Error(schemaMessage());
    if (error) throw new Error(error.message);

    await recordSecurityAudit(admin, context, {
      event_type: `security.event.${data.action}`,
      severity: data.action === "deleted" ? "critical" : "high",
      target_table: "security_audit_events",
      target_id: data.eventId,
      metadata: { originalEventType: data.eventType },
      status: "resolved",
    });

    return { ok: true };
  });

export const unblockSecurityUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UnblockSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertRoles(context.userId, context.claims?.email, SECURITY_ROLES);

    const { error } = await admin
      .from("security_user_blocks")
      .update({ active: false, revoked_at: new Date().toISOString(), revoked_by: context.userId })
      .eq("id", data.blockId);
    if (error && isSchemaError(error)) throw new Error(schemaMessage());
    if (error) throw new Error(error.message);

    await recordSecurityAudit(admin, context, {
      event_type: "security.user.unblocked",
      severity: "high",
      target_table: "security_user_blocks",
      target_id: data.blockId,
      metadata: { email: data.email, userId: data.userId },
      status: "resolved",
    });

    return { ok: true };
  });
