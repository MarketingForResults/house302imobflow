import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", true).maybeSingle()
      .then(({ data }) => setS(data ?? {}));
  }, []);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("app_settings").update({
      rental_late_fee_pct: Number(s.rental_late_fee_pct),
      rental_daily_interest_pct: Number(s.rental_daily_interest_pct),
      rental_grace_days: Number(s.rental_grace_days),
      rental_default_due_day: Number(s.rental_default_due_day),
      rental_default_readjustment_index: s.rental_default_readjustment_index,
      rental_default_readjustment_month: s.rental_default_readjustment_month ? Number(s.rental_default_readjustment_month) : null,
      contract_default_commission_pct: Number(s.contract_default_commission_pct),
      updated_by: user?.id,
    }).eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas. Parcelas em atraso serão recalculadas automaticamente.");
  }

  if (!s) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const Field = ({ k, label, type = "number", step = "0.01", suffix }: any) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input type={type} step={step} value={s[k] ?? ""} disabled={!isAdmin}
          onChange={(e) => setS({ ...s, [k]: e.target.value })} />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Configurações"
        description={isAdmin ? "Parâmetros financeiros aplicados a contratos e parcelas" : "Somente leitura — apenas administradores podem alterar"}
        actions={isAdmin ? <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button> : null}
      />

      <div className="space-y-6 p-8">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">Aluguéis — multa, juros e recálculo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field k="rental_late_fee_pct" label="Multa por atraso" suffix="% sobre o valor devido" />
            <Field k="rental_daily_interest_pct" label="Juros diários (mora)" suffix="% ao dia" />
            <Field k="rental_grace_days" label="Carência (dias após vencimento)" step="1" suffix="dias" />
            <Field k="rental_default_due_day" label="Dia de vencimento padrão" step="1" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Parcelas vencidas exibem o total recalculado automaticamente como:
            valor + (valor × multa%) + (valor × juros% × dias de atraso).
          </p>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">Reajuste e contratos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Índice de reajuste padrão</Label>
              <Input value={s.rental_default_readjustment_index ?? ""} disabled={!isAdmin}
                onChange={(e) => setS({ ...s, rental_default_readjustment_index: e.target.value })} />
            </div>
            <Field k="rental_default_readjustment_month" label="Mês de reajuste padrão (1–12)" step="1" />
            <Field k="contract_default_commission_pct" label="Comissão padrão de contrato" suffix="%" />
          </div>
        </section>
      </div>
    </div>
  );
}
