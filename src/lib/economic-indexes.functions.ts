import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// BCB SGS series codes
const SERIES = [
  { code: "IPCA", sgs: 433, name: "IPCA (IBGE)", source: "https://www.ibge.gov.br/explica/inflacao.php" },
  { code: "IGPM", sgs: 189, name: "IGP-M (FGV)", source: "https://portalibre.fgv.br/igp" },
  { code: "INCC", sgs: 192, name: "INCC-M (FGV)", source: "https://portalibre.fgv.br/incc" },
  { code: "IVAR", sgs: 27865, name: "IVAR (FGV)", source: "https://portalibre.fgv.br/ivar" },
] as const;

async function fetchSeries(sgs: number): Promise<{ data: string; valor: string }[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${sgs}/dados/ultimos/13?formato=json`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`BCB SGS ${sgs}: ${res.status}`);
  return res.json();
}

function parseDate(d: string) {
  // BCB returns "DD/MM/YYYY"
  const [dd, mm, yyyy] = d.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

export const refreshEconomicIndexes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const results: any[] = [];
    for (const s of SERIES) {
      try {
        const rows = await fetchSeries(s.sgs);
        if (!rows.length) continue;
        const last12 = rows.slice(-12);
        const acc = last12.reduce((a, r) => a * (1 + Number(r.valor) / 100), 1) - 1;
        const last = rows[rows.length - 1];
        const refMonth = parseDate(last.data);
        await supabaseAdmin.from("economic_indexes").upsert({
          code: s.code,
          name: s.name,
          reference_month: refMonth,
          monthly_value: Number(last.valor),
          accumulated_12m: Number((acc * 100).toFixed(4)),
          source_url: s.source,
          fetched_at: new Date().toISOString(),
        });
        results.push({ code: s.code, ok: true, refMonth, monthly: Number(last.valor), acc12: Number((acc * 100).toFixed(2)) });
      } catch (e: any) {
        results.push({ code: s.code, ok: false, error: e.message });
      }
    }
    return { results };
  });
