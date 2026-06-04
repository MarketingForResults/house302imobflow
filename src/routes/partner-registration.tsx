import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";
import {
  composeAddress,
  lookupCepAddress,
  maskCep,
  maskCnh,
  maskCpfCnpj,
  maskPhone,
  maskRg,
} from "@/lib/form-utils";
import logo from "@/assets/logo-house302.png";
import logoIcon from "@/assets/logo-house302-icon.png";

export const Route = createFileRoute("/partner-registration")({
  component: PartnerRegistration,
});

const EMPTY_FORM = {
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
  property_owner_name: "",
  property_owner_phone: "",
  property_owner_email: "",
  property_address: "",
  property_zip_code: "",
  property_street: "",
  property_number: "",
  property_complement: "",
  property_neighborhood: "",
  property_city: "",
  property_state: "",
  property_notes: "",
  notes: "",
};

function createPublicRegistrationClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase nao configurado para o formulario publico.");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

const publicRegistrationSupabase = createPublicRegistrationClient();

function composePrefixedAddress(form: typeof EMPTY_FORM, prefix: "property_") {
  return composeAddress({
    address: form[`${prefix}address`],
    zip_code: form[`${prefix}zip_code`],
    street: form[`${prefix}street`],
    number: form[`${prefix}number`],
    complement: form[`${prefix}complement`],
    neighborhood: form[`${prefix}neighborhood`],
    city: form[`${prefix}city`],
    state: form[`${prefix}state`],
  });
}

function buildPartnerNotes(form: typeof EMPTY_FORM) {
  const partnerAddress = composeAddress(form);
  const propertyAddress = composePrefixedAddress(form, "property_");
  const lines = [
    form.notes && `Observacoes gerais: ${form.notes}`,
    partnerAddress && `Endereco do parceiro: ${partnerAddress}`,
    form.rg && `RG do parceiro: ${form.rg}`,
    form.cnh && `CNH do parceiro: ${form.cnh}`,
    "Imovel indicado:",
    form.property_owner_name && `Proprietario/responsavel: ${form.property_owner_name}`,
    form.property_owner_phone && `Telefone do proprietario: ${form.property_owner_phone}`,
    form.property_owner_email && `E-mail do proprietario: ${form.property_owner_email}`,
    propertyAddress && `Endereco do imovel indicado: ${propertyAddress}`,
    form.property_notes && `Dados adicionais do imovel: ${form.property_notes}`,
  ].filter(Boolean);

  return lines.join("\n");
}

