import { useState, useMemo, useEffect } from "react";
import { useInvoices, usePaginatedInvoices, useUpdateInvoice, useDeleteInvoice, useSyncInvoiceEboekhouden, usePullInvoiceStatusEboekhouden, useSyncInvoicesRompslomp, usePullInvoiceStatusRompslomp, useSyncInvoicesMoneybird, usePullInvoiceStatusMoneybird } from "@/hooks/useInvoices";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCommunicationLog } from "@/hooks/useCommunicationLogs";
import type { Invoice } from "@/hooks/useInvoices";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Loader2, ChevronLeft, ChevronRight, FileDown, RefreshCw, BookOpen, Plus, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import InvoiceDialog from "@/components/InvoiceDialog";

const tabs = ["Alle", "Openstaand", "Betaald"];

const statusConfig: Record<string, { label: string; variant: string }> = {
  concept: { label: "Concept", variant: "cyan" },
  verzonden: { label: "Verzonden", variant: "warning" },
  verstuurd: { label: "Verzonden", variant: "warning" },
  betaald: { label: "Betaald", variant: "success" },
  verlopen: { label: "Verlopen", variant: "destructive" },
};

const badgeStyles: Record<string, string> = {
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  destructive: "bg-destructive-muted text-destructive",
  cyan: "bg-cyan-muted text-cyan",
};

const PAGE_SIZE = 25;

const InvoicesPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);

  const statusFilter = activeTab === 0 ? null : activeTab === 1 ? "openstaand" : "betaald";
  const { data: result, isLoading } = usePaginatedInvoices({ page, pageSize: PAGE_SIZE, statusFilter });
  const invoices = result?.data ?? [];
  const totalCount = result?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const updateInvoice = useUpdateInvoice();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const syncEb = useSyncInvoiceEboekhouden();
  const pullStatusEb = usePullInvoiceStatusEboekhouden();
  const syncRompslomp = useSyncInvoicesRompslomp();
  const pullStatusRompslomp = usePullInvoiceStatusRompslomp();
  const syncMoneybird = useSyncInvoicesMoneybird();
  const pullStatusMoneybird = usePullInvoiceStatusMoneybird();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const createLog = useCreateCommunicationLog();
  const [accountingProvider, setAccountingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    (supabase.from("companies_safe" as any).select("accounting_provider").eq("id", companyId).single() as unknown as Promise<{ data: any }>).then(({ data }) => {
      setAccountingProvider(data?.accounting_provider ?? null);
    });
  }, [companyId]);

  const { containerRef, pullDistance, refreshing, isTriggered } = usePullToRefresh({
    onRefresh: () => queryClient.invalidateQueries({ queryKey: ["invoices-paginated"] }),
  });

  // Server-side filtering handles tabs now, so filtered = invoices
  const filtered = invoices;

  const selected = useMemo(() => {
    if (selectedId) return invoices?.find((i) => i.id === selectedId) ?? null;
    return filtered[0] ?? null;
  }, [selectedId, filtered, invoices]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const updates: any = { id, status };
      if (status === "betaald") updates.paid_at = new Date().toISOString().split("T")[0];
      if (status === "verzonden") {
        updates.issued_at = new Date().toISOString().split("T")[0];
        const due = new Date();
        due.setDate(due.getDate() + 30);
        updates.due_at = due.toISOString().split("T")[0];
      }
      await updateInvoice.mutateAsync(updates);
      toast({ title: `Factuur status gewijzigd naar ${statusConfig[status]?.label ?? status}` });

      // Auto-sync when status becomes "verzonden"
      if (status === "verzonden") {
        if (accountingProvider === "rompslomp") {
          handleSyncRompslomp();
        } else if (accountingProvider === "moneybird") {
          handleSyncMoneybird();
        } else if (accountingProvider === "eboekhouden") {
          handleSyncEb(id);
        }
      }

      // Pull invoice status when marked as paid
      if (status === "betaald") {
        if (accountingProvider === "rompslomp") {
          pullStatusRompslomp.mutateAsync().then(() => {
            toast({ title: "✓ Betaalstatus gesynchroniseerd met Rompslomp" });
          }).catch((err: any) => {
            toast({ title: "Rompslomp status sync mislukt", description: err.message, variant: "destructive" });
          });
        } else if (accountingProvider === "moneybird") {
          pullStatusMoneybird.mutateAsync().then(() => {
            toast({ title: "✓ Betaalstatus gesynchroniseerd met Moneybird" });
          }).catch((err: any) => {
            toast({ title: "Moneybird status sync mislukt", description: err.message, variant: "destructive" });
          });
        } else if (accountingProvider === "eboekhouden") {
          pullStatusEb.mutateAsync().then(() => {
            toast({ title: "✓ Betaalstatus gesynchroniseerd met e-Boekhouden" });
          }).catch((err: any) => {
            toast({ title: "e-Boekhouden status sync mislukt", description: err.message, variant: "destructive" });
          });
        }
      }
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleSyncRompslomp = async () => {
    setSyncingId("rompslomp");
    try {
      const result = await syncRompslomp.mutateAsync();
      const errMsg = result?.errors?.length ? `\nFouten: ${result.errors.join(", ")}` : "";
      if ((result?.synced ?? 0) > 0) {
        toast({ title: "Gesynchroniseerd met Rompslomp", description: `${result.synced} facturen gesynchroniseerd${errMsg}` });
      } else if (result?.errors?.length) {
        toast({ title: "Rompslomp sync mislukt", description: result.errors.join("; "), variant: "destructive" });
      } else {
        toast({ title: "Geen facturen om te synchroniseren", description: `Overgeslagen: ${result?.skipped ?? 0}` });
      }
    } catch (err: any) {
      toast({ title: "Rompslomp sync mislukt", description: err.message, variant: "destructive" });
    }
    setSyncingId(null);
  };

  const handleSyncMoneybird = async () => {
    setSyncingId("moneybird");
    try {
      const result = await syncMoneybird.mutateAsync();
      const errMsg = result?.errors?.length ? `\nFouten: ${result.errors.join(", ")}` : "";
      if ((result?.synced ?? 0) > 0) {
        toast({ title: "Gesynchroniseerd met Moneybird", description: `${result.synced} facturen gesynchroniseerd${errMsg}` });
      } else if (result?.errors?.length) {
        toast({ title: "Moneybird sync mislukt", description: result.errors.join("; "), variant: "destructive" });
      } else {
        toast({ title: "Geen facturen om te synchroniseren", description: `Overgeslagen: ${result?.skipped ?? 0}` });
      }
    } catch (err: any) {
      toast({ title: "Moneybird sync mislukt", description: err.message, variant: "destructive" });
    }
    setSyncingId(null);
  };

  const handleSyncEb = async (id: string) => {
    setSyncingId(id);
    try {
      const result = await syncEb.mutateAsync(id);
      if (result?.message === "Al gesynchroniseerd") {
        toast({ title: "Al gesynchroniseerd", description: "Deze factuur staat al in e-Boekhouden." });
      } else {
        toast({ title: "Gesynchroniseerd met e-Boekhouden", description: `ID: ${result?.eboekhouden_id}` });
      }
    } catch (err: any) {
      toast({ title: "e-Boekhouden sync mislukt", description: err.message, variant: "destructive" });
    }
    setSyncingId(null);
  };

  const serviceName = (inv: Invoice) => (inv.work_orders as any)?.services?.name ?? "Dienst";
  const woNumber = (inv: Invoice) => (inv.work_orders as any)?.work_order_number ?? "—";

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobilePreview(true);
  };

  // Invoice preview component
  const InvoicePreview = () => {
    if (!selected) return (
      <div className="bg-card rounded-lg p-9 text-center text-muted-foreground text-sm border border-border">
        Selecteer een factuur om de preview te zien
      </div>
    );

    return (
      <div className="bg-card rounded-lg p-5 md:p-9 text-[13px] shadow-card-hover border border-border">
        {/* Mobile back button */}
        <button onClick={() => setMobilePreview(false)} className="md:hidden flex items-center gap-1 text-[12px] text-t3 font-semibold mb-4 hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Terug naar lijst
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-handwriting text-[26px] md:text-[32px] font-bold text-primary mb-0.5">Factuur</h1>
            <p className="text-[12px] text-t3 font-mono">{selected.invoice_number ?? "—"}</p>
          </div>
          <div className="text-right">
            <div className="font-handwriting text-lg md:text-xl font-extrabold text-primary">Vakflow</div>
            <div className="text-[10px] md:text-[11px] text-t3 leading-relaxed">Heemskerk<br/>KvK 84448237</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 my-4 md:my-5 text-secondary-foreground text-[12px] md:text-[13px]">
          <div>
            <strong className="text-foreground">Factuur aan:</strong><br/>
            {selected.customers?.name ?? "—"}<br/>
            {selected.customers?.address ?? ""}<br/>
            {[selected.customers?.postal_code, selected.customers?.city].filter(Boolean).join(" ")}
          </div>
          <div className="sm:text-right">
            <strong className="text-foreground">Datum:</strong> {selected.issued_at ? format(new Date(selected.issued_at), "dd-MM-yyyy") : "—"}<br/>
            <strong className="text-foreground">Vervalt:</strong> {selected.due_at ? format(new Date(selected.due_at), "dd-MM-yyyy") : "—"}<br/>
            <strong className="text-foreground">Werkbon:</strong> {woNumber(selected)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full my-4 md:my-5 min-w-[300px]">
            <thead>
              <tr>
                <th className="bg-primary-muted text-primary text-[10px] uppercase p-2 px-3 text-left font-bold border-b-2 border-border">Omschrijving</th>
                <th className="bg-primary-muted text-primary text-[10px] uppercase p-2 px-3 text-right font-bold border-b-2 border-border">Aantal</th>
                <th className="bg-primary-muted text-primary text-[10px] uppercase p-2 px-3 text-right font-bold border-b-2 border-border">Prijs</th>
                <th className="bg-primary-muted text-primary text-[10px] uppercase p-2 px-3 text-right font-bold border-b-2 border-border">Totaal</th>
              </tr>
            </thead>
            <tbody className="text-secondary-foreground">
              {Array.isArray(selected.items) && (selected.items as any[]).length > 0 ? (
                (selected.items as any[]).map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="p-2 px-3 border-b border-border/50">{item.description}</td>
                    <td className="p-2 px-3 text-right border-b border-border/50">{item.qty}</td>
                    <td className="p-2 px-3 text-right border-b border-border/50">€ {Number(item.unit_price).toFixed(2)}</td>
                    <td className="p-2 px-3 text-right border-b border-border/50">€ {(item.qty * item.unit_price).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-2 px-3 border-b border-border/50">{serviceName(selected)}</td>
                  <td className="p-2 px-3 text-right border-b border-border/50">1</td>
                  <td className="p-2 px-3 text-right border-b border-border/50">€ {Number(selected.subtotal).toFixed(2)}</td>
                  <td className="p-2 px-3 text-right border-b border-border/50">€ {Number(selected.subtotal).toFixed(2)}</td>
                </tr>
              )}
              <tr><td colSpan={3} className="p-2 px-3 text-right text-t3 text-[12px]">Subtotaal</td><td className="p-2 px-3 text-right">€ {Number(selected.subtotal).toFixed(2)}</td></tr>
              <tr><td colSpan={3} className="p-2 px-3 text-right text-t3 text-[12px]">BTW {Number(selected.vat_percentage)}%</td><td className="p-2 px-3 text-right">€ {Number(selected.vat_amount).toFixed(2)}</td></tr>
              <tr className="font-extrabold text-sm text-primary border-t-2 border-primary">
                <td colSpan={3} className="p-2 px-3 text-right">Totaal</td>
                <td className="p-2 px-3 text-right">€ {Number(selected.total).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 mt-3.5 flex-wrap">
          {selected.status === "concept" && (
            <button onClick={() => handleStatusChange(selected.id, "verzonden")} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors">
              📤 Verzonden
            </button>
          )}
          {(selected.status === "verzonden" || selected.status === "verlopen") && (
            <button onClick={() => handleStatusChange(selected.id, "betaald")} className="px-3 py-1.5 bg-accent text-accent-foreground rounded-sm text-[12px] font-bold hover:bg-accent-hover transition-colors">
              ✓ Betaald
            </button>
          )}
          {/* PDF button - use accounting provider PDF when available, otherwise generate own */}
          {(selected.rompslomp_id || (selected as any).moneybird_id) ? (
            <button
              onClick={async () => {
                try {
                  const isMoneybird = !!(selected as any).moneybird_id;
                  const funcName = isMoneybird ? "sync-moneybird" : "sync-rompslomp";
                  const bodyPayload = isMoneybird
                    ? { action: "download-pdf", moneybird_id: (selected as any).moneybird_id }
                    : { action: "download-pdf", rompslomp_id: selected.rompslomp_id };
                  const res = await supabase.functions.invoke(funcName, { body: bodyPayload });
                  if (res.error) throw res.error;
                  const blob = new Blob([res.data], { type: "application/pdf" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `Factuur_${selected.invoice_number ?? selected.id}.pdf`;
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
          ) : (
          <button
            onClick={async () => {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await supabase.functions.invoke("generate-invoice-pdf", {
                  body: { invoice_id: selected.id },
                });
                if (res.error) throw res.error;
                const blob = new Blob([res.data], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Factuur_${selected.invoice_number ?? selected.id}.pdf`;
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
          )}
          {/* E-mail button - only if customer has email */}
          {selected.customers?.email && (
            <button
              onClick={async () => {
                setSendingEmail(true);
                try {
                  // 1. Generate PDF (use accounting provider PDF if available)
                  let pdfBlob: Blob;
                  if ((selected as any).moneybird_id) {
                    const res = await supabase.functions.invoke("sync-moneybird", {
                      body: { action: "download-pdf", moneybird_id: (selected as any).moneybird_id },
                    });
                    if (res.error) throw res.error;
                    pdfBlob = new Blob([res.data], { type: "application/pdf" });
                  } else if (selected.rompslomp_id) {
                    const res = await supabase.functions.invoke("sync-rompslomp", {
                      body: { action: "download-pdf", rompslomp_id: selected.rompslomp_id },
                    });
                    if (res.error) throw res.error;
                    pdfBlob = new Blob([res.data], { type: "application/pdf" });
                  } else {
                    const res = await supabase.functions.invoke("generate-invoice-pdf", {
                      body: { invoice_id: selected.id },
                    });
                    if (res.error) throw res.error;
                    pdfBlob = new Blob([res.data], { type: "application/pdf" });
                  }

                  // 2. Convert to base64
                  const arrayBuffer = await pdfBlob.arrayBuffer();
                  const bytes = new Uint8Array(arrayBuffer);
                  let binary = "";
                  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                  const pdfBase64 = btoa(binary);

                  // 3. Build email HTML
                  const customerName = selected.customers?.name ?? "Klant";
                  const invoiceNumber = selected.invoice_number ?? "—";
                  const totalFormatted = `€ ${Number(selected.total).toFixed(2)}`;
                  const dueDate = selected.due_at ? format(new Date(selected.due_at), "dd-MM-yyyy") : "14 dagen na factuurdatum";

                  const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                      <p>Beste ${customerName},</p>
                      <p>Hierbij ontvangt u factuur <strong>${invoiceNumber}</strong> met een totaalbedrag van <strong>${totalFormatted}</strong> (incl. BTW).</p>
                      <p>De vervaldatum is <strong>${dueDate}</strong>.</p>
                      <p>De factuur is als PDF bijlage toegevoegd aan deze e-mail.</p>
                      <br/>
                      <p>Met vriendelijke groet,</p>
                      <p><strong>Vakflow</strong></p>
                    </div>
                  `;

                  // 4. Send email with attachment
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) throw new Error("Niet ingelogd");

                  const emailRes = await fetch(
                    `https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/send-email`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({
                        to: selected.customers.email,
                         subject: `Factuur ${invoiceNumber} - Vakflow`,
                        body: `Factuur ${invoiceNumber}`,
                        html: emailHtml,
                        attachments: [{
                          filename: `Factuur_${invoiceNumber}.pdf`,
                          content: pdfBase64,
                          contentType: "application/pdf",
                        }],
                      }),
                    }
                  );
                  const emailJson = await emailRes.json();
                  if (!emailRes.ok) throw new Error(emailJson.error || "Verzending mislukt");

                  // 5. Log communication
                  await createLog.mutateAsync({
                    channel: "email",
                    direction: "outbound",
                    customer_id: selected.customer_id,
                    work_order_id: selected.work_order_id ?? null,
                    subject: `Factuur ${invoiceNumber} - Vakflow`,
                    body: emailHtml,
                    status: "sent",
                    sent_at: new Date().toISOString(),
                  });

                  toast({ title: `✓ Factuur verstuurd naar ${selected.customers.email}` });
                } catch (err: any) {
                  toast({ title: "E-mail fout", description: err.message, variant: "destructive" });
                } finally {
                  setSendingEmail(false);
                }
              }}
              disabled={sendingEmail}
              className="px-3 py-1.5 bg-card border border-border text-secondary-foreground rounded-sm text-[12px] font-bold hover:bg-bg-hover transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              E-mail
            </button>
          )}
          {/* Accounting sync button */}
          {accountingProvider === "eboekhouden" && (selected.status === "verzonden" || selected.status === "betaald") && !selected.eboekhouden_id && (
            <button
              onClick={() => handleSyncEb(selected.id)}
              disabled={syncingId === selected.id}
              className="px-3 py-1.5 bg-card border border-border text-secondary-foreground rounded-sm text-[12px] font-bold hover:bg-bg-hover transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {syncingId === selected.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
              Sync e-Boekhouden
            </button>
          )}
          {accountingProvider === "rompslomp" && (selected.status === "verzonden" || selected.status === "betaald") && !selected.rompslomp_id && (
            <button
              onClick={() => handleSyncRompslomp()}
              disabled={syncingId === "rompslomp"}
              className="px-3 py-1.5 bg-card border border-border text-secondary-foreground rounded-sm text-[12px] font-bold hover:bg-bg-hover transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {syncingId === "rompslomp" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
              Sync Rompslomp
            </button>
          )}
          {selected.eboekhouden_id && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-success">
              ✓ e-Boekhouden #{selected.eboekhouden_id}
            </span>
          )}
          {selected.rompslomp_id && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-success">
                ✓ Rompslomp #{selected.rompslomp_id}
              </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef}>
      {/* Pull-to-refresh indicator */}
      <div
        className="flex justify-center items-center overflow-hidden transition-all duration-200 lg:hidden"
        style={{ height: pullDistance > 0 ? `${pullDistance}px` : 0 }}
      >
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <RefreshCw className={`h-5 w-5 transition-transform ${isTriggered ? "rotate-180" : ""} ${refreshing ? "animate-spin" : ""}`} />
          {isTriggered && !refreshing && <span className="text-[11px]">Loslaten om te verversen</span>}
          {refreshing && <span className="text-[11px]">Verversen...</span>}
        </div>
      </div>
      <div className="flex gap-0 border-b-2 border-border mb-4 md:mb-5 overflow-x-auto scrollbar-hide">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => { setActiveTab(i); setPage(0); }} className={`px-4 md:px-5 py-2.5 text-[12px] md:text-[13px] font-bold border-b-2 -mb-[2px] transition-colors whitespace-nowrap ${i === activeTab ? "text-primary border-primary" : "text-t3 border-transparent hover:text-secondary-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Mobile: show either list or preview */}
      <div className="md:hidden">
        {mobilePreview ? (
          <InvoicePreview />
        ) : (
          <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-[14px] font-bold">Facturen</h3>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="h-8">
                <Plus className="h-3.5 w-3.5 mr-1" /> Nieuw
              </Button>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : !filtered.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Geen facturen gevonden</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((inv) => {
                  const cfg = statusConfig[inv.status] ?? statusConfig.concept;
                  return (
                    <div
                      key={inv.id}
                      onClick={() => handleSelect(inv.id)}
                      className="px-4 py-3 flex items-center gap-3 active:bg-bg-hover transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold truncate">{inv.customers?.name ?? "—"}</div>
                        <div className="text-[11px] text-t3 font-mono">{inv.invoice_number || "Concept"} · € {Number(inv.total).toFixed(2)}</div>
                      </div>
                      <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold flex-shrink-0 ${badgeStyles[cfg.variant]}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
        <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-border">
            <h3 className="text-[15px] font-bold">Facturen</h3>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nieuwe factuur
            </Button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !filtered.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Geen facturen gevonden</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-background">
                  {["Nummer", "Klant", "Dienst", "Bedrag", "Status"].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const cfg = statusConfig[inv.status] ?? statusConfig.concept;
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedId(inv.id)}
                      className={`hover:bg-bg-hover transition-colors cursor-pointer ${selected?.id === inv.id ? "bg-bg-active" : ""}`}
                    >
                      <td className="px-5 py-3 text-[12px] font-mono">{inv.invoice_number || <span className="text-muted-foreground italic">Concept</span>}</td>
                      <td className="px-5 py-3 text-[13.5px]">{inv.customers?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-[13.5px]">{serviceName(inv)}</td>
                      <td className="px-5 py-3 font-mono">€ {Number(inv.total).toFixed(2)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${badgeStyles[cfg.variant]}`}>
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="overflow-y-auto max-h-[calc(100vh-200px)] sticky top-0">
          <InvoicePreview />
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} van {totalCount}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <InvoiceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};

export default InvoicesPage;
