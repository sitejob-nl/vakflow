import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MoneybirdInvoice {
  id: string;
  wc_customer_id: number;
  moneybird_contact_id: string | null;
  moneybird_invoice_id: string | null;
  moneybird_subscription_id: string | null;
  invoice_type: string;
  product_id: number | null;
  amount: number | null;
  description: string | null;
  status: string;
  created_at: string;
  invoice_number: string | null;
  due_date: string | null;
  payment_url: string | null;
  invoice_url: string | null;
}

export function useMoneybirdInvoices(wcCustomerId: number | null | undefined) {
  const queryClient = useQueryClient();

  const invoices = useQuery<MoneybirdInvoice[]>({
    queryKey: ['moneybird-invoices', wcCustomerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('moneybird_invoices')
        .select('*')
        .eq('wc_customer_id', wcCustomerId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MoneybirdInvoice[];
    },
    enabled: !!wcCustomerId,
  });

  const createInvoice = useMutation({
    mutationFn: async (params: {
      action: 'create_membership_invoice' | 'create_event_invoice' | 'send_reminder' | 'get_invoice_pdf';
      wc_customer_id?: number;
      amount?: string;
      description?: string;
      product_id?: number;
      moneybird_invoice_id?: string;
      contact_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('moneybird-invoice', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moneybird-invoices', wcCustomerId] });
    },
  });

  return { invoices: invoices.data || [], isLoading: invoices.isLoading, createInvoice };
}
