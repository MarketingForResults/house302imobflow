import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";
import logoUrl from "@/assets/logo-house302.png";

let cachedLogo: string | null = null;
async function loadLogo(): Promise<string> {
  if (cachedLogo) return cachedLogo;
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  cachedLogo = await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
  return cachedLogo!;
}

function barcodeDataUrl(text: string): string {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, text, {
    format: "CODE128",
    displayValue: false,
    height: 40,
    margin: 0,
    width: 1.6,
  });
  return canvas.toDataURL("image/png");
}

export interface DocPdfOptions {
  code: string;            // contract code (DOC-2026-00001)
  locator: string;         // property code (IMB-00001) — used in barcode
  title: string;
  bodyText: string;
  parties?: { label: string; name: string; doc?: string }[];
  footerNote?: string;
}

export async function generateDocumentPdf(opts: DocPdfOptions): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;

  // ===== HEADER =====
  const logo = await loadLogo();
  doc.addImage(logo, "PNG", margin, 12, 32, 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(opts.title.toUpperCase(), pageW / 2, 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Contrato Nº ${opts.code}`, pageW / 2, 23, { align: "center" });
  doc.text(`Localizador: ${opts.locator}`, pageW / 2, 27, { align: "center" });

  // Barcode top-right
  const bc = barcodeDataUrl(opts.locator);
  doc.addImage(bc, "PNG", pageW - margin - 38, 12, 38, 12);

  doc.setDrawColor(180);
  doc.line(margin, 32, pageW - margin, 32);

  // ===== BODY =====
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const bodyLines = doc.splitTextToSize(opts.bodyText || "", pageW - margin * 2);
  let y = 40;
  const lineH = 5;
  for (const line of bodyLines) {
    if (y > pageH - 50) {
      doc.addPage();
      y = 25;
    }
    doc.text(line, margin, y);
    y += lineH;
  }

  // ===== PARTIES / SIGNATURE =====
  if (opts.parties && opts.parties.length) {
    if (y > pageH - 70) { doc.addPage(); y = 25; }
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("PARTES E ASSINATURAS", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    for (const p of opts.parties) {
      if (y > pageH - 30) { doc.addPage(); y = 25; }
      doc.line(margin, y + 8, margin + 80, y + 8);
      doc.setFontSize(8);
      doc.text(`${p.label}: ${p.name}${p.doc ? `  •  ${p.doc}` : ""}`, margin, y + 12);
      doc.setFontSize(10);
      y += 18;
    }
  }

  // ===== FOOTER =====
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `${opts.footerNote ?? "Documento gerado por House302 ImobiFlow"} • ${new Date().toLocaleString("pt-BR")} • Página ${i}/${total}`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
    doc.setTextColor(0);
  }

  return doc;
}

// Helper for short reports/lists
export async function newReportPdf(title: string): Promise<{ doc: jsPDF; cursorY: number }> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();
  doc.addImage(logo, "PNG", 18, 12, 32, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, pageW / 2, 20, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, pageW - 18, 20, { align: "right" });
  doc.setDrawColor(180);
  doc.line(18, 28, pageW - 18, 28);
  return { doc, cursorY: 36 };
}
