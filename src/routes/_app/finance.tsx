import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  BarChart3,
  Banknote,
  Building2,
  CalendarClock,
  CreditCard,
  Download,
  FileDown,
  FileSpreadsheet,
  Landmark,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  WalletCards,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/finance")({ component: FinancePage });

const db = supabase as any;

const recordSections = [
  {
    key: "accounts_receivable",
    label: "Contas a Receber",
    description: "Titulos, entradas previstas e recebimentos avulsos.",
    direction: "income",
    icon: WalletCards,
  },
  {
    key: "accounts_payable",
    label: "Contas a Pagar",
    description: "Despesas operacionais, fornecedores e compromissos.",
    direction: "expense",
    icon: CreditCard,
  },
  {
    key: "cash_flow",
    label: "Fluxo de Caixa",
    description: "Movimentacoes realizadas e projetadas no caixa.",
    direction: "neutral",
    icon: BarChart3,
  },
  {
    key: "commissions",
    label: "Comissoes",
    description: "Comissoes pendentes e pagas para corretores e parceiros.",
    direction: "expense",
    icon: Banknote,
  },
  {
    key: "owner_transfers",
    label: "Repasses de Proprietarios",
    description: "Valores a repassar para proprietarios administrados.",
    direction: "expense",
    icon: Building2,
  },
  {
    key: "rent_receipts",
    label: "Recebimentos de Aluguel",
    description: "Receitas de aluguel e administracao de contratos.",
    direction: "income",
    icon: CalendarClock,
  },
  {
    key: "collections",
    label: "Cobrancas e Inadimplencia",
    description: "Cobrancas, atrasos, acordos e recuperacao de valores.",
    direction: "income",
    icon: Search,
  },
  {
    key: "bank_reconciliation",
    label: "Extratos e Conciliacao Bancaria",
    description: "Lancamentos conciliados com extratos e bancos.",
    direction: "neutral",
    icon: Landmark,
  },
  {
    key: "reports",
    label: "Relatorios Financeiros",
    description: "Modelos e registros para relatórios gerenciais.",
    direction: "neutral",
    icon: FileDown,
  },
] as const;

const sections = [
  { key: "dashboard", label: "Dashboard Financeiro", icon: BarChart3 },
  ...recordSections,
  { key: "cost_centers", label: "Centro de Custos", icon: Building2 },
  { key: "categories", label: "Categorias Financeiras", icon: FileSpreadsheet },
  { key: "settings", label: "Configuracoes Financeiras", icon: Settings },
] as const;

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  cancelled: "Cancelado",
  reconciled: "Conciliado",
};

const directionLabels: Record<string, string> = {
  income: "Entrada",
  expense: "Saida",
  transfer: "Transferencia",
  neutral: "Neutro",
};

const categoryKindLabels: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferencia",
  commission: "Comissao",
  tax: "Imposto / taxa",
  other: "Outro",
};

const emptyRecord = {
  title: "",
  description: "",
  amount: 0,
  due_date: "",
  payment_date: "",
  competence_month: "",
  status: "pending",
  direction: "income",
  payment_method: "",
  document_number: "",
  person_name: "",
  person_document: "",
  owner_name: "",
  owner_document: "",
  commission_rate: "",
  category_id: "",
  cost_center_id: "",
  bank_account_id: "",
  recurrence_rule: "",
};

const emptyCategory = { name: "", kind: "expense", description: "", active: true };
const emptyCostCenter = {
  name: "",
  code: "",
  responsible: "",
  budget_monthly: 0,
  notes: "",
  active: true,
};

