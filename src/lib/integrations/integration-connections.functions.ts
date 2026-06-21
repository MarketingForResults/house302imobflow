/* eslint-disable @typescript-eslint/no-explicit-any -- Integration connection metadata is connector-specific JSON. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const admin = supabaseAdmin as any;

const AuthTypeSchema = z.enum(["oauth", "api_key", "webhook", "server_secret", "manual"]);

const SaveConnectionSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  connectorId: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  authType: AuthTypeSchema,
  accountLabel: z.string().trim().max(200).optional().nullable(),
  externalAccountId: z.string().trim().max(200).optional().nullable(),
  secretRef: z.string().trim().max(160).optional().nullable(),
  webhookUrl: z.string().trim().url().optional().nullable(),
  callbackUrl: z.string().trim().url().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  scopes: z.array(z.string().trim().min(1).max(120)).default([]),
});

const ConnectorToggleSchema = z.object({
  connectorId: z.string().min(1).max(80),
  enabled: z.boolean(),
  reason: z.string().trim().max(500).optional().nullable(),
});

const ConnectionToggleSchema = z.object({
  connectionId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
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
    current.code === "PGRST204" ||
    text.includes("schema cache") ||
    text.includes("does not exist") ||
    text.includes("could not find")
  );
}

async function assertIntegrationManager(userId: string) {
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["master", "admin", "manager"]);

  if (error) throw new Error("Nao foi possivel validar sua permissao para integracoes.");
  if (!data?.length) {
    throw new Error("Apenas master, administradores ou gestores podem gerenciar integracoes.");
  }
}

function buildConnectionPayload(data: z.infer<typeof SaveConnectionSchema>, userId: string) {
  return {
    connector_id: data.connectorId,
    name: data.name,
    status: "active",
    auth_type: data.authType,
    external_account_id: data.externalAccountId || null,
    account_label: data.accountLabel || null,
    scopes: data.scopes,
    secret_ref: data.secretRef || null,
    config: {
      webhook_url: data.webhookUrl || null,
      callback_url: data.callbackUrl || null,
      notes: data.notes || null,
    },
    disabled_reason: null,
    disabled_at: null,
    disabled_by: null,
    updated_by: userId,
  };
}

export const listIntegrationWorkspaceState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertIntegrationManager(context.userId);

    const [
      { data: settings, error: settingsError },
      { data: connections, error: connectionsError },
    ] = await Promise.all([
      admin.from("integration_connector_settings").select("*").order("connector_id"),
      admin.from("integration_connections").select("*").order("created_at", { ascending: false }),
    ]);

    if (settingsError && !isSchemaError(settingsError)) throw new Error(settingsError.message);
    if (connectionsError && !isSchemaError(connectionsError))
      throw new Error(connectionsError.message);

    return {
      settings: isSchemaError(settingsError) ? [] : (settings ?? []),
      connections: isSchemaError(connectionsError) ? [] : (connections ?? []),
      schemaReady: !settingsError && !connectionsError,
    };
  });

export const saveIntegrationConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveConnectionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertIntegrationManager(context.userId);

    const payload = buildConnectionPayload(data, context.userId);
    const query = data.id
      ? admin.from("integration_connections").update(payload).eq("id", data.id)
      : admin.from("integration_connections").insert({
          ...payload,
          created_by: context.userId,
        });

    const { data: connection, error } = await query.select("*").maybeSingle();
    if (error) throw new Error(error.message);

    const { error: settingError } = await admin.from("integration_connector_settings").upsert(
      {
        connector_id: data.connectorId,
        enabled: true,
        status: "enabled",
        disabled_reason: null,
        disabled_at: null,
        disabled_by: null,
        updated_by: context.userId,
      },
      { onConflict: "connector_id" },
    );
    if (settingError) throw new Error(settingError.message);

    return { ok: true, connection };
  });

export const setIntegrationConnectorEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConnectorToggleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertIntegrationManager(context.userId);

    const now = new Date().toISOString();
    const { data: setting, error } = await admin
      .from("integration_connector_settings")
      .upsert(
        {
          connector_id: data.connectorId,
          enabled: data.enabled,
          status: data.enabled ? "enabled" : "disabled",
          disabled_reason: data.enabled ? null : data.reason || "Desativado pelo workspace",
          disabled_at: data.enabled ? null : now,
          disabled_by: data.enabled ? null : context.userId,
          updated_by: context.userId,
        },
        { onConflict: "connector_id" },
      )
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!data.enabled) {
      const { error: connectionsError } = await admin
        .from("integration_connections")
        .update({
          status: "disabled",
          disabled_reason: data.reason || "Conector desativado pelo workspace",
          disabled_at: now,
          disabled_by: context.userId,
          updated_by: context.userId,
        })
        .eq("connector_id", data.connectorId)
        .eq("status", "active");
      if (connectionsError) throw new Error(connectionsError.message);
    }

    return { ok: true, setting };
  });

export const disableIntegrationConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConnectionToggleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertIntegrationManager(context.userId);

    const { data: connection, error } = await admin
      .from("integration_connections")
      .update({
        status: "disabled",
        disabled_reason: data.reason || "Conexao desativada pelo workspace",
        disabled_at: new Date().toISOString(),
        disabled_by: context.userId,
        updated_by: context.userId,
      })
      .eq("id", data.connectionId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    return { ok: true, connection };
  });
