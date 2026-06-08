/* eslint-disable @typescript-eslint/no-explicit-any -- Settings form mirrors nullable Supabase app_settings fields while generated types are stale. */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ExternalLink, Pencil, RefreshCw, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { refreshEconomicIndexes } from "@/lib/economic-indexes.functions";
import { translatedErrorMessage } from "@/lib/error-messages";
import { formatDateBR } from "@/lib/format-date";
import {
  composeAddress,
  lookupCepAddress,
  maskCep,
  maskCnpj,
  maskCpf,
  maskPhone,
} from "@/lib/form-utils";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

type InstitutionalPersonType = "juridica" | "fisica";

const INSTITUTIONAL_FIELDS = [
  "company_person_type",
  "company_legal_name",
  "company_trade_name",
  "company_cnpj",
  "company_creci",
  "company_zip_code",
  "company_street",
  "company_number",
  "company_complement",
  "company_neighborhood",
  "company_city",
  "company_state",
  "company_address",
  "company_phone",
  "company_email",
] as const;

const COMPANY_ADDRESS_FIELDS = new Set([
  "company_zip_code",
  "company_street",
  "company_number",
  "company_complement",
  "company_neighborhood",
  "company_city",
  "company_state",
]);

const INDEX_OPTIONS = [
  { code: "IPCA", label: "IPCA (IBGE)" },
  { code: "IGPM", label: "IGP-M (FGV)" },
  { code: "INCC", label: "INCC-M (FGV)" },
  { code: "IVAR", label: "IVAR (FGV)" },
];

type SettingsState = Record<string, any>;

interface FieldProps {
  settings: SettingsState;
  isAdmin: boolean;
  setSetting: (key: string, value: any) => void;
  k: string;
  label: string;
  type?: string;
  step?: string;
  suffix?: string;
  mask?: (value: string) => string;
  placeholder?: string;
  inputMode?: any;
  disabled?: boolean;
  readOnly?: boolean;
  onValueChange?: (value: string) => void;
  institutionalFieldsDisabled?: boolean;
}

