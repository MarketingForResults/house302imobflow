import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  FileUp,
  Italic,
  List,
  ListOrdered,
  Plus,
  Redo2,
  Sparkles,
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

function TemplatesPage() {
  const qc = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyDraftRef = useRef("");
  const [editing, setEditing] = useState<any | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [importing, setImporting] = useState(false);
  const [newKindName, setNewKindName] = useState("");

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

  const kindLabelById = Object.fromEntries(documentKinds.map((kind: any) => [kind.id, kind.label]));
  const kindLabel = (kind: string) => kindLabelById[kind] ?? DOCUMENT_KIND_LABEL[kind] ?? kind;

  function openEditor(template: any) {
    bodyDraftRef.current = template.body ?? "";
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

  async function addDocumentKind() {
    const label = newKindName.trim();
    if (!label) return toast.error("Informe o nome da modalidade");
    const id = slugifyKind(label);
    if (!id) return toast.error("Use letras ou numeros no nome da modalidade");
    if (documentKinds.some((kind: any) => kind.id === id))
      return toast.error("Esta modalidade ja existe");

    const { error } = await supabase.from("document_kinds").insert({
      id,
      label,
      active: true,
      system_kind: false,
      sort_order: documentKinds.length * 10 + 100,
    });
    if (error) return toast.error(error.message);
    setNewKindName("");
    setEditing((current: any) => (current ? { ...current, kind: id } : current));
    qc.invalidateQueries({ queryKey: ["document_kinds"] });
    toast.success("Modalidade adicionada");
  }

  async function removeDocumentKind(kind: any) {
    if (kind.system_kind) return toast.error("As modalidades padrao nao podem ser excluidas");
    if (templates.some((template: any) => template.kind === kind.id)) {
      return toast.error("Esta modalidade esta em uso por um modelo");
    }
    if (!confirm(`Excluir a modalidade ${kind.label}?`)) return;
    const { error } = await supabase.from("document_kinds").delete().eq("id", kind.id);
    if (error) return toast.error(error.message);
    if (editing?.kind === kind.id) setEditing({ ...editing, kind: "custom" });
    qc.invalidateQueries({ queryKey: ["document_kinds"] });
    toast.success("Modalidade excluida");
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
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("document_templates").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Modelo salvo");
    setEditing(null);
    refetch();
    qc.invalidateQueries({ queryKey: ["document_templates"] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir este modelo?")) return;
    const { error } = await supabase.from("document_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refetch();
  }

  function runEditorCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    bodyDraftRef.current = editorRef.current?.innerHTML ?? bodyDraftRef.current;
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
      bodyDraftRef.current = body;
      setEditing((current: any) => ({
        ...current,
        name: current.name || file.name.replace(/\.[^.]+$/, ""),
        body,
      }));
      setEditorVersion((version) => version + 1);
      toast.success("Documento importado e pré-formatado. Revise o conteúdo antes de salvar.");
    } catch (error: any) {
      toast.error(error.message ?? "Não foi possível importar o documento");
    } finally {
      setImporting(false);
    }
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
                  {documentKinds.map((kind: any) => (
                    <span
                      key={kind.id}
                      className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs"
                    >
                      {kind.label}
                      {!kind.system_kind && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeDocumentKind(kind)}
                          title="Excluir modalidade"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
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

              <div className="mt-4">
                <Label className="mb-1.5 block text-xs">Corpo do modelo</Label>
                <div className="overflow-hidden rounded-md border">
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
                    className="min-h-[420px] bg-background p-4 text-sm leading-relaxed outline-none [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(bodyDraftRef.current) }}
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
          <Accordion type="multiple" defaultValue={Object.keys(PLACEHOLDER_GROUPS)}>
            {Object.entries(PLACEHOLDER_GROUPS).map(([group, items]) => (
              <AccordionItem key={group} value={group}>
                <AccordionTrigger className="py-2.5 text-xs font-semibold">
                  {group}
                </AccordionTrigger>
                <AccordionContent className="grid gap-1 pb-3">
                  {items.map((placeholder) => (
                    <button
                      key={placeholder}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertPlaceholder(placeholder)}
                      disabled={!editing}
                      className="group rounded border bg-muted/20 px-2 py-1.5 text-left transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:hover:bg-muted/20 disabled:hover:text-foreground"
                      title={`Insere {{${placeholder}}}`}
                    >
                      <span className="block text-xs font-medium">
                        {PLACEHOLDER_LABELS[placeholder]}
                      </span>
                      <code className="block text-[10px] text-muted-foreground transition-colors group-hover:text-primary-foreground/85">{`{{${placeholder}}}`}</code>
                    </button>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
