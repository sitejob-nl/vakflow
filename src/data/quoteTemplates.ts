import type { QuoteItem, OptionalItem } from "@/hooks/useQuotes";

export interface QuoteTemplate {
  name: string;
  items: QuoteItem[];
  optionalItems: OptionalItem[];
}

export const quoteTemplates: QuoteTemplate[] = [
  {
    name: "Itho Euro",
    items: [
      { description: "ITHO DAALDEROP WOONHUISVENTILATOR 375M³/H (met interne (RV) vochtsensor)", qty: 1, unit_price: 535.00, total: 535.00 },
      { description: "ITHO DAALDEROP DRAADLOZE AFSTANDSBEDIENING", qty: 1, unit_price: 0, total: 0 },
      { description: "INSTALLATIEKOSTEN", qty: 1, unit_price: 0, total: 0 },
      { description: "REINIGINGEN VENTILATIE KANALEN", qty: 1, unit_price: 0, total: 0 },
      { description: "VOORRIJKOSTEN", qty: 1, unit_price: 0, total: 0 },
    ],
    optionalItems: [
      { description: "EXTRA ITHO DRAADLOZE AFSTANDSBEDIENING", price: 97.65 },
      { description: "ITHO CO2 RUIMTESENSOR MET BEDIENING", price: 251.68 },
    ],
  },
  {
    name: "Itho Perilex",
    items: [
      { description: "ITHO DAALDEROP WOONHUISVENTILATOR 375M³/H (PERILEX AANSLUITING) Met interne (RV) vochtsensor", qty: 1, unit_price: 535.00, total: 535.00 },
      { description: "ITHO DAALDEROP DRAADLOZE AFSTANDSBEDIENING", qty: 1, unit_price: 0, total: 0 },
      { description: "INSTALLATIEKOSTEN", qty: 1, unit_price: 0, total: 0 },
      { description: "REINIGINGEN VENTILATIE KANALEN", qty: 1, unit_price: 0, total: 0 },
      { description: "VOORRIJKOSTEN", qty: 1, unit_price: 0, total: 0 },
    ],
    optionalItems: [
      { description: "EXTRA ITHO DRAADLOZE AFSTANDSBEDIENING", price: 97.65 },
      { description: "ITHO CO2 RUIMTESENSOR MET BEDIENING", price: 251.68 },
    ],
  },
  {
    name: "Ducobox Euro",
    items: [
      { description: "DUCO WOONHV DUCOBOX SILENT Met interne (RV) vochtsensor", qty: 1, unit_price: 535.00, total: 535.00 },
      { description: "DUCO DRAADLOZE AFSTANDSBEDIENING", qty: 1, unit_price: 0, total: 0 },
      { description: "INSTALLATIEKOSTEN", qty: 1, unit_price: 0, total: 0 },
      { description: "REINIGINGEN VENTILATIE KANALEN", qty: 1, unit_price: 0, total: 0 },
      { description: "VOORRIJKOSTEN", qty: 1, unit_price: 0, total: 0 },
    ],
    optionalItems: [
      { description: "EXTRA DUCO DRAADLOZE AFSTANDSBEDIENING", price: 83.85 },
      { description: "DUCO CO2 BOXSENSOR", price: 278.51 },
      { description: "DUCO CO2 RUIMTESENSOR MET BEDIENING", price: 365.73 },
    ],
  },
  {
    name: "Ducobox Perilex",
    items: [
      { description: "DUCO WOONHV DUCOBOX", qty: 1, unit_price: 535.00, total: 535.00 },
      { description: "INSTALLATIEKOSTEN", qty: 1, unit_price: 0, total: 0 },
      { description: "REINIGINGEN VENTILATIE KANALEN", qty: 1, unit_price: 0, total: 0 },
      { description: "VOORRIJKOSTEN", qty: 1, unit_price: 0, total: 0 },
    ],
    optionalItems: [
      { description: "EXTRA DUCO DRAADLOZE AFSTANDSBEDIENING", price: 83.85 },
      { description: "DUCO CO2 BOXSENSOR", price: 278.51 },
      { description: "DUCO CO2 RUIMTESENSOR MET BEDIENING", price: 365.73 },
    ],
  },
  {
    name: "Zehnder Euro",
    items: [
      { description: "ZEHNDER COMFOFAN SILENT Met interne (RV) vochtsensor", qty: 1, unit_price: 565.00, total: 565.00 },
      { description: "ZEHNDER RF AFSTANDSBEDIENING", qty: 1, unit_price: 0, total: 0 },
      { description: "INSTALLATIEKOSTEN", qty: 1, unit_price: 0, total: 0 },
      { description: "REINIGINGEN VENTILATIE KANALEN", qty: 1, unit_price: 0, total: 0 },
      { description: "VOORRIJKOSTEN", qty: 1, unit_price: 0, total: 0 },
    ],
    optionalItems: [
      { description: "EXTRA ZEHNDER RF AFSTANDSBEDIENING", price: 83.85 },
      { description: "ZEHNDER TIMER RF AFSTANDSBEDIENING", price: 84.37 },
      { description: "ZEHNDER CO2 SENSOR RF AFSTANDSBEDIENING", price: 416.78 },
    ],
  },
  {
    name: "Zehnder Perilex",
    items: [
      { description: "ZEHNDER COMFOFAN SILENT", qty: 1, unit_price: 565.00, total: 565.00 },
      { description: "INSTALLATIEKOSTEN", qty: 1, unit_price: 0, total: 0 },
      { description: "REINIGINGEN VENTILATIE KANALEN", qty: 1, unit_price: 0, total: 0 },
      { description: "VOORRIJKOSTEN", qty: 1, unit_price: 0, total: 0 },
    ],
    optionalItems: [
      { description: "EXTRA ZEHNDER RF AFSTANDSBEDIENING", price: 83.85 },
      { description: "ZEHNDER TIMER RF AFSTANDSBEDIENING", price: 84.37 },
      { description: "ZEHNDER CO2 SENSOR RF AFSTANDSBEDIENING", price: 416.78 },
    ],
  },
  {
    name: "Zehnder Perilex RF",
    items: [
      { description: "ZEHNDER COMFOFAN SILENT Met interne (RV) vochtsensor", qty: 1, unit_price: 565.00, total: 565.00 },
      { description: "ZEHNDER RF AFSTANDSBEDIENING", qty: 1, unit_price: 83.85, total: 83.85 },
      { description: "INSTALLATIEKOSTEN", qty: 1, unit_price: 0, total: 0 },
      { description: "REINIGINGEN VENTILATIE KANALEN", qty: 1, unit_price: 0, total: 0 },
      { description: "VOORRIJKOSTEN", qty: 1, unit_price: 0, total: 0 },
    ],
    optionalItems: [
      { description: "EXTRA ZEHNDER RF AFSTANDSBEDIENING", price: 83.85 },
      { description: "ZEHNDER TIMER RF AFSTANDSBEDIENING", price: 84.37 },
      { description: "ZEHNDER CO2 SENSOR RF AFSTANDSBEDIENING", price: 416.78 },
    ],
  },
  {
    name: "Itho WTW Euro",
    items: [
      { description: "Itho Daalderop WTW HRU 350 ECO (350m3) Euro stekker. Installatie van WTW. Luchtzijdig aansluiten en aansluiten op aanwezige riool en elektra.", qty: 1, unit_price: 1525.55, total: 1525.55 },
      { description: "Itho Daalderop RFT draadloze afstandsbediening", qty: 1, unit_price: 130.55, total: 130.55 },
      { description: "Groot en klein materiaal", qty: 1, unit_price: 243.90, total: 243.90 },
      { description: "Reinigen van de ventilatiekanalen", qty: 1, unit_price: 95.00, total: 95.00 },
    ],
    optionalItems: [
      { description: "EXTRA ITHO DRAADLOZE AFSTANDSBEDIENING", price: 130.55 },
    ],
  },
  {
    name: "Itho WTW Perilex",
    items: [
      { description: "Itho Daalderop WTW HRU 350 ECO (350m3) Perilex stekker. Installatie van WTW. Luchtzijdig aansluiten en aansluiten op aanwezige riool en elektra.", qty: 1, unit_price: 1525.55, total: 1525.55 },
      { description: "Itho Daalderop RFT draadloze afstandsbediening", qty: 1, unit_price: 130.55, total: 130.55 },
      { description: "Groot en klein materiaal", qty: 1, unit_price: 243.90, total: 243.90 },
      { description: "Reinigen van de ventilatiekanalen", qty: 1, unit_price: 95.00, total: 95.00 },
    ],
    optionalItems: [
      { description: "EXTRA ITHO DRAADLOZE AFSTANDSBEDIENING", price: 130.55 },
    ],
  },
  {
    name: "Zehnder WTW",
    items: [
      { description: "Zehnder ComfoAir Q350 (350m3) Euro stekker. Installatie van WTW. Luchtzijdig aansluiten. En aansluiten op aanwezige riool en elektra. En vervanging van het flexibele deel tot aan de schoorsteen.", qty: 1, unit_price: 2909.29, total: 2909.29 },
      { description: "Zehnder ComfoAir Q bedieningen ComfoSwitch C55 RFT draadloze afstandsbediening", qty: 1, unit_price: 129.99, total: 129.99 },
      { description: "Groot en klein materiaal", qty: 1, unit_price: 360.72, total: 360.72 },
      { description: "Zehnder Montagestoel voor de ComfoAir Q", qty: 1, unit_price: 199.99, total: 199.99 },
      { description: "Reinigen van de ventilatiekanalen", qty: 1, unit_price: 95.00, total: 95.00 },
    ],
    optionalItems: [
      { description: "Zehnder ComfoAir Q bedieningen", price: 129.99 },
    ],
  },
];
