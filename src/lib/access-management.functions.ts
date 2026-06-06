/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase types are regenerated after the new portal_access_links migration is applied. */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AccessRoleSchema = z.enum(["owner", "tenant", "broker"]);
const admin = supabaseAdmin as any;

const InviteAccessSchema = z.object({
  email: z.string().email(),
  fullName: z.string().optional().nullable(),
  role: AccessRoleSchema,
  clientId: z.string().uuid().optional().nullable(),
  brokerId: z.string().uuid().optional().nullable(),
});

const RevokeAccessSchema = z.object({
  accessId: z.string().uuid(),
});

async function assertAdmin(userId: string) {
  const { data, error } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Apenas administradores podem gerenciar acessos");
}

function getRedirectUrl() {
  const request = getRequest();
  const origin = request ? new URL(request.url).origin : undefined;
  return origin ? `${origin}/login` : undefined;
}

function getActionLink(data: any) {
  return data?.properties?.action_link ?? data?.properties?.actionLink ?? null;
}

export const invitePortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteAccessSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    if (data.role === "broker" && !data.brokerId) {
      throw new Error("Selecione um corretor para gerar o acesso");
    }
    if ((data.role === "owner" || data.role === "tenant") && !data.clientId) {
      throw new Error("Selecione um cliente para gerar o acesso");
    }

    const payload = {
      email: data.email.trim().toLowerCase(),
      full_name: data.fullName?.trim() || null,
      role: data.role,
      client_id: data.role === "broker" ? null : data.clientId,
      broker_id: data.role === "broker" ? data.brokerId : null,
      invited_by: context.userId,
      revoked_at: null,
    };

    const existingQuery = admin
      .from("portal_access_links")
      .select("*")
      .eq("email", payload.email)
      .eq("role", payload.role)
      .is("revoked_at", null);
    const { data: existing, error: existingError } =
      data.role === "broker"
        ? await existingQuery.eq("broker_id", data.brokerId).maybeSingle()
        : await existingQuery.eq("client_id", data.clientId).maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const { data: link, error: linkError } = existing
      ? { data: existing, error: null }
      : await admin.from("portal_access_links").insert(payload).select("*").single();
    if (linkError) throw new Error(linkError.message);

    const redirectTo = getRedirectUrl();
    const inviteMetadata = {
      full_name: payload.full_name,
      portal_role: payload.role,
      portal_access_id: link.id,
    };
    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      payload.email,
      {
        redirectTo,
        data: inviteMetadata,
      },
    );

    const { data: generatedInvite, error: generateInviteError } =
      await admin.auth.admin.generateLink({
        type: "invite",
        email: payload.email,
        options: {
          redirectTo,
          data: inviteMetadata,
        },
      });
    let generated = generatedInvite;
    let generateError = generateInviteError;

    if (generateError) {
      const { data: recoveryLink, error: recoveryError } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: payload.email,
        options: {
          redirectTo,
          data: inviteMetadata,
        },
      });
      if (!recoveryError) {
        generateError = null;
        generated = recoveryLink;
      }
    }

    const actionLink = getActionLink(generated);

    if (inviteError && !actionLink) {
      throw new Error(inviteError.message);
    }

    const userId = invite?.user?.id ?? generated?.user?.id ?? null;

    if (userId) {
      await admin
        .from("portal_access_links")
        .update({ user_id: userId, accepted_at: new Date().toISOString() })
        .eq("id", link.id);

      await admin
        .from("user_roles")
        .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });

      if (data.role === "broker" && data.brokerId) {
        await admin.from("brokers").update({ user_id: userId }).eq("id", data.brokerId);
      }
    }

    return {
      ok: true,
      accessId: link.id,
      userId,
      actionLink,
      emailSent: !inviteError,
      emailError: inviteError?.message ?? null,
      linkError: generateError?.message ?? null,
    };
  });

export const revokePortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RevokeAccessSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: link, error: linkError } = await admin
      .from("portal_access_links")
      .select("*")
      .eq("id", data.accessId)
      .single();
    if (linkError || !link) throw new Error(linkError?.message ?? "Acesso nao encontrado");

    const revokedAt = new Date().toISOString();
    const { error } = await admin
      .from("portal_access_links")
      .update({ revoked_at: revokedAt })
      .eq("id", data.accessId);
    if (error) throw new Error(error.message);

    if (link.user_id) {
      const { data: remaining } = await admin
        .from("portal_access_links")
        .select("id")
        .eq("user_id", link.user_id)
        .eq("role", link.role)
        .is("revoked_at", null)
        .neq("id", data.accessId);

      if (!remaining?.length) {
        await admin.from("user_roles").delete().eq("user_id", link.user_id).eq("role", link.role);
      }

      if (link.role === "broker" && link.broker_id) {
        await admin.from("brokers").update({ user_id: null }).eq("id", link.broker_id);
      }
    }

    return { ok: true };
  });
