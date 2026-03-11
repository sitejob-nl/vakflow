import { useState } from "react";
import { FileText, RefreshCw, Download, Loader2, Filter, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useRompslompInvoices, useRompslompSettings, useDownloadInvoicePdf } from "@/hooks/useRompslomp";
import type { RompslompInvoice } from "@/hooks/useRompslomp";
import { format, subMonths, startOfYear, endOfYear } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";

const formatCurrency = (v: string) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(parseFloat(v));

type FilterSelection = "all" | "published" | "concept" | "unpaid" | "paid";
const filterOptions: { value: FilterSelection; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "published", label: "Verstuurd" },
  { value: "concept", label: "Concepten" },
  { value: "unpaid", label: "Onbetaald" },
  { value: "paid", label: "Betaald" },
];

export function RompslompInvoices() {
  const { data: settings } = useRompslompSettings();
  const hasSettings = !!settings?.company_id;
  const [filter, setFilter] = useState<FilterSelection>("all");
  const [dateRange, setDateRange] = useState<"3months" | "6months" | "year" | "all">("3months");

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "3months": return { from: format(subMonths(now, 3), "yyyy-MM-dd"), till: format(now, "yyyy-MM-dd") };
      case "6months": return { from: format(subMonths(now, 6), "yyyy-MM-dd"), till: format(now, "yyyy-MM-dd") };
      case "year": return { from: format(startOfYear(now), "yyyy-MM-dd"), till: format(endOfYear(now), "yyyy-MM-dd") };
      case "all": return {};
    }
  };

  const { data: invoices = [], isLoading, refetch, isFetching } = useRompslompInvoices(hasSettings, {
    ...getDateFilter(),
    selection: filter === "paid" ? "all" : filter,
  });
  const downloadPdf = useDownloadInvoicePdf();

  const filteredInvoices = filter === "paid" ? invoices.filter((i) => i.payment_status === "paid") : invoices;

  const stats = {
    total: filteredInvoices.length,
    totalAmount: filteredInvoices.reduce((s, i) => s + parseFloat(i.price_with_vat), 0),
    paid: filteredInvoices.filter((i) => i.payment_status === "paid").length,
    unpaid: filteredInvoices.filter((i) => i.payment_status === "unpaid" && i.status !== "concept").length,
  };

  const handleDownload = async (inv: RompslompInvoice) => {
    try {
      await downloadPdf.mutateAsync({ invoiceId: inv.id, invoiceNumber: inv.invoice_number });
      toast.success("PDF gedownload");
    } catch {
      toast.error("Fout bij downloaden");
    }
  };

  if (!hasSettings) return null;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Totaal", value: formatCurrency(stats.totalAmount.toString()), color: "text-primary" },
          { label: "Betaald", value: stats.paid, color: "text-success" },
          { label: "Onbetaald", value: stats.unpaid, color: "text-destructive" },
          { label: "Facturen", value: stats.total, color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-3">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg p-3">
        <Filter size={14} className="text-muted-foreground" />
        {filterOptions.map((o) => (
          <button
            key={o.value}
            onClick={() => setFilter(o.value)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-sm transition-colors ${
              filter === o.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {o.label}
          </button>
        ))}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
          className="ml-auto px-2 py-1 text-[11px] border border-border rounded-sm bg-background"
        >
          <option value="3months">3 maanden</option>
          <option value="6months">6 maanden</option>
          <option value="year">Dit jaar</option>
          <option value="all">Alles</option>
        </select>
        <button onClick={() => refetch()} disabled={isFetching} className="p-1 text-muted-foreground hover:text-foreground">
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filteredInvoices.length === 0 ? (
        <p className="text-center py-8 text-[13px] text-muted-foreground">Geen facturen gevonden</p>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Nr.</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Klant</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Datum</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bedrag</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-[12px] font-medium text-foreground">{inv.invoice_number || `#${inv.id}`}</td>
                  <td className="px-3 py-2.5 text-[12px] text-foreground truncate max-w-[150px]">{inv.cached_contact?.name || "-"}</td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground hidden md:table-cell">{format(new Date(inv.date), "d MMM yyyy", { locale: nl })}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-[12px] text-foreground">{formatCurrency(inv.price_with_vat)}</td>
                  <td className="px-3 py-2.5">
                    {inv.status === "concept" ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded-sm"><Clock size={10} /> Concept</span>
                    ) : inv.payment_status === "paid" ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-success/10 text-success rounded-sm"><CheckCircle size={10} /> Betaald</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-destructive/10 text-destructive rounded-sm"><AlertCircle size={10} /> Open</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => handleDownload(inv)}
                      disabled={downloadPdf.isPending || inv.status === "concept"}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-foreground hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {downloadPdf.isPending ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
