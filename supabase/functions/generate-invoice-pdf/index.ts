import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(
        "*, customers(name, address, city, postal_code, email), work_orders(work_order_number)"
      )
      .eq("id", invoice_id)
      .maybeSingle();

    if (error || !invoice) {
      return new Response(
        JSON.stringify({ error: error?.message || "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customer = invoice.customers as any;
    const wo = invoice.work_orders as any;

    const invoiceNumber = invoice.invoice_number ?? "—";
    const issuedAt = invoice.issued_at
      ? new Date(invoice.issued_at).toLocaleDateString("nl-NL")
      : "—";
    const dueAt = invoice.due_at
      ? new Date(invoice.due_at).toLocaleDateString("nl-NL")
      : "—";
    const woNumber = wo?.work_order_number ?? "";

    // Build line items from the items JSON column
    const rawItems = (invoice.items as any[] | null) ?? [];
    const lineItems: { description: string; qty: number; unitPrice: number; total: number }[] =
      rawItems.map((item: any) => ({
        description: item.description ?? "Artikel",
        qty: Number(item.qty ?? 1),
        unitPrice: Number(item.unit_price ?? 0),
        total: Number(item.total ?? item.unit_price ?? 0),
      }));

    // Fallback: if no items stored, create a single line from totals
    if (lineItems.length === 0) {
      lineItems.push({
        description: "Dienst",
        qty: 1,
        unitPrice: Number(invoice.subtotal),
        total: Number(invoice.subtotal),
      });
    }

    // Build optional items from the optional_items JSON column
    const rawOptional = (invoice.optional_items as any[] | null) ?? [];
    const optionalItems: { description: string; price: number }[] =
      rawOptional.map((item: any) => ({
        description: item.description ?? "Optioneel",
        price: Number(item.price ?? 0),
      }));

    const subtotal = Number(invoice.subtotal);
    const vatPct = Number(invoice.vat_percentage);
    const vatAmount = Number(invoice.vat_amount);
    const total = Number(invoice.total);

    const pdf = buildPdf({
      invoiceNumber,
      issuedAt,
      dueAt,
      woNumber,
      customerName: customer?.name ?? "—",
      customerAddress: customer?.address ?? "",
      customerPostalCity: [customer?.postal_code, customer?.city]
        .filter(Boolean)
        .join(" "),
      customerEmail: customer?.email ?? "",
      lineItems,
      optionalItems,
      notes: invoice.notes ?? "",
      subtotal,
      vatPct,
      vatAmount,
      total,
    });

    return new Response(pdf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Factuur_${invoiceNumber}.pdf"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ---- Minimal PDF generator ----

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  issuedAt: string;
  dueAt: string;
  woNumber: string;
  customerName: string;
  customerAddress: string;
  customerPostalCity: string;
  customerEmail: string;
  lineItems: LineItem[];
  optionalItems: { description: string; price: number }[];
  notes: string;
  subtotal: number;
  vatPct: number;
  vatAmount: number;
  total: number;
}

function eur(n: number): string {
  return `\\u20AC ${n.toFixed(2)}`;
}

function buildPdf(data: InvoiceData): Uint8Array {
  const lines: string[] = [];
  let currentOffset = 0;

  function addLine(line: string) {
    lines.push(line);
    currentOffset += new TextEncoder().encode(line + "\n").length;
  }

  function startObj(id: number) {
    const pos = currentOffset;
    addLine(`${id} 0 obj`);
    return pos;
  }

  addLine("%PDF-1.4");

  const off1 = startObj(1);
  addLine("<< /Type /Catalog /Pages 2 0 R >>");
  addLine("endobj");

  const off2 = startObj(2);
  addLine("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  addLine("endobj");

  const off4 = startObj(4);
  addLine("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  addLine("endobj");

  const off5 = startObj(5);
  addLine("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  addLine("endobj");

  // Build page content
  const pageW = 595;
  const pageH = 842;
  const margin = 50;
  const contentLines: string[] = [];

  function escPdf(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\u20AC/g, "\\200"); // Euro sign in WinAnsi
  }

  function text(x: number, y: number, str: string, size = 10, bold = false) {
    const font = bold ? "/F2" : "/F1";
    contentLines.push(`BT ${font} ${size} Tf ${x} ${pageH - y} Td (${escPdf(str)}) Tj ET`);
  }

  function textRight(rightX: number, y: number, str: string, size = 10, bold = false) {
    const charW = size * 0.5;
    const w = str.length * charW;
    text(rightX - w, y, str, size, bold);
  }

  function textCenter(centerX: number, y: number, str: string, size = 10, bold = false) {
    const charW = size * 0.5;
    const w = str.length * charW;
    text(centerX - w / 2, y, str, size, bold);
  }

  function line(x1: number, y1: number, x2: number, y2: number, gray = 0.8) {
    contentLines.push(`${gray} ${gray} ${gray} RG 0.5 w ${x1} ${pageH - y1} m ${x2} ${pageH - y2} l S`);
  }

  function rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    contentLines.push(`${r} ${g} ${b} rg ${x} ${pageH - y} ${w} ${-h} re f`);
    contentLines.push("0 0 0 rg");
  }

  // Header - "M V  S O L U T I O N S"
  text(margin, 65, "M V   S O L U T I O N S", 20, true);

  // Customer info & invoice meta
  const infoY = 120;
  text(margin, infoY, "Factuur aan:", 9, true);
  let cy = infoY + 15;
  text(margin, cy, data.customerName, 10); cy += 14;
  if (data.customerAddress) { text(margin, cy, data.customerAddress, 10); cy += 14; }
  if (data.customerPostalCity) { text(margin, cy, data.customerPostalCity, 10); cy += 14; }
  if (data.customerEmail) { text(margin, cy, data.customerEmail, 9); cy += 14; }

  const rx = pageW - margin;
  textRight(rx, infoY, `Factuurnummer: ${data.invoiceNumber}`, 9, true);
  textRight(rx, infoY + 15, `Factuurdatum: ${data.issuedAt}`, 9);
  textRight(rx, infoY + 30, `Vervaldatum: ${data.dueAt}`, 9);
  if (data.woNumber) {
    textRight(rx, infoY + 45, `Werkbon: ${data.woNumber}`, 9);
  }

  // Table
  const tableY = Math.max(cy + 25, 200);
  const tableRight = pageW - margin;
  const col1X = margin + 5;
  const col2X = margin + (tableRight - margin) * 0.45;
  const col3X = margin + (tableRight - margin) * 0.60;
  const col4X = margin + (tableRight - margin) * 0.80;

  // Table header
  rect(margin, tableY, tableRight - margin, 22, 0.95, 0.96, 0.97);
  text(col1X, tableY + 15, "Artikel", 9, true);
  textCenter(col2X + 30, tableY + 15, "Hoeveelheid", 9, true);
  textCenter(col3X + 40, tableY + 15, "Prijs per eenheid", 9, true);
  textCenter(col4X + 30, tableY + 15, "Totaal", 9, true);

  let rowY = tableY + 22;
  for (const item of data.lineItems) {
    text(col1X, rowY + 15, (item.description || "").toUpperCase(), 9);
    textCenter(col2X + 30, rowY + 15, String(item.qty), 9);
    textCenter(col3X + 40, rowY + 15, eur(item.unitPrice), 9);
    textCenter(col4X + 30, rowY + 15, eur(item.total), 9);
    rowY += 22;
    line(margin, rowY, tableRight, rowY, 0.9);
  }

  // Middle section: optional left, totals right
  const midY = rowY + 30;

  // Optional items
  if (data.optionalItems.length > 0) {
    const optW = (tableRight - margin) * 0.48;
    rect(margin, midY, optW, 22, 0.95, 0.96, 0.97);
    text(margin + 10, midY + 15, "Optioneel", 9, true);
    textRight(margin + optW - 10, midY + 15, "Prijs", 9, true);

    let oy = midY + 22;
    for (const opt of data.optionalItems) {
      text(margin + 10, oy + 13, (opt.description || "").toUpperCase(), 7);
      textRight(margin + optW - 10, oy + 13, eur(opt.price), 7);
      oy += 20;
      line(margin, oy, margin + optW, oy, 0.9);
    }
  }

  // Notes section
  if (data.notes) {
    const notesStartY = data.optionalItems.length > 0
      ? midY + 22 + data.optionalItems.length * 20 + 15
      : midY;
    text(margin + 5, notesStartY, "Opmerkingen", 9, true);
    let ny = notesStartY + 15;
    const noteLines: string[] = [];
    for (const nl of data.notes.split("\n")) {
      if (nl.length <= 80) { noteLines.push(nl); continue; }
      let remaining = nl;
      while (remaining.length > 80) {
        const idx = remaining.lastIndexOf(" ", 80);
        const cut = idx > 20 ? idx : 80;
        noteLines.push(remaining.substring(0, cut));
        remaining = remaining.substring(cut).trimStart();
      }
      if (remaining) noteLines.push(remaining);
    }
    for (const nl of noteLines) {
      text(margin + 5, ny, nl, 9);
      ny += 14;
    }
  }

  // Totals
  const totX = margin + (tableRight - margin) * 0.62;
  const totValX = tableRight - 5;
  text(totX, midY + 5, "Subtotaal", 10, true);
  textRight(totValX, midY + 5, eur(data.subtotal), 10, true);
  text(totX, midY + 20, `Belasting (${data.vatPct}%)`, 10, true);
  textRight(totValX, midY + 20, eur(data.vatAmount), 10, true);
  line(totX, midY + 35, tableRight, midY + 35, 0.4);
  text(totX, midY + 52, "Totaal", 14, true);
  textRight(totValX, midY + 52, eur(data.total), 14, true);

  // Footer
  const footH = 65;
  const footY = pageH - margin - footH - 30;
  rect(margin, footY, tableRight - margin, footH, 0.95, 0.96, 0.97);

  const fc1 = margin + 10;
  const fc2 = margin + 180;
  const fc3 = margin + 360;
  const ftY = footY + 16;

  text(fc1, ftY, "Betalingsinformatie", 8, true);
  text(fc1, ftY + 13, "Naam rekening: Vakflow", 7);
  text(fc1, ftY + 24, "NL95 INGB 0111 7593 82", 7);

  text(fc2, ftY, "Vakflow", 8, true);
  text(fc2, ftY + 13, "KvK: 84448237", 7);
  text(fc2, ftY + 24, "Btw: NL003986995B37", 7);

  text(fc3, ftY, "Adres", 8, true);
  text(fc3, ftY + 13, "Graaf Willem II laan 34", 7);
  text(fc3, ftY + 24, "1964 JN Heemskerk", 7);

  // Bottom text
  const bottomY = footY + footH + 18;
  const bottomText = `Deze factuur vervalt op ${data.dueAt}`;
  textCenter(pageW / 2, bottomY, bottomText, 10, true);

  const streamContent = contentLines.join("\n");
  const streamBytes = new TextEncoder().encode(streamContent);

  const off6 = startObj(6);
  addLine(`<< /Length ${streamBytes.length} >>`);
  addLine("stream");
  addLine(streamContent);
  addLine("endstream");
  addLine("endobj");

  const off3 = startObj(3);
  addLine(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>`
  );
  addLine("endobj");

  const xrefOffset = currentOffset;
  addLine("xref");
  addLine("0 7");
  addLine("0000000000 65535 f ");
  const offsets = [0, off1, off2, off3, off4, off5, off6];
  for (let i = 1; i <= 6; i++) {
    addLine(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }

  addLine("trailer");
  addLine("<< /Size 7 /Root 1 0 R >>");
  addLine("startxref");
  addLine(String(xrefOffset));
  addLine("%%EOF");

  return new TextEncoder().encode(lines.join("\n"));
}
