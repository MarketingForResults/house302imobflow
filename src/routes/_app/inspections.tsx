import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Download,
  ExternalLink,
  ImagePlus,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { toast } from "sonner";
import { translatedErrorMessage } from "@/lib/error-messages";

export const Route = createFileRoute("/_app/inspections")({ component: InspectionsPage });

const WORKFLOW_LABEL: Record<string, string> = {
  inspection_pending: "Aguardando agendamento",
  inspection_scheduled: "Vistoria agendada",
  awaiting_inspection_review: "Aguardando aprovação",
  ready_to_publish: "Apto para divulgação",
  rejected: "Reprovado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  inspection_pending: "secondary",
  inspection_scheduled: "outline",
  awaiting_inspection_review: "secondary",
  ready_to_publish: "default",
  rejected: "destructive",
};
const PURPOSE_LABEL: Record<string, string> = {
  sale: "Venda",
  rent: "Aluguel",
  sale_rent: "Venda e aluguel",
};

function money(value: number | null | undefined) {
  return value == null
    ? "—"
    : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const REMINDER_OPTIONS = [
  { value: "0", label: "Sem lembrete" },
  { value: "15", label: "15 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "120", label: "2 horas antes" },
  { value: "1440", label: "1 dia antes" },
];

function calendarRange(datetimeLocal?: string) {
  if (!datetimeLocal) return null;
  const start = new Date(datetimeLocal);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  return { start, end, text: `${fmt(start)}/${fmt(end)}` };
}

function calendarTitle(property: any) {
  return `Vistoria tecnica - ${property?.code ?? "imovel"}`;
}

function calendarDetails(property: any, inspection: any) {
  return [
    property?.title,
    inspection?.contact_notes ? `Contato: ${inspection.contact_notes}` : null,
    inspection?.reminder_minutes ? `Lembrete: ${inspection.reminder_minutes} minutos antes` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function googleCalendarUrl(property: any, inspection: any) {
  const range = calendarRange(inspection?.scheduled_at);
  if (!range) return "";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: calendarTitle(property),
    dates: range.text,
    details: calendarDetails(property, inspection),
    location: property?.address ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function outlookCalendarUrl(property: any, inspection: any) {
  const range = calendarRange(inspection?.scheduled_at);
  if (!range) return "";
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: calendarTitle(property),
    startdt: range.start.toISOString(),
    enddt: range.end.toISOString(),
    body: calendarDetails(property, inspection),
    location: property?.address ?? "",
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function downloadIcs(property: any, inspection: any) {
  const range = calendarRange(inspection?.scheduled_at);
  if (!range) {
    toast.error("Informe a data e hora da vistoria antes de gerar a agenda.");
    return;
  }
  const escapeValue = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,");
  const alarmMinutes = Number(inspection?.reminder_minutes ?? 60);
  const alarm =
    alarmMinutes > 0
      ? [
          "BEGIN:VALARM",
          `TRIGGER:-PT${alarmMinutes}M`,
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeValue(calendarTitle(property))}`,
          "END:VALARM",
        ]
      : [];
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//House302//ImobFlow//PT-BR",
    "BEGIN:VEVENT",
    `UID:${property?.id ?? crypto.randomUUID()}@house302`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z")}`,
    `DTSTART:${range.text.split("/")[0]}`,
    `DTEND:${range.text.split("/")[1]}`,
    `SUMMARY:${escapeValue(calendarTitle(property))}`,
    `DESCRIPTION:${escapeValue(calendarDetails(property, inspection))}`,
    `LOCATION:${escapeValue(property?.address ?? "")}`,
    ...alarm,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${property?.code ?? "vistoria"}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

function isSchemaCacheError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const current = error as {
    code?: string | null;
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  };
  const text = [current.message, current.details, current.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    current.code === "PGRST204" || text.includes("schema cache") || text.includes("could not find")
  );
}

async function upsertInspection(
  payload: Record<string, unknown>,
  options: { select?: boolean } = {},
) {
  const run = async (currentPayload: Record<string, unknown>) => {
    const query = (supabase as any)
      .from("property_inspections")
      .upsert(currentPayload, { onConflict: "property_id" });
    return options.select ? await query.select("*").maybeSingle() : await query;
  };

  const result = await run(payload);
  if (!isSchemaCacheError(result.error)) return { ...result, usedFallback: false };

  const compatiblePayload = { ...payload };
  delete compatiblePayload.review_notes;
  delete compatiblePayload.reviewed_by;
  delete compatiblePayload.reviewed_at;

  if (Object.keys(compatiblePayload).length === Object.keys(payload).length) {
    return { ...result, usedFallback: false };
  }

  const fallbackResult = await run(compatiblePayload);
  return { ...fallbackResult, usedFallback: !fallbackResult.error };
}

function InspectionsPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [editing, setEditing] = useState<any | null>(null);
  const [inspection, setInspection] = useState<any>({});
  const [uploading, setUploading] = useState(false);

  const { data: properties = [] } = useQuery({
    queryKey: ["properties-inspection-pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(
          "*, brokers(full_name), clients(full_name, phone, email), capture_partners(full_name, phone), property_images(*), property_inspections(*)",
        )
        .in("workflow_status", [
          "inspection_pending",
          "inspection_scheduled",
          "awaiting_inspection_review",
          "ready_to_publish",
          "rejected",
        ])
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: brokers = [] } = useQuery({
    queryKey: ["brokers-inspection-options"],
    queryFn: async () =>
      (await supabase.from("brokers").select("id, full_name").eq("active", true).order("full_name"))
        .data ?? [],
  });

  function open(property: any) {
    setEditing(property);
    setInspection({
      ...(property.property_inspections?.[0] ?? {}),
      property_id: property.id,
      assigned_broker_id:
        property.property_inspections?.[0]?.assigned_broker_id ?? property.broker_id ?? "none",
      scheduled_at: property.property_inspections?.[0]?.scheduled_at?.slice(0, 16) ?? "",
      reminder_minutes: property.property_inspections?.[0]?.reminder_minutes ?? 60,
    });
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["properties-inspection-pipeline"] });
  }

  async function save() {
    const payload = {
      property_id: editing.id,
      assigned_broker_id:
        inspection.assigned_broker_id === "none" ? null : inspection.assigned_broker_id,
      scheduled_at: inspection.scheduled_at || null,
      reminder_minutes: Number(inspection.reminder_minutes ?? 60),
      contact_notes: inspection.contact_notes || null,
      technical_notes: inspection.technical_notes || null,
      review_notes: inspection.review_notes || null,
      status:
        inspection.status === "completed"
          ? "completed"
          : inspection.scheduled_at
            ? "scheduled"
            : "pending",
    };
    const { data, error, usedFallback } = await upsertInspection(payload, { select: true });
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel salvar a vistoria."));
    const workflow_status =
      payload.status === "scheduled" ? "inspection_scheduled" : "inspection_pending";
    const { error: propertyError } = await supabase
      .from("properties")
      .update({ workflow_status, broker_id: payload.assigned_broker_id })
      .eq("id", editing.id);
    if (propertyError) {
      return toast.error(
        translatedErrorMessage(propertyError, "Nao foi possivel atualizar a etapa do imovel."),
      );
    }
    if (data) setInspection({ ...data, scheduled_at: data.scheduled_at?.slice(0, 16) ?? "" });
    toast.success(
      usedFallback
        ? "Atendimento salvo. Aplique as migrations para gravar o parecer administrativo."
        : "Vistoria atualizada",
    );
    refresh();
  }

  async function deleteInspection() {
    if (!editing?.id) return;
    if (!confirm("Excluir o registro de vistoria deste imovel?")) return;
    const { error } = await (supabase as any)
      .from("property_inspections")
      .delete()
      .eq("property_id", editing.id);
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel excluir a vistoria."));
    await supabase
      .from("properties")
      .update({ workflow_status: "inspection_pending" })
      .eq("id", editing.id);
    toast.success("Registro de vistoria excluido");
    setEditing(null);
    refresh();
  }

  async function completeInspection() {
    if (!inspection.technical_notes?.trim())
      return toast.error("Registre o parecer técnico antes de concluir");
    const payload = {
      property_id: editing.id,
      assigned_broker_id:
        inspection.assigned_broker_id === "none" ? null : inspection.assigned_broker_id,
      scheduled_at: inspection.scheduled_at || null,
      reminder_minutes: Number(inspection.reminder_minutes ?? 60),
      contact_notes: inspection.contact_notes || null,
      technical_notes: inspection.technical_notes,
      review_notes: inspection.review_notes || null,
      status: "completed",
    };
    const { error, usedFallback } = await upsertInspection(payload);
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel concluir a vistoria."));
    const { error: propertyError } = await supabase
      .from("properties")
      .update({
        workflow_status: "awaiting_inspection_review",
        broker_id: payload.assigned_broker_id,
      })
      .eq("id", editing.id);
    if (propertyError) {
      return toast.error(
        translatedErrorMessage(propertyError, "Nao foi possivel atualizar a etapa do imovel."),
      );
    }
    toast.success(
      usedFallback
        ? "Vistoria concluida. Aplique as migrations para gravar o parecer administrativo."
        : "Vistoria concluída e enviada para aprovação",
    );
    setEditing(null);
    refresh();
  }

  async function review(approved: boolean) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const status = approved ? "approved" : "rejected";
    const workflow_status = approved ? "ready_to_publish" : "rejected";
    const { error, usedFallback } = await upsertInspection({
      property_id: editing.id,
      assigned_broker_id:
        inspection.assigned_broker_id === "none" ? null : inspection.assigned_broker_id,
      scheduled_at: inspection.scheduled_at || null,
      reminder_minutes: Number(inspection.reminder_minutes ?? 60),
      contact_notes: inspection.contact_notes || null,
      technical_notes: inspection.technical_notes || null,
      review_notes: inspection.review_notes || null,
      status,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    });
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel revisar a vistoria."));
    const { error: propertyError } = await supabase
      .from("properties")
      .update({ workflow_status })
      .eq("id", editing.id);
    if (propertyError) {
      return toast.error(
        translatedErrorMessage(propertyError, "Nao foi possivel atualizar a etapa do imovel."),
      );
    }
    toast.success(
      usedFallback
        ? "Revisao salva. Aplique as migrations para gravar os dados do revisor."
        : approved
          ? "Imóvel liberado para divulgação"
          : "Vistoria reprovada",
    );
    setEditing(null);
    refresh();
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    let success = 0;
    for (const [index, file] of Array.from(files).entries()) {
      const path = `${editing.id}/inspection-${Date.now()}-${index}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from("property-images")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) {
        toast.error(
          `${file.name}: ${translatedErrorMessage(uploadError, "Nao foi possivel enviar a foto.")}`,
        );
        continue;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("property-images").getPublicUrl(path);
      const { error } = await supabase.from("property_images").insert({
        property_id: editing.id,
        image_url: publicUrl,
        is_cover: (editing.property_images?.length ?? 0) === 0 && success === 0,
        sort_order: (editing.property_images?.length ?? 0) + success,
      });
      if (error) {
        await supabase.storage.from("property-images").remove([path]);
        toast.error(
          `${file.name}: ${translatedErrorMessage(error, "Nao foi possivel registrar a foto no imovel.")}`,
        );
        continue;
      }
      success++;
    }
    const { data } = await supabase
      .from("properties")
      .select(
        "*, brokers(full_name), clients(full_name, phone, email), capture_partners(full_name, phone), property_images(*), property_inspections(*)",
      )
      .eq("id", editing.id)
      .maybeSingle();
    setEditing(data ?? editing);
    setUploading(false);
    if (success) toast.success(`${success} foto(s) adicionada(s) ao imóvel`);
    refresh();
  }

  async function deleteImage(id: string) {
    const { error } = await supabase.from("property_images").delete().eq("id", id);
    if (error)
      return toast.error(translatedErrorMessage(error, "Nao foi possivel excluir a foto."));
    setEditing({
      ...editing,
      property_images: editing.property_images.filter((image: any) => image.id !== id),
    });
    refresh();
  }

  const phone = editing?.owner_phone || editing?.clients?.phone;

  return (
    <div>
      <PageHeader
        title="Vistorias"
        description="Execução técnica dos imóveis aprovados na etapa de cadastro"
      />
      <div className="p-4 md:p-8">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Imóvel</th>
                <th className="px-4 py-3">Proprietário</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Corretor</th>
                <th className="px-4 py-3">Fotos</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {properties.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum imóvel aguardando vistoria.
                  </td>
                </tr>
              )}
              {properties.map((property: any) => (
                <tr key={property.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{property.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {property.title || property.address}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {property.owner_name || property.clients?.full_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {property.owner_phone || property.clients?.phone || "—"}
                  </td>
                  <td className="px-4 py-3">{property.brokers?.full_name || "Não atribuído"}</td>
                  <td className="px-4 py-3">{property.property_images?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[property.workflow_status] ?? "outline"}>
                      {WORKFLOW_LABEL[property.workflow_status] ?? property.workflow_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => open(property)}
                      title="Abrir vistoria"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={!!editing}
        onOpenChange={(value) => {
          if (!value) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vistoria técnica {editing?.code}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <section className="rounded-md border bg-muted/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{editing.title || editing.address}</h3>
                    <p className="text-xs text-muted-foreground">
                      {[editing.address, editing.neighborhood, editing.city, editing.state]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!["awaiting_inspection_review", "ready_to_publish", "rejected"].includes(
                      editing?.workflow_status,
                    ) && (
                      <Button size="sm" onClick={save}>
                        Salvar atendimento
                      </Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/properties/$id" params={{ id: editing.id }}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Abrir cadastro completo
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground">Proprietário:</span>{" "}
                    {editing.owner_name || editing.clients?.full_name || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Telefone:</span> {phone || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Parceiro indicador:</span>{" "}
                    {editing.capture_partners?.full_name || "Captação direta"}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground">Finalidade:</span>{" "}
                    {PURPOSE_LABEL[editing.listing_purpose] ?? editing.listing_purpose}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Venda proposta:</span>{" "}
                    {money(editing.sale_min_price)} a {money(editing.sale_max_price)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Aluguel proposto:</span>{" "}
                    {money(editing.rental_min_price)} a {money(editing.rental_max_price)}
                  </div>
                </div>
                {phone && (
                  <Button size="sm" variant="outline" className="mt-3" asChild>
                    <a
                      href={`https://wa.me/55${String(phone).replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir conversa no WhatsApp
                    </a>
                  </Button>
                )}
              </section>

              <section className="rounded-md border p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarClock className="h-4 w-4" />
                  Atendimento e agendamento
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Profissional responsável">
                    <Select
                      value={inspection.assigned_broker_id ?? "none"}
                      onValueChange={(value) =>
                        setInspection({ ...inspection, assigned_broker_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não atribuído</SelectItem>
                        {brokers.map((broker: any) => (
                          <SelectItem key={broker.id} value={broker.id}>
                            {broker.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Data e hora da vistoria">
                    <Input
                      type="datetime-local"
                      value={inspection.scheduled_at ?? ""}
                      onChange={(e) =>
                        setInspection({ ...inspection, scheduled_at: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Lembrete">
                    <Select
                      value={String(inspection.reminder_minutes ?? 60)}
                      onValueChange={(value) =>
                        setInspection({ ...inspection, reminder_minutes: Number(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REMINDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!inspection.scheduled_at}
                    asChild={!!inspection.scheduled_at}
                  >
                    {inspection.scheduled_at ? (
                      <a
                        href={googleCalendarUrl(editing, inspection)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <CalendarPlus className="mr-1.5 h-4 w-4" />
                        Google Agenda
                      </a>
                    ) : (
                      <span>Google Agenda</span>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!inspection.scheduled_at}
                    asChild={!!inspection.scheduled_at}
                  >
                    {inspection.scheduled_at ? (
                      <a
                        href={outlookCalendarUrl(editing, inspection)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="mr-1.5 h-4 w-4" />
                        Outlook
                      </a>
                    ) : (
                      <span>Outlook</span>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!inspection.scheduled_at}
                    onClick={() => downloadIcs(editing, inspection)}
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    Baixar .ics
                  </Button>
                </div>
                <div className="mt-3">
                  <Field label="Registros de contato">
                    <Textarea
                      rows={3}
                      value={inspection.contact_notes ?? ""}
                      onChange={(e) =>
                        setInspection({ ...inspection, contact_notes: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </section>

              <section className="rounded-md border p-4">
                <h3 className="mb-3 text-sm font-semibold">
                  Fotos do imóvel ({editing.property_images?.length ?? 0})
                </h3>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {(editing.property_images ?? []).map((image: any) => (
                    <div
                      key={image.id}
                      className="group relative aspect-square overflow-hidden rounded-md border"
                    >
                      <img src={image.image_url} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => deleteImage(image.id)}
                        className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                        title="Excluir foto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted">
                    <ImagePlus className="h-5 w-5" />
                    {uploading ? "Enviando..." : "Adicionar fotos"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        uploadImages(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-md border p-4">
                <Field label="Parecer técnico da vistoria">
                  <Textarea
                    rows={5}
                    value={inspection.technical_notes ?? ""}
                    onChange={(e) =>
                      setInspection({ ...inspection, technical_notes: e.target.value })
                    }
                  />
                </Field>
                {isAdmin && (
                  <div className="mt-3">
                    <Field label="Parecer administrativo final">
                      <Textarea
                        rows={3}
                        value={inspection.review_notes ?? ""}
                        onChange={(e) =>
                          setInspection({ ...inspection, review_notes: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                )}
              </section>
            </div>
          )}
          <DialogFooter className="mt-3 flex-wrap">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Fechar
            </Button>
            <Button variant="destructive" onClick={deleteInspection}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Excluir vistoria
            </Button>
            {isAdmin && editing?.workflow_status === "awaiting_inspection_review" && (
              <Button variant="destructive" onClick={() => review(false)}>
                <XCircle className="mr-1.5 h-4 w-4" />
                Reprovar
              </Button>
            )}
            {isAdmin && editing?.workflow_status === "awaiting_inspection_review" && (
              <Button onClick={() => review(true)}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Aprovar para divulgação
              </Button>
            )}
            {!["awaiting_inspection_review", "ready_to_publish", "rejected"].includes(
              editing?.workflow_status,
            ) && (
              <Button variant="outline" onClick={save}>
                Salvar atendimento
              </Button>
            )}
            {!["awaiting_inspection_review", "ready_to_publish", "rejected"].includes(
              editing?.workflow_status,
            ) && <Button onClick={completeInspection}>Concluir vistoria</Button>}
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
