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

    const { quote_id } = await req.json();
    if (!quote_id) {
      return new Response(JSON.stringify({ error: "quote_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: quote, error } = await supabase
      .from("quotes")
      .select("*, customers(name, address, city, postal_code, email)")
      .eq("id", quote_id)
      .maybeSingle();

    if (error || !quote) {
      return new Response(
        JSON.stringify({ error: error?.message || "Quote not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customer = quote.customers as any;
    const items = Array.isArray(quote.items) ? quote.items : [];
    const optionalItems = Array.isArray(quote.optional_items) ? quote.optional_items : [];

    const pdf = buildPdf({
      quoteNumber: quote.quote_number ?? "—",
      issuedAt: quote.issued_at ? new Date(quote.issued_at).toLocaleDateString("nl-NL") : "—",
      customerName: customer?.name ?? "—",
      customerAddress: customer?.address ?? "",
      customerPostalCity: [customer?.postal_code, customer?.city].filter(Boolean).join(" "),
      items,
      optionalItems,
      subtotal: Number(quote.subtotal),
      vatPct: Number(quote.vat_percentage),
      vatAmount: Number(quote.vat_amount),
      total: Number(quote.total),
    });

    return new Response(pdf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Offerte_${quote.quote_number ?? quote.id}.pdf"`,
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

interface QuoteLineItem {
  description: string;
  qty: number;
  unit_price: number;
  total: number;
}

interface QuoteOptionalItem {
  description: string;
  price: number;
}

interface QuoteData {
  quoteNumber: string;
  issuedAt: string;
  customerName: string;
  customerAddress: string;
  customerPostalCity: string;
  items: QuoteLineItem[];
  optionalItems: QuoteOptionalItem[];
  subtotal: number;
  vatPct: number;
  vatAmount: number;
  total: number;
}

function eur(n: number): string {
  return `\\u20AC ${n.toFixed(2)}`;
}

function buildPdf(data: QuoteData): Uint8Array {
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

  const pageW = 595;
  const pageH = 842;
  const margin = 50;
  const contentLines: string[] = [];

  function escPdf(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\u20AC/g, "\\200");
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

  // Customer info & quote meta
  const infoY = 120;
  text(margin, infoY, "Offerte aan:", 9, true);
  let cy = infoY + 15;
  text(margin, cy, data.customerName, 10); cy += 14;
  if (data.customerAddress) { text(margin, cy, data.customerAddress, 10); cy += 14; }
  if (data.customerPostalCity) { text(margin, cy, data.customerPostalCity, 10); cy += 14; }

  const rx = pageW - margin;
  textRight(rx, infoY, `offerte nr. ${data.quoteNumber}`, 9, true);
  textRight(rx, infoY + 15, data.issuedAt, 9);

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
  for (const item of data.items) {
    text(col1X, rowY + 15, (item.description || "").toUpperCase(), 9);
    textCenter(col2X + 30, rowY + 15, String(item.qty), 9);
    textCenter(col3X + 40, rowY + 15, eur(item.unit_price), 9);
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
  text(fc1, ftY + 13, "Naam rekening: MV Solutions", 7);
  text(fc1, ftY + 24, "NL95 INGB 0111 7593 82", 7);

  text(fc2, ftY, "MV Solutions", 8, true);
  text(fc2, ftY + 13, "KvK: 84448237", 7);
  text(fc2, ftY + 24, "Btw: NL003986995B37", 7);

  text(fc3, ftY, "Adres", 8, true);
  text(fc3, ftY + 13, "Graaf Willem II laan 34", 7);
  text(fc3, ftY + 24, "1964 JN Heemskerk", 7);

  // Validity text centered
  const bottomY = footY + footH + 18;
  const bottomText = "Deze offerte vervalt 14 dagen na offertedatum";
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
