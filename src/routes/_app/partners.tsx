import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { EntityDocuments } from "@/components/entity-documents";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { translatedErrorMessage } from "@/lib/error-messages";
import {
  composeAddress,
  lookupCepAddress,
  maskCep,
  maskCnh,
  maskCpfCnpj,
  maskPhone,
  maskRg,
} from "@/lib/form-utils";

export const Route = createFileRoute("/_app/partners")({ component: PartnersPage });

const EMPTY = {
  full_name: "",
  cpf_cnpj: "",
  phone: "",
  email: "",
  address: "",
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  rg: "",
  cnh: "",
  pix_key: "",
  property_owner_name: "",
  property_owner_phone: "",
  property_owner_email: "",
  property_address: "",
  property_notes: "",
  payment_preference: "",
  payment_details: "",
  notes: "",
  active: false,
  registration_status: "pending",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Reprovado",
};

function PartnersPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [editing, setEditing] = useState<any | null>(null);
  const [searchingCep, setSearchingCep] = useState(false);

  const { data: partners = [] } = useQuery({
    queryKey: ["capture-partners"],
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capture_partners")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["capture-partners"] });
  }

  function set(field: string, value: any) {
    setEditing((current: any) => ({ ...current, [field]: value }));
  }

  async function lookupCep() {
    setSearchingCep(true);
    try {
      const address = await lookupCepAddress(editing?.zip_code ?? "");
      setEditing((current: any) => {
        const next = { ...current, ...address };
        return { ...next, address: composeAddress(next) };
      });
      toast.success("Endereco preenchido pelo CEP");
    } catch (error: any) {
      toast.error(translatedErrorMessage(error, "Nao foi possivel buscar o CEP."));
    } finally {
      setSearchingCep(false);
    }
  }

  async function save() {
    if (!editing.full_name?.trim()) return toast.error("Informe o nome do parceiro");
    const payload = { ...editing, address: composeAddress(editing) };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    const query = editing.id
      ? supabase.from("capture_partners").update(payload).eq("id", editing.id)
      : supabase.from("capture_partners").insert(payload);
    const { error } = await query;
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel salvar o parceiro."));
    toast.success(editing.id ? "Parceiro atualizado" : "Parceiro cadastrado");
    setEditing(null);
    refresh();
  }

  function composeIndicatedPropertyAddress(current: any) {
    return composeAddress({
      address: current.property_address,
      zip_code: current.property_zip_code,
      street: current.property_street,
      number: current.property_number,
      complement: current.property_complement,
      neighborhood: current.property_neighborhood,
      city: current.property_city,
      state: current.property_state,
    });
  }

  async function review(id: string, registration_status: "approved" | "rejected") {
    const { error } = await supabase
      .from("capture_partners")
      .update({ registration_status, active: registration_status === "approved" })
      .eq("id", id);
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel revisar o parceiro."));
    toast.success(registration_status === "approved" ? "Parceiro aprovado" : "Parceiro reprovado");
    refresh();
  }

  async function remove(partner: any) {
    if (!confirm(`Excluir o parceiro ${partner.full_name}?`)) return;
    const { error } = await supabase.from("capture_partners").delete().eq("id", partner.id);
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel excluir o parceiro."));
    toast.success("Parceiro excluido");
    refresh();
  }

  return (
    <div>
      <PageHeader
        title="Parceiros"
        description="Indicadores de oportunidades de venda e aluguel"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/partner-registration" target="_blank">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Formulario publico
              </Link>
            </Button>
            <Button onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo parceiro
            </Button>
          </div>
        }
      />
      <div className="p-4 md:p-8">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Parceiro</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">CPF / CNPJ</th>
                <th className="px-4 py-3">Analise</th>
                <th className="px-4 py-3">Ativo</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum parceiro cadastrado.
                  </td>
                </tr>
              )}
              {partners.map((partner: any) => (
                <tr key={partner.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{partner.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {partner.email || "Sem e-mail"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{partner.phone || "-"}</td>
                  <td className="px-4 py-3">{partner.cpf_cnpj || "-"}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        partner.registration_status === "rejected"
                          ? "destructive"
                          : partner.registration_status === "approved"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {STATUS_LABEL[partner.registration_status] ?? partner.registration_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{partner.active ? "Sim" : "Nao"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {isAdmin && partner.registration_status !== "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Aprovar"
                          onClick={() => review(partner.id, "approved")}
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {isAdmin && partner.registration_status !== "rejected" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reprovar"
                          onClick={() => review(partner.id, "rejected")}
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => setEditing(partner)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir"
                        onClick={() => remove(partner)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={!!editing}
        onOpenChange={(value) => {
          if (!value) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar parceiro" : "Novo parceiro"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo *">
                <Input
                  autoComplete="name"
                  value={editing.full_name ?? ""}
                  onChange={(e) => set("full_name", e.target.value)}
                />
              </Field>
              <Field label="CPF ou CNPJ">
                <Input
                  value={editing.cpf_cnpj ?? ""}
                  onChange={(e) => set("cpf_cnpj", maskCpfCnpj(e.target.value))}
                />
              </Field>
              <Field label="Telefone / WhatsApp">
                <Input
                  autoComplete="tel"
                  value={editing.phone ?? ""}
                  onChange={(e) => set("phone", maskPhone(e.target.value))}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  autoComplete="email"
                  value={editing.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="RG">
                <Input
                  value={editing.rg ?? ""}
                  onChange={(e) => set("rg", maskRg(e.target.value))}
                />
              </Field>
              <Field label="CNH">
                <Input
                  inputMode="numeric"
                  value={editing.cnh ?? ""}
                  onChange={(e) => set("cnh", maskCnh(e.target.value))}
                />
              </Field>
              <div className="sm:col-span-2">
                <AddressFields
                  form={editing}
                  set={set}
                  searchingCep={searchingCep}
                  lookupCep={lookupCep}
                />
              </div>
              <div className="sm:col-span-2 rounded-md border bg-muted/10 p-3">
                <h3 className="mb-2 text-sm font-semibold">Imovel indicado</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nome do proprietario/responsavel">
                    <Input
                      value={editing.property_owner_name ?? ""}
                      onChange={(e) => set("property_owner_name", e.target.value)}
                    />
                  </Field>
                  <Field label="Telefone / WhatsApp do proprietario">
                    <Input
                      value={editing.property_owner_phone ?? ""}
                      onChange={(e) => set("property_owner_phone", maskPhone(e.target.value))}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="E-mail do proprietario">
                      <Input
                        type="email"
                        value={editing.property_owner_email ?? ""}
                        onChange={(e) => set("property_owner_email", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Endereco do imovel indicado">
                      <Input
                        value={editing.property_address ?? composeIndicatedPropertyAddress(editing)}
                        onChange={(e) => set("property_address", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Dados adicionais do imovel">
                      <Textarea
                        rows={3}
                        value={editing.property_notes ?? ""}
                        onChange={(e) => set("property_notes", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                <h3 className="mb-2 text-sm font-semibold">Dados internos de bonificacao</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Preencha somente em ambiente interno, apos aprovacao do parceiro.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Forma de recebimento">
                    <Select
                      value={editing.payment_preference ?? "none"}
                      onValueChange={(value) =>
                        set("payment_preference", value === "none" ? null : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nao informado</SelectItem>
                        <SelectItem value="pix">Pix</SelectItem>
                        <SelectItem value="ted">TED / transferencia</SelectItem>
                        <SelectItem value="deposito">Deposito bancario</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="outro">Outra operacao</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Chave Pix (se usar Pix)">
                    <Input
                      value={editing.pix_key ?? ""}
                      onChange={(e) => set("pix_key", e.target.value)}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Dados bancarios ou instrucoes de pagamento">
                      <Textarea
                        rows={3}
                        value={editing.payment_details ?? ""}
                        onChange={(e) => set("payment_details", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Field label="Observacoes">
                  <Textarea
                    rows={3}
                    value={editing.notes ?? ""}
                    onChange={(e) => set("notes", e.target.value)}
                  />
                </Field>
              </div>
              {isAdmin && editing.registration_status === "approved" && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch
                    checked={editing.active}
                    onCheckedChange={(active) => setEditing({ ...editing, active })}
                  />
                  <Label>Parceiro ativo para novas indicacoes</Label>
                </div>
              )}
              <div className="sm:col-span-2">
                <EntityDocuments entityType="capture_partner" entityId={editing.id} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}

function AddressFields({
  form,
  set,
  searchingCep,
  lookupCep,
}: {
  form: any;
  set: (field: string, value: any) => void;
  searchingCep: boolean;
  lookupCep: () => void;
}) {
  return (
    <section className="rounded-md border bg-muted/10 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <MapPin className="h-4 w-4 text-primary" />
        Endereco com busca por CEP
      </div>
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <Field label="CEP">
          <div className="flex gap-2">
            <Input
              autoComplete="postal-code"
              placeholder="00000-000"
              value={form.zip_code ?? ""}
              onChange={(e) => set("zip_code", maskCep(e.target.value))}
              onBlur={() => {
                if (String(form.zip_code ?? "").replace(/\D/g, "").length === 8) lookupCep();
              }}
            />
            <Button type="button" variant="outline" onClick={lookupCep} disabled={searchingCep}>
              {searchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>
        </Field>
        <Field label="Rua / Logradouro">
          <Input
            autoComplete="address-line1"
            value={form.street ?? ""}
            onChange={(e) => set("street", e.target.value)}
          />
        </Field>
        <Field label="Numero">
          <Input
            autoComplete="address-line2"
            value={form.number ?? ""}
            onChange={(e) => set("number", e.target.value)}
          />
        </Field>
        <Field label="Complemento">
          <Input
            value={form.complement ?? ""}
            onChange={(e) => set("complement", e.target.value)}
          />
        </Field>
        <Field label="Bairro">
          <Input
            value={form.neighborhood ?? ""}
            onChange={(e) => set("neighborhood", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <Field label="Cidade">
            <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="UF">
            <Input
              maxLength={2}
              value={form.state ?? ""}
              onChange={(e) => set("state", e.target.value.toUpperCase())}
            />
          </Field>
        </div>
      </div>
      <div className="mt-3">
        <Field label="Endereco completo">
          <Input
            value={form.address ?? composeAddress(form)}
            onChange={(e) => set("address", e.target.value)}
          />
        </Field>
      </div>
    </section>
  );
}
