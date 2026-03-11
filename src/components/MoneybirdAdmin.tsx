import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Receipt, Users, Search, BarChart3, ExternalLink, Copy, Download,
  Bell, Loader2, Send, Plus, Eye, Mail, Phone, Building2,
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Package, Pencil, CalendarIcon, X
} from "lucide-react";
import {
  useMoneybirdContacts, useMoneybirdInvoicesLive, useMoneybirdProducts,
  useMoneybirdLedgerAccounts, useMoneybirdTaxRates, useMoneybirdFinancialSummary,
  useCreateMoneybirdContact, useSendMoneybirdInvoice, useGetMoneybirdInvoicePdf,
  useCreateMoneybirdProduct, useUpdateMoneybirdProduct, useCreateStandaloneInvoice,
} from "@/hooks/useMoneybirdAdmin";

const formatCurrency = (amount: number | string | null | undefined): string => {
  if (amount == null) return "€0,00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `€${num.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (date: string | null | undefined): string => {
  if (!date) return "-";
  try { return format(new Date(date), "dd MMM yyyy"); } catch { return date; }
};

// ═══ Financial Dashboard ═══
const FinancialDashboard = () => {
  const { data: summary, isLoading } = useMoneybirdFinancialSummary();
  const stats = summary || {};

  const cards = [
    { label: "Openstaand", key: "open", icon: Clock, colorClass: "text-blue-500 bg-blue-500/10" },
    { label: "Te laat", key: "late", icon: AlertTriangle, colorClass: "text-destructive bg-destructive/10" },
    { label: "Betaald", key: "paid", icon: CheckCircle2, colorClass: "text-green-500 bg-green-500/10" },
  ];

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" /> Financieel overzicht laden...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map(({ label, key, icon: Icon, colorClass }) => {
              const [textColor, bgColor] = colorClass.split(" ");
              return (
                <div key={key} className="bg-card border border-border rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bgColor)}>
                      <Icon size={18} className={textColor} />
                    </div>
                  </div>
                  <div className={cn("text-2xl font-bold mb-0.5", textColor)}>
                    {formatCurrency(stats[key]?.total || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">{stats[key]?.count || 0} facturen</div>
                </div>
              );
            })}
          </div>
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-primary" />
              <h3 className="text-sm font-bold">Totaaloverzicht</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { l: "Totaal openstaand", v: formatCurrency((stats.open?.total || 0) + (stats.late?.total || 0)) },
                { l: "Totaal betaald", v: formatCurrency(stats.paid?.total || 0) },
                { l: "Te laat facturen", v: String(stats.late?.count || 0) },
                { l: "Totaal facturen", v: String((stats.open?.count || 0) + (stats.late?.count || 0) + (stats.paid?.count || 0)) },
              ].map((s) => (
                <div key={s.l} className="bg-muted/50 p-3 rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase mb-1">{s.l}</div>
                  <div className="text-base font-bold">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ═══ Contacts Tab ═══
const ContactsTab = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ firstname: "", lastname: "", company_name: "", email: "", phone: "" });

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t); }, [search]);

  const { data: contacts = [], isLoading } = useMoneybirdContacts(debouncedSearch);
  const createMutation = useCreateMoneybirdContact();

  const handleCreate = () => {
    createMutation.mutate(createForm, {
      onSuccess: () => { toast.success("Contact aangemaakt"); setShowCreate(false); setCreateForm({ firstname: "", lastname: "", company_name: "", email: "", phone: "" }); },
      onError: (err: any) => toast.error(err.message || "Aanmaken mislukt"),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Zoek contacten in Moneybird..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)}><Plus size={14} className="mr-1" /> Nieuw</Button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-bold">Nieuw Moneybird contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Input placeholder="Voornaam" value={createForm.firstname} onChange={(e) => setCreateForm(f => ({ ...f, firstname: e.target.value }))} />
            <Input placeholder="Achternaam" value={createForm.lastname} onChange={(e) => setCreateForm(f => ({ ...f, lastname: e.target.value }))} />
            <Input placeholder="Bedrijfsnaam" value={createForm.company_name} onChange={(e) => setCreateForm(f => ({ ...f, company_name: e.target.value }))} />
            <Input placeholder="E-mail" type="email" value={createForm.email} onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))} />
            <Input placeholder="Telefoon" value={createForm.phone} onChange={(e) => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Annuleren</Button>
            <Button size="sm" onClick={handleCreate} disabled={(!createForm.firstname && !createForm.company_name) || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />} Aanmaken
            </Button>
          </div>
        </div>
      )}

      {selectedContact && (
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">{selectedContact.firstname} {selectedContact.lastname} {selectedContact.company_name && <span className="text-muted-foreground text-sm ml-1">({selectedContact.company_name})</span>}</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedContact(null)}><X size={14} /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {selectedContact.email && <div className="flex items-center gap-2"><Mail size={14} className="text-primary" /> {selectedContact.email}</div>}
            {selectedContact.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-primary" /> {selectedContact.phone}</div>}
            {selectedContact.company_name && <div className="flex items-center gap-2"><Building2 size={14} className="text-primary" /> {selectedContact.company_name}</div>}
            {selectedContact.address1 && <div className="text-muted-foreground">{selectedContact.address1}, {selectedContact.zipcode} {selectedContact.city}</div>}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="flex items-center gap-2 mb-4 text-sm font-bold"><Users size={18} className="text-primary" /> Contacten ({contacts.length})</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 size={16} className="animate-spin mr-2" /> Laden...</div>
        ) : contacts.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Geen contacten gevonden</p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-1.5">
              {contacts.map((c: any) => (
                <button key={c.id} onClick={() => setSelectedContact(c)} className="w-full flex justify-between items-center gap-2 bg-muted/30 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors text-left">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.firstname} {c.lastname}{c.company_name && <span className="text-muted-foreground ml-1">· {c.company_name}</span>}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.email || c.phone || "-"}</div>
                  </div>
                  <Eye size={14} className="text-primary shrink-0" />
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

// ═══ Create Invoice Form ═══
interface InvoiceLine { description: string; price: string; amount: string; tax_rate_id: string; ledger_account_id: string; product_id: string; }
const emptyLine = (): InvoiceLine => ({ description: "", price: "", amount: "1", tax_rate_id: "", ledger_account_id: "", product_id: "" });

const CreateInvoiceForm = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => {
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);
  const [sendImmediately, setSendImmediately] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 14));

  const { data: searchContacts = [], isLoading: contactsLoading } = useMoneybirdContacts(contactSearch.length >= 2 && !selectedContact ? contactSearch : "");
  const { data: taxRates = [] } = useMoneybirdTaxRates(true);
  const { data: ledgerAccounts = [] } = useMoneybirdLedgerAccounts(true);
  const { data: mbProducts = [] } = useMoneybirdProducts("");
  const createMutation = useCreateStandaloneInvoice();

  const updateLine = (i: number, field: keyof InvoiceLine, value: string) =>
    setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line));

  const handleProductSelect = (lineIndex: number, productId: string) => {
    const product = mbProducts.find((p: any) => String(p.id) === productId);
    if (!product) { updateLine(lineIndex, "product_id", ""); return; }
    setLines(prev => prev.map((line, idx) => idx === lineIndex ? {
      ...line, product_id: productId,
      description: product.title || product.description || line.description,
      price: product.price || line.price,
      tax_rate_id: product.tax_rate_id ? String(product.tax_rate_id) : line.tax_rate_id,
      ledger_account_id: product.ledger_account_id ? String(product.ledger_account_id) : line.ledger_account_id,
    } : line));
  };

  const totalAmount = lines.reduce((sum, l) => sum + (parseFloat(l.price || "0") * parseFloat(l.amount || "1")), 0);
  const canSubmit = selectedContact && lines.some(l => l.description && l.price);

  const handleSubmit = () => {
    createMutation.mutate({
      contact_id: selectedContact.id,
      reference,
      invoice_date: format(invoiceDate, "yyyy-MM-dd"),
      due_date: format(dueDate, "yyyy-MM-dd"),
      lines: lines.filter(l => l.description && l.price).map(l => ({
        description: l.description, price: l.price, amount: l.amount,
        tax_rate_id: l.tax_rate_id || undefined, ledger_account_id: l.ledger_account_id || undefined, product_id: l.product_id || undefined,
      })),
      send_immediately: sendImmediately,
    }, {
      onSuccess: (data) => { toast.success(`Factuur ${data.invoice_number || ""} aangemaakt!`); onSuccess(); onClose(); },
      onError: (err: any) => toast.error(err.message || "Aanmaken mislukt"),
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2"><Plus size={16} className="text-primary" /> Nieuwe factuur</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>Annuleren</Button>
      </div>

      {/* Contact selector */}
      {selectedContact ? (
        <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border border-border">
          <div className="text-sm"><span className="font-medium">{selectedContact.firstname} {selectedContact.lastname}</span> {selectedContact.company_name && `· ${selectedContact.company_name}`}<div className="text-xs text-muted-foreground">{selectedContact.email || "-"}</div></div>
          <button className="text-xs text-primary hover:underline" onClick={() => { setSelectedContact(null); setContactSearch(""); }}>Wijzig</button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Contact</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Zoek contact..." value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} className="pl-9" />
          </div>
          {contactsLoading && <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Zoeken...</div>}
          {searchContacts.length > 0 && (
            <div className="bg-muted/30 rounded-lg border border-border max-h-48 overflow-y-auto">
              {searchContacts.map((c: any) => (
                <button key={c.id} onClick={() => setSelectedContact(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2 border-b border-border last:border-0">
                  <span className="font-medium">{c.firstname} {c.lastname}</span>
                  {c.company_name && <span className="text-muted-foreground">· {c.company_name}</span>}
                  <span className="text-xs text-muted-foreground ml-auto">{c.email || ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Referentie (optioneel)</label>
        <Input placeholder="bijv. PO-nummer, project" value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>

      {/* Date pickers */}
      <div className="grid grid-cols-2 gap-4">
        {([["Factuurdatum", invoiceDate, setInvoiceDate], ["Vervaldatum", dueDate, setDueDate]] as const).map(([label, date, setDate]) => (
          <div key={label as string} className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">{label as string}</label>
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-muted/30 text-left")}>
                  <CalendarIcon size={14} className="text-muted-foreground" />
                  {format(date as Date, "d MMM yyyy", { locale: nl })}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date as Date} onSelect={(d) => d && (setDate as any)(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        ))}
      </div>

      {/* Invoice lines */}
      <div className="space-y-3">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Factuurregels</label>
        {lines.map((line, i) => (
          <div key={i} className="space-y-2 bg-muted/20 p-3 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Input className="flex-1" placeholder="Omschrijving" value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)} />
              <Input className="w-24" placeholder="Prijs" type="number" step="0.01" value={line.price} onChange={(e) => updateLine(i, "price", e.target.value)} />
              <Input className="w-16" placeholder="Aantal" type="number" value={line.amount} onChange={(e) => updateLine(i, "amount", e.target.value)} />
              {lines.length > 1 && <button onClick={() => setLines(l => l.filter((_, idx) => idx !== i))} className="text-destructive hover:text-destructive/80 text-xs">✕</button>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground" value={line.product_id} onChange={(e) => handleProductSelect(i, e.target.value)}>
                <option value="">Product (optioneel)</option>
                {mbProducts.map((p: any) => <option key={p.id} value={String(p.id)}>{p.title || p.description || p.identifier || p.id}</option>)}
              </select>
              <select className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground" value={line.tax_rate_id} onChange={(e) => updateLine(i, "tax_rate_id", e.target.value)}>
                <option value="">BTW-tarief</option>
                {taxRates.map((t: any) => <option key={t.id} value={String(t.id)}>{t.name} ({t.percentage}%)</option>)}
              </select>
              <select className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground" value={line.ledger_account_id} onChange={(e) => updateLine(i, "ledger_account_id", e.target.value)}>
                <option value="">Grootboekrekening</option>
                {ledgerAccounts.map((la: any) => <option key={la.id} value={String(la.id)}>{la.name}</option>)}
              </select>
            </div>
          </div>
        ))}
        <button onClick={() => setLines(l => [...l, emptyLine()])} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus size={12} /> Regel toevoegen</button>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={sendImmediately} onChange={(e) => setSendImmediately(e.target.checked)} className="rounded" />
            Direct versturen
          </label>
          <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
        </div>
        <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || createMutation.isPending}>
          {createMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Receipt size={14} className="mr-1" />} Factuur aanmaken
        </Button>
      </div>
    </div>
  );
};

// ═══ Invoices Tab ═══
const InvoicesTab = () => {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useMoneybirdInvoicesLive(filter);
  const sendMutation = useSendMoneybirdInvoice();
  const pdfMutation = useGetMoneybirdInvoicePdf();

  const filteredInvoices = useMemo(() => {
    if (!search) return invoices;
    const q = search.toLowerCase();
    return invoices.filter((inv: any) =>
      (inv.invoice_id || "").toLowerCase().includes(q) ||
      (inv.contact?.company_name || "").toLowerCase().includes(q) ||
      (inv.contact?.firstname || "").toLowerCase().includes(q) ||
      (inv.contact?.lastname || "").toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const stateLabel = (s: string) => ({ draft: "Concept", open: "Open", late: "Te laat", paid: "Betaald", pending_payment: "Wacht", uncollectible: "Oninbaar", reminded: "Herinnerd" }[s] || s);
  const stateColor = (s: string) => {
    if (["paid", "accepted"].includes(s)) return "text-green-600 bg-green-500/10";
    if (["open", "sent", "pending_payment"].includes(s)) return "text-blue-600 bg-blue-500/10";
    if (["late", "reminded"].includes(s)) return "text-destructive bg-destructive/10";
    return "text-muted-foreground bg-muted/50";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Zoek facturen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[{ key: "all", label: "Alle" }, { key: "open", label: "Open" }, { key: "late", label: "Te laat" }, { key: "paid", label: "Betaald" }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>{f.label}</button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)}><Plus size={14} className="mr-1" /> Nieuwe factuur</Button>
      </div>

      {showCreate && <CreateInvoiceForm onClose={() => setShowCreate(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["mb-invoices-live"] })} />}

      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="flex items-center gap-2 mb-4 text-sm font-bold"><Receipt size={18} className="text-primary" /> Facturen ({filteredInvoices.length})</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 size={16} className="animate-spin mr-2" /> Laden...</div>
        ) : filteredInvoices.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Geen facturen gevonden</p>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-1.5">
              {filteredInvoices.map((inv: any) => {
                const state = inv.state || "unknown";
                const contactName = inv.contact ? `${inv.contact.firstname || ""} ${inv.contact.lastname || ""}`.trim() || inv.contact.company_name || "-" : "-";
                return (
                  <div key={inv.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-muted/30 p-3 rounded-lg border border-border">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {inv.url ? (
                          <a href={inv.url} target="_blank" rel="noopener noreferrer" className="font-bold text-primary text-sm font-mono flex items-center gap-1 hover:underline">{inv.invoice_id || "-"} <ExternalLink size={12} /></a>
                        ) : (
                          <span className="font-bold text-primary text-sm font-mono">{inv.invoice_id || "Concept"}</span>
                        )}
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", stateColor(state))}>{stateLabel(state)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{contactName}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {inv.due_date && <span className="text-xs text-muted-foreground">Vervalt {formatDate(inv.due_date)}</span>}
                      <span className="text-xs text-muted-foreground">{formatDate(inv.invoice_date)}</span>
                      <span className="font-bold text-sm">{formatCurrency(inv.total_price_incl_tax)}</span>
                      {state === "draft" && (
                        <button onClick={() => sendMutation.mutate(inv.id, { onSuccess: () => toast.success("Factuur verstuurd"), onError: (e: any) => toast.error(e.message) })} disabled={sendMutation.isPending} className="text-primary hover:text-primary/80 disabled:opacity-50" title="Verstuur"><Send size={14} /></button>
                      )}
                      {inv.payment_url && (
                        <button onClick={() => { navigator.clipboard.writeText(inv.payment_url); toast.success("Betaallink gekopieerd"); }} className="text-primary hover:text-primary/80" title="Kopieer betaallink"><Copy size={14} /></button>
                      )}
                      <button onClick={() => pdfMutation.mutate(inv.id, { onSuccess: (d) => { if (d?.pdf_url) window.open(d.pdf_url, "_blank"); }, onError: (e: any) => toast.error(e.message) })} className="text-primary hover:text-primary/80" title="Download PDF"><Download size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

// ═══ Products Tab ═══
const ProductsTab = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [createForm, setCreateForm] = useState({ description: "", price: "", identifier: "", frequency: "", frequency_type: "", ledger_account_id: "", tax_rate_id: "" });
  const [editForm, setEditForm] = useState({ description: "", price: "", identifier: "" });

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t); }, [search]);

  const { data: products = [], isLoading } = useMoneybirdProducts(debouncedSearch);
  const { data: ledgerAccounts = [] } = useMoneybirdLedgerAccounts(showCreate);
  const { data: taxRates = [] } = useMoneybirdTaxRates(showCreate);
  const createMutation = useCreateMoneybirdProduct();
  const updateMutation = useUpdateMoneybirdProduct();

  const handleCreate = () => {
    createMutation.mutate({
      product_description: createForm.description, product_price: createForm.price,
      product_identifier: createForm.identifier,
      product_frequency: createForm.frequency_type && createForm.frequency ? parseInt(createForm.frequency) : undefined,
      product_frequency_type: createForm.frequency_type || undefined,
      ledger_account_id: createForm.ledger_account_id || undefined,
      tax_rate_id: createForm.tax_rate_id || undefined,
    }, {
      onSuccess: () => { toast.success("Product aangemaakt"); setShowCreate(false); setCreateForm({ description: "", price: "", identifier: "", frequency: "", frequency_type: "", ledger_account_id: "", tax_rate_id: "" }); },
      onError: (err: any) => toast.error(err.message || "Aanmaken mislukt"),
    });
  };

  const handleUpdate = () => {
    updateMutation.mutate({
      mb_product_id: editProduct.id, product_description: editForm.description,
      product_price: editForm.price, product_identifier: editForm.identifier,
    }, {
      onSuccess: () => { toast.success("Product bijgewerkt"); setEditProduct(null); },
      onError: (err: any) => toast.error(err.message || "Bijwerken mislukt"),
    });
  };

  const openEdit = (p: any) => { setEditProduct(p); setEditForm({ description: p.description || "", price: p.price || "", identifier: p.identifier || "" }); };
  const frequencyLabel = (p: any) => {
    if (!p.frequency || !p.frequency_type) return null;
    const types: Record<string, string> = { day: "dag", week: "week", month: "maand", quarter: "kwartaal", year: "jaar" };
    return `${p.frequency}x per ${types[p.frequency_type] || p.frequency_type}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Zoek producten..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)}><Plus size={14} className="mr-1" /> Nieuw</Button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-bold">Nieuw Moneybird product</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1"><label className="text-xs text-muted-foreground">Omschrijving *</label><Input value={createForm.description} onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="space-y-1"><label className="text-xs text-muted-foreground">Prijs *</label><Input type="number" step="0.01" value={createForm.price} onChange={(e) => setCreateForm(f => ({ ...f, price: e.target.value }))} /></div>
            <div className="space-y-1"><label className="text-xs text-muted-foreground">Identifier</label><Input value={createForm.identifier} onChange={(e) => setCreateForm(f => ({ ...f, identifier: e.target.value }))} /></div>
            <div className="space-y-1"><label className="text-xs text-muted-foreground">Frequentie type</label>
              <select value={createForm.frequency_type} onChange={(e) => setCreateForm(f => ({ ...f, frequency_type: e.target.value, frequency: e.target.value ? (f.frequency || "1") : "" }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Eenmalig</option><option value="day">Dag</option><option value="week">Week</option><option value="month">Maand</option><option value="quarter">Kwartaal</option><option value="year">Jaar</option>
              </select>
            </div>
            {createForm.frequency_type && <div className="space-y-1"><label className="text-xs text-muted-foreground">Frequentie</label><Input type="number" min="1" value={createForm.frequency} onChange={(e) => setCreateForm(f => ({ ...f, frequency: e.target.value }))} /></div>}
            <div className="space-y-1"><label className="text-xs text-muted-foreground">Grootboekrekening</label>
              <select value={createForm.ledger_account_id} onChange={(e) => setCreateForm(f => ({ ...f, ledger_account_id: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecteer...</option>{ledgerAccounts.map((la: any) => <option key={la.id} value={la.id}>{la.name}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-xs text-muted-foreground">BTW-tarief</label>
              <select value={createForm.tax_rate_id} onChange={(e) => setCreateForm(f => ({ ...f, tax_rate_id: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecteer...</option>{taxRates.map((tr: any) => <option key={tr.id} value={tr.id}>{tr.name} ({tr.percentage}%)</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Annuleren</Button>
            <Button size="sm" onClick={handleCreate} disabled={!createForm.description || !createForm.price || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />} Aanmaken
            </Button>
          </div>
        </div>
      )}

      {editProduct && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Product bewerken</h3><Button variant="ghost" size="sm" onClick={() => setEditProduct(null)}><X size={14} /></Button></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input placeholder="Omschrijving" value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} />
            <Input placeholder="Prijs" type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm(f => ({ ...f, price: e.target.value }))} />
            <Input placeholder="Identifier" value={editForm.identifier} onChange={(e) => setEditForm(f => ({ ...f, identifier: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Pencil size={14} className="mr-1" />} Opslaan
            </Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="flex items-center gap-2 mb-4 text-sm font-bold"><Package size={18} className="text-primary" /> Producten ({products.length})</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 size={16} className="animate-spin mr-2" /> Laden...</div>
        ) : products.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Geen producten gevonden</p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-1.5">
              {products.map((p: any) => (
                <button key={p.id} onClick={() => openEdit(p)} className="w-full flex justify-between items-center gap-2 bg-muted/30 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors text-left">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.description || p.title || "Geen omschrijving"}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      {p.identifier && <span className="font-mono">{p.identifier}</span>}
                      {frequencyLabel(p) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{frequencyLabel(p)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">{formatCurrency(p.price)}</span>
                    <Pencil size={14} className="text-primary" />
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

// ═══ Main Component ═══
const MoneybirdAdmin = () => {
  return (
    <Tabs defaultValue="overzicht">
      <TabsList className="w-full justify-start mb-4">
        <TabsTrigger value="overzicht" className="gap-1.5"><BarChart3 size={14} /> Overzicht</TabsTrigger>
        <TabsTrigger value="facturen" className="gap-1.5"><Receipt size={14} /> Facturen</TabsTrigger>
        <TabsTrigger value="contacten" className="gap-1.5"><Users size={14} /> Contacten</TabsTrigger>
        <TabsTrigger value="producten" className="gap-1.5"><Package size={14} /> Producten</TabsTrigger>
      </TabsList>
      <TabsContent value="overzicht"><FinancialDashboard /></TabsContent>
      <TabsContent value="facturen"><InvoicesTab /></TabsContent>
      <TabsContent value="contacten"><ContactsTab /></TabsContent>
      <TabsContent value="producten"><ProductsTab /></TabsContent>
    </Tabs>
  );
};

export default MoneybirdAdmin;
