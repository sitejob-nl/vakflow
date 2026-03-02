import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Pencil, Trash2, Search, Plus, Save, Loader2, Eye, BarChart3, List, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SuperAdminStats from "@/components/SuperAdminStats";
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
  { slug: "email", label: "E-mail" },
  { slug: "whatsapp", label: "WhatsApp" },
  { slug: "communication", label: "Logboek" },
  { slug: "reminders", label: "Reminders" },
];

const emptyForm = {
  name: "", slug: "", kvk_number: "", btw_number: "", address: "",
  postal_code: "", city: "", phone: "", iban: "", smtp_email: "",
  max_users: 2,
  enabled_features: ALL_FEATURES.map(f => f.slug),
};

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

  const fetchCompanies = useCallback(async () => {
    setLoading(true);

    // Paginated companies query
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from("companies")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    setCompanies(data ?? []);
    setTotalCount(count ?? 0);

    // Single RPC call for all company stats
    const { data: statsData } = await supabase.rpc("get_company_stats") as { data: CompanyStats[] | null };
    const statsMap: Record<string, CompanyStats> = {};
    (statsData ?? []).forEach(s => { statsMap[s.company_id] = s; });
    setStats(statsMap);

    setLoading(false);
  }, [page]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const openCreate = () => { setEditCompany(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Company) => {
    setEditCompany(c);
    setForm({
      name: c.name || "", slug: c.slug || "", kvk_number: c.kvk_number || "",
      btw_number: c.btw_number || "", address: c.address || "", postal_code: c.postal_code || "",
      city: c.city || "", phone: c.phone || "", iban: c.iban || "", smtp_email: c.smtp_email || "",
      max_users: (c as any).max_users ?? 2,
      enabled_features: (c as any).enabled_features ?? ALL_FEATURES.map(f => f.slug),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) { toast({ title: "Naam en slug zijn verplicht", variant: "destructive" }); return; }
    setSaving(true);
    if (editCompany) {
      const { error } = await supabase.from("companies").update(form).eq("id", editCompany.id);
      if (error) toast({ title: "Fout bij opslaan", description: error.message, variant: "destructive" });
      else toast({ title: "Bedrijf bijgewerkt" });
    } else {
      const { error } = await supabase.from("companies").insert(form);
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

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" /> Super Admin
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Platform overzicht en bedrijvenbeheer</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Overzicht</TabsTrigger>
          <TabsTrigger value="companies" className="gap-1.5"><List className="w-4 h-4" /> Bedrijven</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <SuperAdminStats />
        </TabsContent>

        <TabsContent value="companies" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Zoek bedrijf..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Bedrijf toevoegen</Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bedrijf</TableHead>
                      <TableHead>Abonnement</TableHead>
                      <TableHead>KVK</TableHead>
                      <TableHead className="text-center"><Users className="w-4 h-4 inline" /> Users</TableHead>
                      <TableHead className="text-center">Klanten</TableHead>
                      <TableHead className="text-center">Werkbonnen</TableHead>
                      <TableHead className="text-center">Aangemaakt</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Geen bedrijven gevonden</TableCell></TableRow>
                    ) : filtered.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5">
                              {(c as any).max_users ?? 2} users
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {((c as any).enabled_features as string[] | undefined)?.length === ALL_FEATURES.length
                                ? "Alle modules"
                                : `${((c as any).enabled_features as string[] | undefined)?.length ?? 0}/${ALL_FEATURES.length} modules`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{c.kvk_number || "—"}</TableCell>
                        <TableCell className="text-center">{stats[c.id]?.user_count ?? 0}</TableCell>
                        <TableCell className="text-center">{stats[c.id]?.customer_count ?? 0}</TableCell>
                        <TableCell className="text-center">{stats[c.id]?.work_order_count ?? 0}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("nl-NL")}</TableCell>
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
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
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
      </Tabs>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editCompany ? "Bedrijf bewerken" : "Nieuw bedrijf"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
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

            {/* Subscription settings */}
            <div className="col-span-2 border-t pt-3 mt-1">
              <p className="text-sm font-semibold mb-2">Abonnement</p>
            </div>
            <div>
              <Label>Max gebruikers</Label>
              <Input type="number" min={1} value={form.max_users} onChange={e => setForm(f => ({ ...f, max_users: parseInt(e.target.value) || 1 }))} />
            </div>
            <div className="col-span-2">
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
