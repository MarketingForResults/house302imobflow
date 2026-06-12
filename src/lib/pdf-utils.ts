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
  code: string; // contract code (DOC-2026-00001)
  locator: string; // property code (IMB-00001) — used in barcode
  title: string;
  bodyText: string;
  bodyHtml?: string;
  parties?: { label: string; name: string; doc?: string }[];
  footerNote?: string;
}

type TextAlign = "left" | "center" | "right" | "justify";

type InlineStyle = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number;
};

type InlineRun = InlineStyle & {
  text: string;
};

type RichTextBlock = {
  runs: InlineRun[];
  align: TextAlign;
  before: number;
  after: number;
  imageSrc?: string;
  imageAlt?: string;
  tableRows?: string[][];
};

function fontStyleName(run: InlineStyle) {
  if (run.bold && run.italic) return "bolditalic";
  if (run.bold) return "bold";
  if (run.italic) return "italic";
  return "normal";
}

function applyTextStyle(doc: jsPDF, run: InlineStyle) {
  doc.setFont("helvetica", fontStyleName(run));
  doc.setFontSize(run.fontSize);
}

function isBoldWeight(fontWeight: string) {
  return fontWeight === "bold" || fontWeight === "bolder" || Number.parseInt(fontWeight, 10) >= 600;
}

function textAlignFromElement(element: Element): TextAlign {
  const align = (element as HTMLElement).style.textAlign;
  return ["center", "right", "justify"].includes(align) ? (align as TextAlign) : "left";
}

function collectInlineRuns(node: Node, inherited: InlineStyle): InlineRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [{ ...inherited, text: node.textContent ?? "" }];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const element = node as HTMLElement;
  if (element.tagName === "BR") return [{ ...inherited, text: "\n" }];

  const style: InlineStyle = {
    ...inherited,
    bold:
      inherited.bold ||
      ["B", "STRONG"].includes(element.tagName) ||
      isBoldWeight(element.style.fontWeight),
    italic:
      inherited.italic ||
      ["I", "EM"].includes(element.tagName) ||
      element.style.fontStyle === "italic",
    underline:
      inherited.underline ||
      element.tagName === "U" ||
      (element.style.textDecorationLine || element.style.textDecoration).includes("underline"),
    fontSize:
      element.tagName === "H1"
        ? 16
        : element.tagName === "H2"
          ? 14
          : element.tagName === "H3"
            ? 12
            : inherited.fontSize,
  };

  return Array.from(element.childNodes).flatMap((child) => collectInlineRuns(child, style));
}

function blockFromElement(element: Element, prefix = ""): RichTextBlock {
  const tag = element.tagName;
  const heading = ["H1", "H2", "H3", "H4"].includes(tag);
  const baseStyle: InlineStyle = {
    bold: heading,
    italic: false,
    underline: false,
    fontSize: tag === "H1" ? 16 : tag === "H2" ? 14 : tag === "H3" || tag === "H4" ? 12 : 10,
  };
  const runs = collectInlineRuns(element, baseStyle);
  if (prefix) runs.unshift({ ...baseStyle, text: prefix });
  return {
    runs,
    align: textAlignFromElement(element),
    before: heading ? 3 : 0,
    after: heading ? 3 : tag === "LI" ? 1.5 : 2,
  };
}

function richTextBlocksFromHtml(html: string): RichTextBlock[] {
  const container = document.createElement("div");
  container.innerHTML = html;
  const blocks: RichTextBlock[] = [];
  const defaultStyle: InlineStyle = { bold: false, italic: false, underline: false, fontSize: 10 };

  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").trim();
      if (text)
        blocks.push({ runs: [{ ...defaultStyle, text }], align: "left", before: 0, after: 2 });
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const element = node as Element;
    if (element.tagName === "BR") {
      blocks.push({ runs: [], align: "left", before: 0, after: 4 });
      continue;
    }
    if (["UL", "OL"].includes(element.tagName)) {
      Array.from(element.children).forEach((item, index) => {
        if (item.tagName === "LI") {
          blocks.push(blockFromElement(item, element.tagName === "OL" ? `${index + 1}. ` : "- "));
        }
      });
      continue;
    }
    if (element.tagName === "IMG") {
      blocks.push({
        runs: [],
        align: "center",
        before: 2,
        after: 3,
        imageSrc: (element as HTMLImageElement).src,
        imageAlt: (element as HTMLImageElement).alt,
      });
      continue;
    }
    if (element.tagName === "TABLE") {
      const rows = Array.from(element.querySelectorAll("tr")).map((row) =>
        Array.from(row.querySelectorAll("th,td")).map((cell) => (cell.textContent ?? "").trim()),
      );
      blocks.push({ runs: [], align: "left", before: 2, after: 4, tableRows: rows });
      continue;
    }
    blocks.push(blockFromElement(element));
  }

  return blocks;
}

function runWidth(doc: jsPDF, run: InlineRun) {
  applyTextStyle(doc, run);
  return doc.getTextWidth(run.text);
}

