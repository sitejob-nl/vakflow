import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Pencil, Trash2, Search, Plus, X, Save, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies">;

interface CompanyStats {
  company_id: string;
  customer_count: number;
  user_count: number;
  work_order_count: number;
}

const emptyForm = {
  name: "", slug: "", kvk_number: "", btw_number: "", address: "",
  postal_code: "", city: "", phone: "", iban: "", smtp_email: "",
};

const SuperAdminPage = () => {
  const { isSuperAdmin, impersonate, isImpersonating, impersonatedCompanyName, stopImpersonating } = useAuth();
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

  const fetchCompanies = async () => {
    setLoading(true);
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    setCompanies(data ?? []);

    // Fetch stats per company
    const statsMap: Record<string, CompanyStats> = {};
    if (data) {
      const ids = data.map(c => c.id);
      const [custRes, userRes, woRes] = await Promise.all([
        supabase.from("customers").select("company_id", { count: "exact", head: false }).in("company_id", ids),
        supabase.from("profiles").select("company_id", { count: "exact", head: false }).in("company_id", ids),
        supabase.from("work_orders").select("company_id", { count: "exact", head: false }).in("company_id", ids),
      ]);

      for (const id of ids) {
        statsMap[id] = {
          company_id: id,
          customer_count: (custRes.data ?? []).filter(r => r.company_id === id).length,
          user_count: (userRes.data ?? []).filter(r => r.company_id === id).length,
          work_order_count: (woRes.data ?? []).filter(r => r.company_id === id).length,
        };
      }
    }
    setStats(statsMap);
    setLoading(false);
  };

  useEffect(() => { fetchCompanies(); }, []);

  const openCreate = () => {
    setEditCompany(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditCompany(c);
    setForm({
      name: c.name || "", slug: c.slug || "", kvk_number: c.kvk_number || "",
      btw_number: c.btw_number || "", address: c.address || "", postal_code: c.postal_code || "",
      city: c.city || "", phone: c.phone || "", iban: c.iban || "", smtp_email: c.smtp_email || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      toast({ title: "Naam en slug zijn verplicht", variant: "destructive" });
      return;
    }
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
    setSaving(false);
    setDialogOpen(false);
    fetchCompanies();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("companies").delete().eq("id", deleteId);
    if (error) toast({ title: "Fout bij verwijderen", description: error.message, variant: "destructive" });
    else toast({ title: "Bedrijf verwijderd" });
    setDeleteId(null);
    fetchCompanies();
  };

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  if (!isSuperAdmin) return <div className="p-8 text-muted-foreground">Geen toegang.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Super Admin — Bedrijven
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{companies.length} bedrijven geregistreerd</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Bedrijf toevoegen</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Zoek bedrijf..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bedrijf</TableHead>
                <TableHead>Slug</TableHead>
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
                  <TableCell className="text-muted-foreground text-xs font-mono">{c.slug}</TableCell>
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
      )}

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
