/* eslint-disable @typescript-eslint/no-explicit-any -- Homologation joins generated documents and uploaded attachments. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  ExternalLink,
  FileText,
  Link2,
  Paperclip,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { EntityDocuments } from "@/components/entity-documents";
import { formatDateBR } from "@/lib/format-date";
import { translatedErrorMessage } from "@/lib/error-messages";
import { openEntityDocument } from "@/lib/entity-documents";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/rentals/homologation")({
  component: HomologationPage,
});

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  in_review: "Em homologacao",
  archived: "Arquivado",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  open: "outline",
  in_review: "secondary",
  archived: "default",
};

function HomologationPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("manager");
  const [filter, setFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: contracts = [] } = useQuery({
    queryKey: ["homologation-contracts"],
    queryFn: async () =>
      (
        await supabase
          .from("rental_contracts")
          .select(
            "*, properties(code, title), tenant:clients!rental_contracts_tenant_client_id_fkey(id, full_name), landlord:clients!rental_contracts_landlord_client_id_fkey(id, full_name)",
          )
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["homologation-documents"],
    queryFn: async () =>
      (await supabase.from("documents").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["homologation-attachments"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("entity_documents")
          .select("*")
          .eq("entity_type", "rental_contract")
      ).data ?? [],
  });

  const docsByContract = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const d of documents) {
      if (d.rental_contract_id) (map[d.rental_contract_id] ??= []).push(d);
    }
    return map;
  }, [documents]);

  const attachmentsByContract = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const a of attachments) (map[a.entity_id] ??= []).push(a);
    return map;
  }, [attachments]);

  const candidateDocsByContract = useMemo(() => {
    // Documents not yet linked to ANY contract, but matching this contract's property or clients
    const unlinked = documents.filter((d: any) => !d.rental_contract_id);
    const map: Record<string, any[]> = {};
    for (const c of contracts as any[]) {
      const clientIds = [c.tenant_client_id, c.landlord_client_id].filter(Boolean);
      map[c.id] = unlinked.filter(
        (d: any) =>
          (c.property_id && d.property_id === c.property_id) ||
          (d.client_id && clientIds.includes(d.client_id)),
      );
    }
    return map;
  }, [documents, contracts]);

  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (contracts as any[]).filter((c) => {
      if (filter === "active" && c.homologation_status === "archived") return false;
      if (filter === "archived" && c.homologation_status !== "archived") return false;
      if (filter === "in_review" && c.homologation_status !== "in_review") return false;
      if (q) {
        const hay = [c.code, c.properties?.code, c.properties?.title, c.tenant?.full_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contracts, filter, search]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["homologation-contracts"] });
    qc.invalidateQueries({ queryKey: ["homologation-documents"] });
    qc.invalidateQueries({ queryKey: ["homologation-attachments"] });
  }

  async function linkDocument(contractId: string, documentId: string) {
    const { error } = await (supabase as any)
      .from("documents")
      .update({ rental_contract_id: contractId })
      .eq("id", documentId);
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel vincular."));
    toast.success("Documento vinculado");
    // mark contract as in_review if it was open
    await (supabase as any)
      .from("rental_contracts")
      .update({ homologation_status: "in_review" })
      .eq("id", contractId)
      .eq("homologation_status", "open");
    invalidate();
  }

  async function unlinkDocument(documentId: string) {
    const { error } = await (supabase as any)
      .from("documents")
      .update({ rental_contract_id: null, archived_at: null })
      .eq("id", documentId);
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel desvincular."));
    invalidate();
  }

  async function toggleSigned(doc: any) {
    const { error } = await (supabase as any)
      .from("documents")
      .update({
        signed_at: doc.signed_at ? null : new Date().toISOString(),
        status: doc.signed_at ? doc.status : "signed",
      })
      .eq("id", doc.id);
    if (error) return toast.error(translatedErrorMessage(error, "Falha ao atualizar assinatura."));
    invalidate();
  }

  async function archiveContract(contract: any) {
    const docs = docsByContract[contract.id] ?? [];
    if (docs.length === 0) return toast.error("Vincule pelo menos um documento antes de arquivar.");
    const unsigned = docs.filter((d) => !d.signed_at);
    if (unsigned.length > 0) {
      if (
        !confirm(
          `Existem ${unsigned.length} documento(s) sem assinatura confirmada. Arquivar mesmo assim?`,
        )
      )
        return;
    }
    const now = new Date().toISOString();
    const { error } = await (supabase as any)
      .from("rental_contracts")
      .update({ homologation_status: "archived", archived_at: now })
      .eq("id", contract.id);
    if (error) return toast.error(translatedErrorMessage(error, "Falha ao arquivar."));
    await (supabase as any)
      .from("documents")
      .update({ archived_at: now })
      .eq("rental_contract_id", contract.id);
    toast.success("Contrato arquivado");
    invalidate();
  }

  async function reopenContract(contract: any) {
    const { error } = await (supabase as any)
      .from("rental_contracts")
      .update({ homologation_status: "in_review", archived_at: null })
      .eq("id", contract.id);
    if (error) return toast.error(translatedErrorMessage(error, "Falha ao reabrir."));
    await (supabase as any)
      .from("documents")
      .update({ archived_at: null })
      .eq("rental_contract_id", contract.id);
    invalidate();
  }

  return (
    <div>
      <PageHeader
        title="Homologacao de Contratos"
        description="Centralize, valide assinaturas e arquive os documentos de cada contrato de aluguel"
        actions={
          <Button variant="outline" asChild>
            <Link to="/rentals">
              <Undo2 className="mr-1.5 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="p-4 md:p-8 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <Label>Buscar</Label>
            <Input
              placeholder="Codigo, imovel ou inquilino"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-56">
            <Label>Status</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Em aberto e em homologacao</SelectItem>
                <SelectItem value="in_review">Somente em homologacao</SelectItem>
                <SelectItem value="archived">Arquivados</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredContracts.length === 0 && (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum contrato encontrado.
          </div>
        )}

        <div className="space-y-3">
          {filteredContracts.map((c: any) => {
            const docs = docsByContract[c.id] ?? [];
            const atts = attachmentsByContract[c.id] ?? [];
            const candidates = candidateDocsByContract[c.id] ?? [];
            const open = expanded[c.id];
            const totalSigned = docs.filter((d) => d.signed_at).length;
            return (
              <div key={c.id} className="rounded-lg border bg-card">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  onClick={() => setExpanded((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                >
                  <div className="flex flex-1 flex-wrap items-center gap-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">
                        {c.code} — {c.properties?.title ?? c.properties?.code ?? "Imovel"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Inquilino: {c.tenant?.full_name ?? "—"}
                        {c.landlord?.full_name ? ` · Proprietario: ${c.landlord.full_name}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {totalSigned}/{docs.length} assinados · {atts.length} anexos
                    </span>
                    <Badge variant={STATUS_VARIANT[c.homologation_status] ?? "outline"}>
                      {STATUS_LABEL[c.homologation_status] ?? c.homologation_status}
                    </Badge>
                  </div>
                </button>

                {open && (
                  <div className="space-y-4 border-t p-4">
                    <section>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Documentos gerados</h3>
                      </div>
                      {docs.length === 0 ? (
                        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                          Nenhum documento vinculado. Gere modelos em{" "}
                          <Link to="/documents/new" className="underline">
                            Novo documento
                          </Link>{" "}
                          ou vincule abaixo.
                        </div>
                      ) : (
                        <ul className="divide-y rounded-md border">
                          {docs.map((d) => (
                            <li
                              key={d.id}
                              className="flex flex-wrap items-center gap-2 p-3 text-sm"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {d.title || d.code} <span className="text-xs text-muted-foreground">({d.kind})</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Criado em {formatDateBR(d.created_at)}
                                  {d.signed_at && ` · Assinado em ${formatDateBR(d.signed_at)}`}
                                </div>
                              </div>
                              <Badge variant={d.signed_at ? "default" : "outline"}>
                                {d.signed_at ? "Assinado" : "Pendente"}
                              </Badge>
                              {canManage && c.homologation_status !== "archived" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleSigned(d)}
                                    title={d.signed_at ? "Reverter assinatura" : "Marcar assinado"}
                                  >
                                    <CheckCircle2
                                      className={`h-4 w-4 ${d.signed_at ? "text-emerald-600" : ""}`}
                                    />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => unlinkDocument(d.id)}
                                    title="Desvincular"
                                  >
                                    <Link2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      {canManage && c.homologation_status !== "archived" && candidates.length > 0 && (
                        <div className="mt-3 rounded-md border bg-muted/20 p-3">
                          <div className="mb-2 text-xs font-medium text-muted-foreground">
                            Vincular documento existente
                          </div>
                          <Select
                            value=""
                            onValueChange={(value) => value && linkDocument(c.id, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`${candidates.length} documento(s) compativel(is)`} />
                            </SelectTrigger>
                            <SelectContent>
                              {candidates.map((d: any) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.title || d.code} ({d.kind})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </section>

                    <section>
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                        <Paperclip className="h-4 w-4" />
                        Anexos do contrato
                      </h3>
                      {c.homologation_status === "archived" ? (
                        <ul className="divide-y rounded-md border">
                          {atts.length === 0 && (
                            <li className="p-3 text-center text-xs text-muted-foreground">
                              Nenhum anexo.
                            </li>
                          )}
                          {atts.map((a: any) => (
                            <li key={a.id} className="flex items-center gap-2 p-3 text-sm">
                              <Paperclip className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="font-medium">{a.label ?? a.file_name}</div>
                                <div className="text-xs text-muted-foreground">{a.document_kind}</div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEntityDocument(a)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EntityDocuments
                          entityType="rental_contract"
                          entityId={c.id}
                          title="Anexos digitalizados"
                        />
                      )}
                    </section>

                    {canManage && (
                      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                        {c.homologation_status !== "archived" ? (
                          <Button onClick={() => archiveContract(c)}>
                            <Archive className="mr-1.5 h-4 w-4" />
                            Arquivar contrato homologado
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={() => reopenContract(c)}>
                            <ArchiveRestore className="mr-1.5 h-4 w-4" />
                            Reabrir
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
