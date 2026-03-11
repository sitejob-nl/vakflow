import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RompslompContact {
  id: number;
  name: string;
  is_individual: boolean;
  is_supplier: boolean;
  company_name: string;
  contact_person_name: string | null;
  contact_person_email_address: string | null;
  address: string | null;
  zipcode: string | null;
  city: string | null;
  country_code: string;
  kvk_number: string | null;
  phone: string | null;
  vat_number: string | null;
  contact_number: string;
}

export interface RompslompInvoice {
  id: number;
  date: string;
  due_date: string;
  payment_method: string;
  description: string | null;
  status: "concept" | "published";
  price_without_vat: string;
  price_with_vat: string;
  vat_amount: string;
  contact_id: number;
  invoice_number: string | null;
  published_at: string | null;
  payment_status: "unpaid" | "paid" | "partial";
  open_amount: string;
  cached_contact: {
    name: string;
    contact_person_name: string;
    address: string;
    zipcode: string;
    city: string;
    country_code: string;
    contact_person_email_address: string;
    contact_number: string;
  };
  invoice_lines: Array<{
    id: number;
    description: string;
    extended_description: string | null;
    price_per_unit: string;
    price_with_vat: string;
    price_without_vat: string;
    vat_amount: string;
    vat_rate: string;
    quantity: string;
  }>;
}

export interface RompslompQuotation {
  id: number;
  date: string;
  contact_id: number;
  template_id: number | null;
  invoice_number: string | null;
  status: "concept" | "published" | "approved" | "stopped" | "invoiced";
  invoice_lines: Array<{
    id: number;
    description: string;
    extended_description: string | null;
    price_per_unit: string;
    price_with_vat: string;
    price_without_vat: string;
    vat_amount: string;
    vat_rate: string;
    vat_type_id: number;
    quantity: string;
    product_id: number | null;
    account_id: number | null;
    account_path: string | null;
  }>;
}

export interface RompslompProduct {
  id: number;
  number_sold: number;
  has_stock: boolean;
  invoice_line: {
    id: number;
    description: string;
    extended_description: string | null;
    price_per_unit: string;
    price_with_vat: string;
    price_without_vat: string;
    vat_amount: string;
    vat_rate: string;
    vat_type_id: number;
    quantity: string;
    product_id: number | null;
    account_id: number | null;
    account_path: string | null;
    product_code: string;
  };
}

// ─── API helper ──────────────────────────────────────────────────────────────

async function callRompslompApi(action: string, data?: Record<string, unknown>) {
  const { data: response, error } = await supabase.functions.invoke("rompslomp-api", {
    body: { action, data },
  });
  if (error) throw error;
  if (response?.error) throw new Error(response.error);
  return response;
}

// ─── Settings (reads from companies_safe) ────────────────────────────────────

export function useRompslompSettings() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["rompslomp", "settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase
        .from("companies_safe" as any)
        .select("rompslomp_company_id, rompslomp_company_name")
        .eq("id", companyId)
        .single() as { data: any };
      if (!data?.rompslomp_company_id) return null;
      return {
        company_id: data.rompslomp_company_id as string,
        company_name: (data.rompslomp_company_name as string) || "",
      };
    },
    enabled: !!companyId,
  });
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export function useRompslompContacts(enabled: boolean, searchQuery?: string) {
  return useQuery({
    queryKey: ["rompslomp", "contacts", searchQuery],
    queryFn: async () => {
      const response = await callRompslompApi(
        searchQuery ? "search_contact" : "list_contacts",
        searchQuery ? { query: searchQuery } : undefined
      );
      return (response.contacts ?? []) as RompslompContact[];
    },
    enabled,
  });
}

