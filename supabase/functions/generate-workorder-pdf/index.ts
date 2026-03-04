import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetchJpegLogo, logoDisplaySize, type LogoData } from "../_shared/pdf-logo.ts";

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

    const { work_order_id } = await req.json();
    if (!work_order_id) {
      return new Response(JSON.stringify({ error: "work_order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wo, error } = await supabase
      .from("work_orders")
      .select("*, customers(name, address, city, postal_code, email, phone, contact_person), services(name, price, category)")
      .eq("id", work_order_id)
      .maybeSingle();

    if (error || !wo) {
      return new Response(
        JSON.stringify({ error: error?.message || "Work order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load company info + logo
    const companyId = wo.company_id;
    let company: any = null;
    let logoData: LogoData | null = null;
    if (companyId) {
      const { data: c } = await supabase
        .from("companies")
        .select("name, address, postal_code, city, phone, kvk_number, btw_number, logo_url")
        .eq("id", companyId)
        .single();
      company = c;
      if (c?.logo_url) {
        logoData = await fetchJpegLogo(c.logo_url);
      }
    }
    if (!company) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, company_address, company_postal_code, company_city, company_phone, kvk_number, btw_number")
        .eq("id", user.id)
        .single();
      company = profile ? {
        name: profile.company_name,
        address: profile.company_address,
        postal_code: profile.company_postal_code,
        city: profile.company_city,
        phone: profile.company_phone,
        kvk_number: profile.kvk_number,
        btw_number: profile.btw_number,
      } : null;
    }

    const customer = wo.customers as any;
    const service = wo.services as any;
    const checklist: { label: string; checked: boolean }[] = Array.isArray(wo.checklist) ? wo.checklist : [];
    const notes: { text: string; created_at: string }[] = Array.isArray(wo.notes) ? wo.notes : [];

    const servicePrice = service?.price ?? 0;
    const travelCost = wo.travel_cost ?? 0;
    const totalIncl = wo.total_amount ?? (servicePrice + travelCost);
    const subtotalExcl = totalIncl / 1.21;
    const vatAmount = totalIncl - subtotalExcl;

    const woNumber = wo.work_order_number ?? "—";
    const createdAt = new Date(wo.created_at).toLocaleDateString("nl-NL");
    const completedAt = wo.completed_at
      ? new Date(wo.completed_at).toLocaleDateString("nl-NL")
      : null;

    const pdf = buildPdf({
      woNumber,
      createdAt,
      completedAt,
      status: wo.status,
      customerName: customer?.name ?? "—",
      customerAddress: customer?.address ?? "",
      customerPostalCity: [customer?.postal_code, customer?.city].filter(Boolean).join(" "),
      customerPhone: customer?.phone ?? "",
      customerEmail: customer?.email ?? "",
      serviceName: service?.name ?? "Dienst",
      servicePrice,
      travelCost,
      subtotalExcl,
      vatAmount,
      totalIncl,
      description: wo.description ?? "",
      checklist,
      notes,
      remarks: wo.remarks ?? "",
      signedBy: wo.signed_by ?? "",
      signedAt: wo.signed_at ? new Date(wo.signed_at).toLocaleDateString("nl-NL") : "",
      companyName: company?.name ?? "Vakflow",
      companyAddress: company?.address ?? "",
      companyPostalCity: [company?.postal_code, company?.city].filter(Boolean).join(" "),
      companyPhone: company?.phone ?? "",
      kvkNumber: company?.kvk_number ?? "",
      btwNumber: company?.btw_number ?? "",
      logo: logoData,
    });

    return new Response(pdf as unknown as BodyInit, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Werkbon_${woNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("generate-workorder-pdf error:", err);
    try {
      const { createClient: cc } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
      const admin = cc(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { logEdgeFunctionError: log } = await import("../_shared/error-logger.ts");
      await log(admin as any, "generate-workorder-pdf", (err as Error).message, {});
    } catch {}
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ---- Minimal PDF generator ----

interface WoData {
  woNumber: string;
  createdAt: string;
  completedAt: string | null;
  status: string;
  customerName: string;
  customerAddress: string;
  customerPostalCity: string;
  customerPhone: string;
  customerEmail: string;
  serviceName: string;
  servicePrice: number;
  travelCost: number;
  subtotalExcl: number;
  vatAmount: number;
  totalIncl: number;
  description: string;
  checklist: { label: string; checked: boolean }[];
  notes: { text: string; created_at: string }[];
  remarks: string;
  signedBy: string;
  signedAt: string;
  companyName: string;
  companyAddress: string;
  companyPostalCity: string;
  companyPhone: string;
  kvkNumber: string;
  btwNumber: string;
  logo: LogoData | null;
}

function eur(n: number): string {
  return `\u20AC ${n.toFixed(2)}`;
}

function buildPdf(data: WoData): Uint8Array {
  const hasLogo = !!data.logo;
  const totalObjects = hasLogo ? 7 : 6;

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

  let off7 = 0;
  if (hasLogo && data.logo) {
    off7 = startObj(7);
    addLine(`<< /Type /XObject /Subtype /Image /Width ${data.logo.width} /Height ${data.logo.height} /ColorSpace /${data.logo.colorSpace} /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${data.logo.streamLength} >>`);
    addLine("stream");
    addLine(data.logo.hexStream);
    addLine("endstream");
    addLine("endobj");
  }

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

  function line(x1: number, y1: number, x2: number, y2: number, gray = 0.8) {
    contentLines.push(`${gray} ${gray} ${gray} RG 0.5 w ${x1} ${pageH - y1} m ${x2} ${pageH - y2} l S`);
  }

  function rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    contentLines.push(`${r} ${g} ${b} rg ${x} ${pageH - y} ${w} ${-h} re f`);
    contentLines.push("0 0 0 rg");
  }

  // Header — logo or company name
  if (hasLogo && data.logo) {
    const { dw, dh } = logoDisplaySize(data.logo);
    contentLines.push(`q ${dw} 0 0 ${dh} ${margin} ${pageH - 40 - dh} cm /Im1 Do Q`);
    text(margin, 75, "W E R K B O N", 12, true);
  } else {
    text(margin, 55, data.companyName.toUpperCase(), 18, true);
    text(margin, 75, "W E R K B O N", 12, true);
  }

  // Meta info (right)
  const rx = pageW - margin;
  textRight(rx, 55, `Werkbon: ${data.woNumber}`, 9, true);
  textRight(rx, 70, `Datum: ${data.createdAt}`, 9);
  if (data.completedAt) {
    textRight(rx, 85, `Afgerond: ${data.completedAt}`, 9);
  }
  const statusLabels: Record<string, string> = { open: "Open", bezig: "Bezig", afgerond: "Afgerond" };
  textRight(rx, data.completedAt ? 100 : 85, `Status: ${statusLabels[data.status] ?? data.status}`, 9);

  // Customer info
  let cy = 120;
  text(margin, cy, "Klantgegevens:", 9, true); cy += 15;
  text(margin, cy, data.customerName, 10); cy += 14;
  if (data.customerAddress) { text(margin, cy, data.customerAddress, 9); cy += 13; }
  if (data.customerPostalCity) { text(margin, cy, data.customerPostalCity, 9); cy += 13; }
  if (data.customerPhone) { text(margin, cy, `Tel: ${data.customerPhone}`, 9); cy += 13; }
  if (data.customerEmail) { text(margin, cy, data.customerEmail, 9); cy += 13; }

  // Service info
  cy += 5;
  line(margin, cy, pageW - margin, cy, 0.85);
  cy += 15;
  text(margin, cy, "Dienst & tarieven:", 9, true); cy += 15;
  text(margin, cy, data.serviceName, 9);
  textRight(rx, cy, eur(data.servicePrice), 9); cy += 14;
  text(margin, cy, "Voorrijkosten", 9);
  textRight(rx, cy, eur(data.travelCost), 9); cy += 14;
  line(margin, cy, pageW - margin, cy, 0.9); cy += 5;
  text(margin, cy + 8, "Subtotaal (excl. BTW)", 9);
  textRight(rx, cy + 8, eur(data.subtotalExcl), 9); cy += 20;
  text(margin, cy, "BTW 21%", 9);
  textRight(rx, cy, eur(data.vatAmount), 9); cy += 14;
  line(margin, cy, pageW - margin, cy, 0.5); cy += 5;
  text(margin, cy + 8, "Totaal (incl. BTW)", 11, true);
  textRight(rx, cy + 8, eur(data.totalIncl), 11, true); cy += 25;

  // Description
  if (data.description) {
    line(margin, cy, pageW - margin, cy, 0.85); cy += 15;
    text(margin, cy, "Werkzaamheden:", 9, true); cy += 15;
    const descLines = wrapText(data.description, 90);
    for (const dl of descLines) {
      if (cy > pageH - 80) break;
      text(margin, cy, dl, 9); cy += 13;
    }
  }

  // Checklist
  if (data.checklist.length > 0) {
    cy += 5;
    line(margin, cy, pageW - margin, cy, 0.85); cy += 15;
    text(margin, cy, "Checklist:", 9, true); cy += 15;
    for (const item of data.checklist) {
      if (cy > pageH - 80) break;
      text(margin, cy, `[${item.checked ? "x" : " "}] ${item.label}`, 9); cy += 14;
    }
  }

  // Notes
  if (data.notes.length > 0 || data.remarks) {
    cy += 5;
    line(margin, cy, pageW - margin, cy, 0.85); cy += 15;
    text(margin, cy, "Opmerkingen:", 9, true); cy += 15;
    if (data.remarks && data.notes.length === 0) {
      const remarkLines = wrapText(data.remarks, 90);
      for (const rl of remarkLines) {
        if (cy > pageH - 80) break;
        text(margin, cy, rl, 9); cy += 13;
      }
    }
    for (const note of data.notes) {
      if (cy > pageH - 80) break;
      const dateStr = new Date(note.created_at).toLocaleDateString("nl-NL");
      text(margin, cy, `${dateStr}: ${note.text}`, 9); cy += 14;
    }
  }

  // Signature
  if (data.signedBy) {
    cy += 5;
    line(margin, cy, pageW - margin, cy, 0.85); cy += 15;
    text(margin, cy, "Handtekening klant:", 9, true); cy += 15;
    text(margin, cy, `${data.signedBy}${data.signedAt ? ` — ${data.signedAt}` : ""}`, 9);
    cy += 14;
  }

  // Footer
  const footY = pageH - margin - 30;
  rect(margin, footY, pageW - margin * 2, 25, 0.95, 0.96, 0.97);
  const fc1 = margin + 10;
  text(fc1, footY + 16, `${data.companyName} | KvK: ${data.kvkNumber} | BTW: ${data.btwNumber}`, 7);
  text(fc1 + 300, footY + 16, `${data.companyAddress} ${data.companyPostalCity}`, 7);

  const streamContent = contentLines.join("\n");
  const streamBytes = new TextEncoder().encode(streamContent);

  const off6 = startObj(6);
  addLine(`<< /Length ${streamBytes.length} >>`);
  addLine("stream");
  addLine(streamContent);
  addLine("endstream");
  addLine("endobj");

  const xobjRef = hasLogo ? " /XObject << /Im1 7 0 R >>" : "";
  const off3 = startObj(3);
  addLine(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >>${xobjRef} >> >>`
  );
  addLine("endobj");

  const xrefOffset = currentOffset;
  addLine("xref");
  addLine(`0 ${totalObjects + 1}`);
  addLine("0000000000 65535 f ");
  const offsets = [0, off1, off2, off3, off4, off5, off6];
  if (hasLogo) offsets.push(off7);
  for (let i = 1; i <= totalObjects; i++) {
    addLine(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }

  addLine("trailer");
  addLine(`<< /Size ${totalObjects + 1} /Root 1 0 R >>`);
  addLine("startxref");
  addLine(String(xrefOffset));
  addLine("%%EOF");

  return new TextEncoder().encode(lines.join("\n"));
}

function wrapText(str: string, maxChars: number): string[] {
  const result: string[] = [];
  for (const line of str.split("\n")) {
    if (line.length <= maxChars) { result.push(line); continue; }
    let remaining = line;
    while (remaining.length > maxChars) {
      const idx = remaining.lastIndexOf(" ", maxChars);
      const cut = idx > 20 ? idx : maxChars;
      result.push(remaining.substring(0, cut));
      remaining = remaining.substring(cut).trimStart();
    }
    if (remaining) result.push(remaining);
  }
  return result;
}