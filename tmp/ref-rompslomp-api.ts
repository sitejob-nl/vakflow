import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROMPSLOMP_API_KEY = Deno.env.get('ROMPSLOMP_API_KEY');
const ROMPSLOMP_BASE_URL = 'https://api.rompslomp.nl/api/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated and has staff role
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isStaff } = await supabaseClient.rpc('is_staff', { _user_id: user.id });
    if (!isStaff) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, companyId, data } = await req.json();
    console.log('Rompslomp API request:', { action, companyId });

    let endpoint = '';
    let method = 'GET';
    let body = null;

    switch (action) {
      case 'list_companies':
        endpoint = '/companies';
        break;
      
      case 'get_company':
        endpoint = `/companies/${companyId}`;
        break;
      
      case 'list_products':
        if (!companyId) {
          return new Response(JSON.stringify({ error: 'Company ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/products`;
        break;
      
      case 'get_product':
        if (!companyId || !data?.productId) {
          return new Response(JSON.stringify({ error: 'Company ID and Product ID are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/products/${data.productId}`;
        break;
      
      case 'create_product':
        if (!companyId || !data?.product) {
          return new Response(JSON.stringify({ error: 'Company ID and product data are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/products`;
        method = 'POST';
        body = JSON.stringify({ product: data.product });
        break;
      
      case 'update_product':
        if (!companyId || !data?.productId || !data?.product) {
          return new Response(JSON.stringify({ error: 'Company ID, Product ID and product data are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/products/${data.productId}`;
        method = 'PATCH';
        body = JSON.stringify({ product: data.product });
        break;
      
      case 'delete_product':
        if (!companyId || !data?.productId) {
          return new Response(JSON.stringify({ error: 'Company ID and Product ID are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/products/${data.productId}`;
        method = 'DELETE';
        break;
      
      // Contacts
      case 'list_contacts':
        if (!companyId) {
          return new Response(JSON.stringify({ error: 'Company ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/contacts`;
        break;
      
      case 'create_contact':
        if (!companyId || !data?.contact) {
          return new Response(JSON.stringify({ error: 'Company ID and contact data are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/contacts`;
        method = 'POST';
        body = JSON.stringify({ contact: data.contact });
        break;
      
      case 'search_contact':
        if (!companyId) {
          return new Response(JSON.stringify({ error: 'Company ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const searchParams = new URLSearchParams();
        if (data?.query) searchParams.set('search[q]', data.query);
        endpoint = `/companies/${companyId}/contacts${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
        break;
      
      case 'update_contact':
        if (!companyId || !data?.contactId || !data?.contact) {
          return new Response(JSON.stringify({ error: 'Company ID, Contact ID and contact data are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/contacts/${data.contactId}`;
        method = 'PATCH';
        body = JSON.stringify({ contact: data.contact });
        break;
      
      // Sales Invoices
      case 'list_invoices':
        if (!companyId) {
          return new Response(JSON.stringify({ error: 'Company ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const invoiceParams = new URLSearchParams();
        if (data?.selection) invoiceParams.set('selection', data.selection);
        if (data?.from) invoiceParams.set('search[from]', data.from);
        if (data?.till) invoiceParams.set('search[till]', data.till);
        if (data?.per_page) invoiceParams.set('per_page', data.per_page.toString());
        endpoint = `/companies/${companyId}/sales_invoices${invoiceParams.toString() ? `?${invoiceParams.toString()}` : ''}`;
        break;
      
      case 'get_invoice':
        if (!companyId || !data?.invoiceId) {
          return new Response(JSON.stringify({ error: 'Company ID and Invoice ID are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/sales_invoices/${data.invoiceId}`;
        break;
      
      case 'get_invoice_pdf':
        if (!companyId || !data?.invoiceId) {
          return new Response(JSON.stringify({ error: 'Company ID and Invoice ID are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Special handling for PDF - return base64 encoded
        const pdfUrl = `${ROMPSLOMP_BASE_URL}/companies/${companyId}/sales_invoices/${data.invoiceId}/pdf`;
        console.log('Fetching PDF from:', pdfUrl);
        
        const pdfResponse = await fetch(pdfUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${ROMPSLOMP_API_KEY}`,
          },
        });
        
        if (!pdfResponse.ok) {
          console.error('PDF fetch error:', pdfResponse.status);
          return new Response(JSON.stringify({ error: 'Failed to fetch PDF' }), {
            status: pdfResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const pdfBuffer = await pdfResponse.arrayBuffer();
        
        // Convert ArrayBuffer to base64 in chunks to avoid stack overflow
        const uint8Array = new Uint8Array(pdfBuffer);
        const chunkSize = 8192;
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const pdfBase64 = btoa(binaryString);
        
        console.log('PDF encoded successfully, size:', pdfBase64.length);
        
        return new Response(JSON.stringify({ 
          pdf: pdfBase64,
          contentType: 'application/pdf'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      case 'create_invoice':
        if (!companyId || !data?.invoice) {
          return new Response(JSON.stringify({ error: 'Company ID and invoice data are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/sales_invoices`;
        method = 'POST';
        body = JSON.stringify({ sales_invoice: data.invoice });
        break;
      
      case 'update_invoice':
        if (!companyId || !data?.invoiceId || !data?.invoice) {
          return new Response(JSON.stringify({ error: 'Company ID, Invoice ID and invoice data are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/sales_invoices/${data.invoiceId}`;
        method = 'PATCH';
        body = JSON.stringify({ sales_invoice: data.invoice });
        break;
      
      case 'delete_invoice':
        if (!companyId || !data?.invoiceId) {
          return new Response(JSON.stringify({ error: 'Company ID and Invoice ID are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/sales_invoices/${data.invoiceId}`;
        method = 'DELETE';
        break;
      
      // Quotations
      case 'list_quotations':
        if (!companyId) {
          return new Response(JSON.stringify({ error: 'Company ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const quotationParams = new URLSearchParams();
        if (data?.selection) quotationParams.set('selection', data.selection);
        if (data?.from) quotationParams.set('search[from]', data.from);
        if (data?.till) quotationParams.set('search[till]', data.till);
        if (data?.contact_id) quotationParams.set('search[contact_id]', data.contact_id.toString());
        if (data?.per_page) quotationParams.set('per_page', data.per_page.toString());
        endpoint = `/companies/${companyId}/quotations${quotationParams.toString() ? `?${quotationParams.toString()}` : ''}`;
        break;
      
      case 'get_quotation':
        if (!companyId || !data?.quotationId) {
          return new Response(JSON.stringify({ error: 'Company ID and Quotation ID are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/quotations/${data.quotationId}`;
        break;
      
      case 'get_quotation_pdf':
        if (!companyId || !data?.quotationId) {
          return new Response(JSON.stringify({ error: 'Company ID and Quotation ID are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Special handling for PDF - return base64 encoded
        const quotationPdfUrl = `${ROMPSLOMP_BASE_URL}/companies/${companyId}/quotations/${data.quotationId}/pdf`;
        console.log('Fetching quotation PDF from:', quotationPdfUrl);
        
        const quotationPdfResponse = await fetch(quotationPdfUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${ROMPSLOMP_API_KEY}`,
          },
        });
        
        if (!quotationPdfResponse.ok) {
          console.error('Quotation PDF fetch error:', quotationPdfResponse.status);
          return new Response(JSON.stringify({ error: 'Failed to fetch quotation PDF' }), {
            status: quotationPdfResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const quotationPdfBuffer = await quotationPdfResponse.arrayBuffer();
        
        // Convert ArrayBuffer to base64 in chunks to avoid stack overflow
        const quotationUint8Array = new Uint8Array(quotationPdfBuffer);
        const quotationChunkSize = 8192;
        let quotationBinaryString = '';
        for (let i = 0; i < quotationUint8Array.length; i += quotationChunkSize) {
          const chunk = quotationUint8Array.slice(i, i + quotationChunkSize);
          quotationBinaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const quotationPdfBase64 = btoa(quotationBinaryString);
        
        console.log('Quotation PDF encoded successfully, size:', quotationPdfBase64.length);
        
        return new Response(JSON.stringify({ 
          pdf: quotationPdfBase64,
          contentType: 'application/pdf'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      case 'create_quotation':
        if (!companyId || !data?.quotation) {
          return new Response(JSON.stringify({ error: 'Company ID and quotation data are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/quotations`;
        method = 'POST';
        body = JSON.stringify({ quotation: data.quotation });
        break;
      
      case 'update_quotation':
        if (!companyId || !data?.quotationId || !data?.quotation) {
          return new Response(JSON.stringify({ error: 'Company ID, Quotation ID and quotation data are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/quotations/${data.quotationId}`;
        method = 'PATCH';
        body = JSON.stringify({ quotation: data.quotation });
        break;
      
      case 'delete_quotation':
        if (!companyId || !data?.quotationId) {
          return new Response(JSON.stringify({ error: 'Company ID and Quotation ID are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        endpoint = `/companies/${companyId}/quotations/${data.quotationId}`;
        method = 'DELETE';
        break;
      
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const url = `${ROMPSLOMP_BASE_URL}${endpoint}`;
    console.log('Calling Rompslomp API:', { url, method });

    const rompslompResponse = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${ROMPSLOMP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body,
    });

    // Handle rate limiting
    if (rompslompResponse.status === 429) {
      const retryAfter = rompslompResponse.headers.get('Retry-After') || '60';
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded', 
        retryAfter: parseInt(retryAfter) 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle no content response (e.g., delete)
    if (rompslompResponse.status === 204) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const responseData = await rompslompResponse.json();

    if (!rompslompResponse.ok) {
      console.error('Rompslomp API error:', responseData);
      return new Response(JSON.stringify({ 
        error: responseData.error?.message || 'Rompslomp API error',
        type: responseData.error?.type 
      }), {
        status: rompslompResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in rompslomp-api function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
