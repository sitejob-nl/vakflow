import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useUpdateInvoice } from "@/hooks/useInvoices";
import { useCreateCommunicationLog } from "@/hooks/useCommunicationLogs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  FileDown, Mail, RefreshCw, ExternalLink, Loader2, Plus, Trash2, 
  Save, X, Pencil, CheckCircle2, Clock, AlertTriangle
} from "lucide-react";
import type { Invoice } from "@/hooks/useInvoices";

interface InvoiceItem {
  description: string;
  qty: number;
  unit_price: number;
  vat_percentage?: number;
  discount?: number;
  discount_type?: "percentage" | "fixed";
  total: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  accountingProvider: string | null;
  onPullStatus?: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  concept: { label: "Concept", variant: "secondary" },
  verzonden: { label: "Verzonden", variant: "default" },
  verstuurd: { label: "Verzonden", variant: "default" },
  betaald: { label: "Betaald", variant: "outline" },
  verlopen: { label: "Verlopen", variant: "destructive" },
};

const providerLabels: Record<string, string> = {
  exact: "Exact Online",
  moneybird: "Moneybird",
  rompslomp: "Rompslomp",
  wefact: "WeFact",
  eboekhouden: "e-Boekhouden",
  snelstart: "SnelStart",
};

const providerUrls: Record<string, (id: string) => string> = {
  moneybird: (id) => `https://moneybird.com/invoices/${id}`,
  rompslomp: (id) => `https://app.rompslomp.nl/facturen/${id}`,
  exact: (id) => `https://start.exactonline.nl/docs/SalesInvoice.aspx?ID=${id}`,
  wefact: (id) => `https://secure.wefact.nl/debiteuren/facturen.php?factuurnr=${id}`,
};

const emptyItem = (): InvoiceItem => ({ 
  description: "", 
  qty: 1, 
  unit_price: 0, 
  vat_percentage: 21, 
  discount: 0, 
  discount_type: "fixed",
  total: 0 
});

