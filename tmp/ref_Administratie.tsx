import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Receipt, Users, Search, BarChart3, ExternalLink, Copy, Download,
  Bell, Loader2, Send, Plus, Eye, Mail, Phone, Building2,
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Euro, Package, Pencil, CalendarIcon
} from 'lucide-react';

// ── Helpers ──
async function mbAction(action: string, extra: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke('moneybird-invoice', {
    body: { action, ...extra },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

const formatDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  try { return format(new Date(date), 'dd MMM yyyy'); } catch { return date; }
};

const formatCurrency = (amount: number | string | null | undefined): string => {
  if (amount == null) return '€0,00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `€${num.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ══════════════════════════════════════
// Financial Dashboard Tab
// ══════════════════════════════════════
const FinancialDashboard = () => {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['mb-financial-summary'],
    queryFn: () => mbAction('financial_summary'),
    staleTime: 60_000,
  });

  const stats = summary?.summary || {};

  const cards = [
    { label: 'Openstaand', key: 'open', icon: Clock, color: 'hsl(var(--blue))' },
    { label: 'Te laat', key: 'late', icon: AlertTriangle, color: '#ef4444' },
    { label: 'Betaald', key: 'paid', icon: CheckCircle2, color: 'hsl(var(--green))' },
  ];

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" /> Financieel overzicht laden...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cards.map(({ label, key, icon: Icon, color }) => (
              <div key={key} className="glass-premium p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "'Formula Condensed', sans-serif" }}>{label}</h3>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1" style={{ color }}>
                  {formatCurrency(stats[key]?.total || 0)}
                </div>
                <div className="text-sm text-muted-foreground">{stats[key]?.count || 0} facturen</div>
              </div>
            ))}
          </div>

          <div className="glass-premium p-6 rounded-3xl">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={20} className="text-primary" />
              <h3 className="text-lg font-bold">Totaaloverzicht</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Totaal openstaand" value={formatCurrency((stats.open?.total || 0) + (stats.late?.total || 0))} />
              <StatCard label="Totaal betaald" value={formatCurrency(stats.paid?.total || 0)} />
              <StatCard label="Te laat facturen" value={String(stats.late?.count || 0)} />
              <StatCard label="Totaal facturen" value={String((stats.open?.count || 0) + (stats.late?.count || 0) + (stats.paid?.count || 0))} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-secondary/50 p-4 rounded-xl border border-border">
    <div className="text-[11px] text-muted-foreground uppercase mb-1">{label}</div>
    <div className="text-lg font-bold">{value}</div>
  </div>
);

