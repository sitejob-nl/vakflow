import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KvkAddress {
  binnenlandsAdres?: {
    type: string;
    straatnaam: string;
    huisnummer?: number;
    huisnummerToevoeging?: string;
    huisletter?: string;
    postcode?: string;
    plaats: string;
  };
}

interface KvkSearchResult {
  kvkNummer: string;
  vestigingsnummer?: string;
  naam: string;
  adres?: KvkAddress;
  type: "hoofdvestiging" | "nevenvestiging" | "rechtspersoon";
}

interface KvkSearchResponse {
  pagina: number;
  totaal: number;
  resultaten: KvkSearchResult[];
}

interface KvkBasisprofielEigenaar {
  naam: string;
  type: string;
}

interface KvkBasisprofiel {
  kvkNummer: string;
  indNonMailing: string;
  statutaireNaam: string;
  handelsnamen: { naam: string; volgorde: number }[];
  spiActiviteiten: { sbiCode: string; sbiOmschrijving: string; indHoofdactiviteit: string }[];
  _embedded?: {
    eigenaar?: KvkBasisprofielEigenaar;
    hoofdvestiging?: {
      vestigingsnummer: string;
      adressen: {
        type: string;
        straatnaam: string;
        huisnummer?: number;
        postcode?: string;
        plaats: string;
      }[];
    };
  };
}

interface KvkVestigingsprofiel {
  vestigingsnummer: string;
  kvkNummer: string;
  eersteHandelsnaam: string;
  adressen: {
    type: string;
    straatnaam: string;
    huisnummer?: number;
    huisnummerToevoeging?: string;
    postcode?: string;
    plaats: string;
    geoData?: {
      gpsLatitude: number;
      gpsLongitude: number;
    };
  }[];
}

// Mapped output ready for Vakflow company forms
export interface KvkCompanyData {
  kvk_number: string;
  company_name: string;
  trade_names: string[];
  visit_address?: {
    street: string;
    house_number: string;
    postal_code: string;
    city: string;
  };
  postal_address?: {
    street: string;
    house_number: string;
    postal_code: string;
    city: string;
  };
  sbi_codes: { code: string; description: string; is_main: boolean }[];
  latitude?: number;
  longitude?: number;
  vestigingsnummer?: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useKvkLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callKvk = useCallback(async (body: Record<string, unknown>) => {
    const { data, error: fnError } = await supabase.functions.invoke(
      "kvk-lookup",
      { body }
    );

    if (fnError) {
      throw new Error(fnError.message || "KVK API niet bereikbaar");
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  }, []);

  // Search by company name or KVK number
  const search = useCallback(
    async (input: string): Promise<KvkSearchResult[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const isKvkNumber = /^\d{8}$/.test(input.replace(/\s/g, ""));
        const body = isKvkNumber
          ? { action: "zoeken", kvkNummer: input.replace(/\s/g, "") }
          : { action: "zoeken", query: input };

        const data: KvkSearchResponse = await callKvk(body);
        return data.resultaten || [];
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Zoeken mislukt";
        setError(message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [callKvk]
  );

  // Get full company data: basisprofiel + vestigingsprofiel → mapped to Vakflow schema
  const getCompanyData = useCallback(
    async (
      kvkNummer: string,
      vestigingsnummer?: string
    ): Promise<KvkCompanyData | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch basisprofiel
        const basis: KvkBasisprofiel = await callKvk({
          action: "basisprofiel",
          kvkNummer,
        });

        // Determine vestigingsnummer
        const vestNr =
          vestigingsnummer ||
          basis._embedded?.hoofdvestiging?.vestigingsnummer;

        // Fetch vestigingsprofiel if we have a vestigingsnummer
        let vestiging: KvkVestigingsprofiel | null = null;
        if (vestNr) {
          try {
            vestiging = await callKvk({
              action: "vestigingsprofiel",
              vestigingsnummer: vestNr,
            });
          } catch {
            // Non-blocking: we still have basisprofiel data
            console.warn("Vestigingsprofiel ophalen mislukt, doorgaan met basisprofiel");
          }
        }

        // Map to Vakflow format
        const mapAddress = (addr: any) =>
          addr
            ? {
                street: addr.straatnaam || "",
                house_number: [
                  addr.huisnummer,
                  addr.huisletter,
                  addr.huisnummerToevoeging,
                ]
                  .filter(Boolean)
                  .join(""),
                postal_code: addr.postcode || "",
                city: addr.plaats || "",
              }
            : undefined;

        const addresses = vestiging?.adressen || [];
        const bezoek = addresses.find((a) => a.type === "bezoekadres");
        const post = addresses.find((a) => a.type === "postadres");

        const result: KvkCompanyData = {
          kvk_number: kvkNummer,
          company_name:
            basis.statutaireNaam ||
            basis.handelsnamen?.[0]?.naam ||
            "",
          trade_names: (basis.handelsnamen || []).map((h) => h.naam),
          visit_address: mapAddress(bezoek),
          postal_address: mapAddress(post),
          sbi_codes: (basis.spiActiviteiten || []).map((a) => ({
            code: a.sbiCode,
            description: a.sbiOmschrijving,
            is_main: a.indHoofdactiviteit === "Ja",
          })),
          latitude: bezoek?.geoData?.gpsLatitude,
          longitude: bezoek?.geoData?.gpsLongitude,
          vestigingsnummer: vestNr,
        };

        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Gegevens ophalen mislukt";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [callKvk]
  );

  return { search, getCompanyData, isLoading, error };
}