const InvoiceDetailSheet = ({ open, onOpenChange, invoice, accountingProvider, onPullStatus }: Props) => {
  const [editMode, setEditMode] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [globalVat, setGlobalVat] = useState(21);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [globalDiscountType, setGlobalDiscountType] = useState<"percentage" | "fixed">("fixed");
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [pullingStatus, setPullingStatus] = useState(false);

  const updateInvoice = useUpdateInvoice();
  const createLog = useCreateCommunicationLog();
  const { toast } = useToast();

  // Initialize form when invoice changes
  const initForm = () => {
    if (!invoice) return;
    const parsedItems: InvoiceItem[] = Array.isArray(invoice.items) && (invoice.items as any[]).length > 0
      ? (invoice.items as any[]).map((i: any) => ({
          description: i.description || "",
          qty: i.qty || 1,
          unit_price: i.unit_price || 0,
          vat_percentage: i.vat_percentage ?? invoice.vat_percentage ?? 21,
          discount: i.discount || 0,
          discount_type: i.discount_type || "fixed",
          total: i.total || i.qty * i.unit_price,
        }))
      : [{ ...emptyItem(), description: "Dienst", unit_price: invoice.subtotal || 0, total: invoice.subtotal || 0 }];
    setItems(parsedItems);
    setNotes((invoice as any).notes ?? "");
    setDueAt(invoice.due_at ?? "");
    setGlobalVat(invoice.vat_percentage ?? 21);
  };

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;
    let totalVat = 0;

    items.forEach((item) => {
      const lineTotal = item.qty * item.unit_price;
      let discountAmount = 0;
      if (item.discount && item.discount > 0) {
        discountAmount = item.discount_type === "percentage" 
          ? lineTotal * (item.discount / 100) 
          : item.discount;
      }
      const afterDiscount = lineTotal - discountAmount;
      const vatRate = item.vat_percentage ?? globalVat;
      const lineSubtotal = afterDiscount / (1 + vatRate / 100);
      const lineVat = afterDiscount - lineSubtotal;
      subtotal += lineSubtotal;
      totalVat += lineVat;
    });

    // Apply global discount
    let globalDiscountAmount = 0;
    if (globalDiscount > 0) {
      globalDiscountAmount = globalDiscountType === "percentage"
        ? (subtotal + totalVat) * (globalDiscount / 100)
        : globalDiscount;
    }

    const total = subtotal + totalVat - globalDiscountAmount;

    return { subtotal, vatAmount: totalVat, total, globalDiscountAmount };
  };

  const { subtotal, vatAmount, total, globalDiscountAmount } = calculateTotals();

  const recalcItem = (item: InvoiceItem): InvoiceItem => {
    const lineTotal = item.qty * item.unit_price;
    let discountAmount = 0;
    if (item.discount && item.discount > 0) {
      discountAmount = item.discount_type === "percentage" 
        ? lineTotal * (item.discount / 100) 
        : item.discount;
    }
    return { ...item, total: Number((lineTotal - discountAmount).toFixed(2)) };
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = recalcItem({ ...copy[idx], [field]: value });
      return copy;
    });
  };

  const handleSave = async () => {
    if (!invoice) return;
    setSaving(true);
    try {
      const itemsJson = items.filter((i) => i.description).map(recalcItem).map((item) => ({
        description: item.description,
        qty: item.qty,
        unit_price: item.unit_price,
        vat_percentage: item.vat_percentage,
        discount: item.discount,
        discount_type: item.discount_type,
        total: item.total,
      }));
      await updateInvoice.mutateAsync({
        id: invoice.id,
        items: itemsJson as any,
        subtotal: Number(subtotal.toFixed(2)),
        vat_percentage: globalVat,
        vat_amount: Number(vatAmount.toFixed(2)),
        total: Number(total.toFixed(2)),
        notes,
        due_at: dueAt || null,
      });
      toast({ title: "Factuur bijgewerkt" });
      setEditMode(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleStatusChange = async (status: string) => {
    if (!invoice) return;
    try {
      const updates: any = { id: invoice.id, status };
      if (status === "betaald") updates.paid_at = new Date().toISOString().split("T")[0];
      if (status === "verzonden") {
        updates.issued_at = new Date().toISOString().split("T")[0];
        const due = new Date();
        due.setDate(due.getDate() + 30);
        updates.due_at = due.toISOString().split("T")[0];
      }
      await updateInvoice.mutateAsync(updates);
      toast({ title: `Status gewijzigd naar ${statusConfig[status]?.label ?? status}` });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handlePullStatus = async () => {
    if (!accountingProvider) return;
    setPullingStatus(true);
    try {
      const funcMap: Record<string, string> = {
        rompslomp: "sync-rompslomp",
        moneybird: "sync-moneybird",
        wefact: "sync-wefact",
        eboekhouden: "sync-invoice-eboekhouden",
        exact: "sync-exact",
      };
      const funcName = funcMap[accountingProvider];
      if (!funcName) throw new Error("Provider niet ondersteund");

      const res = await supabase.functions.invoke(funcName, {
        body: { action: "pull-invoice-status" },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "✓ Betaalstatus bijgewerkt", description: `${res.data?.updated ?? 0} facturen bijgewerkt` });
      onPullStatus?.();
    } catch (err: any) {
      toast({ title: "Status ophalen mislukt", description: err.message, variant: "destructive" });
    }
    setPullingStatus(false);
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      let pdfBlob: Blob;
      if ((invoice as any).moneybird_id) {
        const res = await supabase.functions.invoke("sync-moneybird", {
          body: { action: "download-pdf", moneybird_id: (invoice as any).moneybird_id },
        });
        if (res.error) throw res.error;
        pdfBlob = new Blob([res.data], { type: "application/pdf" });
      } else if (invoice.rompslomp_id) {
        const res = await supabase.functions.invoke("sync-rompslomp", {
          body: { action: "download-pdf", rompslomp_id: invoice.rompslomp_id },
        });
        if (res.error) throw res.error;
        pdfBlob = new Blob([res.data], { type: "application/pdf" });
      } else {
        const res = await supabase.functions.invoke("generate-invoice-pdf", {
          body: { invoice_id: invoice.id },
        });
        if (res.error) throw res.error;
        pdfBlob = new Blob([res.data], { type: "application/pdf" });
      }
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factuur_${invoice.invoice_number ?? invoice.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "PDF fout", description: err.message, variant: "destructive" });
    }
  };

  const handleSendEmail = async () => {
    if (!invoice?.customers?.email) return;
    setSendingEmail(true);
    try {
      // Generate PDF
      let pdfBlob: Blob;
      if ((invoice as any).moneybird_id) {
        const res = await supabase.functions.invoke("sync-moneybird", {
          body: { action: "download-pdf", moneybird_id: (invoice as any).moneybird_id },
        });
        if (res.error) throw res.error;
        pdfBlob = new Blob([res.data], { type: "application/pdf" });
      } else if (invoice.rompslomp_id) {
        const res = await supabase.functions.invoke("sync-rompslomp", {
          body: { action: "download-pdf", rompslomp_id: invoice.rompslomp_id },
        });
        if (res.error) throw res.error;
        pdfBlob = new Blob([res.data], { type: "application/pdf" });
      } else {
        const res = await supabase.functions.invoke("generate-invoice-pdf", {
          body: { invoice_id: invoice.id },
        });
        if (res.error) throw res.error;
        pdfBlob = new Blob([res.data], { type: "application/pdf" });
      }

      // Convert to base64
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const pdfBase64 = btoa(binary);

      const customerName = invoice.customers?.name ?? "Klant";
      const invoiceNumber = invoice.invoice_number ?? "—";
      const totalFormatted = `€ ${Number(invoice.total).toFixed(2)}`;
      const dueDateStr = invoice.due_at ? format(new Date(invoice.due_at), "dd-MM-yyyy") : "14 dagen";

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <p>Beste ${customerName},</p>
          <p>Hierbij ontvangt u factuur <strong>${invoiceNumber}</strong> met een totaalbedrag van <strong>${totalFormatted}</strong> (incl. BTW).</p>
          <p>De vervaldatum is <strong>${dueDateStr}</strong>.</p>
          <p>De factuur is als PDF bijlage toegevoegd aan deze e-mail.</p>
          <br/>
          <p>Met vriendelijke groet</p>
        </div>
      `;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      const emailRes = await fetch(
        `https://sigzpqwnavfxtvbyqvzj.supabase.co/functions/v1/send-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            to: invoice.customers.email,
            subject: `Factuur ${invoiceNumber}`,
            body: `Factuur ${invoiceNumber}`,
            html: emailHtml,
            attachments: [{ filename: `Factuur_${invoiceNumber}.pdf`, content: pdfBase64, contentType: "application/pdf" }],
          }),
        }
      );
      if (!emailRes.ok) {
        const j = await emailRes.json();
        throw new Error(j.error || "Verzending mislukt");
      }

      await createLog.mutateAsync({
        channel: "email",
        direction: "outbound",
        customer_id: invoice.customer_id,
        work_order_id: invoice.work_order_id ?? null,
        subject: `Factuur ${invoiceNumber}`,
        body: emailHtml,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      // Update status to "verzonden" if it was "concept"
      if (invoice.status === "concept") {
        await handleStatusChange("verzonden");
      }

      toast({ title: `✓ Factuur verstuurd naar ${invoice.customers.email}` });
    } catch (err: any) {
      toast({ title: "E-mail fout", description: err.message, variant: "destructive" });
    }
    setSendingEmail(false);
  };

  // Get provider external ID
  const getProviderId = () => {
    if (!invoice) return null;
    if (accountingProvider === "exact" && invoice.exact_id) return invoice.exact_id;
    if (accountingProvider === "moneybird" && (invoice as any).moneybird_id) return (invoice as any).moneybird_id;
    if (accountingProvider === "rompslomp" && invoice.rompslomp_id) return invoice.rompslomp_id;
    if (accountingProvider === "wefact" && invoice.wefact_id) return invoice.wefact_id;
    if (accountingProvider === "eboekhouden" && invoice.eboekhouden_id) return invoice.eboekhouden_id;
    return null;
  };

  const providerId = getProviderId();
  const providerUrl = providerId && accountingProvider && providerUrls[accountingProvider]
    ? providerUrls[accountingProvider](providerId)
    : null;

  if (!invoice) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold">
              Factuur {invoice.invoice_number}
            </SheetTitle>
            <Badge variant={statusConfig[invoice.status]?.variant ?? "secondary"}>
              {statusConfig[invoice.status]?.label ?? invoice.status}
            </Badge>
          </div>
          {invoice.customers && (
            <p className="text-sm text-muted-foreground">{invoice.customers.name}</p>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Provider status section */}
          {accountingProvider && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{providerLabels[accountingProvider]}</span>
                  {providerId ? (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />
                      Gekoppeld
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="w-3 h-3 mr-1 text-yellow-500" />
                      Niet gesynchroniseerd
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {providerUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={providerUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Openen
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handlePullStatus} disabled={pullingStatus}>
                    {pullingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span className="ml-1">Status ophalen</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Invoice details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Factuurdatum</Label>
              <p className="font-medium">{invoice.issued_at ? format(new Date(invoice.issued_at), "dd-MM-yyyy") : "—"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Vervaldatum</Label>
              {editMode ? (
                <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="mt-1" />
              ) : (
                <p className="font-medium">{invoice.due_at ? format(new Date(invoice.due_at), "dd-MM-yyyy") : "—"}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Artikelen</Label>
              {!editMode && (
                <Button variant="outline" size="sm" onClick={() => { initForm(); setEditMode(true); }}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Bewerken
                </Button>
              )}
            </div>

            {editMode ? (
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-muted/30 p-3 rounded-md">
                    <div className="col-span-12 sm:col-span-4">
                      <Label className="text-xs text-muted-foreground">Omschrijving</Label>
                      <Input 
                        value={item.description} 
                        onChange={(e) => updateItem(idx, "description", e.target.value)} 
                        placeholder="Omschrijving"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Aantal</Label>
                      <Input 
                        type="number" 
                        value={item.qty || ""} 
                        onChange={(e) => updateItem(idx, "qty", Number(e.target.value) || 0)} 
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Prijs incl.</Label>
                      <Input 
                        type="number" 
                        value={item.unit_price || ""} 
                        onChange={(e) => updateItem(idx, "unit_price", Number(e.target.value) || 0)} 
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">BTW</Label>
                      <Select 
                        value={String(item.vat_percentage ?? 21)} 
                        onValueChange={(v) => updateItem(idx, "vat_percentage", Number(v))}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="9">9%</SelectItem>
                          <SelectItem value="21">21%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 sm:col-span-2 flex items-end justify-end gap-1">
                      <span className="text-sm font-mono">€{item.total.toFixed(2)}</span>
                      {items.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setItems((p) => [...p, emptyItem()])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Regel toevoegen
                </Button>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 font-medium">Omschrijving</th>
                      <th className="text-right p-2 font-medium">Aantal</th>
                      <th className="text-right p-2 font-medium">Prijs</th>
                      <th className="text-right p-2 font-medium">BTW</th>
                      <th className="text-right p-2 font-medium">Totaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(invoice.items) && (invoice.items as any[]).length > 0 ? (
                      (invoice.items as any[]).map((item: any, idx: number) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.description}</td>
                          <td className="p-2 text-right">{item.qty}</td>
                          <td className="p-2 text-right">€{Number(item.unit_price).toFixed(2)}</td>
                          <td className="p-2 text-right">{item.vat_percentage ?? invoice.vat_percentage ?? 21}%</td>
                          <td className="p-2 text-right font-mono">€{(item.qty * item.unit_price).toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t">
                        <td className="p-2">Dienst</td>
                        <td className="p-2 text-right">1</td>
                        <td className="p-2 text-right">€{Number(invoice.subtotal).toFixed(2)}</td>
                        <td className="p-2 text-right">{invoice.vat_percentage}%</td>
                        <td className="p-2 text-right font-mono">€{Number(invoice.subtotal).toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotaal (excl. BTW)</span>
              <span className="font-mono">€{(editMode ? subtotal : Number(invoice.subtotal)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">BTW {editMode ? globalVat : invoice.vat_percentage}%</span>
              <span className="font-mono">€{(editMode ? vatAmount : Number(invoice.vat_amount)).toFixed(2)}</span>
            </div>
            {editMode && globalDiscountAmount > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Korting</span>
                <span className="font-mono">-€{globalDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Totaal incl. BTW</span>
              <span className="font-mono">€{(editMode ? total : Number(invoice.total)).toFixed(2)}</span>
            </div>
          </div>

          {/* Notes */}
          {editMode ? (
            <div>
              <Label>Notities</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionele notities" className="mt-1" />
            </div>
          ) : (invoice as any).notes && (
            <div>
              <Label className="text-muted-foreground">Notities</Label>
              <p className="text-sm mt-1">{(invoice as any).notes}</p>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {editMode ? (
              <>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Opslaan
                </Button>
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  <X className="w-4 h-4 mr-1" /> Annuleren
                </Button>
              </>
            ) : (
              <>
                {invoice.status === "concept" && (
                  <Button onClick={() => handleStatusChange("verzonden")}>
                    📤 Markeer als verzonden
                  </Button>
                )}
                {(invoice.status === "verzonden" || invoice.status === "verlopen") && (
                  <Button variant="secondary" onClick={() => handleStatusChange("betaald")}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Markeer als betaald
                  </Button>
                )}
                <Button variant="outline" onClick={handleDownloadPdf}>
                  <FileDown className="w-4 h-4 mr-1" /> PDF
                </Button>
                {invoice.customers?.email && (
                  <Button variant="outline" onClick={handleSendEmail} disabled={sendingEmail}>
                    {sendingEmail ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
                    Versturen
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InvoiceDetailSheet;
