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
import { toast } from "sonner";
import { Trash2, Upload, Star, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/properties/$id")({ component: PropertyEdit });

const STATUS = ["available","sold","reserved","negotiation","rented"] as const;
const TYPES = ["house","apartment","land","lot","commercial"] as const;
const STATUS_LABEL: Record<string,string> = { available:"Disponível", sold:"Vendido", reserved:"Reservado", negotiation:"Negociação", rented:"Alugado" };
const TYPE_LABEL: Record<string,string> = { house:"Casa", apartment:"Apartamento", land:"Terreno", lot:"Lote", commercial:"Comercial" };

function PropertyEdit() {
  const { id } = useParams({ from: "/_app/properties/$id" });
  const isNew = id === "new";
  const navigate = useNavigate();
  const [form, setForm] = useState<any>({
    type: "house", status: "available", country: "Brasil",
    planned_furniture: false, furnished: false, financed: false, accepts_trade: false, exclusive: false,
  });
  const [saving, setSaving] = useState(false);

  const { data: brokers = [] } = useQuery({
    queryKey: ["brokers-active"],
    queryFn: async () => (await supabase.from("brokers").select("id, full_name").eq("active", true).order("full_name")).data ?? [],
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

  async function save() {
    setSaving(true);
    const payload = { ...form };
    delete payload.property_images;
    if (payload.price === "") payload.price = null;
    if (payload.broker_id === "" || payload.broker_id === "none") payload.broker_id = null;

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
      <div className="grid gap-6 p-8 lg:grid-cols-3">
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
            <Field label="Estado (UF)"><Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} /></Field>
            <Field label="Cidade"><Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
            <Field label="Bairro"><Input value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} /></Field>
            <Field label="Endereço"><Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
            <Field label="Latitude"><Input type="number" step="any" value={form.latitude ?? ""} onChange={(e) => set("latitude", e.target.value ? parseFloat(e.target.value) : null)} /></Field>
            <Field label="Longitude"><Input type="number" step="any" value={form.longitude ?? ""} onChange={(e) => set("longitude", e.target.value ? parseFloat(e.target.value) : null)} /></Field>
            <Field label="Vídeo (URL)"><Input value={form.video_url ?? ""} onChange={(e) => set("video_url", e.target.value)} /></Field>
            <Field label="Tour virtual (URL)"><Input value={form.tour_url ?? ""} onChange={(e) => set("tour_url", e.target.value)} /></Field>
          </div>
        </Section>

        {!isNew && (
          <Section title="Galeria de imagens" className="lg:col-span-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {existing?.property_images?.map((img: any) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-md border">
                  <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                  {img.is_cover && <div className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">CAPA</div>}
                  <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/60 group-hover:flex">
                    {!img.is_cover && (
                      <button onClick={() => setCover(img.id)} className="rounded bg-white/10 p-1.5 text-white hover:bg-white/20"><Star className="h-3.5 w-3.5" /></button>
                    )}
                    <button onClick={() => deleteImage(img.id)} className="rounded bg-white/10 p-1.5 text-white hover:bg-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted">
                <Upload className="h-5 w-5" />
                Enviar foto
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
              </label>
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