function Field({
  settings,
  isAdmin,
  setSetting,
  k,
  label,
  type = "number",
  step = "0.01",
  suffix,
  mask,
  placeholder,
  inputMode,
  disabled,
  readOnly,
  onValueChange,
  institutionalFieldsDisabled,
}: FieldProps) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type={type}
          step={step}
          placeholder={placeholder}
          inputMode={inputMode}
          readOnly={readOnly}
          value={settings[k] ?? ""}
          disabled={
            !isAdmin ||
            disabled ||
            (k.startsWith("company_") && Boolean(institutionalFieldsDisabled))
          }
          onChange={(e) => {
            const value = mask ? mask(e.target.value) : e.target.value;
            if (onValueChange) onValueChange(value);
            else setSetting(k, value);
          }}
        />
        {suffix && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function SettingsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [s, setS] = useState<any>(null);
  const [termPreview, setTermPreview] = useState<{ start: string; months: string }>({
    start: new Date().toISOString().slice(0, 10),
    months: "",
  });
  const [saving, setSaving] = useState(false);
  const [savingInstitutional, setSavingInstitutional] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cepSearching, setCepSearching] = useState(false);
  const [institutionalEditing, setInstitutionalEditing] = useState(false);
  const [indexes, setIndexes] = useState<any[]>([]);
  const refresh = useServerFn(refreshEconomicIndexes);

  async function loadIndexes() {
    const { data } = await supabase
      .from("economic_indexes")
      .select("*")
      .order("fetched_at", { ascending: false });
    setIndexes(data ?? []);
  }

  async function loadSettings() {
    const { data } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
    setS(data ?? {});
  }

  useEffect(() => {
    loadSettings();
    loadIndexes();
  }, []);

  async function save() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("app_settings")
      .update({
        rental_late_fee_pct: Number(s.rental_late_fee_pct),
        rental_daily_interest_pct: Number(s.rental_daily_interest_pct),
        rental_grace_days: Number(s.rental_grace_days),
        rental_default_due_day: Number(s.rental_default_due_day),
        rental_default_term_months: Number(s.rental_default_term_months),
        rental_default_contract_type: s.rental_default_contract_type,
        rental_default_readjustment_index: s.rental_default_readjustment_index,
        rental_default_readjustment_month: s.rental_default_readjustment_month
          ? Number(s.rental_default_readjustment_month)
          : null,
        contract_default_commission_pct: Number(s.contract_default_commission_pct),
        sale_default_commission_pct: Number(s.sale_default_commission_pct ?? 0),
        sale_itbi_pct: Number(s.sale_itbi_pct ?? 0),
        sale_default_payment_method: s.sale_default_payment_method ?? "a_vista",
        sale_deed_type: s.sale_deed_type ?? "escritura_publica",
        sale_default_down_payment_pct: Number(s.sale_default_down_payment_pct ?? 0),
        company_person_type: s.company_person_type === "fisica" ? "fisica" : "juridica",
        company_legal_name: s.company_legal_name ?? null,
        company_trade_name: s.company_trade_name ?? null,
        company_cnpj: s.company_cnpj ?? null,
        company_creci: s.company_creci ?? null,
        company_zip_code: s.company_zip_code ?? null,
        company_street: s.company_street ?? null,
        company_number: s.company_number ?? null,
        company_complement: s.company_complement ?? null,
        company_neighborhood: s.company_neighborhood ?? null,
        company_city: s.company_city ?? null,
        company_state: s.company_state ?? null,
        company_address: s.company_address ?? null,
        company_phone: s.company_phone ?? null,
        company_email: s.company_email ?? null,
        rental_contract_notes: s.rental_contract_notes ?? null,
        sale_contract_notes: s.sale_contract_notes ?? null,
        updated_by: user?.id,
      })
      .eq("id", true);
    setSaving(false);
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel salvar as configuracoes."));
    toast.success("Configurações salvas.");
  }

  function composeCompanyAddress(settings: any) {
    return composeAddress({
      zip_code: settings.company_zip_code,
      street: settings.company_street,
      number: settings.company_number,
      complement: settings.company_complement,
      neighborhood: settings.company_neighborhood,
      city: settings.company_city,
      state: settings.company_state,
      address: settings.company_address,
    });
  }

  function buildInstitutionalPatch(settings = s) {
    const patch: Record<string, any> = {};
    for (const field of INSTITUTIONAL_FIELDS) patch[field] = settings[field] ?? null;
    patch.company_person_type = settings.company_person_type === "fisica" ? "fisica" : "juridica";
    patch.company_address = composeCompanyAddress(settings) || settings.company_address || null;
    return patch;
  }

  function setInstitutionalValue(key: string, value: string) {
    setS((current: any) => {
      const next = { ...current, [key]: value };
      if (COMPANY_ADDRESS_FIELDS.has(key)) next.company_address = composeCompanyAddress(next);
      return next;
    });
  }

  function newInstitutionalData() {
    setS((current: any) => ({
      ...current,
      company_person_type: "juridica",
      company_legal_name: null,
      company_trade_name: null,
      company_cnpj: null,
      company_creci: null,
      company_zip_code: null,
      company_street: null,
      company_number: null,
      company_complement: null,
      company_neighborhood: null,
      company_city: null,
      company_state: null,
      company_address: null,
      company_phone: null,
      company_email: null,
    }));
    setInstitutionalEditing(true);
  }

  async function saveInstitutionalData() {
    setSavingInstitutional(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("app_settings")
      .update({ ...buildInstitutionalPatch(), updated_by: user?.id })
      .eq("id", true);
    setSavingInstitutional(false);
    if (error) return toast.error(error.message);
    setInstitutionalEditing(false);
    toast.success("Cadastro institucional salvo.");
    await loadSettings();
  }

  async function deleteInstitutionalData() {
    if (!window.confirm("Excluir os dados institucionais deste cadastro?")) return;
    const patch: Record<string, any> = Object.fromEntries(INSTITUTIONAL_FIELDS.map((field) => [field, null]));
    patch.company_person_type = "juridica";
    setSavingInstitutional(true);
    const { error } = await (supabase as any).from("app_settings").update(patch).eq("id", true);
    setSavingInstitutional(false);
    if (error) return toast.error(error.message);
    setInstitutionalEditing(false);
    toast.success("Cadastro institucional excluido.");
    await loadSettings();
  }

  async function fillCompanyAddressByCep() {
    if (!s.company_zip_code) return toast.error("Informe o CEP para buscar o endereco.");
    setCepSearching(true);
    try {
      const address = await lookupCepAddress(s.company_zip_code);
      setS((current: any) => {
        const next = {
          ...current,
          company_zip_code: address.zip_code,
          company_street: address.street,
          company_neighborhood: address.neighborhood,
          company_city: address.city,
          company_state: address.state,
        };
        next.company_address = composeCompanyAddress(next);
        return next;
      });
      toast.success("Endereco preenchido pelo CEP.");
    } catch (e: any) {
      toast.error(e.message ?? "Nao foi possivel buscar o CEP");
    } finally {
      setCepSearching(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const response = await refresh();
      const results = Array.isArray(response?.results) ? response.results : [];
      if (!results.length) {
        toast.error("A consulta nao retornou indices. Tente novamente em alguns minutos.");
        return;
      }
      const ok = results.filter((r: any) => r.ok).length;
      if (ok > 0) {
        toast.success(`${ok}/${results.length} índices atualizados nos sites oficiais (BCB/SGS)`);
      } else {
        const firstError = (results as any[]).find((r) => !r.ok)?.error;
        toast.error(translatedErrorMessage(firstError, "Nenhum indice foi atualizado nos sites oficiais."));
      }
      await loadIndexes();
    } catch (e: any) {
      toast.error(translatedErrorMessage(e, "Falha ao consultar indices."));
    } finally {
      setRefreshing(false);
    }
  }

  if (!s) return <div className="p-4 md:p-8 text-sm text-muted-foreground">Carregando…</div>;

  function setSetting(key: string, value: any) {
    setS((current: any) => ({ ...current, [key]: value }));
  }

  const selectedIndex = indexes.find((i) => i.code === s.rental_default_readjustment_index);
  const companyPersonType: InstitutionalPersonType =
    s.company_person_type === "fisica" ? "fisica" : "juridica";
  const isIndividual = companyPersonType === "fisica";
  const hasInstitutionalData = INSTITUTIONAL_FIELDS.some(
    (field) => field !== "company_person_type" && Boolean(s[field]),
  );
  const institutionalFieldsDisabled = !institutionalEditing || savingInstitutional;
  const fieldProps = { settings: s, isAdmin, setSetting, institutionalFieldsDisabled };

  return (
    <div>
      <PageHeader
        title="Configurações"
        description={
          isAdmin
            ? "Parâmetros financeiros, vigência e índices oficiais"
            : "Somente leitura — apenas administradores podem alterar"
        }
        actions={
          isAdmin ? (
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          ) : null
        }
      />

      <div className="space-y-6 p-4 md:p-8">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase text-muted-foreground">
            Dados institucionais para documentos
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {isIndividual
              ? "Informações do corretor independente disponíveis para contratos, autorizações e outros modelos."
              : "Informações da imobiliária disponíveis para contratos, autorizações e outros modelos."}
          </p>
          {isAdmin && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={newInstitutionalData}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Novo
              </Button>
              {!institutionalEditing ? (
                <Button size="sm" variant="outline" onClick={() => setInstitutionalEditing(true)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Editar
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={saveInstitutionalData} disabled={savingInstitutional}>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {savingInstitutional ? "Salvando..." : "Salvar cadastro"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await loadSettings();
                      setInstitutionalEditing(false);
                    }}
                    disabled={savingInstitutional}
                  >
                    Cancelar
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={deleteInstitutionalData}
                disabled={!hasInstitutionalData || savingInstitutional}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Excluir
              </Button>
            </div>
          )}
          <div className="mb-5 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label className="text-xs">Tipo de cadastro institucional</Label>
              <div className="mt-1 text-xs text-muted-foreground">
                {isIndividual ? "Corretor pessoa física" : "Imobiliária pessoa jurídica"}
              </div>
            </div>
            <ToggleGroup
              type="single"
              value={companyPersonType}
              disabled={!isAdmin || institutionalFieldsDisabled}
              onValueChange={(value) => {
                if (!value) return;
                setS({ ...s, company_person_type: value as InstitutionalPersonType });
              }}
              className="w-full justify-start rounded-md border bg-muted/20 p-1 sm:w-auto"
            >
              <ToggleGroupItem value="juridica" className="h-8 flex-1 px-3 sm:flex-none">
                Pessoa jurídica
              </ToggleGroupItem>
              <ToggleGroupItem value="fisica" className="h-8 flex-1 px-3 sm:flex-none">
                Pessoa física
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              {...fieldProps}
              k="company_legal_name"
              label={isIndividual ? "Nome completo" : "Razão social"}
              type="text"
            />
            <Field
              {...fieldProps}
              k="company_trade_name"
              label={isIndividual ? "Nome profissional" : "Nome fantasia"}
              type="text"
            />
            <Field
              {...fieldProps}
              k="company_cnpj"
              label={isIndividual ? "CPF" : "CNPJ"}
              type="text"
              mask={isIndividual ? maskCpf : maskCnpj}
              inputMode="numeric"
              placeholder={isIndividual ? "000.000.000-00" : "00.000.000/0000-00"}
            />
            <Field
              {...fieldProps}
              k="company_creci"
              label={isIndividual ? "CRECI do corretor" : "CRECI da imobiliária"}
              type="text"
            />
            <Field
              {...fieldProps}
              k="company_phone"
              label="Telefone"
              type="text"
              mask={maskPhone}
            />
            <Field {...fieldProps} k="company_email" label="E-mail" type="email" />
            <div>
              <Label className="text-xs">CEP</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={s.company_zip_code ?? ""}
                  disabled={!isAdmin || institutionalFieldsDisabled}
                  onChange={(e) =>
                    setInstitutionalValue("company_zip_code", maskCep(e.target.value))
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={fillCompanyAddressByCep}
                  disabled={!isAdmin || institutionalFieldsDisabled || cepSearching}
                >
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                  {cepSearching ? "Buscando..." : "Buscar"}
                </Button>
              </div>
            </div>
            <Field
              {...fieldProps}
              k="company_street"
              label="Rua"
              type="text"
              onValueChange={(value: string) => setInstitutionalValue("company_street", value)}
            />
            <Field
              {...fieldProps}
              k="company_number"
              label="Número"
              type="text"
              onValueChange={(value: string) => setInstitutionalValue("company_number", value)}
            />
            <Field
              {...fieldProps}
              k="company_complement"
              label="Complemento"
              type="text"
              onValueChange={(value: string) =>
                setInstitutionalValue("company_complement", value)
              }
            />
            <Field
              {...fieldProps}
              k="company_neighborhood"
              label="Bairro"
              type="text"
              onValueChange={(value: string) =>
                setInstitutionalValue("company_neighborhood", value)
              }
            />
            <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
              <Field
                {...fieldProps}
                k="company_city"
                label="Cidade"
                type="text"
                onValueChange={(value: string) => setInstitutionalValue("company_city", value)}
              />
              <Field
                {...fieldProps}
                k="company_state"
                label="UF"
                type="text"
                onValueChange={(value: string) =>
                  setInstitutionalValue("company_state", value.toUpperCase().slice(0, 2))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                {...fieldProps}
                k="company_address"
                label="Endereço completo"
                type="text"
                readOnly
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">
            Aluguéis — multa, juros e recálculo
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              {...fieldProps}
              k="rental_late_fee_pct"
              label="Multa por atraso"
              suffix="% sobre o valor devido"
            />
            <Field
              {...fieldProps}
              k="rental_daily_interest_pct"
              label="Juros diários (mora)"
              suffix="% ao dia"
            />
            <Field
              {...fieldProps}
              k="rental_grace_days"
              label="Carência (dias após vencimento)"
              step="1"
              suffix="dias"
            />
            <Field
              {...fieldProps}
              k="rental_default_due_day"
              label="Dia de vencimento padrão"
              step="1"
            />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">
            Vigência e tipo de contrato
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              {...fieldProps}
              k="rental_default_term_months"
              label="Vigência padrão"
              step="1"
              suffix="meses"
            />
            <div>
              <Label className="text-xs">Tipo de contrato padrão</Label>
              <Select
                value={s.rental_default_contract_type ?? "pessoa_fisica"}
                onValueChange={(v) => setS({ ...s, rental_default_contract_type: v })}
                disabled={!isAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoa_fisica">Pessoa física</SelectItem>
                  <SelectItem value="pessoa_juridica">Pessoa jurídica</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field
              {...fieldProps}
              k="contract_default_commission_pct"
              label="Comissão padrão de contrato"
              suffix="%"
            />
          </div>

          <div className="mt-6 rounded-md border bg-muted/20 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
              Simulador de vigência
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Informe a <strong>data de início</strong> e o <strong>prazo em meses</strong> — o{" "}
              <strong>fim do contrato</strong> é calculado automaticamente.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">1. Início do contrato</Label>
                <Input
                  type="date"
                  value={termPreview.start}
                  onChange={(e) => setTermPreview({ ...termPreview, start: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">2. Prazo (meses)</Label>
                <Input
                  type="number"
                  min={1}
                  step="1"
                  placeholder="Ex.: 12, 24, 36"
                  value={termPreview.months}
                  onChange={(e) => setTermPreview({ ...termPreview, months: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">3. Fim do contrato (calculado)</Label>
                <Input
                  type="text"
                  readOnly
                  className="bg-muted/40"
                  value={(() => {
                    const m = Number(termPreview.months);
                    if (!termPreview.start || !m || m <= 0) return "—";
                    const d = new Date(termPreview.start + "T00:00:00");
                    const day = d.getDate();
                    d.setMonth(d.getMonth() + m);
                    if (d.getDate() < day) d.setDate(0);
                    return formatDateBR(d.toISOString().slice(0, 10));
                  })()}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">
            Compra e venda de imóvel — parâmetros padrão
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              {...fieldProps}
              k="sale_default_commission_pct"
              label="Comissão padrão de venda"
              suffix="%"
            />
            <Field
              {...fieldProps}
              k="sale_itbi_pct"
              label="ITBI padrão"
              suffix="% sobre o valor da venda"
            />
            <Field
              {...fieldProps}
              k="sale_default_down_payment_pct"
              label="Entrada padrão"
              suffix="% do valor"
            />
            <div>
              <Label className="text-xs">Forma de pagamento padrão</Label>
              <Select
                value={s.sale_default_payment_method ?? "a_vista"}
                onValueChange={(v) => setS({ ...s, sale_default_payment_method: v })}
                disabled={!isAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_vista">À vista</SelectItem>
                  <SelectItem value="financiado">Financiamento bancário</SelectItem>
                  <SelectItem value="parcelado_direto">Parcelado direto com vendedor</SelectItem>
                  <SelectItem value="consorcio">Consórcio</SelectItem>
                  <SelectItem value="fgts">Com uso do FGTS</SelectItem>
                  <SelectItem value="permuta">Permuta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de escritura/instrumento padrão</Label>
              <Select
                value={s.sale_deed_type ?? "escritura_publica"}
                onValueChange={(v) => setS({ ...s, sale_deed_type: v })}
                disabled={!isAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="escritura_publica">Escritura pública</SelectItem>
                  <SelectItem value="contrato_particular">
                    Contrato particular de compra e venda
                  </SelectItem>
                  <SelectItem value="promessa_compra_venda">Promessa de compra e venda</SelectItem>
                  <SelectItem value="cessao_direitos">Cessão de direitos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Esses valores são usados como padrão ao gerar contratos e documentos de compra e venda.
          </p>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase text-muted-foreground">
            Cláusulas e observações padrão
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Textos auxiliares disponíveis nos campos automáticos dos modelos.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Label className="text-xs">Contratos de aluguel</Label>
              <Textarea
                rows={6}
                value={s.rental_contract_notes ?? ""}
                disabled={!isAdmin}
                onChange={(e) => setS({ ...s, rental_contract_notes: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Contratos de compra e venda</Label>
              <Textarea
                rows={6}
                value={s.sale_contract_notes ?? ""}
                disabled={!isAdmin}
                onChange={(e) => setS({ ...s, sale_contract_notes: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Reajuste — índice padrão
            </h2>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Consultando…" : "Atualizar índices oficiais"}
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Índice de reajuste padrão</Label>
              <Select
                value={s.rental_default_readjustment_index ?? ""}
                onValueChange={(v) => setS({ ...s, rental_default_readjustment_index: v })}
                disabled={!isAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {INDEX_OPTIONS.map((o) => (
                    <SelectItem key={o.code} value={o.code}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedIndex && (
                <div className="mt-2 rounded-md border bg-muted/30 p-3 text-xs">
                  <div className="font-semibold">{selectedIndex.name}</div>
                  <div>
                    Mês ref.: <strong>{formatDateBR(selectedIndex.reference_month)}</strong>
                  </div>
                  <div>
                    Variação mensal:{" "}
                    <strong className="tabular-nums">
                      {Number(selectedIndex.monthly_value).toFixed(2)}%
                    </strong>
                  </div>
                  <div>
                    Acumulado 12m:{" "}
                    <strong className="tabular-nums">
                      {selectedIndex.accumulated_12m != null
                        ? `${Number(selectedIndex.accumulated_12m).toFixed(2)}%`
                        : "—"}
                    </strong>
                  </div>
                  <div className="text-muted-foreground">
                    Atualizado em {formatDateBR(selectedIndex.fetched_at)}
                  </div>
                  {selectedIndex.source_url && (
                    <a
                      href={selectedIndex.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Fonte oficial <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
            <Field
              {...fieldProps}
              k="rental_default_readjustment_month"
              label="Mês de reajuste padrão (1–12)"
              step="1"
            />
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Prévia — todos os índices
            </h3>
            {indexes.length === 0 ? (
              <div className="rounded-md border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                Nenhum índice consultado ainda. Clique em "Atualizar índices oficiais" para buscar
                do BCB/SGS.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Índice</th>
                      <th className="px-3 py-2 text-left">Mês ref.</th>
                      <th className="px-3 py-2 text-right">Variação mensal</th>
                      <th className="px-3 py-2 text-right">Acumulado 12m</th>
                      <th className="px-3 py-2 text-left">Atualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexes.map((i) => (
                      <tr key={`${i.code}-${i.reference_month}`} className="border-t">
                        <td className="px-3 py-2 font-medium">{i.name}</td>
                        <td className="px-3 py-2">{formatDateBR(i.reference_month)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(i.monthly_value).toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {i.accumulated_12m != null
                            ? `${Number(i.accumulated_12m).toFixed(2)}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatDateBR(i.fetched_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
