import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RompslompCompany {
  id: number;
  name: string;
  owner_name: string;
  address: string;
  zipcode: string;
  city: string;
  country_code: string;
  kvk_number: string;
  email: string;
  website: string;
  type: string;
  vat_liable: boolean;
  vat_number: string;
  access_control: {
    api_accessible: boolean;
    allowed_scopes: string[];
  };
}

interface RompslompProduct {
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
  status: 'concept' | 'published';
  price_without_vat: string;
  price_with_vat: string;
  vat_amount: string;
  contact_id: number;
  invoice_number: string | null;
  published_at: string | null;
  payment_status: 'unpaid' | 'paid' | 'partial';
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

interface RompslompSettings {
  id: string;
  company_id: number;
  company_name: string;
  created_at: string;
  updated_at: string;
}

async function callRompslompApi(action: string, companyId?: number, data?: Record<string, unknown>) {
  const { data: response, error } = await supabase.functions.invoke('rompslomp-api', {
    body: { action, companyId, data },
  });

  if (error) throw error;
  if (response?.error) throw new Error(response.error);
  return response;
}

export function useRompslompCompanies() {
  return useQuery({
    queryKey: ['rompslomp', 'companies'],
    queryFn: async () => {
      const response = await callRompslompApi('list_companies');
      return response.companies as RompslompCompany[];
    },
  });
}

export function useRompslompSettings() {
  return useQuery({
    queryKey: ['rompslomp', 'settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rompslomp_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as RompslompSettings | null;
    },
  });
}

export function useSaveRompslompSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, companyName }: { companyId: number; companyName: string }) => {
      // First delete any existing settings
      await supabase.from('rompslomp_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Then insert new settings
      const { data, error } = await supabase
        .from('rompslomp_settings')
        .insert({ company_id: companyId, company_name: companyName })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp'] });
    },
  });
}

export function useRompslompProducts(companyId: number | null) {
  return useQuery({
    queryKey: ['rompslomp', 'products', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const response = await callRompslompApi('list_products', companyId);
      return response.products as RompslompProduct[];
    },
    enabled: !!companyId,
  });
}

export function useCreateRompslompProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      companyId, 
      product 
    }: { 
      companyId: number; 
      product: {
        has_stock?: boolean;
        invoice_line: {
          description: string;
          price_per_unit: string;
          vat_rate?: string;
          product_code?: string;
        };
      };
    }) => {
      const response = await callRompslompApi('create_product', companyId, { product });
      return response.product as RompslompProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'products'] });
    },
  });
}

export function useDeleteRompslompProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, productId }: { companyId: number; productId: number }) => {
      await callRompslompApi('delete_product', companyId, { productId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'products'] });
    },
  });
}

// Contacts
export function useRompslompContacts(companyId: number | null, searchQuery?: string) {
  return useQuery({
    queryKey: ['rompslomp', 'contacts', companyId, searchQuery],
    queryFn: async () => {
      if (!companyId) return [];
      const response = await callRompslompApi(
        searchQuery ? 'search_contact' : 'list_contacts', 
        companyId, 
        searchQuery ? { query: searchQuery } : undefined
      );
      return response.contacts as RompslompContact[];
    },
    enabled: !!companyId,
  });
}

export function useCreateRompslompContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      companyId, 
      contact 
    }: { 
      companyId: number; 
      contact: {
        is_individual?: boolean;
        is_supplier?: boolean;
        company_name: string;
        contact_person_name?: string;
        contact_person_email_address?: string;
        address?: string;
        zipcode?: string;
        city?: string;
        country_code?: string;
        phone?: string;
      };
    }) => {
      const response = await callRompslompApi('create_contact', companyId, { contact });
      return response.contact as RompslompContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'contacts'] });
    },
  });
}