function getSupabaseErrorText(error: any) {
  return [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isMissingColumnError(error: any) {
  const text = getSupabaseErrorText(error);
  return (
    text.includes("pgrst204") ||
    text.includes("schema cache") ||
    text.includes("could not find") ||
    text.includes("column")
  );
}

function isMissingTableError(error: any) {
  const text = getSupabaseErrorText(error);
  return text.includes("42p01") || (text.includes("relation") && text.includes("does not exist"));
}

function PartnerRegistration() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [searchingPartnerCep, setSearchingPartnerCep] = useState(false);
  const [searchingPropertyCep, setSearchingPropertyCep] = useState(false);

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function lookupPartnerCep() {
    setSearchingPartnerCep(true);
    try {
      const address = await lookupCepAddress(form.zip_code);
      setForm((current) => {
        const next = { ...current, ...address };
        return { ...next, address: composeAddress(next) };
      });
      toast.success("Endereco do parceiro preenchido pelo CEP");
    } catch (error: any) {
      toast.error(error.message ?? "Nao foi possivel buscar o CEP");
    } finally {
      setSearchingPartnerCep(false);
    }
  }

  async function lookupPropertyCep() {
    setSearchingPropertyCep(true);
    try {
      const address = await lookupCepAddress(form.property_zip_code);
      setForm((current) => {
        const next = {
          ...current,
          property_zip_code: address.zip_code,
          property_street: address.street,
          property_neighborhood: address.neighborhood,
          property_city: address.city,
          property_state: address.state,
        };
        return { ...next, property_address: composePrefixedAddress(next, "property_") };
      });
      toast.success("Endereco do imovel preenchido pelo CEP");
    } catch (error: any) {
      toast.error(error.message ?? "Nao foi possivel buscar o CEP do imovel");
    } finally {
      setSearchingPropertyCep(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast.error("Informe seu nome e telefone para continuar.");
      return;
    }

    const canSubmit = window.confirm(
      "Por seguranca, dados bancarios, Pix, TED, deposito ou pagamento em dinheiro nao serao solicitados neste formulario publico. Apos a analise e aprovacao do cadastro, a equipe House 302 liberara a area segura do parceiro ou fara contato para registrar a forma de recebimento da bonificacao. Deseja enviar o cadastro agora?",
    );
    if (!canSubmit) return;

    setSaving(true);
    const payload = {
      ...form,
      address: composeAddress(form),
      property_address: composePrefixedAddress(form, "property_"),
      active: false,
      registration_status: "pending",
    };
    const { error } = await publicRegistrationSupabase.from("capture_partners").insert(payload);

    if (error && isMissingColumnError(error)) {
      const fallbackPayload = {
        full_name: form.full_name,
        cpf_cnpj: form.cpf_cnpj || null,
        phone: form.phone,
        email: form.email || null,
        address: composeAddress(form) || null,
        notes: buildPartnerNotes(form),
        active: false,
        registration_status: "pending",
      };
      const { error: fallbackError } = await publicRegistrationSupabase
        .from("capture_partners")
        .insert(fallbackPayload);
      setSaving(false);

      if (fallbackError) {
        if (isMissingTableError(fallbackError)) {
          toast.error("O cadastro de parceiros ainda precisa ser liberado no banco de dados.");
          return;
        }
        toast.error(
          fallbackError.message ?? "Nao foi possivel enviar seu cadastro. Tente novamente.",
        );
        return;
      }

      toast.success(
        "Cadastro enviado. Os detalhes extras foram salvos nas observacoes ate o banco ser atualizado.",
      );
      setForm(EMPTY_FORM);
      setSent(true);
      return;
    }

    setSaving(false);

    if (error) {
      if (isMissingTableError(error)) {
        toast.error("O cadastro de parceiros ainda precisa ser liberado no banco de dados.");
        return;
      }
      toast.error(error.message ?? "Nao foi possivel enviar seu cadastro. Tente novamente.");
      return;
    }

    setForm(EMPTY_FORM);
    setSent(true);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-center">
          <img
            src={logoIcon}
            alt="HOUSE 302"
            className="h-14 w-14 rounded-2xl object-cover shadow-sm sm:hidden"
          />
          <img
            src={logo}
            alt="HOUSE 302"
            className="hidden h-auto max-h-9 max-w-[230px] object-contain sm:block"
          />
        </div>

        <Card>
          {sent ? (
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle2 className="h-14 w-14 text-emerald-600" />
              <CardTitle>Cadastro enviado</CardTitle>
              <CardDescription className="max-w-md">
                Seus dados foram recebidos. Apos a analise, a equipe House 302 orientara os proximos
                passos e liberara uma forma segura para registrar dados de pagamento da bonificacao.
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
                  Cadastre seus dados e, se ja possuir, informe tambem os dados basicos do imovel
                  indicado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={submit}>
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold">Dados do parceiro</h2>
                      <p className="text-xs text-muted-foreground">
                        Informacoes de quem esta indicando a oportunidade.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Nome completo *</Label>
                      <Input
                        id="full_name"
                        autoComplete="name"
                        value={form.full_name}
                        onChange={(e) => update("full_name", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="cpf_cnpj">CPF ou CNPJ</Label>
                        <Input
                          id="cpf_cnpj"
                          value={form.cpf_cnpj}
                          onChange={(e) => update("cpf_cnpj", maskCpfCnpj(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone / WhatsApp *</Label>
                        <Input
                          id="phone"
                          autoComplete="tel"
                          value={form.phone}
                          onChange={(e) => update("phone", maskPhone(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="rg">RG</Label>
                        <Input
                          id="rg"
                          value={form.rg}
                          onChange={(e) => update("rg", maskRg(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cnh">CNH</Label>
                        <Input
                          id="cnh"
                          inputMode="numeric"
                          value={form.cnh}
                          onChange={(e) => update("cnh", maskCnh(e.target.value))}
                        />
                      </div>
                    </div>
                    <AddressSection
                      title="Endereco do parceiro"
                      zipCode={form.zip_code}
                      street={form.street}
                      number={form.number}
                      complement={form.complement}
                      neighborhood={form.neighborhood}
                      city={form.city}
                      state={form.state}
                      address={form.address || composeAddress(form)}
                      searching={searchingPartnerCep}
                      onLookup={lookupPartnerCep}
                      onChange={(field, value) => update(field as keyof typeof EMPTY_FORM, value)}
                      fieldPrefix=""
                    />
                  </section>

                  <section className="space-y-4 border-t pt-5">
                    <div>
                      <h2 className="text-sm font-semibold">Imovel indicado</h2>
                      <p className="text-xs text-muted-foreground">
                        Preencha o que souber. A equipe validara os dados antes de abrir a captacao.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="property_owner_name">
                          Nome do proprietario ou responsavel
                        </Label>
                        <Input
                          id="property_owner_name"
                          value={form.property_owner_name}
                          onChange={(e) => update("property_owner_name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="property_owner_phone">
                          Telefone / WhatsApp do proprietario
                        </Label>
                        <Input
                          id="property_owner_phone"
                          value={form.property_owner_phone}
                          onChange={(e) =>
                            update("property_owner_phone", maskPhone(e.target.value))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="property_owner_email">E-mail do proprietario</Label>
                      <Input
                        id="property_owner_email"
                        type="email"
                        value={form.property_owner_email}
                        onChange={(e) => update("property_owner_email", e.target.value)}
                      />
                    </div>
                    <AddressSection
                      title="Localizacao do imovel indicado"
                      zipCode={form.property_zip_code}
                      street={form.property_street}
                      number={form.property_number}
                      complement={form.property_complement}
                      neighborhood={form.property_neighborhood}
                      city={form.property_city}
                      state={form.property_state}
                      address={form.property_address || composePrefixedAddress(form, "property_")}
                      searching={searchingPropertyCep}
                      onLookup={lookupPropertyCep}
                      onChange={(field, value) =>
                        update(`property_${field}` as keyof typeof EMPTY_FORM, value)
                      }
                      fieldPrefix="property_"
                    />
                    <div className="space-y-2">
                      <Label htmlFor="property_notes">Dados adicionais do imovel indicado</Label>
                      <Textarea
                        id="property_notes"
                        rows={4}
                        placeholder="Ex.: tipo do imovel, finalidade venda/aluguel, valor aproximado, melhor horario para contato, observacoes sobre acesso ou disponibilidade."
                        value={form.property_notes}
                        onChange={(e) => update("property_notes", e.target.value)}
                      />
                    </div>
                  </section>

                  <section className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                    <strong className="block text-foreground">Sobre bonificacao e pagamento</strong>
                    Dados bancarios, Pix, TED, deposito ou pagamento em dinheiro serao tratados
                    somente apos a aprovacao do cadastro, em area segura ou contato direto da equipe
                    House 302.
                  </section>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Observacoes gerais</Label>
                    <Textarea
                      id="notes"
                      rows={4}
                      placeholder="Conte como prefere ser contatado e qualquer informacao adicional sobre sua indicacao."
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

type AddressSectionProps = {
  title: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  address: string;
  searching: boolean;
  onLookup: () => void;
  onChange: (field: string, value: string) => void;
  fieldPrefix: string;
};

function AddressSection(props: AddressSectionProps) {
  return (
    <div className="rounded-md border bg-muted/10 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <MapPin className="h-4 w-4 text-primary" />
        {props.title}
      </div>
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <div className="space-y-2">
          <Label htmlFor={`${props.fieldPrefix}zip_code`}>CEP</Label>
          <div className="flex gap-2">
            <Input
              id={`${props.fieldPrefix}zip_code`}
              autoComplete="postal-code"
              placeholder="00000-000"
              value={props.zipCode}
              onChange={(e) => props.onChange("zip_code", maskCep(e.target.value))}
              onBlur={() => {
                if (props.zipCode.replace(/\D/g, "").length === 8) props.onLookup();
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={props.onLookup}
              disabled={props.searching}
            >
              {props.searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Rua / Logradouro</Label>
          <Input value={props.street} onChange={(e) => props.onChange("street", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Numero</Label>
          <Input value={props.number} onChange={(e) => props.onChange("number", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Complemento</Label>
          <Input
            value={props.complement}
            onChange={(e) => props.onChange("complement", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Bairro</Label>
          <Input
            value={props.neighborhood}
            onChange={(e) => props.onChange("neighborhood", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={props.city} onChange={(e) => props.onChange("city", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Input
              maxLength={2}
              value={props.state}
              onChange={(e) => props.onChange("state", e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Label htmlFor={`${props.fieldPrefix}address`}>Endereco completo</Label>
        <Input
          id={`${props.fieldPrefix}address`}
          value={props.address}
          onChange={(e) => props.onChange("address", e.target.value)}
        />
      </div>
    </div>
  );
}
