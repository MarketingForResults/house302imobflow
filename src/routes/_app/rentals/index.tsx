import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Plus, FileDown, MessageCircle, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_app/rentals/")({ component: RentalsPage });

function RentalsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ kind: "residential", due_day: 5, monthly_rent: "" });

  const { data: contracts = [], refetch } = useQuery({
    queryKey: ["rental_contracts"],
    queryFn: async () =>
      (await supabase.from("rental_contracts").select("*, properties(code, title), tenant:clients!rental_contracts_tenant_client_id_fkey(full_name, phone)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["rental_payments"],
    queryFn: async () => (await supabase.from("rental_payments").select("*").order("due_date", { ascending: false })).data ?? [],
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

  const stats = {
    active: contracts.filter((c: any) => c.status === "active").length,
    monthDue: payments.filter((p: any) => p.due_date >= monthStartIso && p.status !== "paid").reduce((s: number, p: any) => s + Number(p.amount_due ?? 0), 0),
    monthPaid: payments.filter((p: any) => p.status === "paid" && p.paid_at && p.paid_at.slice(0, 10) >= monthStartIso).reduce((s: number, p: any) => s + Number(p.amount_paid ?? p.amount_due ?? 0), 0),
    late: payments.filter((p: any) => p.status === "pending" && p.due_date < today).length + payments.filter((p: any) => p.status === "late").length,
  };

  async function createContract() {
    if (!form.property_id || !form.tenant_client_id || !form.monthly_rent || !form.start_date) {
      return toast.error("Preencha imóvel, inquilino, valor e data de início");
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: created, error } = await supabase.from("rental_contracts").insert({
      ...form, monthly_rent: Number(form.monthly_rent), due_day: Number(form.due_day), created_by: user?.id,
    }).select("id").single();
    if (error) return toast.error(error.message);
    await supabase.rpc("generate_rental_payments", { _contract_id: created.id, _months: 12 });
    toast.success("Contrato criado e parcelas geradas");
    setOpen(false); setForm({ kind: "residential", due_day: 5, monthly_rent: "" });
    refetch(); qc.invalidateQueries({ queryKey: ["rental_payments"] });
  }

  async function markPaid(paymentId: string, amount: number) {
    const { error } = await supabase.from("rental_payments").update({
      status: "paid", paid_at: new Date().toISOString(), amount_paid: amount,
    }).eq("id", paymentId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rental_payments"] });
    toast.success("Pagamento registrado");
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
    const msg = `Olá ${c.tenant?.full_name ?? ""}, lembrete da House302: o aluguel do imóvel ${c.properties?.code} (ref. ${p.reference_month}) no valor de R$ ${Number(p.amount_due).toFixed(2)} vence em ${p.due_date}. Contrato ${c.code}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function exportPdf() {
    const { doc } = await newReportPdf("Relatório de aluguéis — mês atual");
    const rows = payments
      .filter((p: any) => p.due_date >= monthStartIso || (p.status !== "paid"))
      .map((p: any) => {
        const c = contracts.find((x: any) => x.id === p.contract_id);
        return [c?.code ?? "—", c?.properties?.code ?? "—", c?.tenant?.full_name ?? "—", p.reference_month, p.due_date, `R$ ${Number(p.amount_due).toFixed(2)}`, p.status];
      });
    autoTable(doc, {
      startY: 36,
      head: [["Contrato", "Imóvel", "Inquilino", "Ref.", "Vencimento", "Valor", "Status"]],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 0, 200] },
    });
    doc.save("aluguéis.pdf");
  }

  function exportXlsx() {
    const rows = payments.map((p: any) => {
      const c = contracts.find((x: any) => x.id === p.contract_id);
      return {
        Contrato: c?.code, Imóvel: c?.properties?.code, Inquilino: c?.tenant?.full_name,
        Referência: p.reference_month, Vencimento: p.due_date, Valor: Number(p.amount_due),
        Pago: p.amount_paid ?? "", Status: p.status,
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
        description="Contratos, parcelas e cobranças"
        actions={
          <>
            <Button variant="outline" onClick={markLate}>Marcar atrasados</Button>
            <Button variant="outline" onClick={exportXlsx}><FileDown className="mr-1.5 h-4 w-4" />XLSX</Button>
            <Button variant="outline" onClick={exportPdf}><FileDown className="mr-1.5 h-4 w-4" />PDF</Button>
            <Dialog open={open} onOpenChange={setOpen}>
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
                    <div><Label className="text-xs">Aluguel mensal</Label><Input type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} /></div>
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
          { label: "A receber no mês", value: `R$ ${stats.monthDue.toFixed(2)}` },
          { label: "Recebido no mês", value: `R$ ${stats.monthPaid.toFixed(2)}` },
          { label: "Inadimplentes", value: stats.late },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-5">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="px-8 pb-8 space-y-6">
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4" />Contratos</div>
          {contracts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum contrato cadastrado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Código</th><th className="px-4 py-2 text-left">Imóvel</th><th className="px-4 py-2 text-left">Inquilino</th><th className="px-4 py-2 text-left">Início</th><th className="px-4 py-2 text-left">Aluguel</th><th className="px-4 py-2 text-left">Status</th></tr>
              </thead>
              <tbody>
                {contracts.map((c: any) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                    <td className="px-4 py-2">{c.properties?.code} — {c.properties?.title}</td>
                    <td className="px-4 py-2">{c.tenant?.full_name ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{c.start_date}</td>
                    <td className="px-4 py-2">R$ {Number(c.monthly_rent).toFixed(2)}</td>
                    <td className="px-4 py-2 text-xs">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold">Parcelas</div>
          {payments.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma parcela gerada.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Contrato</th><th className="px-4 py-2 text-left">Ref.</th><th className="px-4 py-2 text-left">Vencimento</th><th className="px-4 py-2 text-left">Valor</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2"></th></tr>
              </thead>
              <tbody>
                {payments.slice(0, 100).map((p: any) => {
                  const c = contracts.find((x: any) => x.id === p.contract_id);
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">{c?.code ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{p.reference_month}</td>
                      <td className="px-4 py-2 text-xs">{p.due_date}</td>
                      <td className="px-4 py-2">R$ {Number(p.amount_due).toFixed(2)}</td>
                      <td className="px-4 py-2 text-xs">{p.status}</td>
                      <td className="px-4 py-2 text-right space-x-1">
                        {p.status !== "paid" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => c && whatsappReminder(c, p)} title="Cobrar via WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="outline" onClick={() => markPaid(p.id, Number(p.amount_due))}>Marcar pago</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
