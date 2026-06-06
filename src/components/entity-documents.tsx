/* eslint-disable @typescript-eslint/no-explicit-any -- New document table is accessed through a narrow Supabase adapter. */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  EntityDocument,
  EntityDocumentType,
  openEntityDocument,
  removeEntityDocument,
  uploadEntityDocument,
} from "@/lib/entity-documents";
import { translatedErrorMessage } from "@/lib/error-messages";

const DEFAULT_KINDS = [
  ["identity", "Identidade / CNH"],
  ["cpf", "CPF"],
  ["address_proof", "Comprovante de endereco"],
  ["contract", "Contrato"],
  ["receipt", "Recibo"],
  ["other", "Outro documento"],
] as const;

export function EntityDocuments({
  entityType,
  entityId,
  title = "Documentos digitalizados",
  accept = ".pdf,image/*,.doc,.docx",
}: {
  entityType: EntityDocumentType;
  entityId?: string | null;
  title?: string;
  accept?: string;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState("identity");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const queryKey = ["entity-documents", entityType, entityId];

  const { data: documents = [] } = useQuery({
    queryKey,
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entity_documents")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EntityDocument[];
    },
  });

  async function upload(files: FileList | null) {
    if (!files?.length || !entityId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadEntityDocument({ entityType, entityId, documentKind: kind, label, file });
      }
      setLabel("");
      await qc.invalidateQueries({ queryKey });
      toast.success(files.length > 1 ? "Documentos enviados" : "Documento enviado");
    } catch (error: any) {
      toast.error(translatedErrorMessage(error, "Nao foi possivel enviar o documento."));
    } finally {
      setUploading(false);
    }
  }

  async function open(document: EntityDocument) {
    try {
      await openEntityDocument(document);
    } catch (error: any) {
      toast.error(translatedErrorMessage(error, "Nao foi possivel abrir o documento."));
    }
  }

  async function remove(document: EntityDocument) {
    if (!confirm(`Excluir ${document.file_name}?`)) return;
    try {
      await removeEntityDocument(document);
      await qc.invalidateQueries({ queryKey });
      toast.success("Documento excluido");
    } catch (error: any) {
      toast.error(translatedErrorMessage(error, "Nao foi possivel excluir o documento."));
    }
  }

  return (
    <section className="rounded-lg border bg-muted/20 p-3">
      <Label className="mb-2 block font-semibold">{title}</Label>
      {!entityId ? (
        <p className="text-xs text-muted-foreground">
          Salve o cadastro para anexar documentos separadamente.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_KINDS.map(([value, text]) => (
                  <SelectItem key={value} value={value}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Descricao opcional"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            <Button asChild variant="outline" disabled={uploading}>
              <label className="cursor-pointer">
                <Upload className="mr-1.5 h-4 w-4" />
                {uploading ? "Enviando..." : "Anexar"}
                <input
                  className="hidden"
                  type="file"
                  multiple
                  accept={accept}
                  onChange={(event) => upload(event.target.files)}
                />
              </label>
            </Button>
          </div>
          <div className="mt-3 space-y-1">
            {documents.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum documento anexado.</p>
            )}
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center gap-2 rounded border bg-background px-2 py-1.5 text-xs"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{document.label || document.file_name}</div>
                  {document.label && (
                    <div className="truncate text-muted-foreground">{document.file_name}</div>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Abrir documento"
                  onClick={() => open(document)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Excluir documento"
                  onClick={() => remove(document)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
