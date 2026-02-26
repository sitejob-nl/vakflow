/**
 * Generates an RTF invoice template with e-Boekhouden merge fields.
 * Matches the MV Solutions PDF invoice layout.
 */
export function generateInvoiceRtf(): string {
  // RTF uses twips: 1 inch = 1440 twips, 1 cm ≈ 567 twips
  // A4: 11906 x 16838 twips
  const rtf = String.raw`{\rtf1\ansi\ansicpg1252\deff0
{\fonttbl{\f0\fswiss\fcharset0 Helvetica;}{\f1\fswiss\fcharset0 Arial;}}
{\colortbl;\red0\green0\blue0;\red128\green128\blue128;\red240\green240\blue240;\red100\green100\blue100;}
\paperw11906\paperh16838\margl1134\margr1134\margt850\margb850
\viewkind4\uc1

\pard\qc\sb0\sa200
{\f0\b\fs40 M  V    S  O  L  U  T  I  O  N  S}
\par

\pard\brdrb\brdrs\brdrw10\brdrcf4\brsp40
\par

\pard\sb200\sa0
\trowd\trgaph108\trleft0
\clbrdrt\brdrnone\clbrdrb\brdrnone\clbrdrl\brdrnone\clbrdrr\brdrnone
\cellx4800
\clbrdrt\brdrnone\clbrdrb\brdrnone\clbrdrl\brdrnone\clbrdrr\brdrnone
\cellx9638
\pard\intbl\sb0\sa80
{\f0\b\fs18 Factuur aan:}\line
{\f0\fs20 [Bedrijf]}\line
{\f0\fs20 [Adres]}\line
{\f0\fs20 [Postcode] [Plaats]}\line
{\f0\fs18 [Email]}
\cell
\pard\intbl\qr\sb0\sa80
{\f0\fs18 Factuurnummer: [Factuurnummer]}\line
{\f0\fs18 Factuurdatum: [Factuurdatum]}\line
{\f0\fs18 Vervaldatum: [Vervaldatum]}
\cell
\row

\pard\sb400\sa100
\trowd\trgaph108\trleft0\trbrdrt\brdrs\brdrw5\trbrdrl\brdrs\brdrw5\trbrdrr\brdrs\brdrw5\trbrdrb\brdrs\brdrw5
\clcbpat3\clbrdrt\brdrs\brdrw5\clbrdrb\brdrs\brdrw5\clbrdrl\brdrs\brdrw5\clbrdrr\brdrs\brdrw5
\cellx3200
\clcbpat3\clbrdrt\brdrs\brdrw5\clbrdrb\brdrs\brdrw5\clbrdrl\brdrs\brdrw5\clbrdrr\brdrs\brdrw5
\cellx5000
\clcbpat3\clbrdrt\brdrs\brdrw5\clbrdrb\brdrs\brdrw5\clbrdrl\brdrs\brdrw5\clbrdrr\brdrs\brdrw5
\cellx7400
\clcbpat3\clbrdrt\brdrs\brdrw5\clbrdrb\brdrs\brdrw5\clbrdrl\brdrs\brdrw5\clbrdrr\brdrs\brdrw5
\cellx9638
\pard\intbl {\f0\b\fs18 Artikel}\cell
\pard\intbl {\f0\b\fs18 Hoeveelheid}\cell
\pard\intbl {\f0\b\fs18 Prijs per eenheid}\cell
\pard\intbl {\f0\b\fs18 Totaal}\cell
\row

\pard\sa100
[Regels]

\pard\sb200\sa0
\trowd\trgaph108\trleft4800
\clbrdrt\brdrnone\clbrdrb\brdrnone\clbrdrl\brdrnone\clbrdrr\brdrnone
\cellx7400
\clbrdrt\brdrnone\clbrdrb\brdrnone\clbrdrl\brdrnone\clbrdrr\brdrnone
\cellx9638
\pard\intbl {\f0\fs18 Subtotaal}\cell
\pard\intbl\qr {\f0\fs18 [TotaalExBTW]}\cell
\row
\trowd\trgaph108\trleft4800
\clbrdrt\brdrnone\clbrdrb\brdrnone\clbrdrl\brdrnone\clbrdrr\brdrnone
\cellx7400
\clbrdrt\brdrnone\clbrdrb\brdrnone\clbrdrl\brdrnone\clbrdrr\brdrnone
\cellx9638
\pard\intbl {\f0\fs18 BTW (21%)}\cell
\pard\intbl\qr {\f0\fs18 [BTWBedrag]}\cell
\row
\trowd\trgaph108\trleft4800
\clbrdrt\brdrs\brdrw10\clbrdrb\brdrnone\clbrdrl\brdrnone\clbrdrr\brdrnone
\cellx7400
\clbrdrt\brdrs\brdrw10\clbrdrb\brdrnone\clbrdrl\brdrnone\clbrdrr\brdrnone
\cellx9638
\pard\intbl {\f0\b\fs24 Totaal}\cell
\pard\intbl\qr {\f0\b\fs24 [TotaalInclBTW]}\cell
\row

\pard\sb600\sa0
\trowd\trgaph108\trleft0
\clcbpat3\clbrdrt\brdrnone\clbrdrb\brdrnone\clbrdrl\brdrnone\clbrdrr\brdrnone
\cellx3200
\clcbpat3\clbrdrt\brdrnone\clbrdrb\brdrnone\clbrdrl\brdrnone\clbrdrr\brdrnone
\cellx6400
\clcbpat3\clbrdrt\brdrnone\clbrdrb\brdrnone\clbrdrl\brdrnone\clbrdrr\brdrnone
\cellx9638
\pard\intbl\sb60\sa60
{\f0\b\fs16 Betalingsinformatie}\line
{\f0\fs14 Rekeningnaam: MV Solutions}\line
{\f0\fs14 IBAN: NL95 INGB 0111 7593 82}
\cell
\pard\intbl\sb60\sa60
{\f0\b\fs16 MV Solutions}\line
{\f0\fs14 KvK: 84448237}\line
{\f0\fs14 BTW: NL003986995B37}
\cell
\pard\intbl\sb60\sa60
{\f0\b\fs16 Adres}\line
{\f0\fs14 Graaf Willem II laan 34}\line
{\f0\fs14 1964 JN Heemskerk}
\cell
\row

\pard\sb300\qc
{\f0\b\fs16 Deze factuur vervalt op [Vervaldatum].}
\par
}`;

  return rtf;
}

export function downloadInvoiceRtf(): void {
  const rtf = generateInvoiceRtf();
  const blob = new Blob([rtf], { type: "application/rtf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "MV_Solutions_Factuursjabloon.rtf";
  a.click();
  URL.revokeObjectURL(url);
}
