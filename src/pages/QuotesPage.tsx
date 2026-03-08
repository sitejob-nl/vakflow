import { useState, useMemo, useEffect } from "react";
import { useQuotes, useUpdateQuote, useDeleteQuote, useConvertQuoteToWorkOrder, useConvertQuoteToInvoice, useConvertQuoteToProject, type Quote } from "@/hooks/useQuotes";
import { format } from "date-fns";
import { Loader2, ChevronLeft, FileDown, Plus, RefreshCw, Trash2, FileText, Receipt, CalendarPlus, FolderKanban, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import QuoteDialog from "@/components/QuoteDialog";
import AppointmentDialog from "@/components/AppointmentDialog";

const tabs = ["Alle", "Openstaand", "Geaccepteerd"];

const statusConfig: Record<string, { label: string; variant: string }> = {
  concept: { label: "Concept", variant: "cyan" },
  verzonden: { label: "Verzonden", variant: "warning" },
  geaccepteerd: { label: "Geaccepteerd", variant: "success" },
  afgewezen: { label: "Afgewezen", variant: "destructive" },
};

const badgeStyles: Record<string, string> = {
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  destructive: "bg-destructive-muted text-destructive",
  cyan: "bg-cyan-muted text-cyan",
};

const QuotesPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [appointmentPrefill, setAppointmentPrefill] = useState<{ customer_id?: string; notes?: string } | undefined>(undefined);
  const { data: quotes, isLoading } = useQuotes();
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();
  const convertToWorkOrder = useConvertQuoteToWorkOrder();
  const convertToInvoice = useConvertQuoteToInvoice();
  const convertToProject = useConvertQuoteToProject();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const [sendingReminder, setSendingReminder] = useState(false);

  // Load accounting provider info
  const [accountingProvider, setAccountingProvider] = useState<string | null>(null);
  const [syncQuotes, setSyncQuotes] = useState(false);
  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies_safe" as any).select("accounting_provider, sync_quotes_to_accounting").eq("id", companyId).single().then(({ data }: any) => {
      setAccountingProvider(data?.accounting_provider ?? null);
      setSyncQuotes(!!data?.sync_quotes_to_accounting);
    });
  }, [companyId]);

  const { containerRef, pullDistance, refreshing, isTriggered } = usePullToRefresh({
    onRefresh: () => queryClient.invalidateQueries({ queryKey: ["quotes"] }),
  });

  const filtered = useMemo(() => {
    if (!quotes) return [];
    if (activeTab === 1) return quotes.filter((q) => q.status === "concept" || q.status === "verzonden");
    if (activeTab === 2) return quotes.filter((q) => q.status === "geaccepteerd");
    return quotes;
  }, [quotes, activeTab]);

  const selected = useMemo(() => {
    if (selectedId) return quotes?.find((q) => q.id === selectedId) ?? null;
    return filtered[0] ?? null;
  }, [selectedId, filtered, quotes]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const updates: any = { id, status };
      if (status === "verzonden") {
        updates.issued_at = new Date().toISOString().split("T")[0];
        const valid = new Date();
        valid.setDate(valid.getDate() + 14);
        updates.valid_until = valid.toISOString().split("T")[0];
      }
      await updateQuote.mutateAsync(updates);
      toast({ title: `Offerte status: ${statusConfig[status]?.label ?? status}` });

      // Auto-sync to accounting provider when status becomes "verzonden"
      if (status === "verzonden" && syncQuotes && accountingProvider) {
        const funcMap: Record<string, string> = { rompslomp: "sync-rompslomp", moneybird: "sync-moneybird", wefact: "sync-wefact", eboekhouden: "sync-invoice-eboekhouden", exact: "sync-exact" };
        const labelMap: Record<string, string> = { rompslomp: "Rompslomp", moneybird: "Moneybird", wefact: "WeFact", eboekhouden: "e-Boekhouden", exact: "Exact Online" };
        const funcName = funcMap[accountingProvider];
        const providerLabel = labelMap[accountingProvider] ?? accountingProvider;
        if (funcName) {
          supabase.functions.invoke(funcName, {
            body: { action: accountingProvider === "eboekhouden" ? "sync-quote" : "create-quote", quote_id: id },
          }).then(({ data, error }) => {
            if (error || data?.error) {
              toast({ title: `${providerLabel} sync mislukt`, description: (data?.error || error?.message) ?? "Onbekende fout", variant: "destructive" });
            } else {
              toast({ title: `✓ Offerte gesynchroniseerd met ${providerLabel}` });
            }
          });
        }
      }
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteQuote.mutateAsync(id);
      setSelectedId(null);
      toast({ title: "Offerte verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobilePreview(true);
  };

  const handleEdit = (q: Quote) => {
    setEditQuote(q);
    setDialogOpen(true);
  };

  const handleScheduleAppointment = (quote: Quote) => {
    setAppointmentPrefill({
      customer_id: quote.customer_id,
      notes: quote.items.map((i) => `${i.description} (${i.qty}x — €${Number(i.unit_price).toFixed(2)})`).join("\n"),
    });
    setAppointmentDialogOpen(true);
  };

  const handleConvertToWorkOrder = async (quote: Quote) => {
    try {
      const wo = await convertToWorkOrder.mutateAsync(quote);
      toast({ title: `Werkbon ${(wo as any).work_order_number ?? ""} aangemaakt vanuit offerte` });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleConvertToInvoice = async (quote: Quote) => {
    try {
      const inv = await convertToInvoice.mutateAsync(quote);
      toast({ title: `Factuur ${(inv as any).invoice_number ?? ""} aangemaakt als concept` });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const eur = (n: number) => `€ ${Number(n).toFixed(2)}`;

  const QuotePreview = () => {
    if (!selected) return (
      <div className="bg-card rounded-lg p-9 text-center text-muted-foreground text-sm border border-border">
        Selecteer een offerte om de preview te zien
      </div>
    );

    return (
      <div className="bg-card rounded-lg p-5 md:p-9 text-[13px] shadow-card-hover border border-border">
        <button onClick={() => setMobilePreview(false)} className="md:hidden flex items-center gap-1 text-[12px] text-t3 font-semibold mb-4 hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Terug naar lijst
        </button>

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <h1 className="text-[20px] md:text-[26px] font-extrabold tracking-[6px] uppercase text-foreground">VAKFLOW</h1>
        </div>

        {/* Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-5 text-secondary-foreground text-[12px] md:text-[13px]">
          <div>
            <strong className="text-foreground">Offerte aan:</strong><br />
            {selected.customers?.name ?? "—"}<br />
            {selected.customers?.address ?? ""}<br />
            {[selected.customers?.postal_code, selected.customers?.city].filter(Boolean).join(" ")}
          </div>
          <div className="sm:text-right">
            <strong className="text-foreground">offerte nr.</strong> {selected.quote_number ?? "—"}<br />
            <strong className="text-foreground">Datum:</strong> {selected.issued_at ? format(new Date(selected.issued_at), "dd-MM-yyyy") : "—"}
          </div>
        </div>

        {/* Items table */}
        <div className="overflow-x-auto">
          <table className="w-full mb-5 min-w-[300px]">
            <thead>
              <tr>
                <th className="bg-muted text-foreground text-[10px] uppercase p-2 px-3 text-left font-extrabold border-b border-border w-[45%]">Artikel</th>
                <th className="bg-muted text-foreground text-[10px] uppercase p-2 px-3 text-center font-extrabold border-b border-border w-[15%]">Hoeveelheid</th>
                <th className="bg-muted text-foreground text-[10px] uppercase p-2 px-3 text-center font-extrabold border-b border-border w-[20%]">Prijs per eenheid</th>
                <th className="bg-muted text-foreground text-[10px] uppercase p-2 px-3 text-center font-extrabold border-b border-border w-[20%]">Totaal</th>
              </tr>
            </thead>
            <tbody className="text-secondary-foreground">
              {selected.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="p-2 px-3 border-b border-border/50 uppercase text-[10px] font-semibold">{item.description}</td>
                  <td className="p-2 px-3 text-center border-b border-border/50">{item.qty}</td>
                  <td className="p-2 px-3 text-center border-b border-border/50">{eur(item.unit_price)}</td>
                  <td className="p-2 px-3 text-center border-b border-border/50">{eur(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Optional + Totals side by side */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-5">
          {selected.optional_items.length > 0 && (
            <div className="sm:w-[48%]">
              <div className="flex justify-between font-extrabold text-[10px] uppercase p-2 px-3 bg-muted border-b border-border">
                <span>Optioneel</span><span>Prijs</span>
              </div>
              {selected.optional_items.map((opt, idx) => (
                <div key={idx} className="flex justify-between p-2 px-3 border-b border-border/50 text-[9px] uppercase">
                  <span>{opt.description}</span><span>{eur(opt.price)}</span>
                </div>
              ))}
            </div>
          )}
          <div className={`${selected.optional_items.length > 0 ? "sm:w-[38%]" : "sm:ml-auto sm:w-[38%]"}`}>
            <div className="flex justify-between font-extrabold text-[11px] mb-2"><span>Subtotaal</span><span>{eur(selected.subtotal)}</span></div>
            <div className="flex justify-between font-extrabold text-[11px] mb-2"><span>Belasting (21%)</span><span>{eur(selected.vat_amount)}</span></div>
            <div className="border-t border-border pt-3 mt-3 flex justify-between font-black text-[14px]"><span>Totaal</span><span>{eur(selected.total)}</span></div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted rounded p-3 md:p-4 mb-4">
          <div className="grid grid-cols-3 gap-2 text-[10px] md:text-[11px]">
            <div>
              <h4 className="font-extrabold mb-1">Betalingsinformatie</h4>
              <p>Naam rekening: Vakflow</p>
              <p>NL95 INGB 0111 7593 82</p>
            </div>
            <div>
              <h4 className="font-extrabold mb-1">Vakflow</h4>
              <p>KvK: 84448237</p>
              <p>Btw: NL003986995B37</p>
            </div>
            <div>
              <h4 className="font-extrabold mb-1">Adres</h4>
              <p>Graaf Willem II laan 34</p>
              <p>1964 JN Heemskerk</p>
            </div>
          </div>
        </div>

        <p className="text-center font-extrabold text-[12px] md:text-[14px] text-foreground">
          Deze offerte vervalt 14 dagen na offertedatum
        </p>

        {/* Actions */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {selected.status === "concept" && (
            <>
              <button onClick={() => handleEdit(selected)} className="px-3 py-1.5 bg-card border border-border text-secondary-foreground rounded-sm text-[12px] font-bold hover:bg-bg-hover transition-colors">
                ✏️ Bewerken
              </button>
              <button onClick={() => handleStatusChange(selected.id, "verzonden")} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors">
                📤 Verzenden
              </button>
            </>
          )}
          {selected.status === "verzonden" && (
            <>
              <button onClick={() => handleStatusChange(selected.id, "geaccepteerd")} className="px-3 py-1.5 bg-accent text-accent-foreground rounded-sm text-[12px] font-bold hover:bg-accent-hover transition-colors">
                ✓ Geaccepteerd
              </button>
              <button onClick={() => handleStatusChange(selected.id, "afgewezen")} className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-sm text-[12px] font-bold hover:bg-destructive/90 transition-colors">
                ✕ Afgewezen
              </button>
            </>
          )}
          {selected.status === "geaccepteerd" && (
            <>
              <button onClick={() => handleConvertToWorkOrder(selected)} className="px-3 py-1.5 bg-card border border-border text-secondary-foreground rounded-sm text-[12px] font-bold hover:bg-bg-hover transition-colors flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" /> Werkbon
              </button>
              <button onClick={() => handleConvertToInvoice(selected)} className="px-3 py-1.5 bg-card border border-border text-secondary-foreground rounded-sm text-[12px] font-bold hover:bg-bg-hover transition-colors flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5" /> Factuur
              </button>
              <button onClick={() => handleScheduleAppointment(selected)} className="px-3 py-1.5 bg-card border border-border text-secondary-foreground rounded-sm text-[12px] font-bold hover:bg-bg-hover transition-colors flex items-center gap-1">
                <CalendarPlus className="h-3.5 w-3.5" /> Afspraak
              </button>
              <button onClick={async () => {
                try {
                  const p = await convertToProject.mutateAsync(selected);
                  toast({ title: `Project ${(p as any).project_number ?? ""} aangemaakt` });
                } catch (err: any) {
                  toast({ title: "Fout", description: err.message, variant: "destructive" });
                }
              }} className="px-3 py-1.5 bg-card border border-border text-secondary-foreground rounded-sm text-[12px] font-bold hover:bg-bg-hover transition-colors flex items-center gap-1">
                <FolderKanban className="h-3.5 w-3.5" /> Project
              </button>
            </>
          )}
          <button
            onClick={async () => {
              try {
                const res = await supabase.functions.invoke("generate-quote-pdf", {
                  body: { quote_id: selected.id },
                });
                if (res.error) throw res.error;
                const blob = new Blob([res.data], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Offerte_${selected.quote_number ?? selected.id}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (err: any) {
                toast({ title: "PDF fout", description: err.message, variant: "destructive" });
              }
            }}
            className="px-3 py-1.5 bg-card border border-border text-secondary-foreground rounded-sm text-[12px] font-bold hover:bg-bg-hover transition-colors flex items-center gap-1"
          >
            <FileDown className="h-3.5 w-3.5" /> PDF
          </button>
          {selected.status === "concept" && (
            <button onClick={() => handleDelete(selected.id)} className="px-3 py-1.5 bg-card border border-border text-destructive rounded-sm text-[12px] font-bold hover:bg-bg-hover transition-colors flex items-center gap-1">
              <Trash2 className="h-3.5 w-3.5" /> Verwijderen
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef}>
      {/* Pull-to-refresh */}
      <div className="flex justify-center items-center overflow-hidden transition-all duration-200 lg:hidden" style={{ height: pullDistance > 0 ? `${pullDistance}px` : 0 }}>
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <RefreshCw className={`h-5 w-5 transition-transform ${isTriggered ? "rotate-180" : ""} ${refreshing ? "animate-spin" : ""}`} />
        </div>
      </div>

      {/* Header with new button */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-0 border-b-2 border-border overflow-x-auto scrollbar-hide">
            {tabs.map((t, i) => (
              <button key={t} onClick={() => setActiveTab(i)} className={`px-4 md:px-5 py-2.5 text-[12px] md:text-[13px] font-bold border-b-2 -mb-[2px] transition-colors whitespace-nowrap ${i === activeTab ? "text-primary border-primary" : "text-t3 border-transparent hover:text-secondary-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
          <Button size="sm" className="shrink-0" onClick={() => { setEditQuote(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Nieuwe offerte</span><span className="sm:hidden">Nieuw</span>
          </Button>
        </div>
      </div>
      {/* Mobile */}
      <div className="md:hidden">
        {mobilePreview ? (
          <QuotePreview />
        ) : (
          <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border"><h3 className="text-[14px] font-bold">Offertes</h3></div>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : !filtered.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Geen offertes gevonden</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((q) => {
                  const cfg = statusConfig[q.status] ?? statusConfig.concept;
                  const isExpired = q.status === "verzonden" && (q as any).valid_until && new Date((q as any).valid_until) < new Date();
                  return (
                    <div key={q.id} onClick={() => handleSelect(q.id)} className="px-4 py-3 flex items-center gap-3 active:bg-bg-hover transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold truncate">{q.customers?.name ?? "—"}</div>
                        <div className="text-[11px] text-t3 font-mono">{q.quote_number ?? "—"} · {eur(q.total)}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isExpired && <span className="inline-flex px-2 py-[2px] rounded-full text-[10px] font-bold bg-warning/10 text-warning">Verlopen</span>}
                        <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${badgeStyles[cfg.variant]}`}>{cfg.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
        <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border"><h3 className="text-[15px] font-bold">Offertes</h3></div>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !filtered.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Geen offertes gevonden</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-background">
                  {["Nummer", "Klant", "Bedrag", "Status"].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => {
                  const cfg = statusConfig[q.status] ?? statusConfig.concept;
                  const isExpired = q.status === "verzonden" && (q as any).valid_until && new Date((q as any).valid_until) < new Date();
                  return (
                    <tr key={q.id} onClick={() => setSelectedId(q.id)} className={`hover:bg-bg-hover transition-colors cursor-pointer ${selected?.id === q.id ? "bg-bg-active" : ""}`}>
                      <td className="px-5 py-3 text-[12px] font-mono">{q.quote_number ?? "—"}</td>
                      <td className="px-5 py-3 text-[13.5px]">{q.customers?.name ?? "—"}</td>
                      <td className="px-5 py-3 font-mono">{eur(q.total)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {isExpired && <span className="inline-flex px-2 py-[2px] rounded-full text-[10px] font-bold bg-warning/10 text-warning">Verlopen</span>}
                          <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${badgeStyles[cfg.variant]}`}>{cfg.label}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <QuotePreview />
      </div>

      <QuoteDialog open={dialogOpen} onOpenChange={setDialogOpen} editQuote={editQuote} onScheduleAppointment={handleScheduleAppointment} />
      <AppointmentDialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen} prefill={appointmentPrefill} />
    </div>
  );
};

export default QuotesPage;
