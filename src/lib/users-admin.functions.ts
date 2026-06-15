/* eslint-disable @typescript-eslint/no-explicit-any -- Admin server fns talk to auth.admin & profiles with loose typing. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum([
  "master",
  "it_support",
  "admin",
  "manager",
  "financial",
  "broker",
  "owner",
  "tenant",
]);

const ROLE_ORDER = [
  "master",
  "it_support",
  "admin",
  "manager",
  "financial",
  "broker",
  "owner",
  "tenant",
] as const;
const OWNER_EMAILS = new Set(["house302imob@gmail.com"]);

function normalizedRolesFor(role: z.infer<typeof RoleEnum>) {
  return role === "master" ? ["master", "admin"] : [role];
}

function sortRoles(roles: string[]) {
  return [...roles].sort((a, b) => ROLE_ORDER.indexOf(a as any) - ROLE_ORDER.indexOf(b as any));
}

const CreateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(200),
  role: RoleEnum,
  temporaryPassword: z.string().min(8).max(64),
});

const UpdateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: RoleEnum,
});

const ResetPasswordSchema = z.object({
  userId: z.string().uuid(),
  temporaryPassword: z.string().min(8).max(64),
});

const DeleteSchema = z.object({ userId: z.string().uuid() });

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function assertAdmin(userId: string, email?: string | null) {
  if (OWNER_EMAILS.has((email ?? "").toLowerCase())) return;

  const admin = await getAdmin();
  const { data: rolesRows, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    throw new Error("Nao foi possivel validar a permissao administrativa");
  }

  const roles = (rolesRows ?? []).map((row: any) => String(row.role));
  if (!roles.some((role: string) => role === "master" || role === "admin")) {
    throw new Error("Apenas administradores podem gerenciar usuarios");
  }
}

export const listAppUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.claims?.email);
    const admin = await getAdmin();
    const { data: users, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);
    const list = users?.users ?? [];
    const ids = list.map((u: any) => u.id);
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, must_change_password, email")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const { data: rolesRows } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
    const roleMap = new Map<string, string[]>();
    for (const row of rolesRows ?? []) {
      const arr = roleMap.get(row.user_id) ?? [];
      arr.push(row.role);
      roleMap.set(row.user_id, sortRoles(arr));
    }
    return {
      users: list.map((u: any) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        full_name: profileMap.get(u.id)?.full_name ?? null,
        must_change_password: profileMap.get(u.id)?.must_change_password ?? false,
        roles: roleMap.get(u.id) ?? [],
      })),
    };
  });

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims?.email);
    const admin = await getAdmin();
    const email = data.email.trim().toLowerCase();

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: data.temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created?.user) throw new Error(error?.message ?? "Falha ao criar usuario");
    const newId = created.user.id;

    await admin
      .from("profiles")
      .upsert(
        { id: newId, full_name: data.fullName, email, must_change_password: true },
        { onConflict: "id" },
      );

    const rolesToInsert = normalizedRolesFor(data.role).map((role) => ({
      user_id: newId,
      role,
    }));
    const { error: roleError } = await admin
      .from("user_roles")
      .upsert(rolesToInsert, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);

    return {
      ok: true,
      userId: newId,
      email,
      temporaryPassword: data.temporaryPassword,
    };
  });

export const updateAppUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims?.email);
    const admin = await getAdmin();
    const rolesToKeep = normalizedRolesFor(data.role);
    const rolesToInsert = rolesToKeep.map((role) => ({ user_id: data.userId, role }));
    const { error: upsertError } = await admin
      .from("user_roles")
      .upsert(rolesToInsert, { onConflict: "user_id,role" });
    if (upsertError) throw new Error(upsertError.message);

    const { data: currentRolesRows, error: currentRolesError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if (currentRolesError) throw new Error(currentRolesError.message);

    const rolesToRemove = (currentRolesRows ?? [])
      .map((row: any) => String(row.role))
      .filter((role: string) => !rolesToKeep.includes(role as any));

    if (rolesToRemove.length > 0) {
      const { error: deleteError } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .in("role", rolesToRemove);
      if (deleteError) throw new Error(deleteError.message);
    }
    return { ok: true };
  });

export const resetAppUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResetPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims?.email);
    const admin = await getAdmin();
    const { error } = await admin.auth.admin.updateUserById(data.userId, {
      password: data.temporaryPassword,
    });
    if (error) throw new Error(error.message);
    await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.userId);
    return { ok: true, temporaryPassword: data.temporaryPassword };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims?.email);
    if (data.userId === context.userId) throw new Error("Voce nao pode remover sua propria conta");
    const admin = await getAdmin();
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
