/* eslint-disable @typescript-eslint/no-explicit-any -- Autentique payloads are stored as JSON snapshots. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createAutentiqueDocument,
  createSignatureLink,
  checkAutentiqueConnection,
  getAutentiqueDocument,
  type AutentiqueSignerInput,
} from "./autentique-client.server";

const admin = supabaseAdmin as any;

const DeliveryMethodSchema = z.enum(["email", "whatsapp", "manual"]);

const SignerSchema = z.object({
  name: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  deliveryMethod: DeliveryMethodSchema,
});

const SendDocumentSchema = z.object({
  documentId: z.string().uuid(),
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
  sandbox: z.boolean().default(true),
  signers: z.array(SignerSchema).min(1),
});

const SignatureSchema = z.object({
  signatureId: z.string().uuid(),
});

const SignatureLinkSchema = z.object({
  signatureId: z.string().uuid(),
  publicId: z.string().min(1),
});

function publicStaffRoleFilter(query: any) {
  return query.in("role", ["master", "admin", "manager"]);
}

async function assertStaff(userId: string) {
  const { data, error } = await publicStaffRoleFilter(
    admin.from("user_roles").select("role").eq("user_id", userId),
  );

  if (error) throw new Error("Nao foi possivel validar sua permissao.");
  if (!data?.length) {
    throw new Error("Apenas administradores ou equipe podem enviar documentos para assinatura.");
  }
}

function base64ToBlob(base64: string, mimeType: string) {
  const cleanBase64 = base64.includes(",") ? base64.split(",").pop()! : base64;
  const binary =
    typeof atob === "function"
      ? atob(cleanBase64)
      : Buffer.from(cleanBase64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `+55${digits.replace(/^55/, "")}` : null;
}

function toAutentiqueSigner(signer: z.infer<typeof SignerSchema>): AutentiqueSignerInput {
  const name = signer.name?.trim() || undefined;
  const email = signer.email?.trim().toLowerCase() || undefined;
  const phone = normalizePhone(signer.phone) || undefined;

  if (signer.deliveryMethod === "email") {
    if (!email) throw new Error("Informe e-mail para todos os signatarios por e-mail.");
    if (!z.string().email().safeParse(email).success) {
      throw new Error("Informe um e-mail valido para todos os signatarios por e-mail.");
    }
    return { email, action: "SIGN" };
  }

  if (signer.deliveryMethod === "whatsapp") {
    if (!phone) throw new Error("Informe telefone para todos os signatarios por WhatsApp.");
    return {
      phone,
      delivery_method: "DELIVERY_METHOD_WHATSAPP",
      action: "SIGN",
    };
  }

  if (!name) throw new Error("Informe nome para todos os signatarios com link manual.");
  return { name, action: "SIGN" };
}

function signerStatus(signature: any) {
  if (signature?.rejected) return "rejected";
  if (signature?.signed || signature?.biometric_approved) return "signed";
  if (signature?.signed_unapproved) return "pending_approval";
  if (signature?.viewed) return "viewed";
  return "pending";
}

function normalizeSignatures(signatures: any[] = [], requestedSigners: any[] = []) {
  return signatures.map((signature, index) => ({
    public_id: signature.public_id,
    name:
      signature.name ??
      signature.user_data?.name ??
      signature.user?.name ??
      requestedSigners[index]?.name ??
      null,
    email:
      signature.email ??
      signature.user_data?.email ??
      signature.user?.email ??
      requestedSigners[index]?.email ??
      null,
    phone:
      signature.phone ??
      signature.user_data?.phone ??
      signature.user?.phone ??
      requestedSigners[index]?.phone ??
      null,
    delivery_method: requestedSigners[index]?.deliveryMethod ?? null,
    action: signature.action?.name ?? "SIGN",
    status: signerStatus(signature),
    link: signature.link?.short_link ?? requestedSigners[index]?.link ?? null,
    created_at: signature.created_at ?? null,
    viewed_at: signature.viewed?.created_at ?? null,
    signed_at: signature.signed?.created_at ?? signature.biometric_approved?.created_at ?? null,
    rejected_at: signature.rejected?.created_at ?? signature.biometric_rejected?.created_at ?? null,
    email_events: signature.email_events ?? null,
  }));
}

function documentStatus(document: any, signers: any[]) {
  if (signers.some((signer) => signer.status === "rejected")) return "rejected";
  if (signers.length > 0 && signers.every((signer) => signer.status === "signed")) return "signed";
  if (signers.some((signer) => signer.status === "viewed")) return "viewed";
  return document?.status ?? "pending";
}

function fileUrls(document: any) {
  return {
    original_file_url: document?.files?.original ?? null,
    signed_file_url: document?.files?.signed ?? document?.files?.pades ?? null,
    audit_file_url: document?.files?.pades ?? null,
  };
}

async function persistAutentiqueSnapshot(input: {
  signatureId?: string;
  documentId: string;
  autentiqueDocument: any;
  requestedSigners?: any[];
  sandbox?: boolean;
  userId?: string;
}) {
  const signers = normalizeSignatures(
    input.autentiqueDocument?.signatures ?? [],
    input.requestedSigners ?? [],
  );
  const status = documentStatus(input.autentiqueDocument, signers);
  const urls = fileUrls(input.autentiqueDocument);
  const payload = {
    document_id: input.documentId,
    autentique_document_id: input.autentiqueDocument.id,
    status,
    signers,
    sandbox: input.sandbox ?? true,
    created_by: input.userId,
    ...urls,
  };

  const query = input.signatureId
    ? admin.from("document_signatures").update(payload).eq("id", input.signatureId)
    : admin.from("document_signatures").insert(payload);

  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new Error(error.message);

  if (urls.signed_file_url) {
    await admin
      .from("documents")
      .update({ signed_file_url: urls.signed_file_url, status: "signed" })
      .eq("id", input.documentId);
  }

  return data;
}

export const sendDocumentToAutentique = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendDocumentSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);

    const { data: documentRow, error: documentError } = await admin
      .from("documents")
      .select("id, code, title")
      .eq("id", data.documentId)
      .maybeSingle();
    if (documentError || !documentRow) {
      throw new Error(documentError?.message ?? "Documento nao encontrado.");
    }

    const requestedSigners = data.signers.map((signer) => ({
      ...signer,
      email: signer.email?.trim().toLowerCase() || null,
      phone: normalizePhone(signer.phone),
    }));
    const autentiqueSigners = data.signers.map(toAutentiqueSigner);

    try {
      const file = base64ToBlob(data.fileBase64, "application/pdf");
      const autentiqueDocument = await createAutentiqueDocument({
        document: {
          name: documentRow.title || documentRow.code,
          ignore_cpf: true,
          new_signature_style: true,
          locale: {
            country: "BR",
            language: "pt-BR",
            timezone: "America/Sao_Paulo",
            date_format: "DD_MM_YYYY",
          },
        },
        signers: autentiqueSigners,
        file,
        fileName: data.fileName,
        sandbox: data.sandbox,
      });

      const saved = await persistAutentiqueSnapshot({
        documentId: data.documentId,
        autentiqueDocument,
        requestedSigners,
        sandbox: data.sandbox,
        userId: context.userId,
      });

      return { ok: true, signature: saved };
    } catch (error) {
      console.error("[Autentique] sendDocumentToAutentique failed", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel enviar o documento para assinatura.",
      );
    }
  });

export const refreshAutentiqueDocumentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SignatureSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);

    const { data: signature, error } = await admin
      .from("document_signatures")
      .select("*")
      .eq("id", data.signatureId)
      .maybeSingle();
    if (error || !signature) throw new Error(error?.message ?? "Assinatura nao encontrada.");

    try {
      const autentiqueDocument = await getAutentiqueDocument(signature.autentique_document_id);
      const saved = await persistAutentiqueSnapshot({
        signatureId: signature.id,
        documentId: signature.document_id,
        autentiqueDocument,
        requestedSigners: signature.signers ?? [],
        sandbox: signature.sandbox,
        userId: signature.created_by,
      });

      return { ok: true, signature: saved };
    } catch (error) {
      console.error("[Autentique] refreshAutentiqueDocumentStatus failed", error);
      throw new Error(
        error instanceof Error ? error.message : "Nao foi possivel atualizar o status.",
      );
    }
  });

export const createAutentiqueSignatureLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SignatureLinkSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);

    const { data: signatureRow, error } = await admin
      .from("document_signatures")
      .select("*")
      .eq("id", data.signatureId)
      .maybeSingle();
    if (error || !signatureRow) throw new Error(error?.message ?? "Assinatura nao encontrada.");

    try {
      const link = await createSignatureLink(data.publicId);
      const signers = (signatureRow.signers ?? []).map((signer: any) =>
        signer.public_id === data.publicId ? { ...signer, link } : signer,
      );
      const { data: updated, error: updateError } = await admin
        .from("document_signatures")
        .update({ signers })
        .eq("id", data.signatureId)
        .select("*")
        .maybeSingle();
      if (updateError) throw new Error(updateError.message);

      return { ok: true, link, signature: updated };
    } catch (error) {
      console.error("[Autentique] createAutentiqueSignatureLink failed", error);
      throw new Error(error instanceof Error ? error.message : "Nao foi possivel gerar o link.");
    }
  });

export const getAutentiqueConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);

    const hasToken = !!(process.env.AUTENTIQUE_API_KEY || process.env.AUTENTIQUE_TOKEN);
    if (!hasToken) {
      return {
        ok: false,
        configured: false,
        message: "AUTENTIQUE_API_KEY nao configurada no servidor.",
      };
    }

    try {
      const account = await checkAutentiqueConnection();
      return {
        ok: true,
        configured: true,
        account,
        message: account?.email ? `Conectado como ${account.email}` : "Token Autentique validado.",
      };
    } catch (error) {
      return {
        ok: false,
        configured: true,
        message:
          error instanceof Error ? error.message : "Nao foi possivel validar o token Autentique.",
      };
    }
  });

export async function updateAutentiqueSignatureFromWebhook(payload: any) {
  const event = payload?.event;
  const object = event?.data?.object;
  const autentiqueDocumentId =
    object?.object === "document" ? object?.id : (object?.document?.id ?? object?.document_id);

  if (!event?.id || !event?.type || !autentiqueDocumentId) {
    throw new Error("Payload de webhook da Autentique invalido.");
  }

  const { data: signature, error } = await admin
    .from("document_signatures")
    .select("*")
    .eq("autentique_document_id", autentiqueDocumentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!signature) return { ok: true, ignored: true };

  const refreshedDocument =
    object?.object === "document" ? object : await getAutentiqueDocument(autentiqueDocumentId);
  const signers = normalizeSignatures(refreshedDocument?.signatures ?? [], signature.signers ?? []);
  const urls = fileUrls(refreshedDocument);
  const eventSnapshot = {
    id: event.id,
    type: event.type,
    created_at: event.created_at ?? new Date().toISOString(),
    object_id: object?.id ?? null,
  };
  const currentEvents = Array.isArray(signature.events) ? signature.events : [];
  const events = currentEvents.some((item: any) => item.id === event.id)
    ? currentEvents
    : [...currentEvents, eventSnapshot];

  const { error: updateError } = await admin
    .from("document_signatures")
    .update({
      status: documentStatus(refreshedDocument, signers),
      signers,
      events,
      ...urls,
    })
    .eq("id", signature.id);
  if (updateError) throw new Error(updateError.message);

  if (urls.signed_file_url) {
    await admin
      .from("documents")
      .update({ signed_file_url: urls.signed_file_url, status: "signed" })
      .eq("id", signature.document_id);
  }

  return { ok: true, ignored: false };
}
