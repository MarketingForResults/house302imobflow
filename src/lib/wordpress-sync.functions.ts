import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SyncSchema = z.object({
  propertyId: z.string().uuid(),
  wpUrl: z.string().url(),
  apiKey: z.string().min(8),
});

export const syncPropertyToWordPress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SyncSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Verifica se o usuário é staff
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isStaff = (roles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (!isStaff) throw new Error("Acesso negado");

    // Busca o imóvel completo
    const { data: prop, error } = await supabaseAdmin
      .from("properties")
      .select("*, property_images(image_url, is_cover, sort_order), brokers(full_name)")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (error || !prop) throw new Error("Imóvel não encontrado");

    const payload = {
      code: prop.code,
      title: prop.title,
      description: prop.description,
      type: prop.type,
      status: prop.status,
      price: prop.price,
      area_m2: prop.area_m2,
      bedrooms: prop.bedrooms,
      bathrooms: prop.bathrooms,
      suites: prop.suites,
      parking_spaces: prop.parking_spaces,
      furnished: prop.furnished,
      planned_furniture: prop.planned_furniture,
      financed: prop.financed,
      accepts_trade: prop.accepts_trade,
      exclusive: prop.exclusive,
      state: prop.state,
      city: prop.city,
      neighborhood: prop.neighborhood,
      address: prop.address,
      latitude: prop.latitude,
      longitude: prop.longitude,
      video_url: prop.video_url,
      tour_url: prop.tour_url,
      broker_name: prop.brokers?.full_name ?? null,
      images: (prop.property_images ?? [])
        .sort((a: any, b: any) => Number(b.is_cover) - Number(a.is_cover))
        .map((i: any) => i.image_url),
      wp_post_id: prop.wp_post_id ?? null,
    };

    const url = `${data.wpUrl.replace(/\/$/, "")}/wp-json/imobiflow/v1/properties`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.apiKey}` },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    if (res.ok && body?.id) {
      await supabaseAdmin
        .from("properties")
        .update({
          wp_post_id: body.id,
          wp_synced_at: new Date().toISOString(),
        })
        .eq("id", prop.id);
    }

    await supabaseAdmin.from("wp_sync_logs").insert({
      property_id: prop.id,
      action: "sync",
      success: res.ok,
      status_code: res.status,
      message: typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500),
      payload: payload as any,
    });

    if (!res.ok)
      throw new Error(
        `WordPress retornou ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
      );
    return { ok: true, wpPostId: body.id };
  });