// Sales Invoices
export function useRompslompInvoices(companyId: number | null, options?: { selection?: string; from?: string; till?: string }) {
  return useQuery({
    queryKey: ['rompslomp', 'invoices', companyId, options],
    queryFn: async () => {
      if (!companyId) return [];
      const response = await callRompslompApi('list_invoices', companyId, { 
        ...options, 
        per_page: 100 
      });
      return response.sales_invoices as RompslompInvoice[];
    },
    enabled: !!companyId,
  });
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async ({ companyId, invoiceId, invoiceNumber }: { companyId: number; invoiceId: number; invoiceNumber: string | null }) => {
      const response = await callRompslompApi('get_invoice_pdf', companyId, { invoiceId });
      
      if (!response.pdf) {
        throw new Error('No PDF data received');
      }
      
      // Convert base64 to blob and download
      const byteCharacters = atob(response.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `factuur-${invoiceNumber || invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return true;
    },
  });
}

export function useCreateRompslompInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      companyId, 
      invoice 
    }: { 
      companyId: number; 
      invoice: {
        date: string;
        due_date: string;
        contact_id: number;
        payment_method?: string;
        description?: string;
        invoice_lines: Array<{
          description: string;
          price_per_unit: string;
          quantity: string;
          vat_rate?: string;
        }>;
      };
    }) => {
      const response = await callRompslompApi('create_invoice', companyId, { invoice });
      return response.sales_invoice as RompslompInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'invoices'] });
    },
  });
}

export function useUpdateRompslompInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      companyId, 
      invoiceId, 
      invoice 
    }: { 
      companyId: number; 
      invoiceId: number;
      invoice: Record<string, unknown>;
    }) => {
      const response = await callRompslompApi('update_invoice', companyId, { invoiceId, invoice });
      return response.sales_invoice as RompslompInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'invoices'] });
    },
  });
}

export function useDeleteRompslompInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, invoiceId }: { companyId: number; invoiceId: number }) => {
      await callRompslompApi('delete_invoice', companyId, { invoiceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'invoices'] });
    },
  });
}

// Sync a local customer to Rompslomp contact
export function useSyncCustomerToRompslomp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      companyId, 
      customer,
      existingContactId 
    }: { 
      companyId: number; 
      customer: {
        id: string;
        name: string;
        address?: string | null;
        email?: string | null;
        phone?: string | null;
        is_individual?: boolean;
      };
      existingContactId?: number | null;
    }) => {
      // Parse address into components if possible
      let addressParts = { address: '', zipcode: '', city: '' };
      if (customer.address) {
        // Try to extract zipcode and city from address
        const addressMatch = customer.address.match(/^(.+?),?\s*(\d{4}\s*[A-Z]{2})?\s*(.+)?$/i);
        if (addressMatch) {
          addressParts.address = addressMatch[1]?.trim() || customer.address;
          addressParts.zipcode = addressMatch[2]?.replace(/\s/g, '') || '';
          addressParts.city = addressMatch[3]?.trim() || '';
        } else {
          addressParts.address = customer.address;
        }
      }

      const contactData = {
        is_individual: customer.is_individual || false,
        is_supplier: false,
        company_name: customer.name,
        contact_person_name: customer.is_individual ? customer.name : undefined,
        contact_person_email_address: customer.email || undefined,
        address: addressParts.address || undefined,
        zipcode: addressParts.zipcode || undefined,
        city: addressParts.city || undefined,
        country_code: 'NL',
        phone: customer.phone || undefined,
      };

      let contact;
      if (existingContactId) {
        // Update existing contact
        const response = await callRompslompApi('update_contact', companyId, { 
          contactId: existingContactId, 
          contact: contactData 
        });
        contact = response.contact;
      } else {
        // Create new contact
        const response = await callRompslompApi('create_contact', companyId, { contact: contactData });
        contact = response.contact;
      }

      return contact as RompslompContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

// Import Rompslomp contact as local customer
export function useImportRompslompContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      contact 
    }: { 
      contact: RompslompContact;
    }) => {
      // Check if customer already exists with this rompslomp_contact_id
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('rompslomp_contact_id', contact.id)
        .maybeSingle();

      if (existing) {
        throw new Error('Deze klant is al geïmporteerd');
      }

      // Combine address parts
      const addressParts = [contact.address, contact.zipcode, contact.city].filter(Boolean);
      const fullAddress = addressParts.join(', ') || null;

      const customerData = {
        name: contact.is_individual ? (contact.contact_person_name || contact.name) : contact.company_name,
        address: fullAddress,
        email: contact.contact_person_email_address || null,
        phone: contact.phone || null,
        status: 'Lead',
        is_individual: contact.is_individual,
        rompslomp_contact_id: contact.id,
      };

      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

// Quotations
export interface RompslompQuotation {
  id: number;
  date: string;
  contact_id: number;
  template_id: number | null;
  invoice_number: string | null;
  status: 'concept' | 'published' | 'approved' | 'stopped' | 'invoiced';
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

export function useRompslompQuotations(
  companyId: number | null, 
  options?: { selection?: string; from?: string; till?: string; contact_id?: number }
) {
  return useQuery({
    queryKey: ['rompslomp', 'quotations', companyId, options],
    queryFn: async () => {
      if (!companyId) return [];
      const response = await callRompslompApi('list_quotations', companyId, { 
        ...options, 
        per_page: 100 
      });
      return response.quotations as RompslompQuotation[];
    },
    enabled: !!companyId,
  });
}

export function useRompslompQuotationsByContact(companyId: number | null, contactId: number | null) {
  return useQuery({
    queryKey: ['rompslomp', 'quotations', 'contact', companyId, contactId],
    queryFn: async () => {
      if (!companyId || !contactId) return [];
      const response = await callRompslompApi('list_quotations', companyId, { 
        contact_id: contactId,
        per_page: 100 
      });
      return response.quotations as RompslompQuotation[];
    },
    enabled: !!companyId && !!contactId,
  });
}

export function useDownloadQuotationPdf() {
  return useMutation({
    mutationFn: async ({ companyId, quotationId, quotationNumber }: { companyId: number; quotationId: number; quotationNumber: string | null }) => {
      const response = await callRompslompApi('get_quotation_pdf', companyId, { quotationId });
      
      if (!response.pdf) {
        throw new Error('No PDF data received');
      }
      
      // Convert base64 to blob and download
      const byteCharacters = atob(response.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `offerte-${quotationNumber || quotationId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return true;
    },
  });
}

