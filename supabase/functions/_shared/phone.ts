// _shared/phone.ts — Telefoon normalisatie (Nederlandse nummers)

/**
 * Normaliseert een telefoonnummer naar internationaal formaat zonder + prefix.
 * Voorbeelden:
 *   "06 12345678"  → "31612345678"
 *   "+31612345678" → "31612345678"
 *   "0031612345678" → "31612345678"
 *   "316 12345678" → "31612345678"
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, "");
  if (cleaned.startsWith("06")) cleaned = "316" + cleaned.slice(2);
  if (cleaned.startsWith("00")) cleaned = cleaned.slice(2);
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  return cleaned;
}

/**
 * Zoekt een customer op telefoonnummer met Nederlandse varianten.
 * Probeert: exact, +prefix, 06-formaat.
 */
export async function findCustomerByPhone(
  supabase: any,
  phone: string,
  companyId?: string | null
): Promise<{ id: string } | null> {
  const normalized = normalizePhone(phone);

  // Valideer: alleen cijfers
  if (!/^\d+$/.test(normalized)) return null;

  const variants = [
    normalized,           // 31612345678
    `+${normalized}`,     // +31612345678
  ];

  // Voeg 06-formaat toe als het een NL mobiel nummer is
  if (normalized.startsWith("316")) {
    variants.push(`0${normalized.slice(2)}`); // 0612345678
  }

  for (const variant of variants) {
    let query = supabase
      .from("customers")
      .select("id")
      .eq("phone", variant)
      .limit(1);

    if (companyId) query = query.eq("company_id", companyId);

    const { data } = await query.maybeSingle();
    if (data) return data;
  }

  return null;
}