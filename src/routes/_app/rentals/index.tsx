import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { newReportPdf } from "@/lib/pdf-utils";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Plus, FileDown, MessageCircle, KeyRound, Pencil, Trash2, Undo2, ChevronDown, ChevronRight } from "lucide-react";
import { formatDateBR } from "@/lib/format-date";

export const Route = createFileRoute("/_app/rentals/")({ component: RentalsPage });

function RentalsPage() {
  const qc = useQueryClient();
  const [openContract, setOpenContract] = useState(false);
  const [form, setForm] = useState<any>({ kind: "residential", due_day: 5, monthly_rent: "" });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [addingFor, setAddingFor] = useState<any | null>(null); // contract object
  const [newPayment, setNewPayment] = useState<any>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all"); // all | with_late | with_open | all_paid
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data: settings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", true).maybeSingle()).data,
  });
  const { data: contracts = [], refetch } = useQuery({
    queryKey: ["rental_contracts"],
    queryFn: async () =>
      (await supabase.from("rental_contracts").select("*, properties(code, title), tenant:clients!rental_contracts_tenant_client_id_fkey(full_name, phone)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["rental_payments"],
    queryFn: async () => (await supabase.from("rental_payments").select("*").order("due_date", { ascending: true })).data ?? [],
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-min"],
    queryFn: async () => (await supabase.from("properties").select("id, code, title").order("code", { ascending: false })).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name, phone").order("full_name")).data ?? [],
  });

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(); monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);

  // Late fee + daily interest recalculation based on app_settings
  const lateFeePct = Number(settings?.rental_late_fee_pct ?? 0);
  const dailyPct = Number(settings?.rental_daily_interest_pct ?? 0);
  const grace = Number(settings?.rental_grace_days ?? 0);

  function recalc(p: any) {
    const due = new Date(p.due_date);
    const now = new Date();
    const daysLate = Math.max(0, Math.floor((+now - +due) / 86400000) - grace);
    const base = Number(p.amount_due ?? 0);
    if (p.status === "paid" || daysLate <= 0) {
      return { base, fee: 0, interest: 0, total: base, daysLate: 0 };
    }
    const fee = base * (lateFeePct / 100);
    const interest = base * (dailyPct / 100) * daysLate;
    return { base, fee, interest, total: base + fee + interest, daysLate };
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
          c.code, c.properties?.code, c.properties?.title,
          c.tenant?.full_name, c.tenant?.phone,
        ].filter(Boolean).join(" ").toLowerCase();
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

  const filteredContractIds = useMemo(() => new Set(filteredContracts.map((c: any) => c.id)), [filteredContracts]);

  const stats = useMemo(() => {
    let monthDue = 0, monthPaid = 0, late = 0;
    for (const p of payments) {
      if (!filteredContractIds.has(p.contract_id)) continue;
      if (p.status === "paid" && p.paid_at && p.paid_at.slice(0, 10) >= monthStartIso)
        monthPaid += Number(p.amount_paid ?? p.amount_due ?? 0);
      if (p.status !== "paid" && p.due_date >= monthStartIso) monthDue += recalc(p).total;
      if (p.status !== "paid" && p.due_date < today) late++;
    }
    return { active: filteredContracts.filter((c: any) => c.status === "active").length, monthDue, monthPaid, late };
  }, [payments, filteredContracts, filteredContractIds, lateFeePct, dailyPct, grace]);

  async function createContract() {
    if (!form.property_id || !form.tenant_client_id || !form.monthly_rent || !form.start_date) {
      return toast.error("Preencha imóvel, inquilino, valor e data de início");
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: created, error } = await supabase.from("rental_contracts").insert({
      ...form,
      monthly_rent: Number(form.monthly_rent),
      due_day: Number(form.due_day),
      deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : null,
      created_by: user?.id,
    }).select("id").single();
    if (error) return toast.error(error.message);
    await supabase.rpc("generate_rental_payments", { _contract_id: created.id, _months: 12 });
    toast.success("Contrato criado e parcelas geradas");
    setOpenContract(false); setForm({ kind: "residential", due_day: 5, monthly_rent: "" });
    refetch(); qc.invalidateQueries({ queryKey: ["rental_payments"] });
  }

  async function markPaid(p: any) {
    const total = recalc(p).total;
    const { error } = await supabase.from("rental_payments").update({
      status: "paid", paid_at: new Date().toISOString(), amount_paid: total,
    }).eq("id", p.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success(`Pagamento registrado (R$ ${total.toFixed(2)})`);
  }

  async function revertPaid(id: string) {
    const { error } = await supabase.from("rental_payments").update({
      status: "pending", paid_at: null, amount_paid: null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success("Parcela revertida para pendente");
  }

  async function deletePayment(id: string) {
    if (!confirm("Excluir esta parcela?")) return;
    const { error } = await supabase.from("rental_payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success("Parcela excluída");
  }

  async function saveEdit() {
    if (!editingPayment) return;
    const { id, due_date, amount_due, reference_month, notes } = editingPayment;
    const { error } = await supabase.from("rental_payments").update({
      due_date, amount_due: Number(amount_due), reference_month, notes,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditingPayment(null);
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success("Parcela atualizada");
  }

  async function addPayment() {
    if (!addingFor || !newPayment.due_date || !newPayment.reference_month || !newPayment.amount_due) {
      return toast.error("Preencha referência, vencimento e valor");
    }
    const { error } = await supabase.from("rental_payments").insert({
      contract_id: addingFor.id,
      reference_month: newPayment.reference_month,
      due_date: newPayment.due_date,
      amount_due: Number(newPayment.amount_due),
      notes: newPayment.notes ?? null,
    });
    if (error) return toast.error(error.message);
    setAddingFor(null); setNewPayment({});
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success("Parcela adicionada");
  }

  async function deleteContracts(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`Excluir ${ids.length} contrato(s) e TODAS as parcelas vinculadas? Esta ação é irreversível.`)) return;
    const { error: e1 } = await supabase.from("rental_payments").delete().in("contract_id", ids);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.from("rental_contracts").delete().in("id", ids);
    if (e2) return toast.error(e2.message);
    setSelected({});
    qc.invalidateQueries({ queryKey: ["rental_contracts"] });
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success(`${ids.length} contrato(s) excluído(s)`);
  }

  async function generateMore(contractId: string) {
    const { data, error } = await supabase.rpc("generate_rental_payments", { _contract_id: contractId, _months: 12 });
    if (error) return toast.error(error.message);
    toast.success(`${data} parcela(s) geradas`);
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
  }

  async function markLate() {
    const { data, error } = await supabase.rpc("mark_late_rental_payments");
    if (error) return toast.error(error.message);
    toast.success(`${data} parcela(s) marcada(s) como atrasadas`);
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
  }

  function whatsappReminder(c: any, p: any) {
    const phone = (c.tenant?.phone ?? "").replace(/\D/g, "");
    if (!phone) return toast.error("Inquilino sem telefone cadastrado");
    const r = recalc(p);
    const extra = r.daysLate > 0
      ? ` Com multa e juros (${r.daysLate} dia(s) de atraso): R$ ${r.total.toFixed(2)}.`
      : "";
    const msg = `Olá ${c.tenant?.full_name ?? ""}, lembrete da House302: o aluguel do imóvel ${c.properties?.code} (ref. ${formatDateBR(p.reference_month)}) no valor de R$ ${r.base.toFixed(2)} vence em ${formatDateBR(p.due_date)}.${extra} Contrato ${c.code}.`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function exportPdf() {
    const title = search || statusFilter !== "all" || paymentFilter !== "all"
      ? "Relatório de aluguéis — filtro aplicado"
      : "Relatório de aluguéis — mês atual";
    const { doc } = await newReportPdf(title);
    const rows: any[] = [];
    for (const c of filteredContracts) {
      for (const p of (paymentsByContract[c.id] ?? [])) {
        if (!(p.due_date >= monthStartIso || p.status !== "paid")) continue;
        const r = recalc(p);
        rows.push([c.code, c.properties?.code ?? "—", c.tenant?.full_name ?? "—", formatDateBR(p.reference_month), formatDateBR(p.due_date), `R$ ${r.base.toFixed(2)}`, `R$ ${r.total.toFixed(2)}`, p.status]);
      }
    }
    autoTable(doc, {
      startY: 36,
      head: [["Contrato", "Imóvel", "Inquilino", "Ref.", "Vencimento", "Valor", "Total c/ encargos", "Status"]],
      body: rows, styles: { fontSize: 8 }, headStyles: { fillColor: [0, 0, 200] },
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
          Contrato: c?.code, Imóvel: c?.properties?.code, Inquilino: c?.tenant?.full_name,
          Referência: formatDateBR(p.reference_month), Vencimento: formatDateBR(p.due_date), Valor: r.base,
          Multa: r.fee, Juros: r.interest, Total: r.total, Pago: p.amount_paid ?? "", Status: p.status,
        };
      });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Parcelas");
    XLSX.writeFile(wb, "aluguéis.xlsx");
  }

  return (
    <div>
      <PageHeader
        title="Aluguéis"
        description="Contratos e parcelas — encargos calculados automaticamente conforme as Configurações"
        actions={
          <>
            <Button variant="outline" onClick={markLate}>Marcar atrasados</Button>
            <Button variant="outline" onClick={exportXlsx}><FileDown className="mr-1.5 h-4 w-4" />XLSX</Button>
            <Button variant="outline" onClick={exportPdf}><FileDown className="mr-1.5 h-4 w-4" />PDF</Button>
            <Dialog open={openContract} onOpenChange={setOpenContract}>
              <DialogTrigger asChild><Button><Plus className="mr-1.5 h-4 w-4" />Novo contrato</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo contrato de aluguel</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label className="text-xs">Imóvel</Label>
                    <Select value={form.property_id ?? ""} onValueChange={(v) => setForm({ ...form, property_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} — {p.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Inquilino</Label>
                    <Select value={form.tenant_client_id ?? ""} onValueChange={(v) => setForm({ ...form, tenant_client_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Tipo</Label>
                      <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="residential">Residencial</SelectItem><SelectItem value="commercial">Comercial</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Aluguel mensal</Label><Input type="number" step="0.01" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} /></div>
                    <div><Label className="text-xs">Caução (depósito)</Label><Input type="number" step="0.01" placeholder="Opcional" value={form.deposit_amount ?? ""} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} /></div>
                    <div><Label className="text-xs">Início</Label><Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                    <div><Label className="text-xs">Dia vencimento</Label><Input type="number" min={1} max={28} value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={createContract}>Criar e gerar parcelas</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 p-8 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="px-8 pb-8 space-y-4">
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="with_late">Com atrasadas</SelectItem>
                <SelectItem value="with_open">Com pendentes</SelectItem>
                <SelectItem value="all_paid">Totalmente pagas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(search || statusFilter !== "all" || paymentFilter !== "all") && (
            <Button variant="ghost" onClick={() => { setSearch(""); setStatusFilter("all"); setPaymentFilter("all"); }}>
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
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir selecionados
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => deleteContracts(filteredContracts.map((c: any) => c.id))}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir todos do filtro
              </Button>
            </div>
          </div>
        )}

        {contracts.length === 0 && (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhum contrato cadastrado.</div>
        )}
        {contracts.length > 0 && filteredContracts.length === 0 && (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhum contrato corresponde ao filtro.</div>
        )}

        {filteredContracts.map((c: any) => {
          const list = paymentsByContract[c.id] ?? [];
          const isOpen = expanded[c.id] ?? true;
          const totals = list.reduce(
            (acc, p) => {
              const r = recalc(p);
              if (p.status === "paid") acc.paid += Number(p.amount_paid ?? p.amount_due ?? 0);
              else acc.openTotal += r.total;
              return acc;
            },
            { paid: 0, openTotal: 0 }
          );

          return (
            <div key={c.id} className="overflow-hidden rounded-lg border bg-card">
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
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <KeyRound className="h-4 w-4 text-primary" />
                    <span className="font-mono text-xs">{c.code}</span>
                    <span className="font-semibold">{c.properties?.code} — {c.properties?.title}</span>
                    <span className="text-muted-foreground">• Inquilino: {c.tenant?.full_name ?? "—"}</span>
                  </button>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>Aluguel <strong className="tabular-nums">R$ {Number(c.monthly_rent).toFixed(2)}</strong></span>
                  <span>Aberto <strong className="tabular-nums text-amber-600">R$ {totals.openTotal.toFixed(2)}</strong></span>
                  <span>Pago <strong className="tabular-nums text-emerald-600">R$ {totals.paid.toFixed(2)}</strong></span>
                  <span className="rounded-full bg-secondary px-2 py-0.5">{c.status}</span>
                  <Button size="sm" variant="ghost" onClick={() => deleteContracts([c.id])} title="Excluir contrato">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>

              {isOpen && (
                <>
                  <div className="flex items-center justify-between border-b bg-muted/10 px-4 py-2 text-xs">
                    <span className="text-muted-foreground">{list.length} parcela(s)</span>
                    <div className="space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => generateMore(c.id)}>+12 meses</Button>
                      <Button size="sm" variant="outline" onClick={() => { setAddingFor(c); setNewPayment({ amount_due: c.monthly_rent }); }}>
                        <Plus className="mr-1 h-3.5 w-3.5" />Adicionar parcela
                      </Button>
                    </div>
                  </div>

                  {list.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">Nenhuma parcela.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-left">Ref.</th>
                          <th className="px-4 py-2 text-left">Vencimento</th>
                          <th className="px-4 py-2 text-right">Valor</th>
                          <th className="px-4 py-2 text-right">Multa</th>
                          <th className="px-4 py-2 text-right">Juros</th>
                          <th className="px-4 py-2 text-right">Total</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((p: any) => {
                          const r = recalc(p);
                          const overdue = r.daysLate > 0;
                          return (
                            <tr key={p.id} className="border-t">
                              <td className="px-4 py-2 text-xs">{formatDateBR(p.reference_month)}</td>
                              <td className={`px-4 py-2 text-xs ${overdue ? "text-destructive font-medium" : ""}`}>
                                {formatDateBR(p.due_date)}{overdue && ` • ${r.daysLate}d atraso`}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">R$ {r.base.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.fee ? `R$ ${r.fee.toFixed(2)}` : "—"}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.interest ? `R$ ${r.interest.toFixed(2)}` : "—"}</td>
                              <td className="px-4 py-2 text-right tabular-nums font-semibold">R$ {r.total.toFixed(2)}</td>
                              <td className="px-4 py-2 text-xs">
                                {p.status === "paid"
                                  ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">pago</span>
                                  : overdue
                                    ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">atrasado</span>
                                    : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">pendente</span>}
                              </td>
                              <td className="px-4 py-2 text-right whitespace-nowrap">
                                {p.status !== "paid" ? (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => whatsappReminder(c, p)} title="Cobrar via WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingPayment({ ...p })} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                                    <Button size="sm" variant="outline" onClick={() => markPaid(p)}>Marcar pago</Button>
                                    <Button size="sm" variant="ghost" onClick={() => deletePayment(p.id)} title="Excluir"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => revertPaid(p.id)} title="Voltar para pendente"><Undo2 className="h-3.5 w-3.5" /></Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingPayment({ ...p })} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                                    <Button size="sm" variant="ghost" onClick={() => deletePayment(p.id)} title="Excluir"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>Editar parcela</DialogTitle></DialogHeader>
          {editingPayment && (
            <div className="grid gap-3">
              <div><Label className="text-xs">Mês de referência</Label>
                <Input type="date" value={editingPayment.reference_month} onChange={(e) => setEditingPayment({ ...editingPayment, reference_month: e.target.value })} />
              </div>
              <div><Label className="text-xs">Vencimento</Label>
                <Input type="date" value={editingPayment.due_date} onChange={(e) => setEditingPayment({ ...editingPayment, due_date: e.target.value })} />
              </div>
              <div><Label className="text-xs">Valor</Label>
                <Input type="number" step="0.01" value={editingPayment.amount_due} onChange={(e) => setEditingPayment({ ...editingPayment, amount_due: e.target.value })} />
              </div>
              <div><Label className="text-xs">Observações</Label>
                <Input value={editingPayment.notes ?? ""} onChange={(e) => setEditingPayment({ ...editingPayment, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={saveEdit}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add payment dialog */}
      <Dialog open={!!addingFor} onOpenChange={(o) => !o && setAddingFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar parcela {addingFor?.code}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Mês de referência</Label>
              <Input type="date" value={newPayment.reference_month ?? ""} onChange={(e) => setNewPayment({ ...newPayment, reference_month: e.target.value })} />
            </div>
            <div><Label className="text-xs">Vencimento</Label>
              <Input type="date" value={newPayment.due_date ?? ""} onChange={(e) => setNewPayment({ ...newPayment, due_date: e.target.value })} />
            </div>
            <div><Label className="text-xs">Valor</Label>
              <Input type="number" step="0.01" value={newPayment.amount_due ?? ""} onChange={(e) => setNewPayment({ ...newPayment, amount_due: e.target.value })} />
            </div>
            <div><Label className="text-xs">Observações</Label>
              <Input value={newPayment.notes ?? ""} onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={addPayment}>Adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
