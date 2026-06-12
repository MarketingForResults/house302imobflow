/* eslint-disable @typescript-eslint/no-explicit-any -- Sales tables are accessed through a narrow Supabase adapter. */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  ReceiptText,
  Trash2,
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
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { uploadEntityDocument } from "@/lib/entity-documents";
import { useAuth } from "@/lib/auth";
import { calculateDiscount, formatDiscountLabel } from "@/lib/discounts";
import { translatedErrorMessage } from "@/lib/error-messages";
import { formatDateBR } from "@/lib/format-date";
import { newReportPdf } from "@/lib/pdf-utils";

export const Route = createFileRoute("/_app/sales/")({ component: SalesPage });

const db = supabase as any;
const EMPTY_CONTRACT = {
  total_amount: "",
  discount_type: "none",
  discount_value: "",
  down_payment_amount: "",
  down_payment_pct: "",
  down_payment_mode: "amount" as "amount" | "percent",
  contract_date: new Date().toISOString().slice(0, 10),
  status: "active",
  payment_mode: "cash" as "cash" | "owner_financing" | "bank_financing",
  installments_count: "",
  first_installment_date: "",
  readjustment_index: "",
  late_fee_pct: "2",
  monthly_interest_pct: "1",
  bank_name: "",
  bank_financing_amount: "",
  bank_financing_term_months: "",
  bank_amortization_system: "",
  bank_approval_status: "pending",
  bank_notes: "",
  guarantor_client_id: "",
};
const EMPTY_PAYMENT = {
  description: "Parcela",
  due_date: new Date().toISOString().slice(0, 10),
  amount_due: "",
  discount_type: "none",
  discount_value: "",
};

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SalesPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [openContract, setOpenContract] = useState(false);
  const [contractForm, setContractForm] = useState<any>({ ...EMPTY_CONTRACT });
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [paymentFor, setPaymentFor] = useState<any | null>(null);
  const [paymentForm, setPaymentForm] = useState<any>({ ...EMPTY_PAYMENT });

  const { data: contracts = [] } = useQuery({
    queryKey: ["sale-contracts"],
    queryFn: async () => {
      const { data, error } = await db
        .from("sale_contracts")
        .select(
          "*, properties(code, title), buyer:clients!sale_contracts_buyer_client_id_fkey(full_name, cpf), seller:clients!sale_contracts_seller_client_id_fkey(full_name), brokers(full_name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["sale-payments"],
    queryFn: async () => {
      const { data, error } = await db.from("sale_payments").select("*").order("due_date");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-min"],
    queryFn: async () =>
      (
        await supabase
          .from("properties")
          .select("id, code, title")
          .order("code", { ascending: false })
      ).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () =>
      (await supabase.from("clients").select("id, full_name").order("full_name")).data ?? [],
  });
  const { data: economicIndexes = [] } = useQuery({
    queryKey: ["economic-indexes-min"],
    queryFn: async () =>
      (await (supabase as any).from("economic_indexes").select("code, name").order("code")).data ?? [],
  });
  const { data: brokers = [] } = useQuery({
    queryKey: ["brokers-min"],
    queryFn: async () =>
      (await supabase.from("brokers").select("id, full_name").eq("active", true).order("full_name"))
        .data ?? [],
  });

  const paymentsByContract = useMemo(() => {
    const result: Record<string, any[]> = {};
    for (const payment of payments) (result[payment.contract_id] ??= []).push(payment);
    return result;
  }, [payments]);

  const stats = useMemo(() => {
    const active = contracts.filter((contract: any) => contract.status === "active");
    const received = payments
      .filter((payment: any) => payment.status === "paid")
      .reduce(
        (sum: number, payment: any) => sum + Number(payment.amount_paid ?? payment.amount_due),
        0,
      );
    return {
      active: active.length,
      negotiated: active.reduce(
        (sum: number, contract: any) => sum + Number(contract.total_amount),
        0,
      ),
      received,
      pending: payments
        .filter((payment: any) => payment.status === "pending")
        .reduce((sum: number, payment: any) => sum + Number(payment.amount_due), 0),
    };
  }, [contracts, payments]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["sale-contracts"] });
    qc.invalidateQueries({ queryKey: ["sale-payments"] });
  }

  async function createContract() {
    if (
      !contractForm.property_id ||
      !contractForm.buyer_client_id ||
      !contractForm.total_amount ||
      !contractForm.contract_date
    ) {
      return toast.error("Preencha imóvel, comprador, valor e data do contrato");
    }
    const discount = calculateDiscount(
      contractForm.total_amount,
      contractForm.discount_type,
      contractForm.discount_value,
    );
    const totalNum = Number(contractForm.total_amount);
    const dpMode = contractForm.down_payment_mode === "percent" ? "percent" : "amount";
    const dpRaw = Number(contractForm.down_payment_amount || 0);
    const dpPctRaw = Number(contractForm.down_payment_pct || 0);
    const dpAmount = dpMode === "percent" ? +(totalNum * (dpPctRaw / 100)).toFixed(2) : dpRaw;
    const dpPct = dpMode === "percent" ? dpPctRaw : totalNum > 0 ? +((dpRaw / totalNum) * 100).toFixed(3) : null;
    const payload = {
      property_id: contractForm.property_id,
      buyer_client_id: contractForm.buyer_client_id,
      seller_client_id: contractForm.seller_client_id || null,
      broker_id: contractForm.broker_id || null,
      guarantor_client_id: contractForm.guarantor_client_id || null,
      contract_date: contractForm.contract_date,
      expected_closing_date: contractForm.expected_closing_date || null,
      commission_pct: contractForm.commission_pct ? Number(contractForm.commission_pct) : null,
      notes: contractForm.notes || null,
      status: contractForm.status,
      total_amount: discount.net,
      gross_total_amount: discount.gross,
      discount_type: discount.type,
      discount_value: discount.value,
      discount_amount: discount.amount,
      down_payment_amount: dpAmount,
      down_payment_pct: dpPct,
      down_payment_mode: dpMode,
      payment_mode: contractForm.payment_mode,
      installments_count: contractForm.installments_count ? Number(contractForm.installments_count) : null,
      first_installment_date: contractForm.first_installment_date || null,
      readjustment_index: contractForm.readjustment_index || null,
      late_fee_pct: contractForm.late_fee_pct ? Number(contractForm.late_fee_pct) : null,
      monthly_interest_pct: contractForm.monthly_interest_pct ? Number(contractForm.monthly_interest_pct) : null,
      bank_name: contractForm.bank_name || null,
      bank_financing_amount: contractForm.bank_financing_amount ? Number(contractForm.bank_financing_amount) : null,
      bank_financing_term_months: contractForm.bank_financing_term_months ? Number(contractForm.bank_financing_term_months) : null,
      bank_amortization_system: contractForm.bank_amortization_system || null,
      bank_approval_status: contractForm.bank_approval_status || "pending",
      bank_notes: contractForm.bank_notes || null,
    };
    const { data, error } = await db
      .from("sale_contracts")
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel cadastrar a venda."));
    if (!data?.id) return toast.error("Venda criada, mas nao foi possivel confirmar o registro.");

    if (payload.payment_mode === "owner_financing" && payload.installments_count) {
      await db.rpc("generate_sale_installments", { _contract_id: data.id, _months: payload.installments_count });
    }


    if (contractFile) {
      try {
        await uploadEntityDocument({
          entityType: "sale_contract",
          entityId: data.id,
          documentKind: "contract",
          label: "Contrato de venda digitalizado",
          file: contractFile,
        });
      } catch (uploadError: any) {
        toast.error(
          `Venda criada, mas nao foi possivel anexar o PDF: ${translatedErrorMessage(uploadError, "Falha ao anexar o PDF.")}`,
        );
      }
    }
    toast.success("Contrato de venda cadastrado");
    setOpenContract(false);
    setContractFile(null);
    setContractForm({ ...EMPTY_CONTRACT });
    refresh();
  }

  async function addPayment() {
    if (
      !paymentFor ||
      !paymentForm.description?.trim() ||
      !paymentForm.due_date ||
      !paymentForm.amount_due
    ) {
      return toast.error("Preencha descrição, vencimento e valor");
    }
    const discount = calculateDiscount(
      paymentForm.amount_due,
      paymentForm.discount_type,
      paymentForm.discount_value,
    );
    const { error } = await db.from("sale_payments").insert({
      contract_id: paymentFor.id,
      description: paymentForm.description.trim(),
      due_date: paymentForm.due_date,
      amount_due: discount.net,
      gross_amount_due: discount.gross,
      discount_type: discount.type,
      discount_value: discount.value,
      discount_amount: discount.amount,
      notes: paymentForm.notes?.trim() || null,
    });
    if (error)
      return toast.error(
        translatedErrorMessage(error, "Nao foi possivel adicionar o recebimento."),
      );
    toast.success("Recebimento adicionado");
    setPaymentFor(null);
    setPaymentForm({ ...EMPTY_PAYMENT });
    refresh();
  }

  async function markPaid(payment: any) {
    const { error } = await db
      .from("sale_payments")
      .update({
        status: "paid",
        paid_at: new Date().toISOString().slice(0, 10),
        amount_paid: Number(payment.amount_due),
      })
      .eq("id", payment.id);
    if (error)
      return toast.error(
        translatedErrorMessage(error, "Nao foi possivel confirmar o recebimento."),
      );
    toast.success("Recebimento confirmado");
    refresh();
  }

  async function removePayment(payment: any) {
    if (!confirm(`Excluir ${payment.description}?`)) return;
    const { error } = await db.from("sale_payments").delete().eq("id", payment.id);
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel excluir o recebimento."));
    refresh();
  }

  async function removeContract(contract: any) {
    if (!confirm(`Excluir o contrato ${contract.code}?`)) return;
    const { error } = await db.from("sale_contracts").delete().eq("id", contract.id);
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel excluir o contrato."));
    toast.success("Contrato excluído");
    refresh();
  }

  async function receipt(contract: any, payment: any) {
    const { doc, cursorY } = await newReportPdf("RECIBO DE VENDA");
    doc.setFontSize(10);
    const lines = [
      `Contrato: ${contract.code}`,
      `Imóvel: ${contract.properties?.code ?? "-"} - ${contract.properties?.title ?? ""}`,
      `Comprador: ${contract.buyer?.full_name ?? "-"}`,
      `Referência: ${payment.description}`,
      `Pagamento: ${formatDateBR(payment.paid_at || payment.due_date)}`,
      `Valor recebido: ${money(payment.amount_paid ?? payment.amount_due)}`,
    ];
    lines.forEach((line, index) => doc.text(line, 18, cursorY + index * 7));
    doc.save(`recibo-${contract.code}-${payment.id.slice(0, 8)}.pdf`);
  }

  return (
    <div>
      <PageHeader
        title="Vendas"
        description="Contratos de venda, valores recebidos, recibos e documentos"
        actions={
          <Dialog
            open={openContract}
            onOpenChange={(value) => {
              setOpenContract(value);
              if (!value) {
                setContractForm({ ...EMPTY_CONTRACT });
                setContractFile(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1.5 h-4 w-4" /> Novo contrato
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo contrato de venda</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Imóvel *">
                  <Select
                    value={contractForm.property_id ?? ""}
                    onValueChange={(value) =>
                      setContractForm({ ...contractForm, property_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((property: any) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.code} - {property.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Comprador *">
                  <Select
                    value={contractForm.buyer_client_id ?? ""}
                    onValueChange={(value) =>
                      setContractForm({ ...contractForm, buyer_client_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client: any) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Vendedor">
                  <Select
                    value={contractForm.seller_client_id ?? ""}
                    onValueChange={(value) =>
                      setContractForm({ ...contractForm, seller_client_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client: any) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Corretor">
                  <Select
                    value={contractForm.broker_id ?? ""}
                    onValueChange={(value) =>
                      setContractForm({ ...contractForm, broker_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {brokers.map((broker: any) => (
                        <SelectItem key={broker.id} value={broker.id}>
                          {broker.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Valor total *">
                  <Input
                    type="number"
                    step="0.01"
                    value={contractForm.total_amount ?? ""}
                    onChange={(event) =>
                      setContractForm({ ...contractForm, total_amount: event.target.value })
                    }
                  />
                </Field>
                {isAdmin && (
                  <>
                    <Field label="Desconto">
                      <Select
                        value={contractForm.discount_type ?? "none"}
                        onValueChange={(value) =>
                          setContractForm({ ...contractForm, discount_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem desconto</SelectItem>
                          <SelectItem value="percent">Percentual (%)</SelectItem>
                          <SelectItem value="amount">Valor fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Valor do desconto">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={(contractForm.discount_type ?? "none") === "none"}
                        value={contractForm.discount_value ?? ""}
                        onChange={(event) =>
                          setContractForm({ ...contractForm, discount_value: event.target.value })
                        }
                      />
                    </Field>
                  </>
                )}
                {isAdmin &&
                  formatDiscountLabel(
                    calculateDiscount(
                      contractForm.total_amount,
                      contractForm.discount_type,
                      contractForm.discount_value,
                    ),
                  ) && (
                    <div className="sm:col-span-2 rounded border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      {formatDiscountLabel(
                        calculateDiscount(
                          contractForm.total_amount,
                          contractForm.discount_type,
                          contractForm.discount_value,
                        ),
                      )}
                    </div>
                  )}
                <Field label="Entrada">
                  <Input
                    type="number"
                    step="0.01"
                    value={contractForm.down_payment_amount ?? ""}
                    onChange={(event) =>
                      setContractForm({ ...contractForm, down_payment_amount: event.target.value })
                    }
                  />
                </Field>
                <Field label="Data do contrato *">
                  <Input
                    type="date"
                    value={contractForm.contract_date ?? ""}
                    onChange={(event) =>
                      setContractForm({ ...contractForm, contract_date: event.target.value })
                    }
                  />
                </Field>
                <Field label="Previsão de conclusão">
                  <Input
                    type="date"
                    value={contractForm.expected_closing_date ?? ""}
                    onChange={(event) =>
                      setContractForm({
                        ...contractForm,
                        expected_closing_date: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Comissão (%)">
                  <Input
                    type="number"
                    step="0.01"
                    value={contractForm.commission_pct ?? ""}
                    onChange={(event) =>
                      setContractForm({ ...contractForm, commission_pct: event.target.value })
                    }
                  />
                </Field>
                <Field label="Contrato digitalizado (PDF)">
                  <Input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(event) => setContractFile(event.target.files?.[0] ?? null)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Observações">
                    <Textarea
                      value={contractForm.notes ?? ""}
                      onChange={(event) =>
                        setContractForm({ ...contractForm, notes: event.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createContract}>Cadastrar venda</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 p-4 sm:grid-cols-2 md:p-8 lg:grid-cols-4">
        {[
          ["Contratos ativos", stats.active],
          ["Em negociação", money(stats.negotiated)],
          ["Recebido", money(stats.received)],
          ["A receber", money(stats.pending)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-5">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4 px-4 pb-8 md:px-8">
        {contracts.length === 0 && (
          <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
            Nenhum contrato de venda cadastrado.
          </div>
        )}
        {contracts.map((contract: any) => {
          const isOpen = !!expanded[contract.id];
          const contractPayments = paymentsByContract[contract.id] ?? [];
          const received = contractPayments
            .filter((payment: any) => payment.status === "paid")
            .reduce(
              (sum: number, payment: any) =>
                sum + Number(payment.amount_paid ?? payment.amount_due),
              0,
            );
          return (
            <div key={contract.id} className="overflow-hidden rounded-lg border bg-card">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setExpanded({ ...expanded, [contract.id]: !isOpen })}
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                <BadgeDollarSign className="h-5 w-5 text-primary" />
                <div className="min-w-[220px] flex-1">
                  <div className="font-semibold">
                    {contract.code} - {contract.properties?.code}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {contract.properties?.title} · comprador: {contract.buyer?.full_name}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div>
                    Total <strong>{money(contract.total_amount)}</strong>
                  </div>
                  <div className="text-emerald-700">Recebido {money(received)}</div>
                </div>
                <Badge variant={contract.status === "active" ? "default" : "secondary"}>
                  {contract.status}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Excluir contrato"
                  onClick={() => removeContract(contract)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              {isOpen && (
                <div className="border-t p-4">
                  <EntityDocuments
                    entityType="sale_contract"
                    entityId={contract.id}
                    title="Contrato digitalizado e anexos"
                  />
                  <div className="mt-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Recebimentos</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPaymentFor(contract);
                        setPaymentForm({ ...EMPTY_PAYMENT });
                      }}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Adicionar recebimento
                    </Button>
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="py-2">Descrição</th>
                          <th>Vencimento</th>
                          <th>Valor</th>
                          <th>Status</th>
                          <th className="text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractPayments.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-6 text-center text-xs text-muted-foreground"
                            >
                              Nenhum recebimento lançado.
                            </td>
                          </tr>
                        )}
                        {contractPayments.map((payment: any) => (
                          <tr key={payment.id} className="border-t">
                            <td className="py-2">{payment.description}</td>
                            <td>{formatDateBR(payment.due_date)}</td>
                            <td>{money(payment.amount_due)}</td>
                            <td>
                              <Badge variant={payment.status === "paid" ? "default" : "secondary"}>
                                {payment.status === "paid" ? "Pago" : "Pendente"}
                              </Badge>
                            </td>
                            <td className="text-right">
                              {payment.status !== "paid" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Marcar pago"
                                  onClick={() => markPaid(payment)}
                                >
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                </Button>
                              )}
                              {payment.status === "paid" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Gerar recibo"
                                  onClick={() => receipt(contract, payment)}
                                >
                                  <ReceiptText className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Excluir"
                                onClick={() => removePayment(payment)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog
        open={!!paymentFor}
        onOpenChange={(value) => {
          if (!value) setPaymentFor(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo recebimento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Descrição">
              <Input
                value={paymentForm.description ?? ""}
                onChange={(event) =>
                  setPaymentForm({ ...paymentForm, description: event.target.value })
                }
              />
            </Field>
            <Field label="Vencimento">
              <Input
                type="date"
                value={paymentForm.due_date ?? ""}
                onChange={(event) =>
                  setPaymentForm({ ...paymentForm, due_date: event.target.value })
                }
              />
            </Field>
            <Field label="Valor">
              <Input
                type="number"
                step="0.01"
                value={paymentForm.amount_due ?? ""}
                onChange={(event) =>
                  setPaymentForm({ ...paymentForm, amount_due: event.target.value })
                }
              />
            </Field>
            <Field label="Observações">
              {isAdmin && (
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <Field label="Desconto">
                    <Select
                      value={paymentForm.discount_type ?? "none"}
                      onValueChange={(value) =>
                        setPaymentForm({ ...paymentForm, discount_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem desconto</SelectItem>
                        <SelectItem value="percent">Percentual (%)</SelectItem>
                        <SelectItem value="amount">Valor fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Valor do desconto">
                    <Input
                      type="number"
                      step="0.01"
                      disabled={(paymentForm.discount_type ?? "none") === "none"}
                      value={paymentForm.discount_value ?? ""}
                      onChange={(event) =>
                        setPaymentForm({ ...paymentForm, discount_value: event.target.value })
                      }
                    />
                  </Field>
                </div>
              )}
              <Textarea
                value={paymentForm.notes ?? ""}
                onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={addPayment}>Adicionar</Button>
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
