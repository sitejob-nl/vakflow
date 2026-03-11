import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function mbAction(action: string, extra: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("sync-moneybird", {
    body: { action, ...extra },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Query hooks ──

export function useMoneybirdContacts(search: string) {
  return useQuery({
    queryKey: ["mb-contacts", search],
    queryFn: () => mbAction("list-contacts-live", { query: search, per_page: 50 }),
    staleTime: 30_000,
    select: (d) => d?.contacts || [],
  });
}

export function useMoneybirdInvoicesLive(state: string) {
  return useQuery({
    queryKey: ["mb-invoices-live", state],
    queryFn: () => mbAction("list-invoices-live", { state, per_page: 50 }),
    staleTime: 30_000,
    select: (d) => d?.invoices || [],
  });
}

export function useMoneybirdProducts(search: string) {
  return useQuery({
    queryKey: ["mb-products", search],
    queryFn: () => mbAction("list-products-live", { query: search, per_page: 100 }),
    staleTime: 30_000,
    select: (d) => d?.products || [],
  });
}

export function useMoneybirdLedgerAccounts(enabled = true) {
  return useQuery({
    queryKey: ["mb-ledger-accounts"],
    queryFn: () => mbAction("list-ledger-accounts"),
    staleTime: 300_000,
    enabled,
    select: (d) => (d?.ledger_accounts || []).filter((la: any) => la.account_type === "revenue"),
  });
}

export function useMoneybirdTaxRates(enabled = true) {
  return useQuery({
    queryKey: ["mb-tax-rates"],
    queryFn: () => mbAction("list-tax-rates"),
    staleTime: 300_000,
    enabled,
    select: (d) => (d?.tax_rates || []).filter((t: any) => t.active),
  });
}

export function useMoneybirdFinancialSummary() {
  return useQuery({
    queryKey: ["mb-financial-summary"],
    queryFn: () => mbAction("financial-summary"),
    staleTime: 60_000,
    select: (d) => d?.summary || {},
  });
}

// ── Mutation hooks ──

export function useCreateMoneybirdContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contact_data: Record<string, string>) =>
      mbAction("create-contact-direct", { contact_data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mb-contacts"] }),
  });
}

export function useSendMoneybirdInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (moneybird_invoice_id: string) =>
      mbAction("send-invoice-direct", { moneybird_invoice_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mb-invoices-live"] }),
  });
}

export function useGetMoneybirdInvoicePdf() {
  return useMutation({
    mutationFn: (moneybird_invoice_id: string) =>
      mbAction("get-invoice-pdf-url", { moneybird_invoice_id }),
  });
}

export function useCreateMoneybirdProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, any>) =>
      mbAction("create-product-direct", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mb-products"] }),
  });
}

export function useUpdateMoneybirdProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, any>) =>
      mbAction("update-product-direct", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mb-products"] }),
  });
}

export function useCreateStandaloneInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, any>) =>
      mbAction("create-standalone-invoice", params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mb-invoices-live"] }),
  });
}

export { mbAction };