export function useImportRompslompContact() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contact }: { contact: RompslompContact }) => {
      if (!companyId) throw new Error("Niet ingelogd");

      // Check if already imported
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("rompslomp_contact_id", String(contact.id))
        .maybeSingle();
      if (existing) throw new Error("Deze klant is al geïmporteerd");

      const addressParts = [contact.address, contact.zipcode, contact.city].filter(Boolean);
      const { data, error } = await supabase
        .from("customers")
        .insert({
          company_id: companyId,
          name: contact.is_individual ? (contact.contact_person_name || contact.name) : contact.company_name,
          address: addressParts.join(", ") || null,
          email: contact.contact_person_email_address || null,
          phone: contact.phone || null,
          rompslomp_contact_id: String(contact.id),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export function useRompslompInvoices(enabled: boolean, options?: { selection?: string; from?: string; till?: string }) {
  return useQuery({
    queryKey: ["rompslomp", "invoices", options],
    queryFn: async () => {
      const response = await callRompslompApi("list_invoices", { ...options, per_page: 100 });
      return (response.sales_invoices ?? []) as RompslompInvoice[];
    },
    enabled,
  });
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async ({ invoiceId, invoiceNumber }: { invoiceId: number; invoiceNumber: string | null }) => {
      const response = await callRompslompApi("get_invoice_pdf", { invoiceId });
      if (!response.pdf) throw new Error("Geen PDF ontvangen");
      downloadBase64Pdf(response.pdf, `factuur-${invoiceNumber || invoiceId}.pdf`);
    },
  });
}

// ─── Quotations ──────────────────────────────────────────────────────────────

export function useRompslompQuotations(enabled: boolean, options?: { selection?: string; from?: string; till?: string; contact_id?: number }) {
  return useQuery({
    queryKey: ["rompslomp", "quotations", options],
    queryFn: async () => {
      const response = await callRompslompApi("list_quotations", { ...options, per_page: 100 });
      return (response.quotations ?? []) as RompslompQuotation[];
    },
    enabled,
  });
}

export function useDownloadQuotationPdf() {
  return useMutation({
    mutationFn: async ({ quotationId, quotationNumber }: { quotationId: number; quotationNumber: string | null }) => {
      const response = await callRompslompApi("get_quotation_pdf", { quotationId });
      if (!response.pdf) throw new Error("Geen PDF ontvangen");
      downloadBase64Pdf(response.pdf, `offerte-${quotationNumber || quotationId}.pdf`);
    },
  });
}

export function useConvertQuotationToInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quotation, dueDate }: { quotation: RompslompQuotation; dueDate: string }) => {
      const invoice = {
        date: new Date().toISOString().split("T")[0],
        due_date: dueDate,
        contact_id: quotation.contact_id,
        payment_method: "pay_transfer",
        description: quotation.invoice_number ? `Factuur o.b.v. offerte ${quotation.invoice_number}` : undefined,
        invoice_lines: quotation.invoice_lines.map((l) => ({
          description: l.description,
          price_per_unit: l.price_per_unit,
          quantity: l.quantity,
          vat_rate: l.vat_rate,
        })),
      };
      const response = await callRompslompApi("create_invoice", { invoice });
      return response.sales_invoice as RompslompInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rompslomp", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["rompslomp", "quotations"] });
    },
  });
}

// ─── Products ────────────────────────────────────────────────────────────────

export function useRompslompProducts(enabled: boolean) {
  return useQuery({
    queryKey: ["rompslomp", "products"],
    queryFn: async () => {
      const response = await callRompslompApi("list_products");
      return (response.products ?? []) as RompslompProduct[];
    },
    enabled,
  });
}

export function useCreateRompslompProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ product }: { product: { invoice_line: { description: string; price_per_unit: string; product_code?: string } } }) => {
      const response = await callRompslompApi("create_product", { product });
      return response.product as RompslompProduct;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rompslomp", "products"] }),
  });
}

export function useDeleteRompslompProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId }: { productId: number }) => {
      await callRompslompApi("delete_product", { productId });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rompslomp", "products"] }),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadBase64Pdf(base64: string, filename: string) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
