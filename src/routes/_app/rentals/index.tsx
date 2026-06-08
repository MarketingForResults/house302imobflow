import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { newReportPdf, generateDocumentPdf } from "@/lib/pdf-utils";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Plus,
  FileDown,
  MessageCircle,
  KeyRound,
  Pencil,
  Trash2,
  Undo2,
  ChevronDown,
  ChevronRight,
  Receipt,
  Paperclip,
  BadgeDollarSign,
  FolderArchive,
} from "lucide-react";
import { formatDateBR } from "@/lib/format-date";
import { translatedErrorMessage } from "@/lib/error-messages";
import { EntityDocuments } from "@/components/entity-documents";
import { uploadEntityDocument } from "@/lib/entity-documents";

export const Route = createFileRoute("/_app/rentals/")({ component: RentalsPage });

function RentalsPage() {
  const qc = useQueryClient();
  const [openContract, setOpenContract] = useState(false);
  const [form, setForm] = useState<any>({
    kind: "residential",
    due_day: 5,
    monthly_rent: "",
    term_months: 12,
  });
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [addingFor, setAddingFor] = useState<any | null>(null); // contract object
  const [newPayment, setNewPayment] = useState<any>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all"); // all | with_late | with_open | all_paid
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectedPayments, setSelectedPayments] = useState<Record<string, boolean>>({});
  // Pagamento — confirmar com data
  const [payingPayment, setPayingPayment] = useState<{ p: any; c: any } | null>(null);
  const [payDate, setPayDate] = useState<string>("");
  const [payReceiptFile, setPayReceiptFile] = useState<File | null>(null);
  // Recibo — enviar PDF por e-mail/WhatsApp
  const [receiptFor, setReceiptFor] = useState<{ p: any; c: any } | null>(null);
  const [depositRefundFor, setDepositRefundFor] = useState<{ p: any; c: any } | null>(null);
  const [depositRefundForm, setDepositRefundForm] = useState({
    refund_due_date: "",
    refunded_at: "",
    refund_amount: "",
    notes: "",
  });
  const [depositRefundReceiptFile, setDepositRefundReceiptFile] = useState<File | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () =>
      (await supabase.from("app_settings").select("*").eq("id", true).maybeSingle()).data,
  });
  const { data: contracts = [], refetch } = useQuery({
    queryKey: ["rental_contracts"],
    queryFn: async () =>
      (
        await supabase
          .from("rental_contracts")
          .select(
            "*, properties(code, title), tenant:clients!rental_contracts_tenant_client_id_fkey(full_name, phone, email)",
          )
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["rental_payments"],
    queryFn: async () =>
      (await supabase.from("rental_payments").select("*").order("due_date", { ascending: true }))
        .data ?? [],
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
      (await supabase.from("clients").select("id, full_name, phone").order("full_name")).data ?? [],
  });

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);

  // Late fee + daily interest recalculation based on app_settings
  const lateFeePct = Number(settings?.rental_late_fee_pct || 10);
  const dailyPct = Number(settings?.rental_daily_interest_pct || (1 / 30));
  const grace = Number(settings?.rental_grace_days ?? 0);
  const savingsMonthlyPct = Number(settings?.savings_monthly_rate_pct ?? 0.5);

  function dateOnly(input: string | Date) {
    const raw = typeof input === "string" ? input.slice(0, 10) : input.toISOString().slice(0, 10);
    const [year, month, day] = raw.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function diffDays(startIso: string, endIso: string) {
    const start = dateOnly(startIso);
    const end = dateOnly(endIso);
    return Math.floor((+end - +start) / 86400000);
  }

  function paymentKind(p: any) {
    return p.payment_kind ?? "rent";
  }

  function paymentKindLabel(kind: string) {
    return kind === "deposit" ? "caucao" : "parcela";
  }

  function savingsYield(principal: number, startIso?: string | null, capIso?: string | null) {
    if (!principal || !startIso) return { principal, months: 0, updated: principal, gain: 0 };
    const start = dateOnly(startIso);
    const cap = capIso ? dateOnly(capIso) : dateOnly(today);
    if (cap <= start) return { principal, months: 0, updated: principal, gain: 0 };
    const months =
      (cap.getFullYear() - start.getFullYear()) * 12 +
      (cap.getMonth() - start.getMonth()) +
      (cap.getDate() >= start.getDate() ? 0 : -1);
    const m = Math.max(0, months);
    const updated = principal * Math.pow(1 + savingsMonthlyPct / 100, m);
    return { principal, months: m, updated, gain: updated - principal };
  }

  function depositRefundDueDate(c: any, p: any) {
    return p.deposit_refund_due_date ?? c?.end_date ?? today;
  }

  function depositRefundInfo(c: any, p: any, refundedAt?: string, dueDate?: string) {
    const principal = Number(p.amount_paid ?? p.amount_due ?? 0);
    const start = p.paid_at?.slice(0, 10) ?? p.due_date;
    const expectedDate = dueDate ?? depositRefundDueDate(c, p);
    const realDate = refundedAt || p.deposit_refunded_at?.slice(0, 10) || today;
    const expected = savingsYield(principal, start, expectedDate);
    const actual = savingsYield(principal, start, realDate);
    return {
      principal,
      start,
      expectedDate,
      realDate,
      expectedAmount: expected.updated,
      actualAmount: actual.updated,
      expectedGain: expected.gain,
      actualGain: actual.gain,
      additionalGain: Math.max(0, actual.updated - expected.updated),
      expectedMonths: expected.months,
      actualMonths: actual.months,
      daysAfterDue: Math.max(0, diffDays(expectedDate, realDate)),
    };
  }

  function recalc(p: any, asOf?: string) {
    const base = Number(p.amount_due ?? 0);
    const baseDate = asOf ?? today;
    const rawDaysLate = diffDays(p.due_date, baseDate);
    const daysLate = rawDaysLate <= grace ? 0 : rawDaysLate;

    if (paymentKind(p) === "deposit") {
      if (p.status === "paid") {
        const fee = Number(p.late_fee_amount ?? 0);
        const interest = Number(p.interest_amount ?? 0);
        const paidPrincipal = Number(p.amount_paid ?? base + fee + interest);
        const capDate = p.deposit_refunded_at?.slice(0, 10) ?? today;
        const correction = savingsYield(paidPrincipal, p.paid_at?.slice(0, 10), capDate);
        return {
          base,
          fee,
          interest: correction.gain,
          total: correction.updated,
          daysLate: 0,
          savingsMonths: correction.months,
          isDeposit: true,
        };
      } else {
        const fee = daysLate > 0 ? base * (lateFeePct / 100) : 0;
        const interest = daysLate > 0 ? base * (dailyPct / 100) * daysLate : 0;
        const calculatedTotal = base + fee + interest;
        return {
          base,
          fee,
          interest,
          total: calculatedTotal,
          daysLate,
          savingsMonths: 0,
          isDeposit: true,
        };
      }
    }

    if (p.status === "paid") {
      const fee = Number(p.late_fee_amount ?? 0);
      const interest = Number(p.interest_amount ?? 0);
      const total = p.amount_paid != null ? Number(p.amount_paid) : base + fee + interest;
      return { base, fee, interest, total, daysLate: 0, savingsMonths: 0, isDeposit: false };
    }

    const fee = daysLate > 0 ? base * (lateFeePct / 100) : 0;
    const interest = daysLate > 0 ? base * (dailyPct / 100) * daysLate : 0;
    const calculatedTotal = base + fee + interest;
    return { base, fee, interest, total: calculatedTotal, daysLate, savingsMonths: 0, isDeposit: false };
  }

  const paymentsByContract = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const p of payments) (map[p.contract_id] ??= []).push(p);
    return map;
  }, [payments]);

  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c: any) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q) {
        const hay = [
          c.code,
          c.properties?.code,
          c.properties?.title,
          c.tenant?.full_name,
          c.tenant?.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (paymentFilter !== "all") {
        const list = paymentsByContract[c.id] ?? [];
        const hasLate = list.some((p: any) => p.status !== "paid" && p.due_date < today);
        const hasOpen = list.some((p: any) => p.status !== "paid");
        if (paymentFilter === "with_late" && !hasLate) return false;
        if (paymentFilter === "with_open" && !hasOpen) return false;
        if (paymentFilter === "all_paid" && hasOpen) return false;
      }
      return true;
    });
  }, [contracts, search, statusFilter, paymentFilter, paymentsByContract, today]);

  const filteredContractIds = useMemo(
    () => new Set(filteredContracts.map((c: any) => c.id)),
    [filteredContracts],
  );

  const stats = useMemo(() => {
    let monthDue = 0,
      monthPaid = 0,
      late = 0;
    for (const p of payments) {
      if (!filteredContractIds.has(p.contract_id)) continue;
      if (p.status === "paid" && p.paid_at && p.paid_at.slice(0, 10) >= monthStartIso)
        monthPaid += recalc(p).total;
      if (p.status !== "paid" && p.due_date >= monthStartIso) monthDue += recalc(p).total;
      if (p.status !== "paid" && p.due_date < today) late++;
    }
    return {
      active: filteredContracts.filter((c: any) => c.status === "active").length,
      monthDue,
      monthPaid,
      late,
    };
  }, [payments, filteredContracts, filteredContractIds, lateFeePct, dailyPct, grace, savingsMonthlyPct]);

  function addMonths(iso: string, months: number): string {
    const d = new Date(iso + "T00:00:00");
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) d.setDate(0); // último dia do mês anterior se overflow
    return d.toISOString().slice(0, 10);
  }

  const monthOptions = useMemo(() => {
    const names = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ];
    const currentYear = new Date().getFullYear();
    const options: Array<{ value: string; label: string }> = [];
    for (let year = currentYear - 3; year <= currentYear + 5; year++) {
      for (let month = 1; month <= 12; month++) {
        options.push({
          value: `${year}-${String(month).padStart(2, "0")}-01`,
          label: `${names[month - 1]}/${year}`,
        });
      }
    }
    return options;
  }, []);

  function referenceLabel(value: string | null | undefined) {
    if (!value) return "—";
    const option = monthOptions.find((item) => item.value === normalizeReferenceMonth(value));
    return option?.label ?? formatDateBR(value);
  }

  function normalizeReferenceMonth(value: string | null | undefined) {
    return value ? `${value.slice(0, 7)}-01` : "";
  }

  function referenceMonthExists(
    contractId: string,
    referenceMonth: string,
    ignoredPaymentId?: string,
    kind = "rent",
  ) {
    const normalized = normalizeReferenceMonth(referenceMonth);
    return (paymentsByContract[contractId] ?? []).some(
      (payment: any) =>
        payment.id !== ignoredPaymentId &&
        paymentKind(payment) === kind &&
        normalizeReferenceMonth(payment.reference_month) === normalized,
    );
  }

  function availableMonthOptionsForAdd(contractId: string, kind = "rent") {
    const used = new Set(
      (paymentsByContract[contractId] ?? [])
        .filter((payment: any) => paymentKind(payment) === kind)
        .map((payment: any) => normalizeReferenceMonth(payment.reference_month)),
    );
    return monthOptions.filter((month) => !used.has(month.value));
  }

  function nextAvailableReferenceMonth(contractId: string, kind = "rent") {
    const existing = (paymentsByContract[contractId] ?? [])
      .filter((payment: any) => paymentKind(payment) === kind)
      .map((payment: any) => normalizeReferenceMonth(payment.reference_month))
      .filter(Boolean)
      .sort();

    let candidate = existing.length
      ? addMonths(existing[existing.length - 1], 1)
      : normalizeReferenceMonth(today);
    candidate = normalizeReferenceMonth(candidate);

    for (let attempt = 0; attempt < 120; attempt++) {
      if (!referenceMonthExists(contractId, candidate, undefined, kind)) return candidate;
      candidate = normalizeReferenceMonth(addMonths(candidate, 1));
    }

    return availableMonthOptionsForAdd(contractId, kind)[0]?.value ?? "";
  }

  function openAddPayment(contract: any) {
    setAddingFor(contract);
    setNewPayment({
      amount_due: contract.monthly_rent,
      reference_month: nextAvailableReferenceMonth(contract.id, "rent"),
      payment_kind: "rent",
    });
  }

  function openAddDeposit(contract: any) {
    setAddingFor(contract);
    setNewPayment({
      amount_due: contract.deposit_amount ?? "",
      due_date: contract.start_date ?? today,
      reference_month: nextAvailableReferenceMonth(contract.id, "deposit"),
      payment_kind: "deposit",
      notes: "Caucao",
    });
  }

  const computedEndDate = useMemo(() => {
    const months = Number(form.term_months);
    if (!form.start_date || !months || months <= 0) return "";
    return addMonths(form.start_date, months);
  }, [form.start_date, form.term_months]);

  async function createContract() {
    if (!form.property_id || !form.tenant_client_id || !form.monthly_rent || !form.start_date) {
      return toast.error("Preencha imóvel, inquilino, valor e data de início");
    }
    const months = Number(form.term_months) || 12;
    const dueDay = Number(form.due_day);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      return toast.error("Informe um dia de vencimento entre 1 e 31");
    }
    const end_date = addMonths(form.start_date, months);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { term_months: _t, ...rest } = form;
    const { data: created, error } = await supabase
      .from("rental_contracts")
      .insert({
        ...rest,
        monthly_rent: Number(form.monthly_rent),
        due_day: dueDay,
        deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : null,
        end_date,
        created_by: user?.id,
      })
      .select("id")
      .maybeSingle();
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel criar o contrato."));
    if (!created?.id) return toast.error("Contrato criado, mas nao foi possivel confirmar o registro.");
    const { error: paymentsError } = await supabase.rpc("generate_rental_payments", {
      _contract_id: created.id,
      _months: months,
    });
    if (paymentsError) {
      refetch();
      qc.invalidateQueries({ queryKey: ["rental_payments"] });
      return toast.error(
        `Contrato criado, mas não foi possível gerar as parcelas: ${paymentsError.message}`,
      );
    }
    const depositAmount = Number(form.deposit_amount ?? 0);
    if (depositAmount > 0) {
      const { error: depositPaymentError } = await supabase.from("rental_payments").insert({
        contract_id: created.id,
        reference_month: normalizeReferenceMonth(form.start_date),
        due_date: form.start_date,
        amount_due: depositAmount,
        notes: "Caucao",
        payment_kind: "deposit",
      });
      if (depositPaymentError) {
        toast.error(`Contrato criado, mas nao foi possivel gerar o caucao: ${translatedErrorMessage(depositPaymentError, "Falha ao gerar o caucao.")}`);
      }
    }
    if (contractFile) {
      try {
        await uploadEntityDocument({
          entityType: "rental_contract",
          entityId: created.id,
          documentKind: "contract",
          label: "Contrato de aluguel digitalizado",
          file: contractFile,
        });
      } catch (uploadError: any) {
        toast.error(`Contrato criado, mas nao foi possivel anexar o PDF: ${translatedErrorMessage(uploadError, "Falha ao anexar o PDF.")}`);
      }
    }
    toast.success("Contrato criado e lancamentos gerados");
    setOpenContract(false);
    setForm({ kind: "residential", due_day: 5, monthly_rent: "", term_months: 12 });
    setContractFile(null);
    refetch();
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
  }

  function openMarkPaid(c: any, p: any) {
    setPayingPayment({ p, c });
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayReceiptFile(null);
  }

  function closeMarkPaid() {
    setPayingPayment(null);
    setPayReceiptFile(null);
  }

  function openDepositRefund(c: any, p: any) {
    const refundedAt = p.deposit_refunded_at?.slice(0, 10) ?? today;
    const dueDate = depositRefundDueDate(c, p);
    const info = depositRefundInfo(c, p, refundedAt, dueDate);
    setDepositRefundFor({ c, p });
    setDepositRefundForm({
      refund_due_date: dueDate,
      refunded_at: refundedAt,
      refund_amount: String(Number(p.deposit_refund_amount ?? info.actualAmount).toFixed(2)),
      notes: p.deposit_refund_notes ?? "",
    });
    setDepositRefundReceiptFile(null);
  }

  function closeDepositRefund() {
    setDepositRefundFor(null);
    setDepositRefundReceiptFile(null);
  }

  function safeFileName(name: string) {
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
  }

  async function uploadPaymentReceipt(paymentId: string, file: File) {
    const path = `${paymentId}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("rental-payment-receipts")
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) throw uploadError;
    return path;
  }

  async function openAttachedReceipt(p: any) {
    if (!p.receipt_file_path) return toast.error("Esta parcela não possui recibo anexado.");
    const { data, error } = await supabase.storage
      .from("rental-payment-receipts")
      .createSignedUrl(p.receipt_file_path, 60 * 10);
    if (error || !data?.signedUrl) {
      return toast.error(translatedErrorMessage(error, "Nao foi possivel abrir o recibo anexado."));
    }
    window.open(data.signedUrl, "_blank");
  }

  async function openDepositRefundReceipt(p: any) {
    if (!p.deposit_refund_receipt_file_path) {
      return toast.error("Esta devolução não possui comprovante anexado.");
    }
    const { data, error } = await supabase.storage
      .from("rental-payment-receipts")
      .createSignedUrl(p.deposit_refund_receipt_file_path, 60 * 10);
    if (error || !data?.signedUrl) {
      return toast.error(translatedErrorMessage(error, "Nao foi possivel abrir o comprovante da devolucao."));
    }
    window.open(data.signedUrl, "_blank");
  }

  function isSchemaCacheColumnError(error: any) {
    const message = String(error?.message ?? "").toLowerCase();
    return (
      error?.code === "42703" ||
      error?.code === "PGRST204" ||
      message.includes("schema cache") ||
      (message.includes("could not find") && message.includes("column"))
    );
  }

  async function updateRentalPayment(
    paymentId: string,
    patch: Record<string, any>,
    fallbackPatch?: Record<string, any>,
  ) {
    const { error } = await (supabase as any).from("rental_payments").update(patch).eq("id", paymentId);
    if (error && fallbackPatch && isSchemaCacheColumnError(error)) {
      const retry = await (supabase as any).from("rental_payments").update(fallbackPatch).eq("id", paymentId);
      return { error: retry.error, usedFallback: true };
    }
    return { error, usedFallback: false };
  }

  async function saveDepositRefund() {
    if (!depositRefundFor) return;
    const { p } = depositRefundFor;
    if (!depositRefundForm.refund_due_date || !depositRefundForm.refunded_at) {
      return toast.error("Informe a data prevista e a data real da devolução");
    }
    const amount = Number(String(depositRefundForm.refund_amount).replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      return toast.error("Informe um valor devolvido válido");
    }

    const patch: any = {
      deposit_refund_due_date: depositRefundForm.refund_due_date,
      deposit_refunded_at: new Date(depositRefundForm.refunded_at + "T12:00:00").toISOString(),
      deposit_refund_amount: amount,
      deposit_refund_notes: depositRefundForm.notes || null,
    };

    try {
      if (depositRefundReceiptFile) {
        const receiptPath = await uploadPaymentReceipt(p.id, depositRefundReceiptFile);
        patch.deposit_refund_receipt_file_path = receiptPath;
        patch.deposit_refund_receipt_file_name = depositRefundReceiptFile.name;
        patch.deposit_refund_uploaded_at = new Date().toISOString();
      }
    } catch (err: any) {
      return toast.error(`Nao foi possivel anexar o comprovante: ${translatedErrorMessage(err, "Falha no anexo.")}`);
    }

    const { error } = await updateRentalPayment(p.id, patch);
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel registrar a devolucao do caucao."));
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success("Devolução do caução registrada");
    closeDepositRefund();
  }

  async function confirmMarkPaid() {
    if (!payingPayment) return;
    const { p } = payingPayment;
    if (!payDate) return toast.error("Informe a data do pagamento");
    const calc = recalc(p, payDate);
    const total = calc.total;
    const paidAtIso = new Date(payDate + "T12:00:00").toISOString();
    const patch: any = {
      status: "paid",
      paid_at: paidAtIso,
      amount_paid: total,
      late_fee_amount: calc.fee,
      interest_amount: calc.interest,
    };
    try {
      if (payReceiptFile) {
        const receiptPath = await uploadPaymentReceipt(p.id, payReceiptFile);
        patch.receipt_file_path = receiptPath;
        patch.receipt_file_name = payReceiptFile.name;
        patch.receipt_uploaded_at = new Date().toISOString();
      }
    } catch (err: any) {
      return toast.error(`Nao foi possivel anexar o recibo: ${translatedErrorMessage(err, "Falha no anexo.")}`);
    }
    const { error, usedFallback } = await updateRentalPayment(
      p.id,
      patch,
      payReceiptFile
        ? {
            status: "paid",
            paid_at: paidAtIso,
            amount_paid: total,
          }
        : undefined,
    );
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel registrar o pagamento."));
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    if (usedFallback) {
      toast.warning("Pagamento registrado, mas o recibo não foi vinculado porque o schema do Supabase ainda não expõe os campos de recibo.");
    }
    toast.success(`Pagamento registrado em ${formatDateBR(payDate)} (R$ ${total.toFixed(2)})`);
    closeMarkPaid();
  }

  async function revertPaid(id: string) {
    const basePatch = {
      status: "pending",
      paid_at: null,
      amount_paid: null,
    };
    const { error } = await updateRentalPayment(
      id,
      {
        ...basePatch,
        receipt_file_path: null,
        receipt_file_name: null,
        receipt_uploaded_at: null,
        deposit_refund_due_date: null,
        deposit_refunded_at: null,
        deposit_refund_amount: null,
        deposit_refund_notes: null,
        deposit_refund_receipt_file_path: null,
        deposit_refund_receipt_file_name: null,
        deposit_refund_uploaded_at: null,
      },
      basePatch,
    );
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel reverter o lancamento."));
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success("Lançamento revertido para pendente");
  }

  async function deletePayment(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from("rental_payments").delete().eq("id", id);
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel excluir o lancamento."));
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success("Lançamento excluído");
  }

  async function saveEdit() {
    if (!editingPayment) return;
    const { id, due_date, amount_due, reference_month, notes } = editingPayment;
    const normalizedReferenceMonth = normalizeReferenceMonth(reference_month);
    const kind = paymentKind(editingPayment);
    const label = paymentKindLabel(kind);
    if (referenceMonthExists(editingPayment.contract_id, normalizedReferenceMonth, id, kind)) {
      return toast.error(`Ja existe ${label} de ${referenceLabel(normalizedReferenceMonth)} neste contrato`);
    }
    const { error } = await supabase
      .from("rental_payments")
      .update({
        due_date,
        amount_due: Number(amount_due),
        reference_month: normalizedReferenceMonth,
        notes,
      })
      .eq("id", id);
    if (error) {
      if (
        error.code === "23505" ||
        error.message.includes("rental_payments_contract_id_reference_month_key") ||
        error.message.includes("rental_payments_contract_id_reference_month_payment_kind_key")
      ) {
        return toast.error(`Ja existe ${label} de ${referenceLabel(normalizedReferenceMonth)} neste contrato`);
      }
      return toast.error(translatedErrorMessage(error, "Nao foi possivel atualizar o lancamento."));
    }
    setEditingPayment(null);
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success(kind === "deposit" ? "Caucao atualizado" : "Parcela atualizada");
  }

  async function addPayment() {
    if (
      !addingFor ||
      !newPayment.due_date ||
      !newPayment.reference_month ||
      !newPayment.amount_due
    ) {
      return toast.error("Preencha referência, vencimento e valor");
    }
    const normalizedReferenceMonth = normalizeReferenceMonth(newPayment.reference_month);
    const kind = newPayment.payment_kind ?? "rent";
    const label = paymentKindLabel(kind);
    if (referenceMonthExists(addingFor.id, normalizedReferenceMonth, undefined, kind)) {
      return toast.error(`Ja existe ${label} de ${referenceLabel(normalizedReferenceMonth)} neste contrato`);
    }
    const { error } = await supabase.from("rental_payments").insert({
      contract_id: addingFor.id,
      reference_month: normalizedReferenceMonth,
      due_date: newPayment.due_date,
      amount_due: Number(newPayment.amount_due),
      notes: newPayment.notes ?? null,
      payment_kind: kind,
    });
    if (error) {
      if (
        error.code === "23505" ||
        error.message.includes("rental_payments_contract_id_reference_month_key") ||
        error.message.includes("rental_payments_contract_id_reference_month_payment_kind_key")
      ) {
        return toast.error(`Ja existe ${label} de ${referenceLabel(normalizedReferenceMonth)} neste contrato`);
      }
      return toast.error(translatedErrorMessage(error, "Nao foi possivel adicionar o lancamento."));
    }
    setAddingFor(null);
    setNewPayment({});
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success(kind === "deposit" ? "Caucao adicionado" : "Parcela adicionada");
  }

  async function bulkDeletePayments(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir ${ids.length} lançamento(s) selecionado(s)?`)) return;
    try {
      const { error } = await supabase.from("rental_payments").delete().in("id", ids);
      if (error) throw error;
      setSelectedPayments((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["rental_payments"] });
      toast.success(`${ids.length} lançamento(s) excluído(s) com sucesso!`);
    } catch (err: any) {
      toast.error(translatedErrorMessage(err, "Nao foi possivel excluir as parcelas."));
    }
  }

  async function bulkMarkPaid(ids: string[]) {
    if (ids.length === 0) return;
    const defaultDate = new Date().toISOString().slice(0, 10);
    const dateStr = prompt(
      "Data do pagamento para os lançamentos selecionados (AAAA-MM-DD):",
      defaultDate,
    );
    if (dateStr === null) return;
    if (!dateStr) return toast.error("Data de pagamento obrigatória!");

    try {
      const { data: listToPay } = await supabase.from("rental_payments").select("*").in("id", ids);
      if (!listToPay) return;

      const paidAtIso = new Date(dateStr + "T12:00:00").toISOString();
      const promises = listToPay.map((p) => {
        const calc = recalc(p, dateStr);
        return supabase
          .from("rental_payments")
          .update({
            status: "paid",
            paid_at: paidAtIso,
            amount_paid: calc.total,
            late_fee_amount: calc.fee,
            interest_amount: calc.interest,
          })
          .eq("id", p.id);
      });

      await Promise.all(promises);

      setSelectedPayments((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });

      qc.invalidateQueries({ queryKey: ["rental_payments"] });
      toast.success(`${ids.length} lançamento(s) marcado(s) como pago(s)!`);
    } catch (err: any) {
      toast.error(translatedErrorMessage(err, "Nao foi possivel registrar os pagamentos."));
    }
  }

  async function deleteContracts(ids: string[]) {
    if (ids.length === 0) return;
    if (
      !confirm(
        `Excluir ${ids.length} contrato(s) e TODAS as parcelas vinculadas? Esta ação é irreversível.`,
      )
    )
      return;
    const { error: e1 } = await supabase.from("rental_payments").delete().in("contract_id", ids);
    if (e1) return toast.error(translatedErrorMessage(e1, "Nao foi possivel excluir as parcelas do contrato."));
    const { error: e2 } = await supabase.from("rental_contracts").delete().in("id", ids);
    if (e2) return toast.error(translatedErrorMessage(e2, "Nao foi possivel excluir o contrato."));
    setSelected({});
    qc.invalidateQueries({ queryKey: ["rental_contracts"] });
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success(`${ids.length} contrato(s) excluído(s)`);
  }

  async function generateMore(contractId: string) {
    const { data, error } = await supabase.rpc("generate_rental_payments", {
      _contract_id: contractId,
      _months: 12,
    });
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel gerar as parcelas."));
    toast.success(`${data} parcela(s) geradas`);
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
  }

  async function markLate() {
    const { data, error } = await supabase.rpc("mark_late_rental_payments");
    if (error) return toast.error(translatedErrorMessage(error, "Nao foi possivel marcar os atrasados."));
    toast.success(`${data} parcela(s) marcada(s) como atrasadas`);
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
  }

  function whatsappReminder(c: any, p: any) {
    const phone = (c.tenant?.phone ?? "").replace(/\D/g, "");
    if (!phone) return toast.error("Inquilino sem telefone cadastrado");
    const r = recalc(p);
    const isDeposit = paymentKind(p) === "deposit";
    const label = isDeposit ? "caução" : "aluguel";
    const extra =
      !isDeposit && r.daysLate > 0
        ? ` Com multa e juros (${r.daysLate} dia(s) de atraso): R$ ${r.total.toFixed(2)}.`
        : "";
    const correction =
      isDeposit && r.interest > 0
        ? ` Valor atualizado pela poupança: R$ ${r.total.toFixed(2)}.`
        : "";
    const msg = `Olá ${c.tenant?.full_name ?? ""}, lembrete da House302: ${label} do imóvel ${c.properties?.code} (ref. ${referenceLabel(p.reference_month)}) no valor de R$ ${r.base.toFixed(2)} vence em ${formatDateBR(p.due_date)}.${extra}${correction} Contrato ${c.code}.`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function exportPdf() {
    const title =
      search || statusFilter !== "all" || paymentFilter !== "all"
        ? "Relatório de aluguéis — filtro aplicado"
        : "Relatório de aluguéis — mês atual";
    const { doc } = await newReportPdf(title);
    const rows: any[] = [];
    for (const c of filteredContracts) {
      for (const p of paymentsByContract[c.id] ?? []) {
        if (!(p.due_date >= monthStartIso || p.status !== "paid")) continue;
        const r = recalc(p);
        rows.push([
          c.code,
          c.properties?.code ?? "—",
          c.tenant?.full_name ?? "—",
          paymentKind(p) === "deposit" ? "Caução" : "Aluguel",
          referenceLabel(p.reference_month),
          formatDateBR(p.due_date),
          `R$ ${r.base.toFixed(2)}`,
          `R$ ${r.total.toFixed(2)}`,
          p.status,
        ]);
      }
    }
    autoTable(doc, {
      startY: 36,
      head: [
        [
          "Contrato",
          "Imóvel",
          "Inquilino",
          "Tipo",
          "Ref.",
          "Vencimento",
          "Valor",
          "Total c/ encargos",
          "Status",
        ],
      ],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 0, 200] },
    });
    doc.save("aluguéis.pdf");
  }

  function exportXlsx() {
    const rows = payments
      .filter((p: any) => filteredContractIds.has(p.contract_id))
      .map((p: any) => {
        const c = contracts.find((x: any) => x.id === p.contract_id);
        const r = recalc(p);
        return {
          Contrato: c?.code,
          Imóvel: c?.properties?.code,
          Inquilino: c?.tenant?.full_name,
          Tipo: paymentKind(p) === "deposit" ? "Caução" : "Aluguel",
          Referência: referenceLabel(p.reference_month),
          Vencimento: formatDateBR(p.due_date),
          Valor: r.base,
          Multa: r.fee,
          Juros: r.interest,
          Total: r.total,
          Pago: p.amount_paid ?? "",
          Status: p.status,
        };
      });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Parcelas");
    XLSX.writeFile(wb, "aluguéis.xlsx");
  }

  async function buildReceiptPdf(c: any, p: any) {
    const amount = Number(p.amount_paid ?? p.amount_due ?? 0);
    const paidIso = p.paid_at ? p.paid_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const isDeposit = paymentKind(p) === "deposit";
    const receiptLabel = isDeposit ? "caução" : "aluguel";
    const titleLabel = isDeposit ? "RECIBO DE PAGAMENTO DE CAUÇÃO" : "RECIBO DE PAGAMENTO DE ALUGUEL";
    const body =
      `${titleLabel}\n\n` +
      `Recebemos de ${c.tenant?.full_name ?? "—"} a quantia de R$ ${amount.toFixed(2)}, ` +
      `referente ${isDeposit ? "a caução" : "ao aluguel"} do imóvel ${c.properties?.code ?? ""} — ${c.properties?.title ?? ""}, ` +
      `competência ${referenceLabel(p.reference_month)}, vencimento em ${formatDateBR(p.due_date)}, ` +
      `pago em ${formatDateBR(paidIso)}.\n\n` +
      `Contrato: ${c.code}\n` +
      `Forma de pagamento: conforme ajuste entre as partes.\n\n` +
      `Para clareza e validade, firmamos o presente recibo.`;
    const doc = await generateDocumentPdf({
      code: c.code,
      locator: c.properties?.code ?? c.code,
      title: `Recibo de ${receiptLabel} — ${referenceLabel(p.reference_month)}`,
      bodyText: body,
      parties: [{ label: "Locador / Imobiliária", name: "House302 ImobiFlow" }],
      footerNote: `Recibo de ${receiptLabel} — House302 ImobiFlow`,
    });
    const fileName = `recibo-${receiptLabel}-${c.code}-${(p.reference_month ?? "").slice(0, 7)}.pdf`;
    return { doc, fileName, amount, paidIso, receiptLabel };
  }

  async function downloadReceipt() {
    if (!receiptFor) return;
    const { doc, fileName } = await buildReceiptPdf(receiptFor.c, receiptFor.p);
    doc.save(fileName);
  }

  async function sendReceiptEmail() {
    if (!receiptFor) return;
    const { c, p } = receiptFor;
    const { doc, fileName, amount, paidIso, receiptLabel } = await buildReceiptPdf(c, p);
    doc.save(fileName);
    const email = (c.tenant?.email ?? "").trim();
    const subject = `Recibo de ${receiptLabel} ${c.code} — ${referenceLabel(p.reference_month)}`;
    const bodyMsg =
      `Olá ${c.tenant?.full_name ?? ""},\n\n` +
      `Segue o recibo de ${receiptLabel} do imóvel ${c.properties?.code ?? ""} ` +
      `referente a ${referenceLabel(p.reference_month)}, no valor de R$ ${amount.toFixed(2)}, pago em ${formatDateBR(paidIso)}.\n\n` +
      `O arquivo "${fileName}" foi baixado neste dispositivo — por favor, anexe-o a este e-mail antes de enviar.\n\n` +
      `House302 ImobiFlow`;
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyMsg)}`;
    toast.success("Recibo baixado — anexe ao e-mail antes de enviar");
  }

  async function sendReceiptWhatsapp() {
    if (!receiptFor) return;
    const { c, p } = receiptFor;
    const { doc, fileName, amount, paidIso, receiptLabel } = await buildReceiptPdf(c, p);
    doc.save(fileName);
    const phone = (c.tenant?.phone ?? "").replace(/\D/g, "");
    if (!phone) {
      toast.error("Inquilino sem telefone cadastrado");
      return;
    }
    const msg =
      `Olá ${c.tenant?.full_name ?? ""}! Segue o recibo de ${receiptLabel} do imóvel ${c.properties?.code ?? ""} ` +
      `(ref. ${referenceLabel(p.reference_month)}) no valor de R$ ${amount.toFixed(2)}, pago em ${formatDateBR(paidIso)}. ` +
      `O arquivo "${fileName}" foi baixado — anexe na conversa antes de enviar. — House302`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    toast.success("Recibo baixado — anexe no WhatsApp");
  }

  return (
    <div>
      <PageHeader
        title="Aluguéis"
        description="Contratos e parcelas — encargos calculados automaticamente conforme as Configurações"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/rentals/homologation">
                <FolderArchive className="mr-1.5 h-4 w-4" />
                Homologacao
              </Link>
            </Button>
            <Button variant="outline" onClick={markLate}>
              Marcar atrasados
            </Button>
            <Button variant="outline" onClick={exportXlsx}>
              <FileDown className="mr-1.5 h-4 w-4" />
              XLSX
            </Button>
            <Button variant="outline" onClick={exportPdf}>
              <FileDown className="mr-1.5 h-4 w-4" />
              PDF
            </Button>
            <Dialog open={openContract} onOpenChange={setOpenContract}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Novo contrato
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden sm:max-w-2xl">
                <DialogHeader className="min-w-0">
                  <DialogTitle>Novo contrato de aluguel</DialogTitle>
                </DialogHeader>
                <div className="grid min-w-0 gap-3">
                  <div className="min-w-0">
                    <Label className="text-xs">Imóvel</Label>
                    <Select
                      value={form.property_id ?? ""}
                      onValueChange={(v) => setForm({ ...form, property_id: v })}
                    >
                      <SelectTrigger className="w-full min-w-0 [&>span]:truncate">
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                      <SelectContent className="max-w-[calc(100vw-2rem)]">
                        {properties.map((p: any) => (
                          <SelectItem key={p.id} value={p.id} className="max-w-[calc(100vw-3rem)] truncate">
                            {p.code} — {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-xs">Inquilino</Label>
                    <Select
                      value={form.tenant_client_id ?? ""}
                      onValueChange={(v) => setForm({ ...form, tenant_client_id: v })}
                    >
                      <SelectTrigger className="w-full min-w-0 [&>span]:truncate">
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                      <SelectContent className="max-w-[calc(100vw-2rem)]">
                        {clients.map((c: any) => (
                          <SelectItem key={c.id} value={c.id} className="max-w-[calc(100vw-3rem)] truncate">
                            {c.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="min-w-0">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={form.kind}
                        onValueChange={(v) => setForm({ ...form, kind: v })}
                      >
                        <SelectTrigger className="w-full min-w-0 [&>span]:truncate">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="residential">Residencial</SelectItem>
                          <SelectItem value="commercial">Comercial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs">Aluguel mensal</Label>
                      <Input
                        className="w-full min-w-0"
                        type="number"
                        step="0.01"
                        value={form.monthly_rent}
                        onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs">Caução (depósito)</Label>
                      <Input
                        className="w-full min-w-0"
                        type="number"
                        step="0.01"
                        placeholder="Opcional"
                        value={form.deposit_amount ?? ""}
                        onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs">Início do contrato</Label>
                      <Input
                        className="w-full min-w-0"
                        type="date"
                        value={form.start_date ?? ""}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs">Prazo (meses)</Label>
                      <Input
                        className="w-full min-w-0"
                        type="number"
                        min={1}
                        step="1"
                        value={form.term_months ?? ""}
                        onChange={(e) => setForm({ ...form, term_months: e.target.value })}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs">Dia vencimento</Label>
                      <Input
                        className="w-full min-w-0"
                        type="number"
                        min={1}
                        max={31}
                        step={1}
                        value={form.due_day}
                        onChange={(e) => setForm({ ...form, due_day: e.target.value })}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs">Fim do contrato (calculado)</Label>
                      <Input
                        type="text"
                        readOnly
                        value={computedEndDate ? formatDateBR(computedEndDate) : "—"}
                        className="w-full min-w-0 bg-muted/40"
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs">Contrato digitalizado (PDF)</Label>
                      <Input
                        className="w-full min-w-0 max-w-full text-xs"
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(event) => setContractFile(event.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:justify-end">
                  <Button className="w-full sm:w-auto" onClick={createContract}>Criar e gerar parcelas</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 p-4 md:p-8 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Contratos ativos", value: stats.active },
          { label: "A receber no mês (c/ encargos)", value: `R$ ${stats.monthDue.toFixed(2)}` },
          { label: "Recebido no mês", value: `R$ ${stats.monthPaid.toFixed(2)}` },
          { label: "Inadimplentes", value: stats.late },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-5">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="px-4 md:px-8 pb-4 md:pb-8 space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Pesquisar</Label>
            <Input
              placeholder="Código, imóvel, inquilino, telefone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Label className="text-xs">Status do contrato</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="ended">Encerrado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-52">
            <Label className="text-xs">Parcelas</Label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="with_late">Com atrasadas</SelectItem>
                <SelectItem value="with_open">Com pendentes</SelectItem>
                <SelectItem value="all_paid">Totalmente pagas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(search || statusFilter !== "all" || paymentFilter !== "all") && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setPaymentFilter("all");
              }}
            >
              Limpar
            </Button>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {filteredContracts.length} de {contracts.length} contrato(s)
          </div>
        </div>

        {filteredContracts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filteredContracts.every((c: any) => selected[c.id])}
                onChange={(e) => {
                  const next = { ...selected };
                  for (const c of filteredContracts) next[c.id] = e.target.checked;
                  setSelected(next);
                }}
              />
              Selecionar todos visíveis
            </label>
            <span className="text-muted-foreground">
              {Object.values(selected).filter(Boolean).length} selecionado(s)
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={Object.values(selected).filter(Boolean).length === 0}
                onClick={() => deleteContracts(Object.keys(selected).filter((k) => selected[k]))}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Excluir selecionados
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => deleteContracts(filteredContracts.map((c: any) => c.id))}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Excluir todos do filtro
              </Button>
            </div>
          </div>
        )}

        {contracts.length === 0 && (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum contrato cadastrado.
          </div>
        )}
        {contracts.length > 0 && filteredContracts.length === 0 && (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum contrato corresponde ao filtro.
          </div>
        )}

        {filteredContracts.map((c: any) => {
          const list = paymentsByContract[c.id] ?? [];
          const isOpen = expanded[c.id] ?? true;
          const hasDepositPayment = list.some((p: any) => paymentKind(p) === "deposit");
          const totals = list.reduce(
            (acc, p) => {
              const r = recalc(p);
              if (p.status === "paid") acc.paid += r.total;
              else acc.openTotal += r.total;
              return acc;
            },
            { paid: 0, openTotal: 0 },
          );

          return (
            <div key={c.id} className="overflow-x-auto rounded-lg border bg-card">
              <div className="flex w-full items-center justify-between border-b bg-muted/30 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!selected[c.id]}
                    onChange={(e) => setSelected({ ...selected, [c.id]: e.target.checked })}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={() => setExpanded({ ...expanded, [c.id]: !isOpen })}
                    className="flex items-center gap-2 text-left hover:opacity-80"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <KeyRound className="h-4 w-4 text-primary" />
                    <span className="font-mono text-xs">{c.code}</span>
                    <span className="font-semibold">
                      {c.properties?.code} — {c.properties?.title}
                    </span>
                    <span className="text-muted-foreground">
                      • Inquilino: {c.tenant?.full_name ?? "—"}
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>
                    Aluguel{" "}
                    <strong className="tabular-nums">R$ {Number(c.monthly_rent).toFixed(2)}</strong>
                  </span>
                  <span>
                    Aberto{" "}
                    <strong className="tabular-nums text-amber-600">
                      R$ {totals.openTotal.toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    Pago{" "}
                    <strong className="tabular-nums text-emerald-600">
                      R$ {totals.paid.toFixed(2)}
                    </strong>
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5">{c.status}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteContracts([c.id])}
                    title="Excluir contrato"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>

              {isOpen && (
                <>
                  <div className="border-b p-4">
                    <EntityDocuments
                      entityType="rental_contract"
                      entityId={c.id}
                      title="Contrato digitalizado e anexos"
                      accept=".pdf,application/pdf"
                    />
                  </div>
                  <div className="flex items-center justify-between border-b bg-muted/10 px-4 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{list.length} lançamento(s)</span>
                      {(() => {
                        const contractSelectedCount = list.filter(
                          (p: any) => selectedPayments[p.id],
                        ).length;
                        if (contractSelectedCount > 0) {
                          return (
                            <span className="text-primary font-semibold">
                              ({contractSelectedCount} selecionada(s))
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const contractSelectedIds = list
                          .filter((p: any) => selectedPayments[p.id])
                          .map((p: any) => p.id);
                        if (contractSelectedIds.length > 0) {
                          return (
                            <div className="flex items-center gap-1.5 border-r pr-2 mr-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => bulkMarkPaid(contractSelectedIds)}
                              >
                                Marcar pagas
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => bulkDeletePayments(contractSelectedIds)}
                              >
                                Excluir selecionadas
                              </Button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <Button size="sm" variant="ghost" onClick={() => generateMore(c.id)}>
                        +12 meses
                      </Button>
                      {!hasDepositPayment && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAddDeposit(c)}
                        >
                          <BadgeDollarSign className="mr-1 h-3.5 w-3.5" />
                          Adicionar caução
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAddPayment(c)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Adicionar parcela
                      </Button>
                    </div>
                  </div>

                  {list.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      Nenhum lançamento.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-left w-10">
                            <input
                              type="checkbox"
                              checked={
                                list.length > 0 && list.every((p: any) => selectedPayments[p.id])
                              }
                              onChange={(e) => {
                                const next = { ...selectedPayments };
                                for (const p of list) {
                                  if (e.target.checked) next[p.id] = true;
                                  else delete next[p.id];
                                }
                                setSelectedPayments(next);
                              }}
                            />
                          </th>
                          <th className="px-4 py-2 text-left">Ref.</th>
                          <th className="px-4 py-2 text-left">Vencimento</th>
                          <th className="px-4 py-2 text-left">Data de pagamento</th>
                          <th className="px-4 py-2 text-right">Valor</th>
                          <th className="px-4 py-2 text-right">Multa</th>
                          <th className="px-4 py-2 text-right">Juros/Correção</th>
                          <th className="px-4 py-2 text-right">Total</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((p: any) => {
                          const r = recalc(p);
                          const isDeposit = paymentKind(p) === "deposit";
                          const overdue = isDeposit
                            ? p.status !== "paid" && p.due_date < today
                            : r.daysLate > 0;
                          return (
                            <tr key={p.id} className={`border-t ${isDeposit ? "bg-sky-50/50" : ""}`}>
                              <td className="px-4 py-2 text-left w-10">
                                <input
                                  type="checkbox"
                                  checked={!!selectedPayments[p.id]}
                                  onChange={(e) => {
                                    const next = { ...selectedPayments };
                                    if (e.target.checked) next[p.id] = true;
                                    else delete next[p.id];
                                    setSelectedPayments(next);
                                  }}
                                />
                              </td>
                              <td className="px-4 py-2 text-xs">
                                {isDeposit ? (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-sky-700">
                                    <BadgeDollarSign className="h-3.5 w-3.5" />
                                    Caução · {referenceLabel(p.reference_month)}
                                  </span>
                                ) : (
                                  referenceLabel(p.reference_month)
                                )}
                              </td>
                              <td
                                className={`px-4 py-2 text-xs ${overdue ? "text-destructive font-medium" : ""}`}
                              >
                                {formatDateBR(p.due_date)}
                                {overdue && (isDeposit ? " • vencido" : ` • ${r.daysLate}d atraso`)}
                              </td>
                              <td className="px-4 py-2 text-xs">
                                {p.paid_at ? formatDateBR(p.paid_at.slice(0, 10)) : "—"}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                R$ {r.base.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                                {r.fee ? `R$ ${r.fee.toFixed(2)}` : "—"}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                                {r.interest ? `R$ ${r.interest.toFixed(2)}` : "—"}
                                {isDeposit && r.savingsMonths > 0 && (
                                  <span className="ml-1 text-[11px] text-sky-700">
                                    ({r.savingsMonths}m)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums font-semibold">
                                R$ {r.total.toFixed(2)}
                                {isDeposit && p.deposit_refunded_at && p.deposit_refund_amount != null && (
                                  <div className="text-[11px] font-normal text-sky-700">
                                    devolvido R$ {Number(p.deposit_refund_amount).toFixed(2)}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-xs">
                                {isDeposit && p.deposit_refunded_at ? (
                                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">
                                    devolvido
                                  </span>
                                ) : p.status === "paid" ? (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                                    pago
                                  </span>
                                ) : overdue ? (
                                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                                    {isDeposit ? "vencido" : "atrasado"}
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                                    pendente
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right whitespace-nowrap">
                                {p.status !== "paid" ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => whatsappReminder(c, p)}
                                      title="Cobrar via WhatsApp"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingPayment({ ...p })}
                                      title="Editar"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openMarkPaid(c, p)}
                                    >
                                      Marcar pago
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => deletePayment(p.id)}
                                      title="Excluir"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    {p.receipt_file_path && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => openAttachedReceipt(p)}
                                        title={p.receipt_file_name ?? "Abrir recibo anexado"}
                                      >
                                        <Paperclip className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {isDeposit && p.deposit_refund_receipt_file_path && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => openDepositRefundReceipt(p)}
                                        title={p.deposit_refund_receipt_file_name ?? "Abrir comprovante da devolução"}
                                      >
                                        <Paperclip className="h-3.5 w-3.5 text-sky-700" />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setReceiptFor({ c, p })}
                                      title="Enviar recibo"
                                    >
                                      <Receipt className="mr-1 h-3.5 w-3.5" />
                                      Recibo
                                    </Button>
                                    {isDeposit && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openDepositRefund(c, p)}
                                        title={p.deposit_refunded_at ? "Editar devolução do caução" : "Registrar devolução do caução"}
                                      >
                                        <BadgeDollarSign className="mr-1 h-3.5 w-3.5" />
                                        {p.deposit_refunded_at ? "Devolução" : "Devolver"}
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => revertPaid(p.id)}
                                      title="Voltar para pendente"
                                    >
                                      <Undo2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingPayment({ ...p })}
                                      title="Editar"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => deletePayment(p.id)}
                                      title="Excluir"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit payment dialog */}
      <Dialog open={!!editingPayment} onOpenChange={(o) => !o && setEditingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar {editingPayment && paymentKind(editingPayment) === "deposit" ? "caução" : "parcela"}
            </DialogTitle>
          </DialogHeader>
          {editingPayment && (
            <div className="grid gap-3">
              <div>
                <Label className="text-xs">Mês de referência</Label>
                <Select
                  value={editingPayment.reference_month ? `${editingPayment.reference_month.slice(0, 7)}-01` : ""}
                  onValueChange={(value) => setEditingPayment({ ...editingPayment, reference_month: value })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Vencimento</Label>
                <Input
                  type="date"
                  value={editingPayment.due_date}
                  onChange={(e) =>
                    setEditingPayment({ ...editingPayment, due_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingPayment.amount_due}
                  onChange={(e) =>
                    setEditingPayment({ ...editingPayment, amount_due: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Observações</Label>
                <Input
                  value={editingPayment.notes ?? ""}
                  onChange={(e) => setEditingPayment({ ...editingPayment, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add payment dialog */}
      <Dialog open={!!addingFor} onOpenChange={(o) => !o && setAddingFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Adicionar {newPayment.payment_kind === "deposit" ? "caução" : "parcela"} {addingFor?.code}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Mês de referência</Label>
              <Select
                value={newPayment.reference_month ? `${newPayment.reference_month.slice(0, 7)}-01` : ""}
                onValueChange={(value) => setNewPayment({ ...newPayment, reference_month: value })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
                <SelectContent>
                  {addingFor && availableMonthOptionsForAdd(addingFor.id, newPayment.payment_kind ?? "rent").length > 0 ? (
                    availableMonthOptionsForAdd(addingFor.id, newPayment.payment_kind ?? "rent").map((month) => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>Nenhuma competência livre</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vencimento</Label>
              <Input
                type="date"
                value={newPayment.due_date ?? ""}
                onChange={(e) => setNewPayment({ ...newPayment, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Valor</Label>
              <Input
                type="number"
                step="0.01"
                value={newPayment.amount_due ?? ""}
                onChange={(e) => setNewPayment({ ...newPayment, amount_due: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Input
                value={newPayment.notes ?? ""}
                onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addPayment}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payingPayment} onOpenChange={(o) => !o && closeMarkPaid()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pagamento</DialogTitle>
          </DialogHeader>
          {payingPayment && (
            <div className="grid gap-3 text-sm">
              <div className="text-xs text-muted-foreground">
                Contrato <strong>{payingPayment.c.code}</strong> • Ref. {referenceLabel(payingPayment.p.reference_month)} •
                Vencimento {formatDateBR(payingPayment.p.due_date)}
              </div>
              <div>
                <Label className="text-xs">Data do pagamento</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              {(() => {
                const preview = recalc(payingPayment.p, payDate);
                const isDeposit = paymentKind(payingPayment.p) === "deposit";
                return (
                  <div className="rounded-md border bg-muted/30 p-2 text-xs">
                    Total a registrar: <strong className="tabular-nums">R$ {preview.total.toFixed(2)}</strong>
                    {isDeposit && preview.savingsMonths > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        (inclui correção pela poupança por {preview.savingsMonths} mês(es))
                      </span>
                    )}
                    {!isDeposit && preview.daysLate > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        (inclui multa/juros por {preview.daysLate} dia(s) de atraso)
                      </span>
                    )}
                  </div>
                );
              })()}
              <div>
                <Label className="text-xs">Anexar recibo/comprovante</Label>
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setPayReceiptFile(e.target.files?.[0] ?? null)}
                />
                {payReceiptFile && (
                  <p className="mt-1 text-xs text-muted-foreground">{payReceiptFile.name}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeMarkPaid}>Cancelar</Button>
            <Button onClick={confirmMarkPaid}>Registrar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!depositRefundFor} onOpenChange={(o) => !o && closeDepositRefund()}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar devolução do caução</DialogTitle>
          </DialogHeader>
          {depositRefundFor && (
            <div className="grid gap-3 text-sm">
              <div className="text-xs text-muted-foreground">
                Contrato <strong>{depositRefundFor.c.code}</strong> • Ref. {referenceLabel(depositRefundFor.p.reference_month)} •
                Caução recebido em {depositRefundFor.p.paid_at ? formatDateBR(depositRefundFor.p.paid_at.slice(0, 10)) : "—"}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Data prevista de devolução</Label>
                  <Input
                    type="date"
                    value={depositRefundForm.refund_due_date}
                    onChange={(e) =>
                      setDepositRefundForm({ ...depositRefundForm, refund_due_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Data real da devolução</Label>
                  <Input
                    type="date"
                    value={depositRefundForm.refunded_at}
                    onChange={(e) => {
                      const next = e.target.value;
                      const info = depositRefundInfo(
                        depositRefundFor.c,
                        depositRefundFor.p,
                        next,
                        depositRefundForm.refund_due_date,
                      );
                      setDepositRefundForm({
                        ...depositRefundForm,
                        refunded_at: next,
                        refund_amount: info.actualAmount.toFixed(2),
                      });
                    }}
                  />
                </div>
              </div>
              {(() => {
                const info = depositRefundInfo(
                  depositRefundFor.c,
                  depositRefundFor.p,
                  depositRefundForm.refunded_at,
                  depositRefundForm.refund_due_date,
                );
                return (
                  <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>Caução recebido</span>
                      <strong className="tabular-nums">R$ {info.principal.toFixed(2)}</strong>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>Corrigido até a data prevista</span>
                      <strong className="tabular-nums">R$ {info.expectedAmount.toFixed(2)}</strong>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>Corrigido até a data real</span>
                      <strong className="tabular-nums text-sky-700">R$ {info.actualAmount.toFixed(2)}</strong>
                    </div>
                    {info.daysAfterDue > 0 && (
                      <div className="text-muted-foreground">
                        Devolvido {info.daysAfterDue} dia(s) após a data prevista, sem multa contratual, com correção pela poupança até a data real.
                        {info.additionalGain > 0 && (
                          <span className="ml-1">
                            Correção adicional: R$ {info.additionalGain.toFixed(2)}.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              <div>
                <Label className="text-xs">Valor devolvido</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={depositRefundForm.refund_amount}
                  onChange={(e) =>
                    setDepositRefundForm({ ...depositRefundForm, refund_amount: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Observações</Label>
                <Input
                  value={depositRefundForm.notes}
                  onChange={(e) => setDepositRefundForm({ ...depositRefundForm, notes: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Anexar comprovante da devolução</Label>
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setDepositRefundReceiptFile(e.target.files?.[0] ?? null)}
                />
                {depositRefundReceiptFile && (
                  <p className="mt-1 text-xs text-muted-foreground">{depositRefundReceiptFile.name}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDepositRefund}>Cancelar</Button>
            <Button onClick={saveDepositRefund}>Salvar devolução</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enviar recibo (PDF) */}
      <Dialog open={!!receiptFor} onOpenChange={(o) => !o && setReceiptFor(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enviar recibo do pagamento</DialogTitle>
          </DialogHeader>
          {receiptFor && (
            <div className="grid gap-3 text-sm">
              <div className="text-xs text-muted-foreground">
                Contrato <strong>{receiptFor.c.code}</strong> • Ref. {referenceLabel(receiptFor.p.reference_month)} •
                Pago em {receiptFor.p.paid_at ? formatDateBR(receiptFor.p.paid_at.slice(0, 10)) : "—"}
              </div>
              <div className="text-xs">
                Inquilino: <strong>{receiptFor.c.tenant?.full_name ?? "—"}</strong>
                <br />
                E-mail:{" "}
                {receiptFor.c.tenant?.email ?? (
                  <span className="text-muted-foreground">não cadastrado</span>
                )}
                <br />
                Telefone:{" "}
                {receiptFor.c.tenant?.phone ?? (
                  <span className="text-muted-foreground">não cadastrado</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                O recibo em PDF será baixado neste dispositivo. Em seguida, abriremos o e-mail ou o
                WhatsApp já com a mensagem pronta — basta anexar o arquivo baixado antes de enviar.
              </p>
              {receiptFor.p.receipt_file_path && (
                <Button variant="outline" size="sm" className="w-fit" onClick={() => openAttachedReceipt(receiptFor.p)}>
                  <Paperclip className="mr-1.5 h-4 w-4" />Abrir comprovante anexado
                </Button>
              )}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="outline" className="min-w-0 justify-center whitespace-nowrap" onClick={downloadReceipt}>
              <FileDown className="mr-1.5 h-4 w-4" />
              Apenas baixar PDF
            </Button>
            <Button
              variant="outline"
              className="min-w-0 justify-center whitespace-nowrap"
              onClick={sendReceiptEmail}
              disabled={!receiptFor?.c?.tenant?.email}
            >
              Enviar por e-mail
            </Button>
            <Button
              className="min-w-0 justify-center whitespace-nowrap"
              onClick={sendReceiptWhatsapp}
              disabled={!receiptFor?.c?.tenant?.phone}
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />
              Enviar por WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