// ══════════════════════════════════════
// Contacts Tab
// ══════════════════════════════════════
const ContactsTab = () => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ firstname: '', lastname: '', company_name: '', email: '', phone: '' });
  const queryClient = useQueryClient();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['mb-contacts', debouncedSearch],
    queryFn: () => mbAction('list_contacts', { query: debouncedSearch, per_page: 50 }),
    staleTime: 30_000,
  });

  const contacts = contactsData?.contacts || [];

  const createMutation = useMutation({
    mutationFn: () => mbAction('create_contact', { contact_data: createForm }),
    onSuccess: () => {
      toast.success('Contact aangemaakt');
      setShowCreate(false);
      setCreateForm({ firstname: '', lastname: '', company_name: '', email: '', phone: '' });
      queryClient.invalidateQueries({ queryKey: ['mb-contacts'] });
    },
    onError: (err: any) => toast.error(err.message || 'Aanmaken mislukt'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek contacten in Moneybird..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <button className="btn btn-gold text-xs" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={14} /> Nieuw contact
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="glass-premium p-6 rounded-3xl space-y-4">
          <h3 className="font-bold text-sm">Nieuw Moneybird contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Input placeholder="Voornaam" value={createForm.firstname} onChange={(e) => setCreateForm(f => ({ ...f, firstname: e.target.value }))} />
            <Input placeholder="Achternaam" value={createForm.lastname} onChange={(e) => setCreateForm(f => ({ ...f, lastname: e.target.value }))} />
            <Input placeholder="Bedrijfsnaam" value={createForm.company_name} onChange={(e) => setCreateForm(f => ({ ...f, company_name: e.target.value }))} />
            <Input placeholder="E-mail" type="email" value={createForm.email} onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))} />
            <Input placeholder="Telefoon" value={createForm.phone} onChange={(e) => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-glass text-xs" onClick={() => setShowCreate(false)}>Annuleren</button>
            <button className="btn btn-gold text-xs" onClick={() => createMutation.mutate()} disabled={!createForm.firstname && !createForm.company_name}>
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Aanmaken
            </button>
          </div>
        </div>
      )}

      {/* Contact detail */}
      {selectedContact && (
        <div className="glass-premium p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">
              {selectedContact.firstname} {selectedContact.lastname}
              {selectedContact.company_name && <span className="text-muted-foreground ml-2 text-sm">({selectedContact.company_name})</span>}
            </h3>
            <button className="btn btn-glass text-xs" onClick={() => setSelectedContact(null)}>Sluiten</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {selectedContact.email && (
              <div className="flex items-center gap-2"><Mail size={14} className="text-primary" /> {selectedContact.email}</div>
            )}
            {selectedContact.phone && (
              <div className="flex items-center gap-2"><Phone size={14} className="text-primary" /> {selectedContact.phone}</div>
            )}
            {selectedContact.company_name && (
              <div className="flex items-center gap-2"><Building2 size={14} className="text-primary" /> {selectedContact.company_name}</div>
            )}
            {selectedContact.address1 && (
              <div className="text-muted-foreground">{selectedContact.address1}, {selectedContact.zipcode} {selectedContact.city}</div>
            )}
            {selectedContact.customer_id && (
              <div className="text-muted-foreground">WC ID: {selectedContact.customer_id}</div>
            )}
            {selectedContact.sepa_active && (
              <div className="flex items-center gap-2 text-status-green"><CheckCircle2 size={14} /> SEPA actief</div>
            )}
          </div>
        </div>
      )}

      {/* Contact list */}
      <div className="glass-premium p-6 rounded-3xl">
        <h3 className="flex items-center gap-2 mb-4 text-lg font-bold"><Users size={20} className="text-primary" /> Contacten ({contacts.length})</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 size={16} className="animate-spin mr-2" /> Laden...
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Geen contacten gevonden</p>
        ) : (
          <ScrollArea className="h-[calc(100vh-420px)] min-h-[200px]">
            <div className="space-y-2">
              {contacts.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-secondary/30 p-3 sm:p-4 rounded-xl border border-border hover:border-primary/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="member-avatar" style={{ width: 36, height: 36, fontSize: 11 }}>
                      {((c.firstname?.[0] || '') + (c.lastname?.[0] || '')).toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {c.firstname} {c.lastname}
                        {c.company_name && <span className="text-muted-foreground ml-1">· {c.company_name}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{c.email || c.phone || '-'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {c.sepa_active && <span className="status-badge bg-status-green/10 text-status-green text-[10px]">SEPA</span>}
                    <Eye size={14} className="text-primary" />
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

// ══════════════════════════════════════
// Create Invoice Form
// ══════════════════════════════════════
interface InvoiceLine {
  description: string;
  price: string;
  amount: string;
  tax_rate_id: string;
  ledger_account_id: string;
  product_id: string;
}

const emptyLine = (): InvoiceLine => ({ description: '', price: '', amount: '1', tax_rate_id: '', ledger_account_id: '', product_id: '' });

const CreateInvoiceForm = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => {
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);
  const [sendImmediately, setSendImmediately] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 14));

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['mb-contacts-search', contactSearch],
    queryFn: () => mbAction('list_contacts', { query: contactSearch, per_page: 20 }),
    enabled: contactSearch.length >= 2 && !selectedContact,
    staleTime: 15_000,
  });
  const contacts = contactsData?.contacts || [];

  // Tax rates, ledger accounts, products queries
  const { data: taxRatesData } = useQuery({
    queryKey: ['mb-tax-rates'],
    queryFn: () => mbAction('list_tax_rates'),
    staleTime: 300_000,
  });
  const taxRates = (taxRatesData?.tax_rates || []).filter((t: any) => t.active);

  const { data: ledgerData } = useQuery({
    queryKey: ['mb-ledger-accounts'],
    queryFn: () => mbAction('list_ledger_accounts'),
    staleTime: 300_000,
  });
  const ledgerAccounts = (ledgerData?.ledger_accounts || []).filter((la: any) => la.account_type === 'revenue');

  const { data: productsData } = useQuery({
    queryKey: ['mb-products-invoice'],
    queryFn: () => mbAction('list_products', { per_page: 100 }),
    staleTime: 300_000,
  });
  const mbProducts = productsData?.products || [];

  const createMutation = useMutation({
    mutationFn: () => mbAction('create_standalone_invoice', {
      contact_id: selectedContact.id,
      reference,
      invoice_date: format(invoiceDate, 'yyyy-MM-dd'),
      due_date: format(dueDate, 'yyyy-MM-dd'),
      lines: lines.filter(l => l.description && l.price).map(l => ({
        description: l.description,
        price: l.price,
        amount: l.amount,
        tax_rate_id: l.tax_rate_id || undefined,
        ledger_account_id: l.ledger_account_id || undefined,
        product_id: l.product_id || undefined,
      })),
      send_immediately: sendImmediately,
    }),
    onSuccess: (data) => {
      toast.success(`Factuur ${data.invoice_number || ''} aangemaakt!`);
      onSuccess();
      onClose();
    },
    onError: (err: any) => toast.error(err.message || 'Aanmaken mislukt'),
  });

  const addLine = () => setLines(l => [...l, emptyLine()]);
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof InvoiceLine, value: string) =>
    setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line));

  const handleProductSelect = (lineIndex: number, productId: string) => {
    const product = mbProducts.find((p: any) => String(p.id) === productId);
    if (!product) {
      updateLine(lineIndex, 'product_id', '');
      return;
    }
    setLines(prev => prev.map((line, idx) => idx === lineIndex ? {
      ...line,
      product_id: productId,
      description: product.title || product.description || line.description,
      price: product.price || line.price,
      tax_rate_id: product.tax_rate_id ? String(product.tax_rate_id) : line.tax_rate_id,
      ledger_account_id: product.ledger_account_id ? String(product.ledger_account_id) : line.ledger_account_id,
    } : line));
  };

  const totalAmount = lines.reduce((sum, l) => {
    const price = parseFloat(l.price || '0');
    const amount = parseFloat(l.amount || '1');
    return sum + (price * amount);
  }, 0);

  const canSubmit = selectedContact && lines.some(l => l.description && l.price);

  return (
    <div className="glass-premium p-6 rounded-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2"><Plus size={18} className="text-primary" /> Nieuwe factuur</h3>
        <button className="btn btn-glass text-xs" onClick={onClose}>Annuleren</button>
      </div>

      {/* Contact selector */}
      {selectedContact ? (
        <div className="flex items-center justify-between bg-secondary/50 p-3 rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="member-avatar" style={{ width: 32, height: 32, fontSize: 10 }}>
              {((selectedContact.firstname?.[0] || '') + (selectedContact.lastname?.[0] || '')).toUpperCase() || '?'}
            </div>
            <div>
              <div className="text-sm font-medium">{selectedContact.firstname} {selectedContact.lastname} {selectedContact.company_name && `· ${selectedContact.company_name}`}</div>
              <div className="text-xs text-muted-foreground">{selectedContact.email || '-'}</div>
            </div>
          </div>
          <button className="text-xs text-primary hover:underline" onClick={() => { setSelectedContact(null); setContactSearch(''); }}>Wijzig</button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Contact</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek contact op naam of e-mail..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {contactsLoading && <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Zoeken...</div>}
          {contacts.length > 0 && (
            <div className="bg-secondary/30 rounded-xl border border-border max-h-48 overflow-y-auto">
              {contacts.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors flex items-center gap-2 border-b border-border last:border-0"
                >
                  <span className="font-medium">{c.firstname} {c.lastname}</span>
                  {c.company_name && <span className="text-muted-foreground">· {c.company_name}</span>}
                  <span className="text-xs text-muted-foreground ml-auto">{c.email || ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reference */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Referentie (optioneel)</label>
        <Input placeholder="bijv. PO-nummer, project" value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>

      {/* Date pickers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Factuurdatum</label>
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-secondary/30 text-left", !invoiceDate && "text-muted-foreground")}>
                <CalendarIcon size={14} className="text-muted-foreground" />
                {invoiceDate ? format(invoiceDate, 'd MMM yyyy', { locale: nl }) : 'Kies datum'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={invoiceDate} onSelect={(d) => d && setInvoiceDate(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Vervaldatum</label>
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-secondary/30 text-left", !dueDate && "text-muted-foreground")}>
                <CalendarIcon size={14} className="text-muted-foreground" />
                {dueDate ? format(dueDate, 'd MMM yyyy', { locale: nl }) : 'Kies datum'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dueDate} onSelect={(d) => d && setDueDate(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Invoice lines */}
      <div className="space-y-3">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Factuurregels</label>
        {lines.map((line, i) => (
          <div key={i} className="space-y-2 bg-secondary/20 p-3 rounded-xl border border-border">
            <div className="flex items-center gap-2">
              <Input className="flex-1" placeholder="Omschrijving" value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)} />
              <Input className="w-24" placeholder="Prijs" type="number" step="0.01" value={line.price} onChange={(e) => updateLine(i, 'price', e.target.value)} />
              <Input className="w-16" placeholder="Aantal" type="number" value={line.amount} onChange={(e) => updateLine(i, 'amount', e.target.value)} />
              {lines.length > 1 && (
                <button onClick={() => removeLine(i)} className="text-destructive hover:text-destructive/80 text-xs">✕</button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Product selector */}
              <select
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-secondary/30 text-foreground"
                value={line.product_id}
                onChange={(e) => handleProductSelect(i, e.target.value)}
              >
                <option value="">Product (optioneel)</option>
                {mbProducts.map((p: any) => (
                  <option key={p.id} value={String(p.id)}>{p.title || p.description || p.identifier || p.id}</option>
                ))}
              </select>
              {/* Tax rate */}
              <select
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-secondary/30 text-foreground"
                value={line.tax_rate_id}
                onChange={(e) => updateLine(i, 'tax_rate_id', e.target.value)}
              >
                <option value="">BTW-tarief</option>
                {taxRates.map((t: any) => (
                  <option key={t.id} value={String(t.id)}>{t.name} ({t.percentage}%)</option>
                ))}
              </select>
              {/* Ledger account */}
              <select
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-secondary/30 text-foreground"
                value={line.ledger_account_id}
                onChange={(e) => updateLine(i, 'ledger_account_id', e.target.value)}
              >
                <option value="">Grootboekrekening</option>
                {ledgerAccounts.map((la: any) => (
                  <option key={la.id} value={String(la.id)}>{la.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
        <button onClick={addLine} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus size={12} /> Regel toevoegen</button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={sendImmediately} onChange={(e) => setSendImmediately(e.target.checked)} className="rounded" />
            Direct versturen via Outlook
          </label>
          <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
        </div>
        <button
          className="btn btn-gold text-xs"
          onClick={() => createMutation.mutate()}
          disabled={!canSubmit || createMutation.isPending}
        >
          {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
          Factuur aanmaken
        </button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════
// Invoices Tab
// ══════════════════════════════════════
const InvoicesTab = () => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['mb-invoices', filter],
    queryFn: () => mbAction('list_invoices', { state: filter, per_page: 50 }),
    staleTime: 30_000,
  });

  const invoices = invoicesData?.invoices || [];

  const filteredInvoices = useMemo(() => {
    if (!search) return invoices;
    const q = search.toLowerCase();
    return invoices.filter((inv: any) =>
      (inv.invoice_id || '').toLowerCase().includes(q) ||
      (inv.contact?.company_name || '').toLowerCase().includes(q) ||
      (inv.contact?.firstname || '').toLowerCase().includes(q) ||
      (inv.contact?.lastname || '').toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleSendInvoice = async (invoiceId: string) => {
    setActionLoading(invoiceId);
    try {
      await mbAction('send_invoice', { moneybird_invoice_id: invoiceId });
      toast.success('Factuur verstuurd!');
      queryClient.invalidateQueries({ queryKey: ['mb-invoices'] });
    } catch (err: any) {
      toast.error(err.message || 'Versturen mislukt');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendReminder = async (invoiceId: string, contactId: string) => {
    setActionLoading(invoiceId);
    try {
      await mbAction('send_reminder', { moneybird_invoice_id: invoiceId, contact_id: contactId });
      toast.success('Herinnering verstuurd!');
      queryClient.invalidateQueries({ queryKey: ['mb-invoices'] });
    } catch (err: any) {
      toast.error(err.message || 'Herinnering mislukt');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    try {
      const data = await mbAction('get_invoice_pdf', { moneybird_invoice_id: invoiceId });
      if (data?.pdf_url) window.open(data.pdf_url, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'PDF downloaden mislukt');
    }
  };

  const handleCopyPaymentUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success('Betaallink gekopieerd!');
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'paid': case 'accepted': return 'hsl(var(--green))';
      case 'open': case 'sent': case 'pending_payment': return 'hsl(var(--blue))';
      case 'late': case 'reminded': return '#ef4444';
      case 'uncollectible': return '#6b7280';
      default: return 'hsl(var(--gold))';
    }
  };

  const stateLabel = (state: string) => {
    const labels: Record<string, string> = { draft: 'Concept', open: 'Open', late: 'Te laat', paid: 'Betaald', pending_payment: 'Wacht op betaling', uncollectible: 'Oninbaar', reminded: 'Herinnerd' };
    return labels[state] || state;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Zoek facturen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[{ key: 'all', label: 'Alle' }, { key: 'open', label: 'Open' }, { key: 'late', label: 'Te laat' }, { key: 'paid', label: 'Betaald' }].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button className="btn btn-gold text-xs" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={14} /> Nieuwe factuur
        </button>
      </div>

      {showCreate && (
        <CreateInvoiceForm
          onClose={() => setShowCreate(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['mb-invoices'] })}
        />
      )}

      <div className="glass-premium p-6 rounded-3xl">
        <h3 className="flex items-center gap-2 mb-4 text-lg font-bold"><Receipt size={20} className="text-primary" /> Facturen ({filteredInvoices.length})</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 size={16} className="animate-spin mr-2" /> Laden...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Geen facturen gevonden</p>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-2">
              {filteredInvoices.map((inv: any) => {
                const state = inv.state || 'unknown';
                const statusColor = getStatusColor(state);
                const contactName = inv.contact
                  ? `${inv.contact.firstname || ''} ${inv.contact.lastname || ''}`.trim() || inv.contact.company_name || '-'
                  : '-';
                const canSend = state === 'draft';
                const canRemind = ['open', 'late', 'reminded'].includes(state);

                return (
                  <div key={inv.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-secondary/30 p-3 sm:p-4 rounded-xl border border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {inv.url ? (
                            <a href={inv.url} target="_blank" rel="noopener noreferrer" className="font-bold text-primary text-sm font-mono flex items-center gap-1 hover:underline">
                              {inv.invoice_id || '-'} <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="font-bold text-primary text-sm font-mono">{inv.invoice_id || 'Concept'}</span>
                          )}
                          <span className="status-badge text-[10px]" style={{ background: `${statusColor}20`, color: statusColor }}>
                            {stateLabel(state)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{contactName}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {inv.due_date && <span className="text-xs text-muted-foreground">Vervalt {formatDate(inv.due_date)}</span>}
                      <span className="text-sm text-muted-foreground">{formatDate(inv.invoice_date)}</span>
                      <span className="font-bold text-sm">{formatCurrency(inv.total_price_incl_tax)}</span>
                      
                      {/* Actions */}
                      {canSend && (
                        <button
                          onClick={() => handleSendInvoice(inv.id)}
                          disabled={actionLoading === inv.id}
                          className="text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                          title="Verstuur factuur"
                        >
                          {actionLoading === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        </button>
                      )}
                      {canRemind && (
                        <button
                          onClick={() => handleSendReminder(inv.id, inv.contact_id)}
                          disabled={actionLoading === inv.id}
                          className="text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                          title="Verstuur herinnering"
                        >
                          {actionLoading === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                        </button>
                      )}
                      {inv.payment_url && (
                        <button onClick={() => handleCopyPaymentUrl(inv.payment_url)} className="text-primary hover:text-primary/80 transition-colors" title="Kopieer betaallink">
                          <Copy size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDownloadPdf(inv.id)} className="text-primary hover:text-primary/80 transition-colors" title="Download PDF">
                        <Download size={14} />
                      </button>
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

// ══════════════════════════════════════
// Products Tab
// ══════════════════════════════════════
const ProductsTab = () => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [createForm, setCreateForm] = useState({ description: '', price: '', identifier: '', frequency: '', frequency_type: '', ledger_account_id: '', tax_rate_id: '' });
  const [editForm, setEditForm] = useState({ description: '', price: '', identifier: '' });
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['mb-products', debouncedSearch],
    queryFn: () => mbAction('list_products', { query: debouncedSearch, per_page: 100 }),
    staleTime: 30_000,
  });

  const products = productsData?.products || [];

  // Fetch ledger accounts and tax rates for the create form
  const { data: ledgerData } = useQuery({
    queryKey: ['mb-ledger-accounts'],
    queryFn: () => mbAction('list_ledger_accounts'),
    staleTime: 300_000,
    enabled: showCreate,
  });
  const ledgerAccounts = (ledgerData?.ledger_accounts || []).filter((la: any) => la.account_type === 'revenue');

  const { data: taxData } = useQuery({
    queryKey: ['mb-tax-rates'],
    queryFn: () => mbAction('list_tax_rates'),
    staleTime: 300_000,
    enabled: showCreate,
  });
  const taxRates = (taxData?.tax_rates || []).filter((tr: any) => tr.active);

  const createMutation = useMutation({
    mutationFn: () => mbAction('create_product', {
      product_description: createForm.description,
      product_price: createForm.price,
      product_identifier: createForm.identifier,
      product_frequency: createForm.frequency_type && createForm.frequency ? parseInt(createForm.frequency) : undefined,
      product_frequency_type: createForm.frequency_type || undefined,
      ledger_account_id: createForm.ledger_account_id || undefined,
      tax_rate_id: createForm.tax_rate_id || undefined,
    }),
    onSuccess: () => {
      toast.success('Product aangemaakt in Moneybird');
      setShowCreate(false);
      setCreateForm({ description: '', price: '', identifier: '', frequency: '', frequency_type: '', ledger_account_id: '', tax_rate_id: '' });
      queryClient.invalidateQueries({ queryKey: ['mb-products'] });
    },
    onError: (err: any) => toast.error(err.message || 'Aanmaken mislukt'),
  });

  const updateMutation = useMutation({
    mutationFn: () => mbAction('update_product', {
      mb_product_id: editProduct.id,
      product_description: editForm.description,
      product_price: editForm.price,
      product_identifier: editForm.identifier,
    }),
    onSuccess: () => {
      toast.success('Product bijgewerkt');
      setEditProduct(null);
      queryClient.invalidateQueries({ queryKey: ['mb-products'] });
    },
    onError: (err: any) => toast.error(err.message || 'Bijwerken mislukt'),
  });

  const openEdit = (p: any) => {
    setEditProduct(p);
    setEditForm({ description: p.description || '', price: p.price || '', identifier: p.identifier || '' });
  };

  const frequencyLabel = (p: any) => {
    if (!p.frequency || !p.frequency_type) return null;
    const types: Record<string, string> = { day: 'dag', week: 'week', month: 'maand', quarter: 'kwartaal', year: 'jaar' };
    return `${p.frequency}x per ${types[p.frequency_type] || p.frequency_type}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek producten in Moneybird..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <button className="btn btn-gold text-xs" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={14} /> Nieuw product
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="glass-premium p-6 rounded-3xl space-y-4">
          <h3 className="font-bold text-sm">Nieuw Moneybird product</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Omschrijving *</label>
              <Input placeholder="bijv. StreetGasm Lidmaatschap" value={createForm.description} onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Prijs *</label>
              <Input placeholder="bijv. 2250.00" type="number" step="0.01" value={createForm.price} onChange={(e) => setCreateForm(f => ({ ...f, price: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Identifier</label>
              <Input placeholder="bijv. SG-MEMBERSHIP" value={createForm.identifier} onChange={(e) => setCreateForm(f => ({ ...f, identifier: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Frequentie type</label>
              <select
                value={createForm.frequency_type}
                onChange={(e) => setCreateForm(f => ({ ...f, frequency_type: e.target.value, frequency: e.target.value ? (f.frequency || '1') : '' }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Eenmalig (geen frequentie)</option>
                <option value="day">Dag</option>
                <option value="week">Week</option>
                <option value="month">Maand</option>
                <option value="quarter">Kwartaal</option>
                <option value="year">Jaar</option>
              </select>
            </div>
            {createForm.frequency_type && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Frequentie</label>
                <Input placeholder="bijv. 1" type="number" min="1" value={createForm.frequency} onChange={(e) => setCreateForm(f => ({ ...f, frequency: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Grootboekrekening *</label>
              <select
                value={createForm.ledger_account_id}
                onChange={(e) => setCreateForm(f => ({ ...f, ledger_account_id: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecteer...</option>
                {ledgerAccounts.map((la: any) => (
                  <option key={la.id} value={la.id}>{la.name} ({la.account_id})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">BTW-tarief *</label>
              <select
                value={createForm.tax_rate_id}
                onChange={(e) => setCreateForm(f => ({ ...f, tax_rate_id: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecteer...</option>
                {taxRates.map((tr: any) => (
                  <option key={tr.id} value={tr.id}>{tr.name} ({tr.percentage}%)</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-glass text-xs" onClick={() => setShowCreate(false)}>Annuleren</button>
            <button className="btn btn-gold text-xs" onClick={() => createMutation.mutate()} disabled={!createForm.description || !createForm.price || !createForm.ledger_account_id || !createForm.tax_rate_id || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Aanmaken
            </button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editProduct && (
        <div className="glass-premium p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Product bewerken — {editProduct.id}</h3>
            <button className="btn btn-glass text-xs" onClick={() => setEditProduct(null)}>Sluiten</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input placeholder="Omschrijving" value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} />
            <Input placeholder="Prijs" type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm(f => ({ ...f, price: e.target.value }))} />
            <Input placeholder="Identifier" value={editForm.identifier} onChange={(e) => setEditForm(f => ({ ...f, identifier: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-gold text-xs" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Opslaan
            </button>
          </div>
        </div>
      )}

      {/* Product list */}
      <div className="glass-premium p-6 rounded-3xl">
        <h3 className="flex items-center gap-2 mb-4 text-lg font-bold"><Package size={20} className="text-primary" /> Producten ({products.length})</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 size={16} className="animate-spin mr-2" /> Laden...
          </div>
        ) : products.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Geen producten gevonden</p>
        ) : (
          <ScrollArea className="h-[calc(100vh-420px)] min-h-[200px]">
            <div className="space-y-2">
              {products.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => openEdit(p)}
                  className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-secondary/30 p-3 sm:p-4 rounded-xl border border-border hover:border-primary/30 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.description || p.title || 'Geen omschrijving'}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      {p.identifier && <span className="font-mono">{p.identifier}</span>}
                      {frequencyLabel(p) && (
                        <span className="status-badge bg-primary/10 text-primary text-[10px]">{frequencyLabel(p)}</span>
                      )}
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

// ══════════════════════════════════════
// Main Administratie Page
// ══════════════════════════════════════
const Administratie = () => {
  return (
    <>
      <div className="page-header">
        <div>
          <p>Financieel</p>
          <h1>Administratie</h1>
        </div>
      </div>

      <Tabs defaultValue="overzicht">
        <TabsList className="glass-premium w-full justify-start rounded-2xl p-1 mb-6">
          <TabsTrigger value="overzicht" className="gap-1.5 rounded-xl"><BarChart3 size={14} /> Overzicht</TabsTrigger>
          <TabsTrigger value="facturen" className="gap-1.5 rounded-xl"><Receipt size={14} /> Facturen</TabsTrigger>
          <TabsTrigger value="contacten" className="gap-1.5 rounded-xl"><Users size={14} /> Contacten</TabsTrigger>
          <TabsTrigger value="producten" className="gap-1.5 rounded-xl"><Package size={14} /> Producten</TabsTrigger>
        </TabsList>

        <TabsContent value="overzicht">
          <FinancialDashboard />
        </TabsContent>

        <TabsContent value="facturen">
          <InvoicesTab />
        </TabsContent>

        <TabsContent value="contacten">
          <ContactsTab />
        </TabsContent>

        <TabsContent value="producten">
          <ProductsTab />
        </TabsContent>
      </Tabs>
    </>
  );
};

export default Administratie;
