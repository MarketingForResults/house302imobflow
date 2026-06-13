import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, KeyboardEvent, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  DEFAULT_DOCUMENT_KINDS,
  DOCUMENT_KIND_LABEL,
  PLACEHOLDER_GROUPS,
  PLACEHOLDER_LABELS,
  sanitizeRichTextHtml,
} from "@/lib/doc-placeholders";
import { translatedErrorMessage } from "@/lib/error-messages";
import { toast } from "sonner";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  Eye,
  FileUp,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pencil,
  Plus,
  Redo2,
  Sparkles,
  Table2,
  Trash2,
  Underline,
  Undo2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_app/documents/templates")({ component: TemplatesPage });

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textToEditorHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function stripRtf(value: string) {
  return value
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-f]{2}/gi, "")
    .replace(/\\[a-z]+\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function suggestPlaceholders(value: string) {
  return value
    .replace(
      /(nome(?: completo)? do cliente|cliente)\s*:\s*[_\s.]{3,}/gi,
      "$1: {{client.full_name}}",
    )
    .replace(/cpf(?: do cliente)?\s*:\s*[_\s.]{3,}/gi, "CPF: {{client.cpf}}")
    .replace(/(endere[cç]o do im[oó]vel|im[oó]vel)\s*:\s*[_\s.]{3,}/gi, "$1: {{property.address}}")
    .replace(/(c[oó]digo do im[oó]vel)\s*:\s*[_\s.]{3,}/gi, "$1: {{property.code}}")
    .replace(
      /(nome(?: completo)? do corretor|corretor)\s*:\s*[_\s.]{3,}/gi,
      "$1: {{broker.full_name}}",
    )
    .replace(/creci\s*:\s*[_\s.]{3,}/gi, "CRECI: {{broker.creci}}")
    .replace(/(data|data atual)\s*:\s*[_\s./-]{3,}/gi, "$1: {{date.today}}");
}

type ImportPreview = {
  fileName: string;
  body: string;
  text: string;
};

function TemplatesPage() {
  const qc = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const bodyDraftRef = useRef("");
  const [editing, setEditing] = useState<any | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [newKindName, setNewKindName] = useState("");
  const [editingKind, setEditingKind] = useState<any | null>(null);
  const [activePlaceholderGroup, setActivePlaceholderGroup] = useState<string>(
    Object.keys(PLACEHOLDER_GROUPS)[0],
  );

  const { data: templates = [], refetch } = useQuery({
    queryKey: ["document_templates"],
    queryFn: async () =>
      (
        await supabase
          .from("document_templates")
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: documentKinds = DEFAULT_DOCUMENT_KINDS, refetch: refetchDocumentKinds } = useQuery({
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

  const kindLabelById = Object.fromEntries(documentKinds.map((kind: any) => [kind.id, kind.label]));
  const kindLabel = (kind: string) => kindLabelById[kind] ?? DOCUMENT_KIND_LABEL[kind] ?? kind;
  const isDocumentKindInUse = (kindId: string) =>
    templates.some((template: any) => template.kind === kindId);

  function openEditor(template: any) {
    bodyDraftRef.current = template.body ?? "";
    setImportPreview(null);
    setEditing(template);
    setEditorVersion((version) => version + 1);
  }

  function newTemplate() {
    openEditor({ name: "", kind: documentKinds[0]?.id ?? "custom", body: "", active: true });
  }

  function slugifyKind(label: string) {
    return label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);
  }

  function sortDocumentKinds(kinds: any[]) {
    return [...kinds].sort(
      (a, b) =>
        Number(a.sort_order ?? 100) - Number(b.sort_order ?? 100) ||
        String(a.label ?? "").localeCompare(String(b.label ?? ""), "pt-BR"),
    );
  }

  async function addDocumentKind() {
    const label = newKindName.trim();
    if (!label) return toast.error("Informe o nome da modalidade");
    const id = slugifyKind(label);
    if (!id) return toast.error("Use letras ou numeros no nome da modalidade");
    if (documentKinds.some((kind: any) => kind.id === id))
      return toast.error("Esta modalidade ja existe");

    const payload = {
      id,
      label,
      active: true,
      system_kind: false,
      sort_order: documentKinds.length * 10 + 100,
    };
    const { data, error } = await supabase
      .from("document_kinds")
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel adicionar a modalidade."));
    const createdKind = data ?? payload;
    qc.setQueryData(["document_kinds"], (current: any[] | undefined) =>
      sortDocumentKinds([
        ...(current ?? documentKinds).filter((kind: any) => kind.id !== id),
        createdKind,
      ]),
    );
    setNewKindName("");
    setEditing((current: any) => (current ? { ...current, kind: id } : current));
    await refetchDocumentKinds();
    toast.success("Modalidade adicionada");
  }

  async function updateDocumentKind() {
    if (!editingKind?.label?.trim()) return toast.error("Informe o nome da modalidade");
    const { data, error } = await supabase
      .from("document_kinds")
      .update({
        label: editingKind.label.trim(),
        sort_order: Number(editingKind.sort_order ?? 100),
        active: editingKind.active ?? true,
      })
      .eq("id", editingKind.id)
      .select("*")
      .maybeSingle();
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel atualizar a modalidade."));
    qc.setQueryData(["document_kinds"], (current: any[] | undefined) =>
      sortDocumentKinds(
        (current ?? documentKinds).map((kind: any) =>
          kind.id === editingKind.id ? (data ?? editingKind) : kind,
        ),
      ),
    );
    setEditingKind(null);
    await refetchDocumentKinds();
    toast.success("Modalidade atualizada");
  }

  async function removeDocumentKind(kind: any) {
    if (!confirm(`Excluir a modalidade ${kind.label}?`)) return;
    const inUse = isDocumentKindInUse(kind.id);
    const query =
      inUse || kind.system_kind
        ? supabase.from("document_kinds").update({ active: false }).eq("id", kind.id)
        : supabase.from("document_kinds").delete().eq("id", kind.id);
    const { error } = await query;
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel excluir a modalidade."));
    qc.setQueryData(["document_kinds"], (current: any[] | undefined) =>
      (current ?? documentKinds).filter((candidate: any) => candidate.id !== kind.id),
    );
    if (editing?.kind === kind.id) {
      const fallbackKind = documentKinds.find((candidate: any) => candidate.id !== kind.id);
      setEditing({ ...editing, kind: fallbackKind?.id ?? "custom" });
    }
    await refetchDocumentKinds();
    toast.success(inUse || kind.system_kind ? "Modalidade desativada" : "Modalidade excluida");
  }

  async function save() {
    if (!editing.name?.trim()) return toast.error("Informe um nome");
    const payload = {
      ...editing,
      body: sanitizeRichTextHtml(
        editorRef.current?.innerHTML ?? bodyDraftRef.current ?? editing.body ?? "",
      ),
    };
    if (payload.id) {
      const { error } = await supabase
        .from("document_templates")
        .update(payload)
        .eq("id", payload.id);
      if (error)
        return toast.error(translatedErrorMessage(error, "Nao foi possivel salvar o modelo."));
    } else {
      const { error } = await supabase.from("document_templates").insert(payload);
      if (error)
        return toast.error(translatedErrorMessage(error, "Nao foi possivel salvar o modelo."));
    }
    toast.success("Modelo salvo");
    setEditing(null);
    refetch();
    qc.invalidateQueries({ queryKey: ["document_templates"] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir este modelo?")) return;
    const { error } = await supabase.from("document_templates").delete().eq("id", id);
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel excluir o modelo."));
    refetch();
  }

  function runEditorCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    bodyDraftRef.current = editorRef.current?.innerHTML ?? bodyDraftRef.current;
  }

  function insertLink() {
    const url = prompt("Informe o link completo (https://...)");
    if (!url) return;
    runEditorCommand("createLink", url);
  }

  async function insertImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem valida.");
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    });
    runEditorCommand(
      "insertHTML",
      `<p style="text-align:center"><img src="${dataUrl}" alt="${file.name}" style="max-width:100%;height:auto" /></p>`,
    );
  }

  function insertTable() {
    const rows = Math.max(1, Number(prompt("Quantidade de linhas", "3")) || 3);
    const cols = Math.max(1, Number(prompt("Quantidade de colunas", "3")) || 3);
    const cells = Array.from({ length: rows })
      .map(
        (_, rowIndex) =>
          `<tr>${Array.from({ length: cols })
            .map(() =>
              rowIndex === 0
                ? '<th style="border:1px solid #ddd;padding:6px;text-align:left">Cabecalho</th>'
                : '<td style="border:1px solid #ddd;padding:6px">Texto</td>',
            )
            .join("")}</tr>`,
      )
      .join("");
    runEditorCommand(
      "insertHTML",
      `<table style="width:100%;border-collapse:collapse;margin:8px 0"><tbody>${cells}</tbody></table><p><br></p>`,
    );
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    const key = event.key.toLowerCase();
    const commandByKey: Record<string, string> = {
      b: "bold",
      i: "italic",
      u: "underline",
      z: event.shiftKey ? "redo" : "undo",
      y: "redo",
    };
    const command = commandByKey[key];
    if (!command) return;
    event.preventDefault();
    runEditorCommand(command);
  }

  function insertPlaceholder(placeholder: string) {
    if (!editing) return;
    editorRef.current?.focus();
    const token = ` {{${placeholder}}} `;
    if (!document.execCommand("insertText", false, token)) {
      bodyDraftRef.current = `${editorRef.current?.innerHTML ?? bodyDraftRef.current ?? editing.body ?? ""}${token}`;
      setEditing((current: any) => ({ ...current, body: bodyDraftRef.current }));
      setEditorVersion((version) => version + 1);
      return;
    }
    bodyDraftRef.current = editorRef.current?.innerHTML ?? bodyDraftRef.current;
  }

  async function extractText(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "txt") return file.text();
    if (extension === "rtf") return stripRtf(await file.text());
    if (extension === "docx") {
      const mammoth = await import("mammoth/mammoth.browser");
      return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    }
    if (extension === "pdf") {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map((item: any) => ("str" in item ? item.str : "")).join(" "));
      }
      return pages.join("\n\n");
    }
    throw new Error("Formato não suportado. Envie PDF, DOCX, RTF ou TXT.");
  }

  async function importDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const extracted = (await extractText(file))
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .trim();
      if (!extracted) throw new Error("Não foi possível reconhecer texto neste arquivo.");
      const body = textToEditorHtml(suggestPlaceholders(extracted));
      setImportPreview({ fileName: file.name, body, text: extracted });
      toast.success("Documento reconhecido. Confira a pré-visualização antes de aplicar.");
    } catch (error: any) {
      toast.error(translatedErrorMessage(error, "Nao foi possivel importar o documento."));
    } finally {
      setImporting(false);
    }
  }

  function applyImportPreview() {
    if (!importPreview) return;
    const body = importPreview.body;
    bodyDraftRef.current = body;
    setEditing((current: any) => ({
      ...(current ?? {}),
      name: current?.name || importPreview.fileName.replace(/\.[^.]+$/, ""),
      body,
    }));
    setEditorVersion((version) => version + 1);
    setImportPreview(null);
    toast.success("Documento aplicado ao modelo. Revise o conteúdo antes de salvar.");
  }

  return (
    <div>
      <PageHeader
        title="Modelos de documentos"
        description="Crie modelos padronizados, importe documentos e insira campos automáticos"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/documents">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <Button onClick={newTemplate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo modelo
            </Button>
          </>
        }
      />

      <div className="grid gap-6 p-4 md:p-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {editing ? (
            <div className="rounded-lg border bg-card p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs">Nome do modelo</Label>
                  <Input
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Tipo</Label>
                  <Select
                    value={editing.kind}
                    onValueChange={(value) => setEditing({ ...editing, kind: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {documentKinds.map((kind: any) => (
                        <SelectItem key={kind.id} value={kind.id}>
                          {kind.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 rounded-md border bg-muted/10 p-3">
                <Label className="mb-1.5 block text-xs">Gerenciar modalidades de documento</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex.: Carta proposta, Termo de vistoria..."
                    value={newKindName}
                    onChange={(event) => setNewKindName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addDocumentKind();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addDocumentKind}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {documentKinds.map((kind: any) => {
                    const isEditingKind = editingKind?.id === kind.id;
                    return (
                      <span
                        key={kind.id}
                        className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs"
                      >
                        {isEditingKind ? (
                          <Input
                            className="h-6 w-48 rounded-full px-2 text-xs"
                            value={editingKind.label ?? ""}
                            onChange={(event) =>
                              setEditingKind({ ...editingKind, label: event.target.value })
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") updateDocumentKind();
                              if (event.key === "Escape") setEditingKind(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          kind.label
                        )}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-primary"
                          onClick={() =>
                            isEditingKind ? updateDocumentKind() : setEditingKind({ ...kind })
                          }
                          title={isEditingKind ? "Salvar modalidade" : "Editar modalidade"}
                        >
                          {isEditingKind ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Pencil className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            isEditingKind ? setEditingKind(null) : removeDocumentKind(kind)
                          }
                          title={
                            isEditingKind ? "Cancelar edição" : "Excluir ou desativar modalidade"
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 p-2">
                <div>
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Importação inteligente
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Reconhece PDF, Word (.docx), WordPad (.rtf) e texto (.txt).
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.rtf,.txt"
                  className="hidden"
                  onChange={importDocument}
                />
                <div className="flex flex-wrap gap-2">
                  {importPreview && (
                    <Button type="button" variant="secondary" size="sm">
                      <Eye className="mr-1.5 h-4 w-4" />
                      Prévia aberta
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={importing}
                    onClick={() => fileRef.current?.click()}
                  >
                    <FileUp className="mr-1.5 h-4 w-4" />
                    {importing ? "Reconhecendo..." : "Importar documento"}
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                <Label className="mb-1.5 block text-xs">Corpo do modelo</Label>
                <div className="overflow-hidden rounded-md border">
                  <input
                    ref={imageRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={insertImage}
                  />
                  <div
                    className="flex flex-wrap gap-1 border-b bg-muted/30 p-1.5"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Desfazer"
                      onClick={() => runEditorCommand("undo")}
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Refazer"
                      onClick={() => runEditorCommand("redo")}
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                    <span className="mx-1 border-l" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Paragrafo"
                      onClick={() => runEditorCommand("formatBlock", "p")}
                    >
                      P
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Titulo 1"
                      onClick={() => runEditorCommand("formatBlock", "h1")}
                    >
                      <Heading1 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Titulo 2"
                      onClick={() => runEditorCommand("formatBlock", "h2")}
                    >
                      <Heading2 className="h-4 w-4" />
                    </Button>
                    <span className="mx-1 border-l" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Negrito"
                      onClick={() => runEditorCommand("bold")}
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Itálico"
                      onClick={() => runEditorCommand("italic")}
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Sublinhado"
                      onClick={() => runEditorCommand("underline")}
                    >
                      <Underline className="h-4 w-4" />
                    </Button>
                    <span className="mx-1 border-l" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Inserir link"
                      onClick={insertLink}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Inserir imagem"
                      onClick={() => imageRef.current?.click()}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Inserir tabela"
                      onClick={insertTable}
                    >
                      <Table2 className="h-4 w-4" />
                    </Button>
                    <span className="mx-1 border-l" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Lista"
                      onClick={() => runEditorCommand("insertUnorderedList")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Lista numerada"
                      onClick={() => runEditorCommand("insertOrderedList")}
                    >
                      <ListOrdered className="h-4 w-4" />
                    </Button>
                    <span className="mx-1 border-l" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Alinhar à esquerda"
                      onClick={() => runEditorCommand("justifyLeft")}
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Centralizar"
                      onClick={() => runEditorCommand("justifyCenter")}
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Alinhar à direita"
                      onClick={() => runEditorCommand("justifyRight")}
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Justificar"
                      onClick={() => runEditorCommand("justifyFull")}
                    >
                      <AlignJustify className="h-4 w-4" />
                    </Button>
                  </div>
                  <div
                    key={editorVersion}
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="min-h-[420px] bg-background p-4 text-sm leading-relaxed outline-none [&_a]:text-primary [&_a]:underline [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_img]:my-3 [&_img]:max-w-full [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted/40 [&_th]:p-2 [&_ul]:list-disc"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(bodyDraftRef.current) }}
                    onKeyDown={handleEditorKeyDown}
                    onInput={(event) => {
                      bodyDraftRef.current = event.currentTarget.innerHTML;
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Use os campos automáticos ao lado para preencher dados do imóvel, cliente e
                  corretor ao gerar o documento.
                </p>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button onClick={save}>Salvar modelo</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              {templates.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground md:p-8">
                  Nenhum modelo criado.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Nome</th>
                      <th className="px-4 py-2 text-left">Tipo</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template: any) => (
                      <tr key={template.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2">{template.name}</td>
                        <td className="px-4 py-2 text-xs">{kindLabel(template.kind)}</td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEditor(template)}>
                            Editar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => remove(template.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-1 text-sm font-semibold">Campos automáticos</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Clique em um campo para inseri-lo na posição atual do texto.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1 border-b pb-2">
              {Object.keys(PLACEHOLDER_GROUPS).map((group) => (
                <button
                  key={group}
                  onClick={() => setActivePlaceholderGroup(group)}
                  className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    activePlaceholderGroup === group
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>

            <div className="grid gap-1.5 pb-2 max-h-[600px] overflow-y-auto pr-1">
              {(PLACEHOLDER_GROUPS as any)[activePlaceholderGroup].map((placeholder: string) => (
                <button
                  key={placeholder}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertPlaceholder(placeholder)}
                  disabled={!editing}
                  className="group flex flex-col items-start rounded-md border bg-muted/20 px-2.5 py-2 text-left transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:hover:bg-muted/20 disabled:hover:text-foreground"
                  title={`Insere {{${placeholder}}}`}
                >
                  <span className="text-xs font-medium">{PLACEHOLDER_LABELS[placeholder]}</span>
                  <code className="mt-0.5 text-[10px] text-muted-foreground transition-colors group-hover:text-primary-foreground/85">
                    {`{{${placeholder}}}`}
                  </code>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={!!importPreview}
        onOpenChange={(open) => {
          if (!open) setImportPreview(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Pré-visualização do documento
            </DialogTitle>
          </DialogHeader>
          {importPreview && (
            <div className="min-h-0 space-y-3">
              <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{importPreview.fileName}</span>
                <span className="mx-2">•</span>
                {importPreview.text.length.toLocaleString("pt-BR")} caracteres reconhecidos
              </div>
              <div className="max-h-[58vh] overflow-auto rounded-md border bg-background p-5 text-sm leading-relaxed shadow-inner [&_p]:mb-2">
                <div
                  dangerouslySetInnerHTML={{
                    __html: sanitizeRichTextHtml(importPreview.body),
                  }}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setImportPreview(null)}>
              Cancelar importação
            </Button>
            <Button onClick={applyImportPreview}>
              <Check className="mr-1.5 h-4 w-4" />
              Aplicar ao modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
