import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Building2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/partner-registration")({
  component: PartnerRegistration,
});

const EMPTY_FORM = {
  full_name: "",
  cpf_cnpj: "",
  phone: "",
  email: "",
  address: "",
  pix_key: "",
  notes: "",
};

function PartnerRegistration() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast.error("Informe seu nome e telefone para continuar.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("capture_partners").insert({
      ...form,
      active: false,
      registration_status: "pending",
    });
    setSaving(false);

    if (error) {
      toast.error("Nao foi possivel enviar seu cadastro. Tente novamente.");
      return;
    }

    setForm(EMPTY_FORM);
    setSent(true);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-center gap-3 text-primary">
          <Building2 className="h-9 w-9" />
          <span className="text-2xl font-bold">HOUSE 302</span>
        </div>

        <Card>
          {sent ? (
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle2 className="h-14 w-14 text-emerald-600" />
              <CardTitle>Cadastro enviado</CardTitle>
              <CardDescription className="max-w-md">
                Seus dados foram recebidos. Nossa equipe entrara em contato apos a analise do cadastro para
                orientar o envio das informacoes do imovel.
              </CardDescription>
              <Button variant="outline" onClick={() => setSent(false)}>
                Enviar outro cadastro
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Quero indicar imoveis</CardTitle>
                <CardDescription>
                  Cadastre-se como parceiro da House 302 para indicar oportunidades de venda ou aluguel e
                  receber orientacoes sobre bonificacoes e comissoes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submit}>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome completo *</Label>
                    <Input id="full_name" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cpf_cnpj">CPF ou CNPJ</Label>
                      <Input id="cpf_cnpj" value={form.cpf_cnpj} onChange={(e) => update("cpf_cnpj", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone / WhatsApp *</Label>
                      <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereco</Label>
                    <Input id="address" value={form.address} onChange={(e) => update("address", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pix_key">Chave Pix para bonificacoes</Label>
                    <Input id="pix_key" value={form.pix_key} onChange={(e) => update("pix_key", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Observacoes</Label>
                    <Textarea
                      id="notes"
                      rows={4}
                      placeholder="Conte como prefere ser contatado e, se desejar, adiante informacoes sobre os imoveis que pretende indicar."
                      value={form.notes}
                      onChange={(e) => update("notes", e.target.value)}
                    />
                  </div>
                  <Button className="w-full" type="submit" disabled={saving}>
                    {saving ? "Enviando..." : "Enviar cadastro"}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
        <div className="mt-5 text-center">
          <Link className="text-sm text-primary hover:underline" to="/login">
            Acesso da equipe House 302
          </Link>
        </div>
      </div>
    </main>
  );
}
