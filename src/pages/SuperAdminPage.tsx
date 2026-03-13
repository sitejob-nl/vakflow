import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { industryConfig, type Industry } from "@/config/industryConfig";
import { Building2, Users, Pencil, Trash2, Search, Plus, Save, Loader2, Eye, BarChart3, List, ChevronLeft, ChevronRight, Activity, AlertTriangle, CreditCard, Zap, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SuperAdminStats from "@/components/SuperAdminStats";
import SuperAdminUsage from "@/components/SuperAdminUsage";
import SuperAdminErrors from "@/components/SuperAdminErrors";
import SuperAdminSubscriptions, { PlanBadge, StatusBadge } from "@/components/SuperAdminSubscriptions";
import SuperAdminActivity from "@/components/SuperAdminActivity";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies">;

interface CompanyStats {
  company_id: string;
  customer_count: number;
  user_count: number;
  work_order_count: number;
}

const PAGE_SIZE = 25;

const ALL_FEATURES = [
  { slug: "dashboard", label: "Dashboard" },
  { slug: "planning", label: "Planning" },
  { slug: "customers", label: "Klanten" },
  { slug: "workorders", label: "Werkbonnen" },
  { slug: "invoices", label: "Facturatie" },
  { slug: "quotes", label: "Offertes" },
  { slug: "reports", label: "Rapportages" },
  { slug: "email", label: "E-mail" },
  { slug: "whatsapp", label: "WhatsApp" },
  { slug: "communication", label: "Logboek" },
  { slug: "reminders", label: "Reminders" },
  { slug: "assets", label: "Objecten" },
  { slug: "contracts", label: "Contracten" },
  { slug: "schedule", label: "Rooster" },
  { slug: "audits", label: "Audits" },
  { slug: "vehicles", label: "Voertuigen" },
  { slug: "trade", label: "Inruil" },
  { slug: "vehicle_sales", label: "Voertuigverkoop" },
  { slug: "projects", label: "Projecten" },
  { slug: "marketing", label: "Marketing" },
  { slug: "custom_domain", label: "Custom Domein" },
  { slug: "api", label: "API" },
  { slug: "leads", label: "Leads" },
  { slug: "hexon", label: "Hexon DV" },
  { slug: "voip", label: "Telefonie (Voys)" },
  { slug: "ai_agent", label: "AI Agent" },
];

const INDUSTRIES: { value: string; label: string }[] = [
  { value: "technical", label: "Technisch" },
  { value: "cleaning", label: "Schoonmaak" },
  { value: "automotive", label: "Automotive" },
  { value: "pest", label: "Pest Control" },
  { value: "landscaping", label: "Groenvoorziening" },
];

const PLANS = [
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
];

const STATUSES = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Actief" },
  { value: "past_due", label: "Achterstallig" },
  { value: "cancelled", label: "Geannuleerd" },
  { value: "suspended", label: "Opgeschort" },
];

const emptyForm = {
  name: "", slug: "", kvk_number: "", btw_number: "", address: "",
  postal_code: "", city: "", phone: "", iban: "", smtp_email: "",
  max_users: 2,
  enabled_features: ALL_FEATURES.map(f => f.slug),
  subscription_plan: "starter",
  subscription_status: "trial",
  trial_ends_at: "",
  monthly_price: 0,
  billing_email: "",
  stripe_customer_id: "",
  stripe_subscription_id: "",
  industry: "technical",
  subcategory: "general",
  admin_notes: "",
};

type SortKey = "name" | "subscription_plan" | "subscription_status" | "monthly_price" | "last_active_at" | "created_at";

