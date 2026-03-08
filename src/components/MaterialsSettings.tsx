import { useState } from "react";
import { useMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial, type Material } from "@/hooks/useMaterials";
import { Plus, Pencil, Trash2, X, Check, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function MaterialsSettings() {
  const { toast } = useToast();
  const { data: materials, isLoading } = useMaterials();
  const createMaterial = useCreateMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("stuk");
  const [unitPrice, setUnitPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [markupPercentage, setMarkupPercentage] = useState("");
  const [articleNumber, setArticleNumber] = useState("");
  const [category, setCategory] = useState("");

  const resetForm = () => {
    setName("");
    setUnit("stuk");
    setUnitPrice("");
    setCostPrice("");
    setMarkupPercentage("");
    setArticleNumber("");
    setCategory("");
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (m: Material) => {
    setEditingId(m.id);
    setName(m.name);
    setUnit(m.unit);
    setUnitPrice(String(m.unit_price));
    setCostPrice(String(m.cost_price || ""));
    setMarkupPercentage(String(m.markup_percentage || ""));
    setArticleNumber(m.article_number ?? "");
    setCategory(m.category ?? "");
    setShowForm(true);
  };

  // Auto-calculate unit_price when cost_price or markup changes
  const handleCostPriceChange = (val: string) => {
    setCostPrice(val);
    const cp = parseFloat(val) || 0;
    const mp = parseFloat(markupPercentage) || 0;
    if (cp > 0) {
      setUnitPrice((cp * (1 + mp / 100)).toFixed(2));
    }
  };

  const handleMarkupChange = (val: string) => {
    setMarkupPercentage(val);
    const cp = parseFloat(costPrice) || 0;
    const mp = parseFloat(val) || 0;
    if (cp > 0) {
      setUnitPrice((cp * (1 + mp / 100)).toFixed(2));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const cp = parseFloat(costPrice) || 0;
    const mp = parseFloat(markupPercentage) || 0;
    const calculatedPrice = cp > 0 ? cp * (1 + mp / 100) : parseFloat(unitPrice) || 0;

    const payload = {
      name: name.trim(),
      unit,
      unit_price: calculatedPrice,
      cost_price: cp,
      markup_percentage: mp,
      article_number: articleNumber.trim() || null,
      category: category.trim() || null,
    };

    try {
      if (editingId) {
        await updateMaterial.mutateAsync({ id: editingId, ...payload });
        toast({ title: "Materiaal bijgewerkt" });
      } else {
        await createMaterial.mutateAsync(payload);
        toast({ title: "Materiaal toegevoegd" });
      }
      resetForm();
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMaterial.mutateAsync(deletingId);
      toast({ title: "Materiaal verwijderd" });
      setDeletingId(null);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const filtered = (materials ?? []).filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.article_number ?? "").toLowerCase().includes(q) ||
      (m.category ?? "").toLowerCase().includes(q)
    );
  });

  const categories = [...new Set((materials ?? []).map((m) => m.category).filter(Boolean))] as string[];

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold flex items-center gap-2">
          <Package className="h-4 w-4" /> Materialencatalogus
        </h3>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Nieuw materiaal
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-t3" />
        <Input
          placeholder="Zoek op naam, artikelnummer of categorie..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-[13px]"
        />
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="border border-border rounded-sm p-4 mb-4 bg-muted/30 space-y-3">
          <h4 className="text-[13px] font-bold">
            {editingId ? "Materiaal bewerken" : "Nieuw materiaal"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Naam *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-[13px]"
              autoFocus
            />
            <Input
              placeholder="Artikelnummer"
              value={articleNumber}
              onChange={(e) => setArticleNumber(e.target.value)}
              className="text-[13px]"
            />
            <Input
              placeholder="Eenheid (bijv. stuk, meter, liter)"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="text-[13px]"
            />
            <Input
              placeholder="Categorie"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-[13px]"
              list="material-categories"
            />
            <datalist id="material-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* Markup calculation section */}
          <div className="border-t border-border pt-3 mt-2">
            <p className="text-[11px] font-bold text-t3 uppercase tracking-wide mb-2">Prijsberekening</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-t3 font-semibold mb-1 block">Inkoopprijs (€)</label>
                <Input
                  placeholder="0.00"
                  type="number"
                  value={costPrice}
                  onChange={(e) => handleCostPriceChange(e.target.value)}
                  className="text-[13px]"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-[11px] text-t3 font-semibold mb-1 block">Opslag (%)</label>
                <Input
                  placeholder="0"
                  type="number"
                  value={markupPercentage}
                  onChange={(e) => handleMarkupChange(e.target.value)}
                  className="text-[13px]"
                  min="0"
                  step="1"
                />
              </div>
              <div>
                <label className="text-[11px] text-t3 font-semibold mb-1 block">Verkoopprijs (€)</label>
                <Input
                  placeholder="0.00"
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="text-[13px]"
                  min="0"
                  step="0.01"
                  readOnly={parseFloat(costPrice) > 0}
                />
                {parseFloat(costPrice) > 0 && (
                  <p className="text-[10px] text-t3 mt-1">Automatisch berekend op basis van inkoopprijs + opslag%</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!name.trim() || createMaterial.isPending || updateMaterial.isPending}
            >
              {createMaterial.isPending || updateMaterial.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              {editingId ? "Opslaan" : "Toevoegen"}
            </Button>
            <Button size="sm" variant="outline" onClick={resetForm}>
              <X className="h-3 w-3 mr-1" /> Annuleren
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-t3 text-center py-8 italic">
          {search ? "Geen materialen gevonden" : "Nog geen materialen in de catalogus"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Naam</TableHead>
                <TableHead className="text-[11px]">Artikelnr.</TableHead>
                <TableHead className="text-[11px]">Categorie</TableHead>
                <TableHead className="text-[11px]">Eenheid</TableHead>
                <TableHead className="text-[11px] text-right">Inkoop</TableHead>
                <TableHead className="text-[11px] text-right">Opslag</TableHead>
                <TableHead className="text-[11px] text-right">Verkoop</TableHead>
                <TableHead className="text-[11px] w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-[13px] font-semibold">{m.name}</TableCell>
                  <TableCell className="text-[13px] text-t3">{m.article_number || "—"}</TableCell>
                  <TableCell className="text-[13px] text-t3">{m.category || "—"}</TableCell>
                  <TableCell className="text-[13px]">{m.unit}</TableCell>
                  <TableCell className="text-[13px] text-right text-t3">
                    {m.cost_price > 0 ? `€${m.cost_price.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-[13px] text-right text-t3">
                    {m.markup_percentage > 0 ? `${m.markup_percentage}%` : "—"}
                  </TableCell>
                  <TableCell className="text-[13px] text-right font-semibold">€{m.unit_price.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => startEdit(m)}
                        className="p-1.5 text-t3 hover:text-primary transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingId(m.id)}
                        className="p-1.5 text-t3 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-t3 mt-3">
        {(materials ?? []).length} materialen in catalogus
      </p>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Materiaal verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit materiaal wordt uit de catalogus verwijderd. Reeds geregistreerde materialen op werkbonnen blijven behouden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMaterial.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMaterial.isPending ? "Verwijderen..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}