export function useCreateRompslompQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      companyId, 
      quotation 
    }: { 
      companyId: number; 
      quotation: {
        date: string;
        contact_id: number;
        template_id?: number;
        invoice_lines: Array<{
          description: string;
          price_per_unit: string;
          quantity: string;
          vat_rate?: string;
        }>;
      };
    }) => {
      const response = await callRompslompApi('create_quotation', companyId, { quotation });
      return response.quotation as RompslompQuotation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'quotations'] });
    },
  });
}

export function useUpdateRompslompQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      companyId, 
      quotationId, 
      quotation 
    }: { 
      companyId: number; 
      quotationId: number;
      quotation: Record<string, unknown>;
    }) => {
      const response = await callRompslompApi('update_quotation', companyId, { quotationId, quotation });
      return response.quotation as RompslompQuotation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'quotations'] });
    },
  });
}

export function useDeleteRompslompQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, quotationId }: { companyId: number; quotationId: number }) => {
      await callRompslompApi('delete_quotation', companyId, { quotationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'quotations'] });
    },
  });
}

// Convert a quotation to an invoice
export function useConvertQuotationToInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      companyId, 
      quotation,
      dueDate
    }: { 
      companyId: number; 
      quotation: RompslompQuotation;
      dueDate: string;
    }) => {
      // Create invoice from quotation data
      const invoice = {
        date: new Date().toISOString().split('T')[0],
        due_date: dueDate,
        contact_id: quotation.contact_id,
        payment_method: 'pay_transfer',
        description: quotation.invoice_number ? `Factuur o.b.v. offerte ${quotation.invoice_number}` : undefined,
        invoice_lines: quotation.invoice_lines.map(line => ({
          description: line.description,
          price_per_unit: line.price_per_unit,
          quantity: line.quantity,
          vat_rate: line.vat_rate,
        })),
      };
      
      const response = await callRompslompApi('create_invoice', companyId, { invoice });
      return response.sales_invoice as RompslompInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['rompslomp', 'quotations'] });
    },
  });
}
