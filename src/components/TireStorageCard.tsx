import { useState } from "react";
import { useVehicleTires, useCreateTireSet, useUpdateTireSet, useDeleteTireSet, type TireSet } from "@/hooks/useTireStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Check, Trash2, Pencil, Circle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const SEASONS = [
  { value: "zomer", label: "Zomer" },
  { value: "winter", label: "Winter" },
  { value: "all-season", label: "All-Season" },
];

const STATUSES = [
  { value: "opgeslagen", label: "Opgeslagen" },
  { value: "gemonteerd", label: "Gemonteerd" },
  { value: "afgevoerd", label: "Afgevoerd" },
];

const statusColor = (s: string) => {
  if (s === "opgeslagen") return "secondary";
  if (s === "gemonteerd") return "default";
  return "outline";
};

const TreadIndicator = ({ depth }: { depth: number | null }) => {
  if (depth === null || depth === undefined) return <span className="text-muted-foreground">—</span>;
  const color = depth >= 4 ? "text-green-600" : depth >= 2 ? "text-yellow-600" : "text-destructive";
  return <span className={`font-mono font-bold ${color}`}>{depth.toFixed(1)}</span>;
};

interface FormState {
  season: string;
  brand: string;
  size: string;
  dot_code: string;
  tread_depth_fl: string;
  tread_depth_fr: string;
  tread_depth_rl: string;
  tread_depth_rr: string;
  location_code: string;
  status: string;
  notes: string;
}

const emptyForm: FormState = {
  season: "zomer",
  brand: "",
  size: "",
  dot_code: "",
  tread_depth_fl: "",
  tread_depth_fr: "",
  tread_depth_rl: "",
  tread_depth_rr: "",
  location_code: "",
  status: "opgeslagen",
  notes: "",
};

