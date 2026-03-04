// Frontend API layer for SnelStart CRUD operations via Edge Functions
import { supabase } from "@/integrations/supabase/client";

async function invoke(functionName: string, params?: Record<string, string>, method?: string, body?: any) {
  // Build query string
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";

  const { data, error } = await supabase.functions.invoke(`${functionName}${qs}`, {
    method: method || "GET",
    body: body || undefined,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// Relaties
export const getRelaties = (filter?: string) => invoke("snelstart-relaties", filter ? { filter } : undefined);
export const getRelatie = (id: string) => invoke("snelstart-relaties", { id });
export const createRelatie = (data: any) => invoke("snelstart-relaties", undefined, "POST", data);
export const updateRelatie = (id: string, data: any) => invoke("snelstart-relaties", { id }, "PUT", data);
export const deleteRelatie = (id: string) => invoke("snelstart-relaties", { id }, "DELETE");

// Artikelen
export const getArtikelen = (filter?: string) => invoke("snelstart-artikelen", filter ? { filter } : undefined);
export const getArtikel = (id: string) => invoke("snelstart-artikelen", { id });
export const createArtikel = (data: any) => invoke("snelstart-artikelen", undefined, "POST", data);
export const updateArtikel = (id: string, data: any) => invoke("snelstart-artikelen", { id }, "PUT", data);
export const getArtikelCustomFields = (id: string) => invoke("snelstart-artikelen", { id, action: "customFields" });
export const getArtikelOmzetgroepen = () => invoke("snelstart-artikelen", { action: "omzetgroepen" });

// Offertes
export const getOffertes = (filter?: string) => invoke("snelstart-offertes", filter ? { filter } : undefined);
export const getOfferte = (id: string) => invoke("snelstart-offertes", { id });
export const createOfferte = (data: any) => invoke("snelstart-offertes", undefined, "POST", data);
export const updateOfferte = (id: string, data: any) => invoke("snelstart-offertes", { id }, "PUT", data);

// Verkooporders
export const getVerkooporders = (filter?: string) => invoke("snelstart-verkooporders", filter ? { filter } : undefined);
export const getVerkooporder = (id: string) => invoke("snelstart-verkooporders", { id });
export const createVerkooporder = (data: any) => invoke("snelstart-verkooporders", undefined, "POST", data);
export const updateVerkooporder = (id: string, data: any) => invoke("snelstart-verkooporders", { id }, "PUT", data);
export const updateVerkooporderStatus = (id: string, status: any) =>
  invoke("snelstart-verkooporders", { id, action: "procesStatus" }, "PUT", status);

// Facturen
export const getVerkoopfacturen = (filter?: string) => invoke("snelstart-facturen", { type: "facturen", ...(filter ? { filter } : {}) });
export const getVerkoopfactuur = (id: string) => invoke("snelstart-facturen", { type: "facturen", id });
export const getFactuurUBL = (id: string) => invoke("snelstart-facturen", { type: "facturen", id, action: "ubl" });
export const createVerkoopboeking = (data: any) => invoke("snelstart-facturen", { type: "boekingen" }, "POST", data);
export const getVerkoopboekingen = (filter?: string) => invoke("snelstart-facturen", { type: "boekingen", ...(filter ? { filter } : {}) });
