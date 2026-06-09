/* eslint-disable @typescript-eslint/no-explicit-any -- Admin server fns talk to auth.admin & profiles with loose typing. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum(["admin", "manager", "financial", "broker", "owner", "tenant"]);

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

async function assertAdmin(userId: string) {
  const admin = await getAdmin();
  const { data, error } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Apenas administradores podem gerenciar usuarios");
}

export const listAppUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
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
      roleMap.set(row.user_id, arr);
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
    await assertAdmin(context.userId);
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

    await admin
      .from("user_roles")
      .upsert({ user_id: newId, role: data.role }, { onConflict: "user_id,role" });

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
    await assertAdmin(context.userId);
    const admin = await getAdmin();
    await admin.from("user_roles").delete().eq("user_id", data.userId);
    await admin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    return { ok: true };
  });

export const resetAppUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResetPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
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
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Voce nao pode remover sua propria conta");
    const admin = await getAdmin();
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