function FinancePage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canManage = roles.some((role) => ["admin", "manager", "financial"].includes(role));
  const [active, setActive] = useState("dashboard");
  const [recordEditing, setRecordEditing] = useState<any | null>(null);
  const [categoryEditing, setCategoryEditing] = useState<any | null>(null);
  const [costCenterEditing, setCostCenterEditing] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    direction: "all",
    startDate: "",
    endDate: "",
    minAmount: "",
    maxAmount: "",
  });
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const { data: records = [], error: recordsError } = useQuery({
    queryKey: ["financial-records"],
    queryFn: async () => {
      const { data, error } = await db
        .from("financial_records")
        .select(
          "*, financial_categories(name, kind), financial_cost_centers(name, code), financial_bank_accounts(bank_name)",
        )
        .is("deleted_at", null)
        .order("due_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["financial-categories"],
    queryFn: async () => {
      const { data, error } = await db
        .from("financial_categories")
        .select("*")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["financial-cost-centers"],
    queryFn: async () => {
      const { data, error } = await db
        .from("financial_cost_centers")
        .select("*")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["financial-bank-accounts"],
    queryFn: async () => {
      const { data, error } = await db
        .from("financial_bank_accounts")
        .select("*")
        .is("deleted_at", null)
        .order("bank_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["financial-settings"],
    queryFn: async () => {
      const { data, error } = await db
        .from("financial_settings")
        .select("*")
        .eq("name", "default")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const activeRecordSection = recordSections.find((section) => section.key === active);
  const sectionRecords = useMemo(() => {
    const bySection = activeRecordSection
      ? records.filter((record: any) => record.module_key === activeRecordSection.key)
      : records;
    return applyRecordFilters(bySection, filters);
  }, [records, filters, activeRecordSection]);
  const pagedRecords = paginate(sectionRecords, page, 10);
  const dashboardData = useMemo(() => buildDashboard(records), [records]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["financial-records"] });
    qc.invalidateQueries({ queryKey: ["financial-categories"] });
    qc.invalidateQueries({ queryKey: ["financial-cost-centers"] });
    qc.invalidateQueries({ queryKey: ["financial-bank-accounts"] });
    qc.invalidateQueries({ queryKey: ["financial-settings"] });
  }

  function changeSection(sectionKey: string) {
    setActive(sectionKey);
    setPage(1);
  }

  function openNewRecord() {
    if (!activeRecordSection) return;
    setRecordEditing({
      ...emptyRecord,
      module_key: activeRecordSection.key,
      direction: activeRecordSection.direction,
    });
  }

  async function saveRecord() {
    if (!recordEditing?.title?.trim()) return toast.error("Informe um titulo para o lancamento.");
    const payload = normalizeRecordPayload(
      recordEditing,
      activeRecordSection?.key ?? recordEditing.module_key,
    );
    const query = recordEditing.id
      ? db.from("financial_records").update(payload).eq("id", recordEditing.id)
      : db.from("financial_records").insert(payload);
    const { error } = await query;
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel salvar o lancamento."));
    toast.success(recordEditing.id ? "Lancamento atualizado" : "Lancamento criado");
    setRecordEditing(null);
    refresh();
  }

  async function softDeleteRecord(record: any) {
    if (!confirm(`Excluir "${record.title}"? O registro ficara preservado para auditoria.`)) return;
    const { error } = await db
      .from("financial_records")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", record.id);
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel remover o lancamento."));
    toast.success("Lancamento removido com soft delete");
    refresh();
  }

  async function saveCategory() {
    if (!categoryEditing?.name?.trim()) return toast.error("Informe o nome da categoria.");
    const payload = { ...categoryEditing };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    const query = categoryEditing.id
      ? db.from("financial_categories").update(payload).eq("id", categoryEditing.id)
      : db.from("financial_categories").insert(payload);
    const { error } = await query;
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel salvar a categoria."));
    toast.success(categoryEditing.id ? "Categoria atualizada" : "Categoria criada");
    setCategoryEditing(null);
    refresh();
  }

  async function saveCostCenter() {
    if (!costCenterEditing?.name?.trim()) return toast.error("Informe o nome do centro de custos.");
    const payload = {
      ...costCenterEditing,
      budget_monthly: moneyToNumber(costCenterEditing.budget_monthly),
    };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    const query = costCenterEditing.id
      ? db.from("financial_cost_centers").update(payload).eq("id", costCenterEditing.id)
      : db.from("financial_cost_centers").insert(payload);
    const { error } = await query;
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel salvar o centro de custos."));
    toast.success(costCenterEditing.id ? "Centro de custos atualizado" : "Centro de custos criado");
    setCostCenterEditing(null);
    refresh();
  }

  async function softDelete(table: string, item: any, label: string) {
    if (!confirm(`Excluir "${label}"? O registro ficara preservado para auditoria.`)) return;
    const { error } = await db
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel remover o registro."));
    toast.success("Registro removido com soft delete");
    refresh();
  }

  async function saveSettings(nextSettings: any) {
    const payload = {
      pix_enabled: !!nextSettings.pix_enabled,
      open_finance_enabled: !!nextSettings.open_finance_enabled,
      boleto_enabled: !!nextSettings.boleto_enabled,
      gateway_enabled: !!nextSettings.gateway_enabled,
      gateway_provider: nextSettings.gateway_provider || null,
      default_late_fee_percent: moneyToNumber(nextSettings.default_late_fee_percent),
      default_daily_interest_percent: moneyToNumber(nextSettings.default_daily_interest_percent),
      owner_transfer_day: Number(nextSettings.owner_transfer_day) || 10,
      commission_payment_day: Number(nextSettings.commission_payment_day) || 10,
      config: nextSettings.config ?? {},
    };
    const { error } = await db.from("financial_settings").update(payload).eq("id", nextSettings.id);
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel salvar as configuracoes financeiras."));
    toast.success("Configuracoes financeiras atualizadas");
    refresh();
  }

  function exportExcel() {
    const rows = exportRows(activeRecordSection ? sectionRecords : records);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Financeiro");
    XLSX.writeFile(workbook, `financeiro-${active}.xlsx`);
  }

  function exportCsv() {
    const worksheet = XLSX.utils.json_to_sheet(
      exportRows(activeRecordSection ? sectionRecords : records),
    );
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    downloadBlob(csv, `financeiro-${active}.csv`, "text/csv;charset=utf-8");
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text(
      `ImobFlow - ${sections.find((section) => section.key === active)?.label ?? "Financeiro"}`,
      14,
      14,
    );
    autoTable(doc, {
      startY: 20,
      head: [["Titulo", "Pessoa", "Vencimento", "Pagamento", "Status", "Valor"]],
      body: (activeRecordSection ? sectionRecords : records).map((record: any) => [
        record.title,
        record.person_name ?? "",
        formatDate(record.due_date),
        formatDate(record.payment_date),
        statusLabels[record.status] ?? record.status,
        formatCurrency(record.amount),
      ]),
    });
    doc.save(`financeiro-${active}.pdf`);
  }

  async function importSpreadsheet(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeRecordSection) return;
    if (!canManage) return toast.error("Seu perfil nao permite importar lancamentos.");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });
    const payload = rows
      .map((row) =>
        spreadsheetRowToRecord(row, activeRecordSection.key, activeRecordSection.direction),
      )
      .filter((row) => row.title);
    if (payload.length === 0)
      return toast.error("Nenhuma linha valida encontrada para importacao.");

    const { error } = await db.from("financial_records").insert(payload);
    await db.from("financial_import_batches").insert({
      module_key: activeRecordSection.key,
      file_name: file.name,
      file_type: file.type || file.name.split(".").pop(),
      total_rows: rows.length,
      imported_rows: error ? 0 : payload.length,
      status: error ? "failed" : "processed",
      error_message: error?.message ?? null,
    });
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel importar os lancamentos."));
    toast.success(`${payload.length} lancamento(s) importado(s)`);
    refresh();
  }

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Controle financeiro para venda, locacao, administracao, comissoes e repasses."
        actions={
          <div className="flex flex-wrap gap-2">
            {activeRecordSection && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={importSpreadsheet}
                />
                <Button
                  variant="outline"
                  onClick={() => importInputRef.current?.click()}
                  disabled={!canManage}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  Importar
                </Button>
              </>
            )}
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline" onClick={exportPdf}>
              <FileDown className="mr-1.5 h-4 w-4" />
              PDF
            </Button>
            {activeRecordSection && (
              <Button onClick={openNewRecord} disabled={!canManage}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo lancamento
              </Button>
            )}
            {active === "categories" && (
              <Button
                onClick={() => setCategoryEditing({ ...emptyCategory })}
                disabled={!canManage}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Nova categoria
              </Button>
            )}
            {active === "cost_centers" && (
              <Button
                onClick={() => setCostCenterEditing({ ...emptyCostCenter })}
                disabled={!canManage}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Novo centro
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 p-4 md:grid-cols-[280px_1fr] md:p-8">
        <aside className="rounded-xl border bg-card p-2">
          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => changeSection(section.key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                active === section.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <section.icon className="h-4 w-4" />
              <span>{section.label}</span>
            </button>
          ))}
        </aside>

        <main className="min-w-0 space-y-4">
          {!canManage && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Seu perfil esta em modo consulta no Financeiro. Criacao, edicao, importacao e
              exclusoes ficam restritas a Administrador, Gerente e Financeiro.
            </div>
          )}
          {recordsError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Nao foi possivel carregar o modulo financeiro. Verifique se a migration financeira foi
              aplicada no Supabase.
            </div>
          )}
          {active === "dashboard" && <FinanceDashboard data={dashboardData} />}
          {activeRecordSection && (
            <RecordSection
              section={activeRecordSection}
              records={pagedRecords}
              allCount={sectionRecords.length}
              page={page}
              setPage={setPage}
              filters={filters}
              setFilters={setFilters}
              canManage={canManage}
              onEdit={setRecordEditing}
              onDelete={softDeleteRecord}
            />
          )}
          {active === "categories" && (
            <CategoriesSection
              canManage={canManage}
              categories={categories}
              onEdit={setCategoryEditing}
              onDelete={(item) => softDelete("financial_categories", item, item.name)}
            />
          )}
          {active === "cost_centers" && (
            <CostCentersSection
              canManage={canManage}
              costCenters={costCenters}
              onEdit={setCostCenterEditing}
              onDelete={(item) => softDelete("financial_cost_centers", item, item.name)}
            />
          )}
          {active === "settings" && (
            <SettingsSection
              settings={settings}
              canManage={canManage}
              onSave={saveSettings}
              bankAccounts={bankAccounts}
            />
          )}
        </main>
      </div>

      <RecordDialog
        record={recordEditing}
        categories={categories}
        costCenters={costCenters}
        bankAccounts={bankAccounts}
        canManage={canManage}
        onClose={() => setRecordEditing(null)}
        onChange={setRecordEditing}
        onSave={saveRecord}
      />
      <CategoryDialog
        item={categoryEditing}
        canManage={canManage}
        onClose={() => setCategoryEditing(null)}
        onChange={setCategoryEditing}
        onSave={saveCategory}
      />
      <CostCenterDialog
        item={costCenterEditing}
        canManage={canManage}
        onClose={() => setCostCenterEditing(null)}
        onChange={setCostCenterEditing}
        onSave={saveCostCenter}
      />
    </div>
  );
}

