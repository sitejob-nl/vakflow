import { useState } from 'react';
import { 
  FileText, 
  RefreshCw, 
  Download, 
  Loader2, 
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Euro
} from 'lucide-react';
import { useRompslompInvoices, useRompslompSettings, useDownloadInvoicePdf, type RompslompInvoice } from '@/hooks/useRompslomp';
import { format, subMonths, startOfYear, endOfYear } from 'date-fns';
import { nl } from 'date-fns/locale';
import { toast } from 'sonner';

const formatCurrency = (value: string) => {
  return new Intl.NumberFormat('nl-NL', { 
    style: 'currency', 
    currency: 'EUR' 
  }).format(parseFloat(value));
};

type FilterSelection = 'all' | 'published' | 'concept' | 'unpaid' | 'paid';

const filterOptions: { value: FilterSelection; label: string }[] = [
  { value: 'all', label: 'Alle facturen' },
  { value: 'published', label: 'Verstuurd' },
  { value: 'concept', label: 'Concepten' },
  { value: 'unpaid', label: 'Onbetaald' },
  { value: 'paid', label: 'Betaald' },
];

export function RompslompInvoices() {
  const { data: settings } = useRompslompSettings();
  const [filter, setFilter] = useState<FilterSelection>('all');
  const [dateRange, setDateRange] = useState<'3months' | '6months' | 'year' | 'all'>('3months');
  
  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case '3months':
        return { from: format(subMonths(now, 3), 'yyyy-MM-dd'), till: format(now, 'yyyy-MM-dd') };
      case '6months':
        return { from: format(subMonths(now, 6), 'yyyy-MM-dd'), till: format(now, 'yyyy-MM-dd') };
      case 'year':
        return { from: format(startOfYear(now), 'yyyy-MM-dd'), till: format(endOfYear(now), 'yyyy-MM-dd') };
      case 'all':
        return {};
    }
  };
  
  const { data: invoices = [], isLoading, refetch, isFetching } = useRompslompInvoices(
    settings?.company_id ?? null,
    { ...getDateFilter(), selection: filter === 'paid' ? 'all' : filter }
  );
  
  const downloadPdf = useDownloadInvoicePdf();

  // Filter paid invoices client-side since API doesn't have a "paid" selection
  const filteredInvoices = filter === 'paid' 
    ? invoices.filter(i => i.payment_status === 'paid')
    : invoices;

  // Calculate stats
  const stats = {
    total: filteredInvoices.length,
    totalAmount: filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.price_with_vat), 0),
    paid: filteredInvoices.filter(i => i.payment_status === 'paid').length,
    unpaid: filteredInvoices.filter(i => i.payment_status === 'unpaid' && i.status !== 'concept').length,
    concepts: filteredInvoices.filter(i => i.status === 'concept').length,
  };

  const handleDownload = async (invoice: RompslompInvoice) => {
    if (!settings?.company_id) return;
    
    try {
      await downloadPdf.mutateAsync({
        companyId: settings.company_id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
      });
      toast.success('PDF gedownload');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Fout bij downloaden van PDF');
    }
  };

  if (!settings) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="bg-white border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-admin-gold/10 rounded">
              <Euro size={16} className="sm:w-5 sm:h-5 text-admin-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-admin-dark truncate">{formatCurrency(stats.totalAmount.toString())}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Totaal</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-green-50 rounded">
              <CheckCircle size={16} className="sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-admin-dark">{stats.paid}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Betaald</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-red-50 rounded">
              <AlertCircle size={16} className="sm:w-5 sm:h-5 text-red-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-admin-dark">{stats.unpaid}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Onbetaald</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-gray-100 rounded">
              <Clock size={16} className="sm:w-5 sm:h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-admin-dark">{stats.concepts}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Concepten</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 bg-white border border-gray-200 p-3 sm:p-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter size={16} className="text-gray-400 flex-shrink-0" />
          <div className="flex gap-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === option.value
                    ? 'bg-admin-dark text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-xs border border-gray-200 bg-white focus:outline-none focus:border-admin-gold"
          >
            <option value="3months">3 maanden</option>
            <option value="6months">6 maanden</option>
            <option value="year">Dit jaar</option>
            <option value="all">Alles</option>
          </select>
          
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 text-gray-400 hover:text-admin-dark transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Invoices - Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-admin-gold" size={32} />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white border border-gray-200">
            <FileText className="mx-auto mb-3 opacity-30" size={40} />
            <p className="text-sm">Geen facturen gevonden</p>
          </div>
        ) : (
          filteredInvoices.map((invoice) => (
            <div key={invoice.id} className="bg-white border border-gray-200 p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-mono text-sm font-medium text-admin-dark">
                    {invoice.invoice_number || `#${invoice.id}`}
                  </span>
                  <p className="text-xs text-gray-600 mt-0.5">{invoice.cached_contact?.name || '-'}</p>
                </div>
                {invoice.status === 'concept' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
                    <Clock size={10} /> Concept
                  </span>
                ) : invoice.payment_status === 'paid' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 rounded">
                    <CheckCircle size={10} /> Betaald
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 rounded">
                    <AlertCircle size={10} /> Onbetaald
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                <span>{format(new Date(invoice.date), 'd MMM yyyy', { locale: nl })}</span>
                <span className="font-medium text-admin-dark">{formatCurrency(invoice.price_with_vat)}</span>
              </div>
              {invoice.status !== 'concept' && (
                <button
                  onClick={() => handleDownload(invoice)}
                  disabled={downloadPdf.isPending}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-admin-dark border border-admin-dark/20 hover:bg-admin-cream transition-colors disabled:opacity-50"
                >
                  {downloadPdf.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Download size={12} />
                  )}
                  Download PDF
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Invoices Table - Desktop */}
      <div className="hidden sm:block bg-white border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-admin-gold" size={32} />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FileText className="mx-auto mb-3 opacity-30" size={48} />
            <p>Geen facturen gevonden</p>
            <p className="text-sm text-gray-400">Pas de filters aan of maak een nieuwe factuur</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 lg:px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600">Factuurnr</th>
                  <th className="text-left px-3 lg:px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600">Klant</th>
                  <th className="text-left px-3 lg:px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600 hidden md:table-cell">Datum</th>
                  <th className="text-left px-3 lg:px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600 hidden lg:table-cell">Vervaldatum</th>
                  <th className="text-right px-3 lg:px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600">Bedrag</th>
                  <th className="text-left px-3 lg:px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600">Status</th>
                  <th className="px-3 lg:px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 lg:px-4 py-3">
                      <span className="font-mono text-sm font-medium text-admin-dark">
                        {invoice.invoice_number || `#${invoice.id}`}
                      </span>
                    </td>
                    <td className="px-3 lg:px-4 py-3">
                      <span className="text-sm text-gray-900 truncate block max-w-[150px]">{invoice.cached_contact?.name || '-'}</span>
                    </td>
                    <td className="px-3 lg:px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-gray-600">
                        {format(new Date(invoice.date), 'd MMM yyyy', { locale: nl })}
                      </span>
                    </td>
                    <td className="px-3 lg:px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-gray-600">
                        {format(new Date(invoice.due_date), 'd MMM yyyy', { locale: nl })}
                      </span>
                    </td>
                    <td className="px-3 lg:px-4 py-3 text-right">
                      <span className="font-medium text-admin-dark">
                        {formatCurrency(invoice.price_with_vat)}
                      </span>
                    </td>
                    <td className="px-3 lg:px-4 py-3">
                      {invoice.status === 'concept' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                          <Clock size={12} /> Concept
                        </span>
                      ) : invoice.payment_status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded">
                          <CheckCircle size={12} /> Betaald
                        </span>
                      ) : invoice.payment_status === 'partial' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-50 text-yellow-700 rounded">
                          <AlertCircle size={12} /> Deels
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-50 text-red-700 rounded">
                          <AlertCircle size={12} /> Open
                        </span>
                      )}
                    </td>
                    <td className="px-3 lg:px-4 py-3 text-right">
                      <button
                        onClick={() => handleDownload(invoice)}
                        disabled={downloadPdf.isPending || invoice.status === 'concept'}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-admin-dark hover:text-admin-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={invoice.status === 'concept' ? 'Concepten kunnen niet worden gedownload' : 'Download PDF'}
                      >
                        {downloadPdf.isPending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}