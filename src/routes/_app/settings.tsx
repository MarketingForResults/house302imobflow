import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";
import { refreshEconomicIndexes } from "@/lib/economic-indexes.functions";
import { formatDateBR } from "@/lib/format-date";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

const INDEX_OPTIONS = [
  { code: "IPCA", label: "IPCA (IBGE)" },
  { code: "IGPM", label: "IGP-M (FGV)" },
  { code: "INCC", label: "INCC-M (FGV)" },
  { code: "IVAR", label: "IVAR (FGV)" },
];

function SettingsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [indexes, setIndexes] = useState<any[]>([]);
  const refresh = useServerFn(refreshEconomicIndexes);

  async function loadIndexes() {
    const { data } = await supabase.from("economic_indexes").select("*").order("fetched_at", { ascending: false });
    setIndexes(data ?? []);
  }

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", true).maybeSingle()
      .then(({ data }) => setS(data ?? {}));
    loadIndexes();
  }, []);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("app_settings").update({
      rental_late_fee_pct: Number(s.rental_late_fee_pct),
      rental_daily_interest_pct: Number(s.rental_daily_interest_pct),
      rental_grace_days: Number(s.rental_grace_days),
      rental_default_due_day: Number(s.rental_default_due_day),
      rental_default_term_months: Number(s.rental_default_term_months),
      rental_default_contract_type: s.rental_default_contract_type,
      rental_default_readjustment_index: s.rental_default_readjustment_index,
      rental_default_readjustment_month: s.rental_default_readjustment_month ? Number(s.rental_default_readjustment_month) : null,
      contract_default_commission_pct: Number(s.contract_default_commission_pct),
      updated_by: user?.id,
    }).eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas.");
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const { results } = await refresh({});
      const ok = results.filter((r: any) => r.ok).length;
      toast.success(`${ok}/${results.length} índices atualizados nos sites oficiais (BCB/SGS)`);
      await loadIndexes();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao consultar índices");
    } finally {
      setRefreshing(false);
    }
  }

  if (!s) return <div className="p-4 md:p-8 text-sm text-muted-foreground">Carregando…</div>;

  const Field = ({ k, label, type = "number", step = "0.01", suffix }: any) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input type={type} step={step} value={s[k] ?? ""} disabled={!isAdmin}
          onChange={(e) => setS({ ...s, [k]: e.target.value })} />
        {suffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );

  const selectedIndex = indexes.find((i) => i.code === s.rental_default_readjustment_index);

  return (
    <div>
      <PageHeader
        title="Configurações"
        description={isAdmin ? "Parâmetros financeiros, vigência e índices oficiais" : "Somente leitura — apenas administradores podem alterar"}
        actions={isAdmin ? <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button> : null}
      />

      <div className="space-y-6 p-4 md:p-8">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">Aluguéis — multa, juros e recálculo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field k="rental_late_fee_pct" label="Multa por atraso" suffix="% sobre o valor devido" />
            <Field k="rental_daily_interest_pct" label="Juros diários (mora)" suffix="% ao dia" />
            <Field k="rental_grace_days" label="Carência (dias após vencimento)" step="1" suffix="dias" />
            <Field k="rental_default_due_day" label="Dia de vencimento padrão" step="1" />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">Vigência e tipo de contrato</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field k="rental_default_term_months" label="Vigência padrão" step="1" suffix="meses" />
            <div>
              <Label className="text-xs">Tipo de contrato padrão</Label>
              <Select
                value={s.rental_default_contract_type ?? "pessoa_fisica"}
                onValueChange={(v) => setS({ ...s, rental_default_contract_type: v })}
                disabled={!isAdmin}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoa_fisica">Pessoa física</SelectItem>
                  <SelectItem value="pessoa_juridica">Pessoa jurídica</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field k="contract_default_commission_pct" label="Comissão padrão de contrato" suffix="%" />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Reajuste — índice padrão</h2>
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
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {INDEX_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedIndex && (
                <div className="mt-2 rounded-md border bg-muted/30 p-3 text-xs">
                  <div className="font-semibold">{selectedIndex.name}</div>
                  <div>Mês ref.: <strong>{formatDateBR(selectedIndex.reference_month)}</strong></div>
                  <div>Variação mensal: <strong className="tabular-nums">{Number(selectedIndex.monthly_value).toFixed(2)}%</strong></div>
                  <div>Acumulado 12m: <strong className="tabular-nums">{selectedIndex.accumulated_12m != null ? `${Number(selectedIndex.accumulated_12m).toFixed(2)}%` : "—"}</strong></div>
                  <div className="text-muted-foreground">Atualizado em {formatDateBR(selectedIndex.fetched_at)}</div>
                  {selectedIndex.source_url && (
                    <a href={selectedIndex.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
                      Fonte oficial <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
            <Field k="rental_default_readjustment_month" label="Mês de reajuste padrão (1–12)" step="1" />
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Prévia — todos os índices</h3>
            {indexes.length === 0 ? (
              <div className="rounded-md border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                Nenhum índice consultado ainda. Clique em "Atualizar índices oficiais" para buscar do BCB/SGS.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border">
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
                        <td className="px-3 py-2 text-right tabular-nums">{Number(i.monthly_value).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums">{i.accumulated_12m != null ? `${Number(i.accumulated_12m).toFixed(2)}%` : "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatDateBR(i.fetched_at)}</td>
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