const SuperAdminPage = () => {
  const { isSuperAdmin, impersonate, role } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<Record<string, CompanyStats>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [unresolvedErrorCount, setUnresolvedErrorCount] = useState(0);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterIndustry, setFilterIndustry] = useState("all");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase.from("companies").select("*", { count: "exact" });

    if (filterStatus !== "all") query = query.eq("subscription_status", filterStatus);
    if (filterPlan !== "all") query = query.eq("subscription_plan", filterPlan);
    if (filterIndustry !== "all") query = query.eq("industry", filterIndustry);

    query = query.order(sortKey === "monthly_price" ? "monthly_price" : sortKey, { ascending: sortAsc });
    query = query.range(from, to);

    const { data, count } = await query;
    setCompanies(data ?? []);
    setTotalCount(count ?? 0);

    const { data: statsData } = await supabase.rpc("get_company_stats") as { data: CompanyStats[] | null };
    const statsMap: Record<string, CompanyStats> = {};
    (statsData ?? []).forEach(s => { statsMap[s.company_id] = s; });
    setStats(statsMap);
    setLoading(false);
  }, [page, filterStatus, filterPlan, filterIndustry, sortKey, sortAsc]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "name"); }
  };

  const subcategories = form.industry && industryConfig[form.industry as Industry]
    ? Object.entries(industryConfig[form.industry as Industry].subcategories).map(([value, cfg]) => ({ value, label: cfg.label }))
    : [];

  const openCreate = () => { setEditCompany(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Company) => {
    setEditCompany(c);
    setForm({
      name: c.name || "", slug: c.slug || "", kvk_number: c.kvk_number || "",
      btw_number: c.btw_number || "", address: c.address || "", postal_code: c.postal_code || "",
      city: c.city || "", phone: c.phone || "", iban: c.iban || "", smtp_email: c.smtp_email || "",
      max_users: (c as any).max_users ?? 2,
      enabled_features: (c as any).enabled_features ?? ALL_FEATURES.map(f => f.slug),
      subscription_plan: (c as any).subscription_plan || "starter",
      subscription_status: (c as any).subscription_status || "trial",
      trial_ends_at: (c as any).trial_ends_at ? new Date((c as any).trial_ends_at).toISOString().split("T")[0] : "",
      monthly_price: (c as any).monthly_price ?? 0,
      billing_email: (c as any).billing_email || "",
      stripe_customer_id: (c as any).stripe_customer_id || "",
      stripe_subscription_id: (c as any).stripe_subscription_id || "",
      industry: c.industry || "technical",
      subcategory: (c as any).subcategory || "general",
      admin_notes: (c as any).admin_notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) { toast({ title: "Naam en slug zijn verplicht", variant: "destructive" }); return; }
    setSaving(true);

    const payload: any = {
      name: form.name, slug: form.slug, kvk_number: form.kvk_number || null,
      btw_number: form.btw_number || null, address: form.address || null,
      postal_code: form.postal_code || null, city: form.city || null,
      phone: form.phone || null, iban: form.iban || null, smtp_email: form.smtp_email || null,
      max_users: form.max_users, enabled_features: form.enabled_features,
      subscription_plan: form.subscription_plan,
      subscription_status: form.subscription_status,
      trial_ends_at: form.trial_ends_at ? new Date(form.trial_ends_at).toISOString() : null,
      monthly_price: form.monthly_price,
      billing_email: form.billing_email || null,
      stripe_customer_id: form.stripe_customer_id || null,
      stripe_subscription_id: form.stripe_subscription_id || null,
      industry: form.industry,
      subcategory: form.subcategory,
      admin_notes: form.admin_notes || null,
    };

    if (editCompany) {
      const { error } = await supabase.from("companies").update(payload).eq("id", editCompany.id);
      if (error) toast({ title: "Fout bij opslaan", description: error.message, variant: "destructive" });
      else toast({ title: "Bedrijf bijgewerkt" });
    } else {
      const { error } = await supabase.from("companies").insert(payload);
      if (error) toast({ title: "Fout bij aanmaken", description: error.message, variant: "destructive" });
      else toast({ title: "Bedrijf aangemaakt" });
    }
    setSaving(false); setDialogOpen(false); fetchCompanies();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("companies").delete().eq("id", deleteId);
    if (error) toast({ title: "Fout bij verwijderen", description: error.message, variant: "destructive" });
    else toast({ title: "Bedrijf verwijderd" });
    setDeleteId(null); fetchCompanies();
  };

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (role === null) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Laden...</div>;
  if (!isSuperAdmin) return <div className="p-8 text-muted-foreground">Geen toegang.</div>;

  const SortHeader = ({ label, field, className }: { label: string; field: SortKey; className?: string }) => (
    <TableHead className={`cursor-pointer select-none hover:text-foreground ${className || ""}`} onClick={() => handleSort(field)}>
      {label} {sortKey === field ? (sortAsc ? "↑" : "↓") : ""}
    </TableHead>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" /> Super Admin
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Platform overzicht en bedrijvenbeheer</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Overzicht</TabsTrigger>
          <TabsTrigger value="companies" className="gap-1.5"><List className="w-4 h-4" /> Bedrijven</TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-1.5"><CreditCard className="w-4 h-4" /> Subscriptions</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Zap className="w-4 h-4" /> Activiteit</TabsTrigger>
          <TabsTrigger value="usage" className="gap-1.5"><Activity className="w-4 h-4" /> Usage</TabsTrigger>
          <TabsTrigger value="errors" className="gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Errors
            {unresolvedErrorCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {unresolvedErrorCount > 99 ? "99+" : unresolvedErrorCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <SuperAdminStats />
        </TabsContent>

        <TabsContent value="companies" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Zoek bedrijf..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPlan} onValueChange={v => { setFilterPlan(v); setPage(0); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle plannen</SelectItem>
                {PLANS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterIndustry} onValueChange={v => { setFilterIndustry(v); setPage(0); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle branches</SelectItem>
                {INDUSTRIES.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto">
              <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Bedrijf toevoegen</Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader label="Bedrijf" field="name" />
                      <TableHead>Branche</TableHead>
                      <SortHeader label="Plan" field="subscription_plan" />
                      <SortHeader label="Status" field="subscription_status" />
                      <TableHead>Trial</TableHead>
                      <SortHeader label="MRR" field="monthly_price" className="text-right" />
                      <TableHead className="text-center"><Users className="w-4 h-4 inline" /></TableHead>
                      <SortHeader label="Laatste activiteit" field="last_active_at" />
                      <SortHeader label="Aangemaakt" field="created_at" />
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Geen bedrijven gevonden</TableCell></TableRow>
                    ) : filtered.map(c => {
                      const ca = c as any;
                      const trialDays = ca.subscription_status === "trial" && ca.trial_ends_at
                        ? differenceInDays(new Date(ca.trial_ends_at), new Date())
                        : null;
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground">{c.slug}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {INDUSTRIES.find(i => i.value === c.industry)?.label || c.industry}
                            </Badge>
                          </TableCell>
                          <TableCell><PlanBadge plan={ca.subscription_plan || "starter"} /></TableCell>
                          <TableCell><StatusBadge status={ca.subscription_status || "trial"} /></TableCell>
                          <TableCell className="text-xs">
                            {trialDays !== null && (
                              <span className={`font-mono font-bold ${trialDays < 3 ? "text-destructive" : trialDays < 7 ? "text-warning" : "text-muted-foreground"}`}>
                                {trialDays}d
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {(ca.monthly_price || 0) > 0 ? `€${ca.monthly_price}` : "—"}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {stats[c.id]?.user_count ?? 0}/{ca.max_users ?? 2}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {ca.last_active_at
                              ? formatDistanceToNow(new Date(ca.last_active_at), { addSuffix: true, locale: nl })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString("nl-NL")}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" title="Bekijk als dit bedrijf" onClick={() => { impersonate(c.id, c.name); toast({ title: `Bekijken als ${c.name}` }); }}>
                                <Eye className="w-4 h-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} van {totalCount} bedrijven
                  </p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4 mr-1" /> Vorige
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                      Volgende <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <SuperAdminSubscriptions />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <SuperAdminActivity />
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          <SuperAdminUsage />
        </TabsContent>

        <TabsContent value="errors" className="mt-4">
          <SuperAdminErrors onUnresolvedCount={setUnresolvedErrorCount} />
        </TabsContent>
      </Tabs>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCompany ? "Bedrijf bewerken" : "Nieuw bedrijf"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {/* Basis */}
            <div className="col-span-2">
              <Label>Bedrijfsnaam *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} />
            </div>
            <div>
              <Label>KVK-nummer</Label>
              <Input value={form.kvk_number} onChange={e => setForm(f => ({ ...f, kvk_number: e.target.value }))} />
            </div>
            <div>
              <Label>BTW-nummer</Label>
              <Input value={form.btw_number} onChange={e => setForm(f => ({ ...f, btw_number: e.target.value }))} />
            </div>
            <div>
              <Label>IBAN</Label>
              <Input value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Adres</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <Label>Postcode</Label>
              <Input value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} />
            </div>
            <div>
              <Label>Plaats</Label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <Label>Telefoon</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>SMTP e-mail</Label>
              <Input value={form.smtp_email} onChange={e => setForm(f => ({ ...f, smtp_email: e.target.value }))} />
            </div>

            {/* Branche */}
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-sm font-semibold mb-2">Branche</p>
            </div>
            <div>
              <Label>Industry</Label>
              <Select value={form.industry} onValueChange={v => setForm(f => ({ ...f, industry: v, subcategory: "general" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subcategorie</Label>
              <Select value={form.subcategory} onValueChange={v => setForm(f => ({ ...f, subcategory: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {subcategories.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Abonnement */}
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-sm font-semibold mb-2">Abonnement</p>
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={form.subscription_plan} onValueChange={v => setForm(f => ({ ...f, subscription_plan: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.subscription_status} onValueChange={v => setForm(f => ({ ...f, subscription_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.subscription_status === "trial" && (
              <div>
                <Label>Trial verloopt</Label>
                <Input type="date" value={form.trial_ends_at} onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))} />
              </div>
            )}
            <div>
              <Label>Maandprijs (€)</Label>
              <Input type="number" min={0} value={form.monthly_price} onChange={e => setForm(f => ({ ...f, monthly_price: Number(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Billing e-mail</Label>
              <Input value={form.billing_email} onChange={e => setForm(f => ({ ...f, billing_email: e.target.value }))} />
            </div>
            <div>
              <Label>Max gebruikers</Label>
              <Input type="number" min={1} value={form.max_users} onChange={e => setForm(f => ({ ...f, max_users: parseInt(e.target.value) || 1 }))} />
            </div>

            {/* Stripe */}
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-sm font-semibold mb-2">Stripe</p>
            </div>
            <div>
              <Label>Stripe Customer ID</Label>
              <Input value={form.stripe_customer_id} onChange={e => setForm(f => ({ ...f, stripe_customer_id: e.target.value }))} placeholder="cus_..." />
            </div>
            <div>
              <Label>Stripe Subscription ID</Label>
              <Input value={form.stripe_subscription_id} onChange={e => setForm(f => ({ ...f, stripe_subscription_id: e.target.value }))} placeholder="sub_..." />
            </div>

            {/* Modules */}
            <div className="col-span-2 border-t pt-3 mt-1">
              <Label className="mb-2 block">Beschikbare modules</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_FEATURES.map(feat => (
                  <label key={feat.slug} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.enabled_features.includes(feat.slug)}
                      onCheckedChange={(checked) => {
                        setForm(f => ({
                          ...f,
                          enabled_features: checked
                            ? [...f.enabled_features, feat.slug]
                            : f.enabled_features.filter(s => s !== feat.slug),
                        }));
                      }}
                    />
                    {feat.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Intern */}
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-sm font-semibold mb-2">Intern</p>
            </div>
            <div className="col-span-2">
              <Label>Admin notities</Label>
              <Textarea value={form.admin_notes} onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))} placeholder="Interne opmerkingen..." rows={3} />
            </div>
            {editCompany && (
              <div className="col-span-2">
                <Label>Laatste activiteit</Label>
                <p className="text-sm text-muted-foreground">
                  {(editCompany as any).last_active_at
                    ? formatDistanceToNow(new Date((editCompany as any).last_active_at), { addSuffix: true, locale: nl })
                    : "Onbekend"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuleren</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              <Save className="w-4 h-4 mr-1" /> Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bedrijf verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit verwijdert het bedrijf en alle bijbehorende data. Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperAdminPage;
