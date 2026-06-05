/* eslint-disable @typescript-eslint/no-explicit-any -- New document table is accessed through a narrow Supabase adapter. */
import { supabase } from "@/integrations/supabase/client";

export const ENTITY_DOCUMENT_BUCKET = "business-documents";

export type EntityDocumentType =
  | "client"
  | "broker"
  | "capture_partner"
  | "property"
  | "rental_contract"
  | "sale_contract";

export interface EntityDocument {
  id: string;
  entity_type: EntityDocumentType;
  entity_id: string;
  document_kind: string;
  label: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export async function uploadEntityDocument(input: {
  entityType: EntityDocumentType;
  entityId: string;
  documentKind?: string;
  label?: string;
  file: File;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessao expirada. Entre novamente.");

  const storagePath = `${user.id}/${input.entityType}/${input.entityId}/${crypto.randomUUID()}-${safeFileName(input.file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(ENTITY_DOCUMENT_BUCKET)
    .upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error: rowError } = await (supabase as any).from("entity_documents").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    document_kind: input.documentKind ?? "other",
    label: input.label?.trim() || null,
    file_name: input.file.name,
    storage_path: storagePath,
    mime_type: input.file.type || null,
    file_size: input.file.size,
    created_by: user.id,
  });

  if (rowError) {
    await supabase.storage.from(ENTITY_DOCUMENT_BUCKET).remove([storagePath]);
    throw rowError;
  }
}

export async function openEntityDocument(document: EntityDocument) {
  const { data, error } = await supabase.storage
    .from(ENTITY_DOCUMENT_BUCKET)
    .createSignedUrl(document.storage_path, 60);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export async function removeEntityDocument(document: EntityDocument) {
  const { error: storageError } = await supabase.storage
    .from(ENTITY_DOCUMENT_BUCKET)
    .remove([document.storage_path]);
  if (storageError) throw storageError;

  const { error: rowError } = await (supabase as any)
    .from("entity_documents")
    .delete()
    .eq("id", document.id);
  if (rowError) throw rowError;
}