function wrapRuns(doc: jsPDF, runs: InlineRun[], maxWidth: number): InlineRun[][] {
  const lines: InlineRun[][] = [];
  let current: InlineRun[] = [];
  let width = 0;

  const pushLine = () => {
    lines.push(current);
    current = [];
    width = 0;
  };

  for (const run of runs) {
    const parts = run.text.split(/(\n|\s+|[^\s\n]+)/g).filter(Boolean);
    for (const part of parts) {
      if (part === "\n") {
        pushLine();
        continue;
      }
      const token: InlineRun = { ...run, text: part };
      const tokenWidth = runWidth(doc, token);
      const isOnlySpace = /^\s+$/.test(part);
      if (!isOnlySpace && width + tokenWidth > maxWidth && current.length > 0) pushLine();
      if (current.length === 0 && isOnlySpace) continue;
      current.push(token);
      width += tokenWidth;
    }
  }

  if (current.length > 0) lines.push(current);
  return lines;
}

function drawRunLine(
  doc: jsPDF,
  line: InlineRun[],
  x: number,
  y: number,
  maxWidth: number,
  align: TextAlign,
) {
  const lineWidth = line.reduce((sum, run) => sum + runWidth(doc, run), 0);
  const startX =
    align === "center"
      ? x + (maxWidth - lineWidth) / 2
      : align === "right"
        ? x + maxWidth - lineWidth
        : x;
  let cursorX = startX;

  for (const run of line) {
    applyTextStyle(doc, run);
    doc.text(run.text, cursorX, y);
    const width = doc.getTextWidth(run.text);
    if (run.underline && run.text.trim()) {
      doc.setLineWidth(0.1);
      doc.line(cursorX, y + 0.8, cursorX + width, y + 0.8);
    }
    cursorX += width;
  }
}

function renderRichTextBody(
  doc: jsPDF,
  html: string,
  startY: number,
  margin: number,
  pageW: number,
  pageH: number,
) {
  let y = startY;
  const maxWidth = pageW - margin * 2;
  const ensurePage = (height = 5) => {
    if (y + height > pageH - 50) {
      doc.addPage();
      y = 25;
    }
  };

  for (const block of richTextBlocksFromHtml(html)) {
    y += block.before;
    if (block.imageSrc) {
      ensurePage(45);
      try {
        const format = block.imageSrc.startsWith("data:image/png") ? "PNG" : "JPEG";
        const width = Math.min(120, maxWidth);
        doc.addImage(block.imageSrc, format, margin, y, width, 45);
        y += 45;
      } catch {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text(block.imageAlt ? `[Imagem: ${block.imageAlt}]` : "[Imagem]", margin, y);
        y += 6;
      }
      y += block.after;
      continue;
    }
    if (block.tableRows?.length) {
      const columns = Math.max(...block.tableRows.map((row) => row.length), 1);
      const cellW = maxWidth / columns;
      const cellH = 8;
      for (const row of block.tableRows) {
        ensurePage(cellH);
        row.forEach((cell, index) => {
          const cellX = margin + index * cellW;
          doc.rect(cellX, y - 4.8, cellW, cellH);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(doc.splitTextToSize(cell, cellW - 3), cellX + 1.5, y, { maxWidth: cellW - 3 });
        });
        y += cellH;
      }
      y += block.after;
      continue;
    }
    if (block.runs.length === 0) {
      y += block.after;
      continue;
    }

    const lines = wrapRuns(doc, block.runs, maxWidth);
    for (const line of lines) {
      if (line.length === 0) {
        ensurePage(4.5);
        y += 4.5;
        continue;
      }
      const fontSize = Math.max(...line.map((run) => run.fontSize), 10);
      const lineH = Math.max(4.5, fontSize * 0.48);
      ensurePage(lineH);
      drawRunLine(doc, line, margin, y, maxWidth, block.align);
      y += lineH;
    }
    y += block.after;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return y;
}

function renderPlainTextBody(
  doc: jsPDF,
  bodyText: string,
  startY: number,
  margin: number,
  pageW: number,
  pageH: number,
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const bodyLines = doc.splitTextToSize(bodyText || "", pageW - margin * 2);
  let y = startY;
  const lineH = 5;
  for (const line of bodyLines) {
    if (y > pageH - 50) {
      doc.addPage();
      y = 25;
    }
    doc.text(line, margin, y);
    y += lineH;
  }
  return y;
}

export async function generateDocumentPdf(opts: DocPdfOptions): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;

  // ===== HEADER =====
  const logo = await loadLogo();
  // Logo 1920x220 → preserve aspect ratio (~8.73:1)
  doc.addImage(logo, "PNG", margin, 12, 40, 4.58);

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
  let y =
    opts.bodyHtml && /<[a-z][\s\S]*>/i.test(opts.bodyHtml)
      ? renderRichTextBody(doc, opts.bodyHtml, 40, margin, pageW, pageH)
      : renderPlainTextBody(doc, opts.bodyText, 40, margin, pageW, pageH);

  // ===== PARTIES / SIGNATURE =====
  if (opts.parties && opts.parties.length) {
    if (y > pageH - 70) {
      doc.addPage();
      y = 25;
    }
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("PARTES E ASSINATURAS", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    for (const p of opts.parties) {
      if (y > pageH - 30) {
        doc.addPage();
        y = 25;
      }
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
      { align: "center" },
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
  doc.addImage(logo, "PNG", 18, 12, 40, 4.58);
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