export default function TireStorageCard({ vehicleId }: { vehicleId: string }) {
  const { toast } = useToast();
  const { data: tires, isLoading } = useVehicleTires(vehicleId);
  const createTire = useCreateTireSet();
  const updateTire = useUpdateTireSet();
  const deleteTire = useDeleteTireSet();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (t: TireSet) => {
    setEditingId(t.id);
    setForm({
      season: t.season,
      brand: t.brand ?? "",
      size: t.size ?? "",
      dot_code: t.dot_code ?? "",
      tread_depth_fl: t.tread_depth_fl?.toString() ?? "",
      tread_depth_fr: t.tread_depth_fr?.toString() ?? "",
      tread_depth_rl: t.tread_depth_rl?.toString() ?? "",
      tread_depth_rr: t.tread_depth_rr?.toString() ?? "",
      location_code: t.location_code ?? "",
      status: t.status,
      notes: t.notes ?? "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const payload = {
      vehicle_id: vehicleId,
      season: form.season,
      brand: form.brand.trim() || null,
      size: form.size.trim() || null,
      dot_code: form.dot_code.trim() || null,
      tread_depth_fl: parseFloat(form.tread_depth_fl) || null,
      tread_depth_fr: parseFloat(form.tread_depth_fr) || null,
      tread_depth_rl: parseFloat(form.tread_depth_rl) || null,
      tread_depth_rr: parseFloat(form.tread_depth_rr) || null,
      location_code: form.location_code.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    try {
      if (editingId) {
        await updateTire.mutateAsync({ id: editingId, ...payload });
        toast({ title: "Bandenset bijgewerkt" });
      } else {
        await createTire.mutateAsync(payload);
        toast({ title: "Bandenset toegevoegd" });
      }
      resetForm();
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteTire.mutateAsync(deletingId);
      toast({ title: "Bandenset verwijderd" });
      setDeletingId(null);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const setField = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Circle className="h-4 w-4" /> Bandenopslag
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Set toevoegen
        </Button>
      </CardHeader>
      <CardContent>
        {/* Form */}
        {showForm && (
          <div className="border border-border rounded-sm p-4 mb-4 bg-muted/30 space-y-3">
            <h4 className="text-[13px] font-bold">{editingId ? "Bandenset bewerken" : "Nieuwe bandenset"}</h4>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">Seizoen</label>
                <Select value={form.season} onValueChange={(v) => setField("season", v)}>
                  <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEASONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">Merk</label>
                <Input placeholder="bijv. Michelin" value={form.brand} onChange={(e) => setField("brand", e.target.value)} className="text-[13px]" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">Maat</label>
                <Input placeholder="bijv. 205/55R16" value={form.size} onChange={(e) => setField("size", e.target.value)} className="text-[13px]" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">DOT-code</label>
                <Input placeholder="bijv. 2523" value={form.dot_code} onChange={(e) => setField("dot_code", e.target.value)} className="text-[13px]" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">Opslaglocatie</label>
                <Input placeholder="bijv. Rek A3-2" value={form.location_code} onChange={(e) => setField("location_code", e.target.value)} className="text-[13px]" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">Status</label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tread depth per position */}
            <div className="border-t border-border pt-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Profieldiepte (mm)</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {([
                  ["tread_depth_fl", "Links voor"],
                  ["tread_depth_fr", "Rechts voor"],
                  ["tread_depth_rl", "Links achter"],
                  ["tread_depth_rr", "Rechts achter"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">{label}</label>
                    <Input
                      placeholder="0.0"
                      type="number"
                      value={form[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      className="text-[13px]"
                      min="0"
                      max="12"
                      step="0.1"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">Opmerkingen</label>
              <Input placeholder="Optioneel" value={form.notes} onChange={(e) => setField("notes", e.target.value)} className="text-[13px]" />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={createTire.isPending || updateTire.isPending}>
                {(createTire.isPending || updateTire.isPending) ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                {editingId ? "Opslaan" : "Toevoegen"}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}><X className="h-3 w-3 mr-1" /> Annuleren</Button>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !tires || tires.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4 italic">Geen banden opgeslagen voor dit voertuig</p>
        ) : (
          <div className="space-y-3">
            {tires.map((t) => (
              <div key={t.id} className="border border-border rounded-sm p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColor(t.status) as any} className="text-[10px]">{t.status}</Badge>
                    <span className="text-sm font-semibold">
                      {SEASONS.find((s) => s.value === t.season)?.label ?? t.season}
                    </span>
                    {t.brand && <span className="text-sm text-muted-foreground">{t.brand}</span>}
                    {t.size && <span className="text-sm text-muted-foreground font-mono">{t.size}</span>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(t)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDeletingId(t.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
                  {t.dot_code && <span className="text-muted-foreground">DOT: <span className="font-mono font-medium text-foreground">{t.dot_code}</span></span>}
                  {t.location_code && <span className="text-muted-foreground">Locatie: <span className="font-medium text-foreground">{t.location_code}</span></span>}
                  <span className="text-muted-foreground">Opgeslagen: {format(new Date(t.stored_at), "dd MMM yyyy", { locale: nl })}</span>
                </div>
                {/* Tread depths */}
                {(t.tread_depth_fl !== null || t.tread_depth_fr !== null || t.tread_depth_rl !== null || t.tread_depth_rr !== null) && (
                  <div className="grid grid-cols-4 gap-2 text-[11px] text-center border-t border-border pt-2">
                    <div><span className="text-muted-foreground block">LV</span><TreadIndicator depth={t.tread_depth_fl} /></div>
                    <div><span className="text-muted-foreground block">RV</span><TreadIndicator depth={t.tread_depth_fr} /></div>
                    <div><span className="text-muted-foreground block">LA</span><TreadIndicator depth={t.tread_depth_rl} /></div>
                    <div><span className="text-muted-foreground block">RA</span><TreadIndicator depth={t.tread_depth_rr} /></div>
                  </div>
                )}
                {t.notes && <p className="text-[12px] text-muted-foreground italic">{t.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bandenset verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit verwijdert de bandenset permanent uit het systeem.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteTire.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteTire.isPending ? "Verwijderen..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
