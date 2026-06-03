import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { maskCep, maskCpf, maskPhone } from "@/lib/form-utils";
import { toast } from "sonner";
import { Trash2, Upload, Star, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/properties/$id")({ component: PropertyEdit });

const STATUS = ["available","sold","reserved","negotiation","rented"] as const;
const TYPES = ["house","apartment","land","lot","commercial"] as const;
const STATUS_LABEL: Record<string,string> = { available:"Disponível", sold:"Vendido", reserved:"Reservado", negotiation:"Negociação", rented:"Alugado" };
const TYPE_LABEL: Record<string,string> = { house:"Casa", apartment:"Apartamento", land:"Terreno", lot:"Lote", commercial:"Comercial" };
const PURPOSE_LABEL: Record<string,string> = { sale: "Venda", rent: "Aluguel", sale_rent: "Venda ou aluguel" };
const WORKFLOW_LABEL: Record<string,string> = {
  capture_pending: "Captação recebida",
  registration_in_progress: "Cadastro em atendimento",
  awaiting_admin_review: "Aguardando aprovação do cadastro",
  inspection_pending: "Aguardando vistoria técnica",
  inspection_scheduled: "Vistoria agendada",
  awaiting_inspection_review: "Aguardando aprovação da vistoria",
  ready_to_publish: "Apto para divulgação",
  rejected: "Reprovado",
};

const STATES = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" }
];