function FinanceDashboard({ data }: { data: ReturnType<typeof buildDashboard> }) {
  const cards = [
    { label: "Receita mensal", value: formatCurrency(data.monthIncome), tone: "text-emerald-600" },
    { label: "Despesa mensal", value: formatCurrency(data.monthExpense), tone: "text-red-600" },
    {
      label: "Saldo atual",
      value: formatCurrency(data.balance),
      tone: data.balance >= 0 ? "text-emerald-600" : "text-red-600",
    },
    {
      label: "Comissoes pendentes",
      value: formatCurrency(data.pendingCommissions),
      tone: "text-amber-600",
    },
    {
      label: "Comissoes pagas",
      value: formatCurrency(data.paidCommissions),
      tone: "text-emerald-600",
    },
    {
      label: "Alugueis recebidos",
      value: formatCurrency(data.rentReceived),
      tone: "text-emerald-600",
    },
    { label: "Alugueis em atraso", value: formatCurrency(data.rentOverdue), tone: "text-red-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">{card.label}</div>
            <div className={cn("mt-2 text-2xl font-semibold tabular-nums", card.tone)}>
              {card.value}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Fluxo de caixa mensal">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.monthlyFlow}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line
                type="monotone"
                dataKey="income"
                name="Receitas"
                stroke="#059669"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Despesas"
                stroke="#dc2626"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="balance"
                name="Saldo"
                stroke="#001eff"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Indicadores por status">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="amount" name="Valor" fill="#001eff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function RecordSection(props: {
  section: (typeof recordSections)[number];
  records: any[];
  allCount: number;
  page: number;
  setPage: (page: number) => void;
  filters: any;
  setFilters: (filters: any) => void;
  canManage: boolean;
  onEdit: (record: any) => void;
  onDelete: (record: any) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(props.allCount / 10));
  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{props.section.label}</h2>
            <p className="text-sm text-muted-foreground">{props.section.description}</p>
          </div>
          <Badge variant="secondary">{props.allCount} registro(s)</Badge>
        </div>
        <AdvancedFilters filters={props.filters} setFilters={props.setFilters} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Lancamento</th>
              <th className="px-4 py-3">Pessoa</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {props.records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {props.records.map((record) => (
              <tr key={record.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{record.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {record.document_number || directionLabels[record.direction]}
                  </div>
                </td>
                <td className="px-4 py-3">{record.person_name || record.owner_name || "-"}</td>
                <td className="px-4 py-3">{formatDate(record.due_date)}</td>
                <td className="px-4 py-3">{record.financial_categories?.name || "-"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={record.status} />
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-semibold tabular-nums",
                    record.direction === "income"
                      ? "text-emerald-600"
                      : record.direction === "expense"
                        ? "text-red-600"
                        : "",
                  )}
                >
                  {formatCurrency(record.amount)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => props.onEdit(record)}
                      title="Editar"
                      disabled={!props.canManage}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => props.onDelete(record)}
                      title="Excluir"
                      disabled={!props.canManage}
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
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Pagina {props.page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={props.page <= 1}
            onClick={() => props.setPage(props.page - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={props.page >= totalPages}
            onClick={() => props.setPage(props.page + 1)}
          >
            Proxima
          </Button>
        </div>
      </div>
    </section>
  );
}

function AdvancedFilters({
  filters,
  setFilters,
}: {
  filters: any;
  setFilters: (filters: any) => void;
}) {
  const set = (field: string, value: string) => setFilters({ ...filters, [field]: value });
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Field label="Pesquisar">
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Titulo, pessoa, documento"
        />
      </Field>
      <Field label="Status">
        <Select value={filters.status} onValueChange={(value) => set("status", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Direcao">
        <Select value={filters.direction} onValueChange={(value) => set("direction", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(directionLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="De">
        <Input
          type="date"
          value={filters.startDate}
          onChange={(e) => set("startDate", e.target.value)}
        />
      </Field>
      <Field label="Ate">
        <Input
          type="date"
          value={filters.endDate}
          onChange={(e) => set("endDate", e.target.value)}
        />
      </Field>
      <Field label="Valor min.">
        <Input value={filters.minAmount} onChange={(e) => set("minAmount", e.target.value)} />
      </Field>
    </div>
  );
}

function CategoriesSection({
  categories,
  canManage,
  onEdit,
  onDelete,
}: {
  categories: any[];
  canManage: boolean;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
}) {
  return (
    <SimpleTable
      title="Categorias Financeiras"
      description="Classificacao padronizada para receitas, despesas, comissoes, impostos e repasses."
      headers={["Nome", "Tipo", "Status"]}
      rows={categories.map((item) => ({
        id: item.id,
        cells: [
          item.name,
          categoryKindLabels[item.kind] ?? item.kind,
          item.active ? "Ativa" : "Inativa",
        ],
        item,
      }))}
      canManage={canManage}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

function CostCentersSection({
  costCenters,
  canManage,
  onEdit,
  onDelete,
}: {
  costCenters: any[];
  canManage: boolean;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
}) {
  return (
    <SimpleTable
      title="Centro de Custos"
      description="Unidades de controle para operacao, captacao, locacao, vendas, marketing e administrativo."
      headers={["Nome", "Codigo", "Responsavel", "Orcamento mensal", "Status"]}
      rows={costCenters.map((item) => ({
        id: item.id,
        cells: [
          item.name,
          item.code || "-",
          item.responsible || "-",
          formatCurrency(item.budget_monthly),
          item.active ? "Ativo" : "Inativo",
        ],
        item,
      }))}
      canManage={canManage}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

function SettingsSection({
  settings,
  canManage,
  onSave,
  bankAccounts,
}: {
  settings: any;
  canManage: boolean;
  onSave: (settings: any) => void;
  bankAccounts: any[];
}) {
  const [draft, setDraft] = useState<any>(settings ?? {});
  useEffect(() => setDraft(settings ?? {}), [settings]);
  const set = (field: string, value: any) =>
    setDraft((current: any) => ({ ...current, [field]: value }));
  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Configuracoes Financeiras</h2>
        <p className="text-sm text-muted-foreground">
          Parametros preparados para PIX, Open Finance, bancos, gateways e boletos.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <ToggleField
            label="PIX habilitado"
            checked={!!draft.pix_enabled}
            onCheckedChange={(value) => set("pix_enabled", value)}
          />
          <ToggleField
            label="Open Finance habilitado"
            checked={!!draft.open_finance_enabled}
            onCheckedChange={(value) => set("open_finance_enabled", value)}
          />
          <ToggleField
            label="Boletos habilitados"
            checked={!!draft.boleto_enabled}
            onCheckedChange={(value) => set("boleto_enabled", value)}
          />
          <ToggleField
            label="Gateway de pagamento habilitado"
            checked={!!draft.gateway_enabled}
            onCheckedChange={(value) => set("gateway_enabled", value)}
          />
          <Field label="Provedor de gateway">
            <Input
              value={draft.gateway_provider ?? ""}
              onChange={(e) => set("gateway_provider", e.target.value)}
              placeholder="Ex.: Asaas, Iugu, Pagar.me"
            />
          </Field>
          <Field label="Multa padrao (%)">
            <Input
              value={draft.default_late_fee_percent ?? ""}
              onChange={(e) => set("default_late_fee_percent", e.target.value)}
            />
          </Field>
          <Field label="Juros diarios (%)">
            <Input
              value={draft.default_daily_interest_percent ?? ""}
              onChange={(e) => set("default_daily_interest_percent", e.target.value)}
            />
          </Field>
          <Field label="Dia padrao de repasse">
            <Input
              type="number"
              min={1}
              max={31}
              value={draft.owner_transfer_day ?? 10}
              onChange={(e) => set("owner_transfer_day", e.target.value)}
            />
          </Field>
          <Field label="Dia padrao de comissao">
            <Input
              type="number"
              min={1}
              max={31}
              value={draft.commission_payment_day ?? 10}
              onChange={(e) => set("commission_payment_day", e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button disabled={!canManage || !draft.id} onClick={() => onSave(draft)}>
            Salvar configuracoes
          </Button>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold">Contas bancarias preparadas</h3>
        <p className="text-sm text-muted-foreground">
          Estrutura pronta para conciliar extratos e futuras integracoes bancarias.
        </p>
        <div className="mt-3 divide-y text-sm">
          {bankAccounts.length === 0 ? (
            <div className="py-3 text-muted-foreground">Nenhuma conta bancaria cadastrada.</div>
          ) : (
            bankAccounts.map((account) => (
              <div key={account.id} className="flex justify-between gap-3 py-3">
                <span>{account.bank_name}</span>
                <span className="font-medium">{formatCurrency(account.current_balance)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function SimpleTable({
  title,
  description,
  headers,
  rows,
  canManage,
  onEdit,
  onDelete,
}: {
  title: string;
  description: string;
  headers: string[];
  rows: any[];
  canManage: boolean;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3">
                  {header}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={headers.length + 1}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                {row.cells.map((cell: ReactNode, index: number) => (
                  <td key={index} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canManage}
                      onClick={() => onEdit(row.item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canManage}
                      onClick={() => onDelete(row.item)}
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
    </section>
  );
}

function RecordDialog(props: {
  record: any | null;
  categories: any[];
  costCenters: any[];
  bankAccounts: any[];
  canManage: boolean;
  onClose: () => void;
  onChange: (record: any) => void;
  onSave: () => void;
}) {
  const record = props.record;
  const set = (field: string, value: any) => props.onChange({ ...record, [field]: value });
  return (
    <Dialog
      open={!!record}
      onOpenChange={(value) => {
        if (!value) props.onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {record?.id ? "Editar lancamento financeiro" : "Novo lancamento financeiro"}
          </DialogTitle>
        </DialogHeader>
        {record && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Titulo *">
                <Input value={record.title ?? ""} onChange={(e) => set("title", e.target.value)} />
              </Field>
            </div>
            <Field label="Direcao">
              <Select
                value={record.direction ?? "neutral"}
                onValueChange={(value) => set("direction", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(directionLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={record.status ?? "pending"}
                onValueChange={(value) => set("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Valor">
              <Input value={record.amount ?? ""} onChange={(e) => set("amount", e.target.value)} />
            </Field>
            <Field label="Vencimento">
              <Input
                type="date"
                value={record.due_date ?? ""}
                onChange={(e) => set("due_date", e.target.value)}
              />
            </Field>
            <Field label="Pagamento">
              <Input
                type="date"
                value={record.payment_date ?? ""}
                onChange={(e) => set("payment_date", e.target.value)}
              />
            </Field>
            <Field label="Competencia">
              <Input
                type="date"
                value={record.competence_month ?? ""}
                onChange={(e) => set("competence_month", e.target.value)}
              />
            </Field>
            <Field label="Categoria">
              <Select
                value={record.category_id || "none"}
                onValueChange={(value) => set("category_id", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {props.categories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Centro de custos">
              <Select
                value={record.cost_center_id || "none"}
                onValueChange={(value) => set("cost_center_id", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem centro</SelectItem>
                  {props.costCenters.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Conta bancaria">
              <Select
                value={record.bank_account_id || "none"}
                onValueChange={(value) => set("bank_account_id", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem conta</SelectItem>
                  {props.bankAccounts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Metodo de pagamento">
              <Input
                value={record.payment_method ?? ""}
                onChange={(e) => set("payment_method", e.target.value)}
                placeholder="Pix, boleto, TED, dinheiro..."
              />
            </Field>
            <Field label="Numero do documento">
              <Input
                value={record.document_number ?? ""}
                onChange={(e) => set("document_number", e.target.value)}
              />
            </Field>
            <Field label="Pessoa / Empresa">
              <Input
                value={record.person_name ?? ""}
                onChange={(e) => set("person_name", e.target.value)}
              />
            </Field>
            <Field label="CPF / CNPJ">
              <Input
                value={record.person_document ?? ""}
                onChange={(e) => set("person_document", e.target.value)}
              />
            </Field>
            <Field label="Proprietario">
              <Input
                value={record.owner_name ?? ""}
                onChange={(e) => set("owner_name", e.target.value)}
              />
            </Field>
            <Field label="Documento do proprietario">
              <Input
                value={record.owner_document ?? ""}
                onChange={(e) => set("owner_document", e.target.value)}
              />
            </Field>
            <Field label="Comissao (%)">
              <Input
                value={record.commission_rate ?? ""}
                onChange={(e) => set("commission_rate", e.target.value)}
              />
            </Field>
            <Field label="Recorrencia">
              <Input
                value={record.recurrence_rule ?? ""}
                onChange={(e) => set("recurrence_rule", e.target.value)}
                placeholder="Ex.: mensal, anual, unica"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Descricao">
                <Textarea
                  rows={4}
                  value={record.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>
            Cancelar
          </Button>
          <Button disabled={!props.canManage} onClick={props.onSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  item,
  canManage,
  onClose,
  onChange,
  onSave,
}: {
  item: any | null;
  canManage: boolean;
  onClose: () => void;
  onChange: (item: any) => void;
  onSave: () => void;
}) {
  const set = (field: string, value: any) => onChange({ ...item, [field]: value });
  return (
    <Dialog
      open={!!item}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        {item && (
          <div className="space-y-4">
            <Field label="Nome">
              <Input value={item.name ?? ""} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Tipo">
              <Select value={item.kind ?? "expense"} onValueChange={(value) => set("kind", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryKindLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Descricao">
              <Textarea
                value={item.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <ToggleField
              label="Categoria ativa"
              checked={!!item.active}
              onCheckedChange={(value) => set("active", value)}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canManage} onClick={onSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CostCenterDialog({
  item,
  canManage,
  onClose,
  onChange,
  onSave,
}: {
  item: any | null;
  canManage: boolean;
  onClose: () => void;
  onChange: (item: any) => void;
  onSave: () => void;
}) {
  const set = (field: string, value: any) => onChange({ ...item, [field]: value });
  return (
    <Dialog
      open={!!item}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item?.id ? "Editar centro de custos" : "Novo centro de custos"}
          </DialogTitle>
        </DialogHeader>
        {item && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Nome">
                <Input value={item.name ?? ""} onChange={(e) => set("name", e.target.value)} />
              </Field>
            </div>
            <Field label="Codigo">
              <Input value={item.code ?? ""} onChange={(e) => set("code", e.target.value)} />
            </Field>
            <Field label="Responsavel">
              <Input
                value={item.responsible ?? ""}
                onChange={(e) => set("responsible", e.target.value)}
              />
            </Field>
            <Field label="Orcamento mensal">
              <Input
                value={item.budget_monthly ?? ""}
                onChange={(e) => set("budget_monthly", e.target.value)}
              />
            </Field>
            <ToggleField
              label="Centro ativo"
              checked={!!item.active}
              onCheckedChange={(value) => set("active", value)}
            />
            <div className="md:col-span-2">
              <Field label="Observacoes">
                <Textarea value={item.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canManage} onClick={onSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-4 font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "paid" || status === "reconciled"
      ? "default"
      : status === "overdue"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant as any}>{statusLabels[status] ?? status}</Badge>;
}

function normalizeRecordPayload(record: any, moduleKey: string) {
  const payload = {
    ...record,
    module_key: moduleKey,
    amount: moneyToNumber(record.amount),
    commission_rate:
      record.commission_rate === "" || record.commission_rate == null
        ? null
        : moneyToNumber(record.commission_rate),
    category_id: record.category_id || null,
    cost_center_id: record.cost_center_id || null,
    bank_account_id: record.bank_account_id || null,
    due_date: record.due_date || null,
    payment_date: record.payment_date || null,
    competence_month: record.competence_month || null,
  };
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;
  delete payload.deleted_at;
  delete payload.financial_categories;
  delete payload.financial_cost_centers;
  delete payload.financial_bank_accounts;
  return payload;
}

function applyRecordFilters(records: any[], filters: any) {
  const search = filters.search.trim().toLowerCase();
  return records.filter((record) => {
    const date = record.due_date || record.payment_date || "";
    const amount = Number(record.amount ?? 0);
    if (
      search &&
      ![
        record.title,
        record.description,
        record.person_name,
        record.document_number,
        record.owner_name,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(search),
      )
    )
      return false;
    if (filters.status !== "all" && record.status !== filters.status) return false;
    if (filters.direction !== "all" && record.direction !== filters.direction) return false;
    if (filters.startDate && date < filters.startDate) return false;
    if (filters.endDate && date > filters.endDate) return false;
    if (filters.minAmount && amount < moneyToNumber(filters.minAmount)) return false;
    if (filters.maxAmount && amount > moneyToNumber(filters.maxAmount)) return false;
    return true;
  });
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

function buildDashboard(records: any[]) {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const activeRecords = records.filter((record) => !record.deleted_at);
  const paid = activeRecords.filter((record) => ["paid", "reconciled"].includes(record.status));
  const monthRecords = activeRecords.filter((record) =>
    String(record.payment_date || record.due_date || "").startsWith(monthKey),
  );
  const income = paid
    .filter((record) => record.direction === "income")
    .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
  const expense = paid
    .filter((record) => record.direction === "expense")
    .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
  const monthIncome = monthRecords
    .filter((record) => record.direction === "income")
    .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
  const monthExpense = monthRecords
    .filter((record) => record.direction === "expense")
    .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
  const pendingCommissions = activeRecords
    .filter((record) => record.module_key === "commissions" && record.status !== "paid")
    .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
  const paidCommissions = activeRecords
    .filter((record) => record.module_key === "commissions" && record.status === "paid")
    .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
  const rentReceived = activeRecords
    .filter((record) => record.module_key === "rent_receipts" && record.status === "paid")
    .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
  const rentOverdue = activeRecords
    .filter((record) => record.module_key === "rent_receipts" && record.status === "overdue")
    .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);

  const monthlyFlow = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = date.toISOString().slice(0, 7);
    const label = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(2)}`;
    const rows = activeRecords.filter((record) =>
      String(record.payment_date || record.due_date || "").startsWith(key),
    );
    const rowIncome = rows
      .filter((record) => record.direction === "income")
      .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
    const rowExpense = rows
      .filter((record) => record.direction === "expense")
      .reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
    return {
      month: label,
      income: rowIncome,
      expense: rowExpense,
      balance: rowIncome - rowExpense,
    };
  });

  const statusData = Object.keys(statusLabels)
    .map((status) => ({
      status: statusLabels[status],
      amount: activeRecords
        .filter((record) => record.status === status)
        .reduce((sum, record) => sum + Number(record.amount ?? 0), 0),
    }))
    .filter((row) => row.amount > 0);

  return {
    monthIncome,
    monthExpense,
    balance: income - expense,
    pendingCommissions,
    paidCommissions,
    rentReceived,
    rentOverdue,
    monthlyFlow,
    statusData,
  };
}

function exportRows(records: any[]) {
  return records.map((record) => ({
    Modulo:
      recordSections.find((section) => section.key === record.module_key)?.label ??
      record.module_key,
    Titulo: record.title,
    Direcao: directionLabels[record.direction] ?? record.direction,
    Status: statusLabels[record.status] ?? record.status,
    Valor: Number(record.amount ?? 0),
    Vencimento: formatDate(record.due_date),
    Pagamento: formatDate(record.payment_date),
    Pessoa: record.person_name ?? "",
    Documento: record.document_number ?? "",
    Categoria: record.financial_categories?.name ?? "",
    Centro_de_Custos: record.financial_cost_centers?.name ?? "",
  }));
}

function spreadsheetRowToRecord(row: Record<string, any>, moduleKey: string, direction: string) {
  return {
    module_key: moduleKey,
    direction: row.Direcao || row.direction || direction,
    title: row.Titulo || row.title || row.Descricao || row.description || "",
    description: row.Observacoes || row.description || row.Descricao || "",
    amount: moneyToNumber(row.Valor ?? row.amount ?? 0),
    due_date: parseSpreadsheetDate(row.Vencimento ?? row.due_date),
    payment_date: parseSpreadsheetDate(row.Pagamento ?? row.payment_date),
    status: normalizeStatus(row.Status || row.status || "pending"),
    payment_method: row.Metodo || row.payment_method || "",
    document_number: row.Documento || row.document_number || "",
    person_name: row.Pessoa || row.person_name || "",
    person_document: row.CPF_CNPJ || row.person_document || "",
  };
}

function normalizeStatus(value: string) {
  const text = String(value).toLowerCase();
  const found = Object.entries(statusLabels).find(
    ([key, label]) => key === text || label.toLowerCase() === text,
  );
  return found?.[0] ?? "pending";
}

function moneyToNumber(value: any) {
  if (typeof value === "number") return value;
  const raw = String(value ?? "").replace(/[R$\s]/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalized) || 0;
}

function parseSpreadsheetDate(value: any) {
  if (!value) return null;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed)
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value);
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function formatCurrency(value: any) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value ?? 0),
  );
}

function formatDate(value: any) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
