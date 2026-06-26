/* eslint-disable @typescript-eslint/no-explicit-any -- Documents and signature tables are accessed through narrow UI adapters. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState } from "react";
import {
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileSignature,
  FileText,
  Link as LinkIcon,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_DOCUMENT_KINDS,
  DOCUMENT_KIND_LABEL,
  richTextToPlainText,
} from "@/lib/doc-placeholders";
import { generateDocumentPdf } from "@/lib/pdf-utils";
import { formatDateBR } from "@/lib/format-date";
import { translatedErrorMessage } from "@/lib/error-messages";
import {
  createAutentiqueSignatureLink,
  refreshAutentiqueDocumentStatus,
  sendDocumentToAutentique,
} from "@/lib/autentique/autentique.functions";

export const Route = createFileRoute("/_app/documents/")({ component: DocumentsList });

type DeliveryMethod = "email" | "whatsapp" | "manual";

type SignerForm = {
  id: string;
  name: string;
  email: string;
  phone: string;
  deliveryMethod: DeliveryMethod;
};

const db = supabase as any;

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  issued: "Emitido",
  sent: "Enviado",
  created: "Criado",
  pending: "Pendente",
  viewed: "Visualizado",
  signed: "Assinado",
  rejected: "Recusado",
  pending_approval: "Aguardando aprovação",
  cancelled: "Cancelado",
};

function emptySigner(deliveryMethod: DeliveryMethod = "email"): SignerForm {
  return {
    id: crypto.randomUUID(),
    name: "",
    email: "",
    phone: "",
    deliveryMethod,
  };
}

function signatureStatusLabel(status?: string | null) {
  return STATUS_LABEL[status ?? ""] ?? status ?? "Pendente";
}

function buildPdfFileName(document: any) {
  const code = document.code ?? "documento";
  return `${code} - ${document.title || "Documento ImobiFlow"}.pdf`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",").pop() ?? "");
    reader.readAsDataURL(blob);
  });
}

async function copyText(text?: string | null) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  toast.success("Link copiado");
}

async function buildDocumentPdf(document: any) {
  return generateDocumentPdf({
    code: document.code,
    locator: document.code,
    title: document.title || "Documento ImobiFlow",
    bodyHtml: document.body_rendered ?? "",
    bodyText: richTextToPlainText(document.body_rendered ?? ""),
  });
}

function DocumentsList() {
  const qc = useQueryClient();
  const sendToAutentique = useServerFn(sendDocumentToAutentique);
  const refreshSignature = useServerFn(refreshAutentiqueDocumentStatus);
  const createSignatureLink = useServerFn(createAutentiqueSignatureLink);
  const [editing, setEditing] = useState<any | null>(null);
  const [signingDocument, setSigningDocument] = useState<any | null>(null);
  const [signers, setSigners] = useState<SignerForm[]>([emptySigner()]);
  const [sandbox, setSandbox] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [linkingPublicId, setLinkingPublicId] = useState<string | null>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: async () =>
      (await supabase.from("documents").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });
  const { data: signatures = [] } = useQuery({
    queryKey: ["document_signatures"],
    queryFn: async () =>
      (await db.from("document_signatures").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["document_templates"],
    queryFn: async () =>
      (await supabase.from("document_templates").select("*").order("name")).data ?? [],
  });
  const { data: documentKinds = DEFAULT_DOCUMENT_KINDS } = useQuery({
    queryKey: ["document_kinds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_kinds")
        .select("*")
        .eq("active", true)
        .order("sort_order")
        .order("label");
      if (error) return DEFAULT_DOCUMENT_KINDS;
      return data?.length ? data : DEFAULT_DOCUMENT_KINDS;
    },
  });

  const signatureByDocumentId = useMemo(() => {
    const map = new Map<string, any>();
    for (const signature of signatures) {
      if (!map.has(signature.document_id)) map.set(signature.document_id, signature);
    }
    return map;
  }, [signatures]);

  const kindLabelById = Object.fromEntries(documentKinds.map((kind: any) => [kind.id, kind.label]));
  const kindLabel = (kind: string) => kindLabelById[kind] ?? DOCUMENT_KIND_LABEL[kind] ?? kind;

  async function saveEdit() {
    if (!editing) return;
    const payload = {
      title: editing.title,
      status: editing.status,
      notes: editing.notes,
    };
    const { error } = await supabase.from("documents").update(payload).eq("id", editing.id);

    if (error) {
      const isUnknownStatus =
        error.code === "22P02" || /document_status|invalid input value/i.test(error.message ?? "");

      if (isUnknownStatus) {
        const { error: fallbackError } = await supabase
          .from("documents")
          .update({ title: editing.title, notes: editing.notes })
          .eq("id", editing.id);

        if (!fallbackError) {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["documents"] });
          toast.warning("Documento salvo. Aplique as migrations para habilitar este status.");
          return;
        }
      }

      return toast.error(translatedErrorMessage(error, "Nao foi possivel atualizar o documento."));
    }

    setEditing(null);
    qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Documento atualizado");
  }

  async function remove(id: string) {
    if (!confirm("Excluir este documento?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel excluir o documento."));
    qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Documento excluído");
  }

  async function viewDocument(document: any) {
    try {
      const pdf = await buildDocumentPdf(document);
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(translatedErrorMessage(error, "Nao foi possivel visualizar o documento."));
    }
  }

  async function downloadDocument(document: any) {
    try {
      const pdf = await buildDocumentPdf(document);
      pdf.save(buildPdfFileName(document));
    } catch (error) {
      toast.error(translatedErrorMessage(error, "Nao foi possivel baixar o documento."));
    }
  }

  function openSignatureModal(document: any) {
    setSigningDocument(document);
    setSandbox(true);
    setSigners([emptySigner()]);
  }

  function updateSigner(id: string, patch: Partial<SignerForm>) {
    setSigners((current) =>
      current.map((signer) => (signer.id === id ? { ...signer, ...patch } : signer)),
    );
  }

  function removeSigner(id: string) {
    setSigners((current) => (current.length === 1 ? current : current.filter((s) => s.id !== id)));
  }

  function validateSigners() {
    const cleaned = signers.map((signer) => ({
      name: signer.name.trim(),
      email: signer.email.trim(),
      phone: signer.phone.trim(),
      deliveryMethod: signer.deliveryMethod,
    }));

    const invalid = cleaned.find((signer) => {
      if (signer.deliveryMethod === "email") return !signer.email;
      if (signer.deliveryMethod === "whatsapp") return !signer.phone;
      return !signer.name;
    });

    if (invalid) {
      toast.error("Preencha os dados obrigatórios de cada signatário.");
      return null;
    }

    return cleaned;
  }

  async function sendForSignature() {
    if (!signingDocument) return;
    const cleanedSigners = validateSigners();
    if (!cleanedSigners) return;

    setSending(true);
    try {
      const pdf = await generateDocumentPdf({
        code: signingDocument.code,
        locator: signingDocument.code,
        title: signingDocument.title || "Documento ImobiFlow",
        bodyHtml: signingDocument.body_rendered ?? "",
        bodyText: richTextToPlainText(signingDocument.body_rendered ?? ""),
      });
      const blob = pdf.output("blob");
      const fileBase64 = await blobToBase64(blob);
      const result = (await sendToAutentique({
        data: {
          documentId: signingDocument.id,
          fileName: buildPdfFileName(signingDocument),
          fileBase64,
          sandbox,
          signers: cleanedSigners,
        },
      })) as any;

      setSigningDocument(null);
      qc.invalidateQueries({ queryKey: ["document_signatures"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success(
        result?.signature?.sandbox
          ? "Documento enviado em modo sandbox."
          : "Documento enviado para assinatura digital.",
      );
    } catch (error) {
      console.error("[Autentique] send failed", error);
      toast.error(
        translatedErrorMessage(error, "Nao foi possivel enviar para assinatura. Tente novamente."),
      );
    } finally {
      setSending(false);
    }
  }

  async function refreshStatus(signatureId: string) {
    setRefreshingId(signatureId);
    try {
      await refreshSignature({ data: { signatureId } });
      qc.invalidateQueries({ queryKey: ["document_signatures"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Status atualizado");
    } catch (error) {
      console.error("[Autentique] refresh failed", error);
      toast.error(translatedErrorMessage(error, "Nao foi possivel atualizar o status."));
    } finally {
      setRefreshingId(null);
    }
  }

  async function generateManualLink(signatureId: string, publicId: string) {
    setLinkingPublicId(publicId);
    try {
      const result = (await createSignatureLink({ data: { signatureId, publicId } })) as any;
      qc.invalidateQueries({ queryKey: ["document_signatures"] });
      await copyText(result?.link);
    } catch (error) {
      console.error("[Autentique] link failed", error);
      toast.error(translatedErrorMessage(error, "Nao foi possivel gerar o link manual."));
    } finally {
      setLinkingPublicId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Documentos"
        description="Modelos e geração de fichas, contratos e autorizações"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/documents/templates">
                <Settings2 className="mr-1.5 h-4 w-4" />
                Modelos ({templates.length})
              </Link>
            </Button>
            <Button asChild>
              <Link to="/documents/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Novo documento
              </Link>
            </Button>
          </>
        }
      />
      <div className="p-4 md:p-8">
        {docs.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Nenhum documento gerado ainda</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Crie um modelo primeiro em <strong>Modelos</strong> e depois gere um documento.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Código</th>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-left">Título</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Assinatura</th>
                  <th className="px-4 py-2 text-left">Criado em</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((document: any) => {
                  const signature = signatureByDocumentId.get(document.id);
                  return (
                    <Fragment key={document.id}>
                      <tr className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-xs">{document.code}</td>
                        <td className="px-4 py-2">{kindLabel(document.kind)}</td>
                        <td className="px-4 py-2">{document.title ?? "—"}</td>
                        <td className="px-4 py-2 text-xs">
                          {signatureStatusLabel(document.status)}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {signature ? (
                            <Badge
                              variant={signature.status === "signed" ? "default" : "secondary"}
                            >
                              {signatureStatusLabel(signature.status)}
                              {signature.sandbox ? " · sandbox" : ""}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">Não enviada</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {formatDateBR(document.created_at)}
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewDocument(document)}
                            title="Visualizar documento"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadDocument(document)}
                            title="Baixar PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openSignatureModal(document)}
                            title="Enviar para assinatura digital"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing({ ...document })}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(document.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                      {signature && (
                        <tr className="border-t bg-muted/10">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="rounded-md border bg-background p-3">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2 text-sm font-semibold">
                                    <FileSignature className="h-4 w-4" />
                                    Painel de assinatura
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Autentique: {signature.autentique_document_id}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {signature.signed_file_url && (
                                    <Button size="sm" variant="outline" asChild>
                                      <a
                                        href={signature.signed_file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                        PDF assinado
                                      </a>
                                    </Button>
                                  )}
                                  {signature.audit_file_url && (
                                    <Button size="sm" variant="outline" asChild>
                                      <a
                                        href={signature.audit_file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Auditoria
                                      </a>
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={refreshingId === signature.id}
                                    onClick={() => refreshStatus(signature.id)}
                                  >
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                    {refreshingId === signature.id
                                      ? "Atualizando…"
                                      : "Atualizar status"}
                                  </Button>
                                </div>
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                {(signature.signers ?? []).map((signer: any) => (
                                  <div key={signer.public_id} className="rounded border p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-medium">
                                          {signer.name ||
                                            signer.email ||
                                            signer.phone ||
                                            "Signatário"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {[signer.email, signer.phone]
                                            .filter(Boolean)
                                            .join(" · ") || "Link manual"}
                                        </p>
                                      </div>
                                      <Badge variant="secondary">
                                        {signatureStatusLabel(signer.status)}
                                      </Badge>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {signer.link ? (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => copyText(signer.link)}
                                          >
                                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                                            Copiar link
                                          </Button>
                                          <Button size="sm" variant="outline" asChild>
                                            <a href={signer.link} target="_blank" rel="noreferrer">
                                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                              Abrir link
                                            </a>
                                          </Button>
                                        </>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={linkingPublicId === signer.public_id}
                                          onClick={() =>
                                            generateManualLink(signature.id, signer.public_id)
                                          }
                                        >
                                          <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                                          {linkingPublicId === signer.public_id
                                            ? "Gerando…"
                                            : "Gerar link manual"}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar documento {editing?.code}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input
                  value={editing.title ?? ""}
                  onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editing.status}
                  onValueChange={(value) => setEditing({ ...editing, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="issued">Emitido</SelectItem>
                    <SelectItem value="sent">Enviado</SelectItem>
                    <SelectItem value="created">Criado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="viewed">Visualizado</SelectItem>
                    <SelectItem value="signed">Assinado</SelectItem>
                    <SelectItem value="rejected">Recusado</SelectItem>
                    <SelectItem value="pending_approval">Aguardando aprovação</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Input
                  value={editing.notes ?? ""}
                  onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!signingDocument} onOpenChange={(open) => !open && setSigningDocument(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar para assinatura digital</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <p className="font-medium">{signingDocument?.title ?? signingDocument?.code}</p>
              <p className="text-xs text-muted-foreground">
                O PDF será gerado no ImobiFlow e enviado para a Autentique pelo servidor.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border p-3">
              <Checkbox
                id="autentique-sandbox"
                checked={sandbox}
                onCheckedChange={(checked) => setSandbox(checked === true)}
              />
              <Label htmlFor="autentique-sandbox" className="text-sm">
                Enviar em modo sandbox
              </Label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Signatários</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSigners([...signers, emptySigner()])}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
              {signers.map((signer, index) => (
                <div key={signer.id} className="rounded-md border p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">Signatário {index + 1}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={signers.length === 1}
                      onClick={() => removeSigner(signer.id)}
                    >
                      Remover
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">Envio</Label>
                      <Select
                        value={signer.deliveryMethod}
                        onValueChange={(value) =>
                          updateSigner(signer.id, { deliveryMethod: value as DeliveryMethod })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="manual">Link manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Nome</Label>
                      <Input
                        value={signer.name}
                        onChange={(event) => updateSigner(signer.id, { name: event.target.value })}
                        placeholder="Obrigatório para link manual"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">E-mail</Label>
                      <Input
                        value={signer.email}
                        onChange={(event) => updateSigner(signer.id, { email: event.target.value })}
                        placeholder="Obrigatório para envio por e-mail"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">WhatsApp</Label>
                      <Input
                        value={signer.phone}
                        onChange={(event) => updateSigner(signer.id, { phone: event.target.value })}
                        placeholder="Obrigatório para WhatsApp"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSigningDocument(null)}>
              Cancelar
            </Button>
            <Button onClick={sendForSignature} disabled={sending}>
              <Send className="mr-1.5 h-4 w-4" />
              {sending ? "Enviando…" : "Enviar para assinatura digital"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