function PropertyEdit() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const { id } = useParams({ from: "/_app/properties/$id" });
  const isNew = id === "new";
  const navigate = useNavigate();
  const [form, setForm] = useState<any>({
    type: "house", status: "available", country: "Brasil", workflow_status: "capture_pending", listing_purpose: "sale_rent",
    planned_furniture: false, furnished: false, financed: false, accepts_trade: false, exclusive: false,
  });
  const [saving, setSaving] = useState(false);

  const [cep, setCep] = useState("");
  const [searchingCep, setSearchingCep] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [fetchingCoords, setFetchingCoords] = useState(false);

  async function fetchCities(uf: string) {
    if (!uf) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    try {
      const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
      const data = await res.json();
      const list = data.map((c: any) => c.nome).sort();
      setCities(list);
    } catch (e) {
      console.error("Erro ao carregar cidades", e);
    } finally {
      setLoadingCities(false);
    }
  }

  useEffect(() => {
    if (form.state) {
      fetchCities(form.state);
    }
  }, [form.state]);

  function handleStateChange(uf: string) {
    setForm((f: any) => ({ ...f, state: uf, city: "" }));
    fetchCities(uf);
  }

  async function searchCep() {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      return toast.error("CEP inválido! Digite 8 números.");
    }
    setSearchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error("CEP não encontrado!");
        return;
      }
      setForm((f: any) => ({
        ...f,
        state: data.uf,
        city: data.localidade,
        neighborhood: data.bairro,
        address: data.logradouro,
      }));
      toast.success("Endereço preenchido!");
      updateCoordinates(data.logradouro, data.bairro, data.localidade, data.uf);
    } catch (e: any) {
      toast.error(`Erro ao buscar CEP: ${e.message}`);
    } finally {
      setSearchingCep(false);
    }
  }

  async function updateCoordinates(addressStr: string, neighborhoodStr: string, cityStr: string, stateStr: string) {
    if (!addressStr || !cityStr || !stateStr) return;
    setFetchingCoords(true);
    try {
      const q = `${addressStr}, ${neighborhoodStr || ""}, ${cityStr} - ${stateStr}, Brasil`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, {
        headers: {
          "Accept-Language": "pt-BR",
          "User-Agent": "House302ImobFlow-RealEstate-Agent"
        }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        setForm((f: any) => ({
          ...f,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon)
        }));
        toast.success("Coordenadas geográficas atualizadas!");
      } else {
        toast.warning("Coordenadas não encontradas para o endereço completo.");
      }
    } catch (e: any) {
      console.error("Erro ao buscar coordenadas", e);
      toast.error(`Erro ao geolocalizar: ${e.message}`);
    } finally {
      setFetchingCoords(false);
    }
  }

  const { data: brokers = [] } = useQuery({
    queryKey: ["brokers-active"],
    queryFn: async () => (await supabase.from("brokers").select("id, full_name").eq("active", true).order("full_name")).data ?? [],
  });
  const { data: partners = [] } = useQuery({
    queryKey: ["capture-partners-active"],
    queryFn: async () => (await supabase.from("capture_partners").select("id, full_name").eq("active", true).order("full_name")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-owner-options"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name, cpf, phone, email, address").order("full_name")).data ?? [],
  });

  const { data: existing, refetch } = useQuery({
    queryKey: ["property", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data } = await supabase.from("properties").select("*, property_images(*)").eq("id", id).single();
      return data;
    },
  });

  useEffect(() => { if (existing) setForm(existing); }, [existing]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
  function selectOwner(clientId: string) {
    const owner = clients.find((client: any) => client.id === clientId);
    setForm((current: any) => ({
      ...current,
      client_id: clientId,
      owner_name: owner?.full_name ?? current.owner_name,
      owner_cpf: owner?.cpf ?? current.owner_cpf,
      owner_phone: owner?.phone ?? current.owner_phone,
      owner_email: owner?.email ?? current.owner_email,
      owner_address: owner?.address ?? current.owner_address,
    }));
  }

  async function save() {
    setSaving(true);
    const payload = { ...form };
    delete payload.property_images;
    if (payload.price === "") payload.price = null;
    if (payload.broker_id === "" || payload.broker_id === "none") payload.broker_id = null;
    if (payload.capture_partner_id === "" || payload.capture_partner_id === "none") payload.capture_partner_id = null;
    if (payload.client_id === "" || payload.client_id === "none") payload.client_id = null;

    if (isNew) {
      delete payload.id; delete payload.code; delete payload.created_at; delete payload.updated_at;
      const { data: { user } } = await supabase.auth.getUser();
      payload.created_by = user?.id;
      const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Imóvel criado");
      navigate({ to: "/properties/$id", params: { id: data.id } });
    } else {
      const { error } = await supabase.from("properties").update(payload).eq("id", id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Salvo");
      refetch();
    }
  }

  async function advanceWorkflow(workflow_status: string, message: string) {
    const patch: any = { workflow_status };
    if (isAdmin && ["inspection_pending", "ready_to_publish", "rejected"].includes(workflow_status)) {
      const { data: { user } } = await supabase.auth.getUser();
      patch.admin_reviewed_by = user?.id;
      patch.admin_reviewed_at = new Date().toISOString();
      patch.admin_review_notes = form.admin_review_notes ?? null;
    }
    const { error } = await supabase.from("properties").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(message);
    refetch();
  }

  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  async function compressImage(file: File): Promise<Blob> {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1920;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function uploadImages(files: FileList | File[]) {
    if (isNew) return toast.error("Salve o imóvel antes de enviar fotos");
    const list = Array.from(files);
    const currentCount = existing?.property_images?.length ?? 0;
    const remaining = 30 - currentCount;
    if (remaining <= 0) return toast.error("Limite de 30 imagens atingido");
    const toUpload = list.slice(0, remaining);
    if (list.length > remaining) toast.warning(`Apenas ${remaining} imagem(ns) serão enviadas (limite 30)`);

    setUploadProgress({ current: 0, total: toUpload.length });
    let success = 0;
    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i];
      try {
        const blob = await compressImage(file);
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${id}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("property-images").upload(path, blob, { contentType: blob.type || file.type });
        if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue; }
        const { data: { publicUrl } } = supabase.storage.from("property-images").getPublicUrl(path);
        const isFirst = currentCount === 0 && success === 0;
        await supabase.from("property_images").insert({
          property_id: id, image_url: publicUrl, is_cover: isFirst, sort_order: currentCount + success,
        });
        success++;
      } catch (e: any) {
        toast.error(`${file.name}: ${e.message}`);
      }
      setUploadProgress({ current: i + 1, total: toUpload.length });
    }
    setUploadProgress(null);
    if (success > 0) toast.success(`${success} imagem(ns) enviada(s)`);
    refetch();
  }

  async function deleteImage(imgId: string) {
    await supabase.from("property_images").delete().eq("id", imgId);
    refetch();
  }

  async function setCover(imgId: string) {
    await supabase.from("property_images").update({ is_cover: false }).eq("property_id", id);
    await supabase.from("property_images").update({ is_cover: true }).eq("id", imgId);
    refetch();
  }

  async function remove() {
    if (!confirm("Excluir este imóvel?")) return;
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    navigate({ to: "/properties" });
  }

  return (
    <div>
      <PageHeader
        title={isNew ? "Novo imóvel" : (existing?.code ?? "Carregando...")}
        description={isNew ? "Cadastre as informações do imóvel" : existing?.title ?? ""}
        actions={
          <>
            <Button variant="outline" asChild><Link to="/properties"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar</Link></Button>
            {!isNew && <Button variant="outline" onClick={remove}><Trash2 className="mr-1.5 h-4 w-4" />Excluir</Button>}
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </>
        }
      />
      <div className="grid gap-6 p-4 md:p-8 lg:grid-cols-3">
        <Section title="Etapa da captação" className="lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant={form.workflow_status === "rejected" ? "destructive" : "outline"}>{WORKFLOW_LABEL[form.workflow_status] ?? form.workflow_status}</Badge>
              <p className="mt-2 text-xs text-muted-foreground">O imóvel só estará apto para divulgação após a aprovação administrativa da vistoria técnica.</p>
            </div>
            {!isNew && (
              <div className="flex flex-wrap gap-2">
                {form.workflow_status === "capture_pending" && <Button type="button" variant="outline" onClick={() => advanceWorkflow("registration_in_progress", "Atendimento iniciado")}>Iniciar atendimento</Button>}
                {form.workflow_status === "registration_in_progress" && <Button type="button" variant="outline" onClick={() => advanceWorkflow("awaiting_admin_review", "Cadastro enviado para aprovação")}>Enviar cadastro para aprovação</Button>}
                {isAdmin && form.workflow_status === "awaiting_admin_review" && <Button type="button" onClick={() => advanceWorkflow("inspection_pending", "Cadastro aprovado e enviado para vistoria")}>Aprovar e enviar para vistoria</Button>}
                {isAdmin && ["awaiting_admin_review", "awaiting_inspection_review"].includes(form.workflow_status) && <Button type="button" variant="destructive" onClick={() => advanceWorkflow("rejected", "Imóvel reprovado")}>Reprovar</Button>}
              </div>
            )}
          </div>
        </Section>

        <Section title="Origem da captação e proprietário" className="lg:col-span-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Finalidade">
              <Select value={form.listing_purpose ?? "sale_rent"} onValueChange={(value) => set("listing_purpose", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PURPOSE_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Parceiro indicador">
              <Select value={form.capture_partner_id ?? "none"} onValueChange={(value) => set("capture_partner_id", value)}>
                <SelectTrigger><SelectValue placeholder="Captação direta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Captação direta</SelectItem>
                  {partners.map((partner: any) => <SelectItem key={partner.id} value={partner.id}>{partner.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cliente proprietário já cadastrado">
              <Select value={form.client_id ?? "none"} onValueChange={selectOwner}>
                <SelectTrigger><SelectValue placeholder="Selecione se existir" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não vincular agora</SelectItem>
                  {clients.map((client: any) => <SelectItem key={client.id} value={client.id}>{client.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nome do proprietário ou responsável"><Input value={form.owner_name ?? ""} onChange={(e) => set("owner_name", e.target.value)} /></Field>
            <Field label="CPF do proprietário"><Input value={form.owner_cpf ?? ""} onChange={(e) => set("owner_cpf", maskCpf(e.target.value))} /></Field>
            <Field label="Telefone para contato"><Input value={form.owner_phone ?? ""} onChange={(e) => set("owner_phone", maskPhone(e.target.value))} /></Field>
            <Field label="E-mail para contato"><Input type="email" value={form.owner_email ?? ""} onChange={(e) => set("owner_email", e.target.value)} /></Field>
            <div className="md:col-span-3"><Field label="Endereço do proprietário"><Input value={form.owner_address ?? ""} onChange={(e) => set("owner_address", e.target.value)} /></Field></div>
            <div className="md:col-span-3"><Field label="Observações da captação"><Textarea rows={3} value={form.capture_notes ?? ""} onChange={(e) => set("capture_notes", e.target.value)} /></Field></div>
            {isAdmin && <div className="md:col-span-3"><Field label="Parecer administrativo"><Textarea rows={3} value={form.admin_review_notes ?? ""} onChange={(e) => set("admin_review_notes", e.target.value)} /></Field></div>}
          </div>
        </Section>

        <Section title="Identificação" className="lg:col-span-2">
          <Field label="Título"><Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Descrição"><Textarea rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="Comercial">
          <Field label="Valor (R$)"><Input type="number" value={form.price ?? ""} onChange={(e) => set("price", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Venda mínima (R$)"><Input type="number" value={form.sale_min_price ?? ""} onChange={(e) => set("sale_min_price", e.target.value)} /></Field>
            <Field label="Venda máxima (R$)"><Input type="number" value={form.sale_max_price ?? ""} onChange={(e) => set("sale_max_price", e.target.value)} /></Field>
            <Field label="Aluguel mínimo (R$)"><Input type="number" value={form.rental_min_price ?? ""} onChange={(e) => set("rental_min_price", e.target.value)} /></Field>
            <Field label="Aluguel máximo (R$)"><Input type="number" value={form.rental_max_price ?? ""} onChange={(e) => set("rental_max_price", e.target.value)} /></Field>
          </div>
          <Field label="Comissão (%)"><Input type="number" step="0.01" value={form.commission_pct ?? ""} onChange={(e) => set("commission_pct", e.target.value)} /></Field>
          <Field label="Corretor responsável">
            <Select value={form.broker_id ?? "none"} onValueChange={(v) => set("broker_id", v)}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {brokers.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Características" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="Área (m²)"><Input type="number" value={form.area_m2 ?? ""} onChange={(e) => set("area_m2", e.target.value)} /></Field>
            <Field label="Quartos"><Input type="number" value={form.bedrooms ?? ""} onChange={(e) => set("bedrooms", e.target.value)} /></Field>
            <Field label="Banheiros"><Input type="number" value={form.bathrooms ?? ""} onChange={(e) => set("bathrooms", e.target.value)} /></Field>
            <Field label="Suítes"><Input type="number" value={form.suites ?? ""} onChange={(e) => set("suites", e.target.value)} /></Field>
            <Field label="Vagas"><Input type="number" value={form.parking_spaces ?? ""} onChange={(e) => set("parking_spaces", e.target.value)} /></Field>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Toggle label="Mobiliado" v={form.furnished} onChange={(v) => set("furnished", v)} />
            <Toggle label="Móveis planejados" v={form.planned_furniture} onChange={(v) => set("planned_furniture", v)} />
            <Toggle label="Financiável" v={form.financed} onChange={(v) => set("financed", v)} />
            <Toggle label="Aceita permuta" v={form.accepts_trade} onChange={(v) => set("accepts_trade", v)} />
            <Toggle label="Exclusividade" v={form.exclusive} onChange={(v) => set("exclusive", v)} />
          </div>
        </Section>

        <Section title="Localização" className="lg:col-span-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-4 grid grid-cols-1 gap-3 md:grid-cols-4 border-b pb-4 mb-2">
              <Field label="Buscar CEP">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: 58030-000"
                    value={cep}
                    onChange={(e) => setCep(maskCep(e.target.value))}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchCep())}
                  />
                  <Button type="button" variant="secondary" onClick={searchCep} disabled={searchingCep}>
                    {searchingCep ? "Buscando..." : "Buscar CEP"}
                  </Button>
                </div>
              </Field>
            </div>

            <Field label="Estado (UF)">
              <Select value={form.state || ""} onValueChange={handleStateChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {STATES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label} ({s.value})</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Cidade">
              <Select value={form.city || ""} onValueChange={(v) => set("city", v)} disabled={loadingCities}>
                <SelectTrigger><SelectValue placeholder={loadingCities ? "Carregando..." : "Selecione a cidade"} /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Bairro"><Input value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} /></Field>
            <Field label="Endereço (Rua e número)"><Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
            
            <div className="md:col-span-4 flex flex-wrap gap-2 items-center justify-between border-t border-b py-4 my-2">
              <span className="text-xs text-muted-foreground">Preencha o endereço acima e clique ao lado para buscar as coordenadas geográficas automaticamente</span>
              <Button type="button" variant="outline" size="sm" onClick={() => updateCoordinates(form.address, form.neighborhood, form.city, form.state)} disabled={fetchingCoords || !form.address || !form.city || !form.state}>
                {fetchingCoords ? "Buscando Coordenadas..." : "Geolocalizar Imóvel"}
              </Button>
            </div>

            <Field label="Latitude"><Input type="number" step="any" value={form.latitude ?? ""} onChange={(e) => set("latitude", e.target.value ? parseFloat(e.target.value) : null)} /></Field>
            <Field label="Longitude"><Input type="number" step="any" value={form.longitude ?? ""} onChange={(e) => set("longitude", e.target.value ? parseFloat(e.target.value) : null)} /></Field>
            <Field label="Vídeo (URL)"><Input value={form.video_url ?? ""} onChange={(e) => set("video_url", e.target.value)} /></Field>
            <Field label="Tour virtual (URL)"><Input value={form.tour_url ?? ""} onChange={(e) => set("tour_url", e.target.value)} /></Field>
          </div>
        </Section>

        {!isNew && (
          <Section title={`Galeria de imagens (${existing?.property_images?.length ?? 0}/30)`} className="lg:col-span-3">
            {uploadProgress && (
              <div className="mb-3 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                Enviando {uploadProgress.current} de {uploadProgress.total}…
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {existing?.property_images?.map((img: any) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-md border">
                  <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                  {img.is_cover && <div className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">CAPA</div>}
                  <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/60 group-hover:flex">
                    {!img.is_cover && (
                      <button onClick={() => setCover(img.id)} className="rounded bg-white/10 p-1.5 text-white hover:bg-white/20" title="Tornar capa"><Star className="h-3.5 w-3.5" /></button>
                    )}
                    <button onClick={() => deleteImage(img.id)} className="rounded bg-white/10 p-1.5 text-white hover:bg-destructive" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              {(existing?.property_images?.length ?? 0) < 30 && (
                <label
                  className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) uploadImages(e.dataTransfer.files); }}
                >
                  <Upload className="h-5 w-5" />
                  Enviar fotos
                  <span className="text-[10px]">arraste ou clique</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.length) uploadImages(e.target.files); e.target.value = ""; }}
                  />
                </label>
              )}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children, className = "" }: any) {
  return (
    <div className={`rounded-lg border bg-card p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: any) {
  return <div><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      {label}
      <Switch checked={!!v} onCheckedChange={onChange} />
    </label>
  );
}
