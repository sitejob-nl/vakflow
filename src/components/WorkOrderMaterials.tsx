import { useState } from "react";
import {
  useMaterials,
  useWorkOrderMaterials,
  useAddWorkOrderMaterial,
  useDeleteWorkOrderMaterial,
  useCreateMaterial,
} from "@/hooks/useMaterials";
import { Package, Plus, Trash2, X, Search, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function WorkOrderMaterials({ workOrderId }: { workOrderId: string }) {
  const { toast } = useToast();
  const { data: catalogMaterials } = useMaterials();
  const { data: woMaterials } = useWorkOrderMaterials(workOrderId);
  const addMaterial = useAddWorkOrderMaterial();
  const deleteMaterial = useDeleteWorkOrderMaterial();
  const createCatalogMaterial = useCreateMaterial();

  const [showForm, setShowForm] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserSearch, setBrowserSearch] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("stuk");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const materials = woMaterials ?? [];
  const totalCost = materials.reduce((sum, m) => sum + m.total, 0);

  const handleSelectCatalog = (mat: { id: string; name: string; unit: string; unit_price: number }) => {
    setSelectedMaterialId(mat.id);
    setName(mat.name);
    setUnit(mat.unit);
    setUnitPrice(String(mat.unit_price));
    setShowSuggestions(false);
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    const qty = parseFloat(quantity) || 1;
    const price = parseFloat(unitPrice) || 0;

    try {
      // If it's a new material not in catalog, add it to catalog too
      let materialId = selectedMaterialId;
      if (!materialId && name.trim()) {
        const existing = (catalogMaterials ?? []).find(
          (m) => m.name.toLowerCase() === name.trim().toLowerCase()
        );
        if (existing) {
          materialId = existing.id;
        } else {
          const newMat = await createCatalogMaterial.mutateAsync({
            name: name.trim(),
            unit,
            unit_price: price,
            article_number: null,
            category: null,
            cost_price: 0,
            markup_percentage: 0,
          });
          materialId = (newMat as any).id;
        }
      }

      await addMaterial.mutateAsync({
        work_order_id: workOrderId,
        material_id: materialId,
        name: name.trim(),
        unit,
        quantity: qty,
        unit_price: price,
      });

      setName("");
      setUnit("stuk");
      setQuantity("1");
      setUnitPrice("");
      setSelectedMaterialId(null);
      setShowForm(false);
      toast({ title: "Materiaal toegevoegd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMaterial.mutateAsync(id);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const filteredSuggestions = (catalogMaterials ?? []).filter(
    (m) => name.length > 0 && m.name.toLowerCase().includes(name.toLowerCase())
  );

  const browseMaterials = (catalogMaterials ?? []).filter(
    (m) => browserSearch.length === 0 || m.name.toLowerCase().includes(browserSearch.toLowerCase())
  );

  const handleBrowserSelect = async (mat: { id: string; name: string; unit: string; unit_price: number }) => {
    try {
      await addMaterial.mutateAsync({
        work_order_id: workOrderId,
        material_id: mat.id,
        name: mat.name,
        unit: mat.unit,
        quantity: 1,
        unit_price: mat.unit_price,
      });
      toast({ title: `${mat.name} toegevoegd` });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-background border border-border rounded-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] uppercase tracking-widest text-t3 font-bold flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" /> Materialen
        </h4>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBrowser(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-t3 hover:text-foreground transition-colors"
          >
            <FolderOpen className="h-3 w-3" /> Bladeren
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-hover transition-colors"
          >
            <Plus className="h-3 w-3" /> Toevoegen
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border border-border rounded-sm p-3 mb-3 space-y-2 bg-muted/30">
          <div className="relative">
            <Input
              placeholder="Materiaalnaam..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSelectedMaterialId(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="text-[13px]"
              autoFocus
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 bg-background border border-border rounded-sm shadow-lg mt-1 max-h-40 overflow-y-auto">
                {filteredSuggestions.slice(0, 8).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectCatalog(m)}
                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-bg-hover transition-colors flex justify-between"
                  >
                    <span>{m.name}</span>
                    <span className="text-t3">
                      €{m.unit_price.toFixed(2)} / {m.unit}
                      {m.stock_quantity > 0 && <span className="ml-1.5 text-primary">({m.stock_quantity} op voorraad)</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="Aantal"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="text-[13px]"
              min="0"
              step="0.5"
            />
            <Input
              placeholder="Eenheid"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="text-[13px]"
            />
            <Input
              placeholder="Prijs/eenheid"
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="text-[13px]"
              min="0"
              step="0.01"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!name.trim() || addMaterial.isPending}>
              {addMaterial.isPending ? "Bezig..." : "Toevoegen"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setName("");
                setUnit("stuk");
                setQuantity("1");
                setUnitPrice("");
                setSelectedMaterialId(null);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Material list */}
      {materials.length === 0 && !showForm && (
        <p className="text-[13px] text-t3 italic">Geen materialen geregistreerd</p>
      )}

      {materials.length > 0 && (
        <div className="space-y-1">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-[13px] py-1.5 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <span className="font-semibold">{m.name}</span>
                <span className="text-t3 ml-1.5">
                  {m.quantity} {m.unit} × €{m.unit_price.toFixed(2)}
                </span>
              </div>
              <span className="font-bold whitespace-nowrap">€{m.total.toFixed(2)}</span>
              <button
                onClick={() => handleDelete(m.id)}
                className="text-t3 hover:text-destructive transition-colors p-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex justify-between pt-2 font-bold text-primary text-[13px]">
            <span>Totaal materialen</span>
            <span>€{totalCost.toFixed(2)}</span>
          </div>
        </div>
      )}
      {/* Material browser dialog */}
      <Dialog open={showBrowser} onOpenChange={setShowBrowser}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Materialen catalogus</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-t3" />
            <Input
              placeholder="Zoeken..."
              value={browserSearch}
              onChange={(e) => setBrowserSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {browseMaterials.length === 0 && (
              <p className="text-[13px] text-t3 italic text-center py-4">Geen materialen gevonden</p>
            )}
            {browseMaterials.map((mat) => (
              <button
                key={mat.id}
                onClick={() => handleBrowserSelect(mat)}
                disabled={addMaterial.isPending}
                className="w-full text-left p-3 rounded-sm border border-border hover:bg-bg-hover transition-colors disabled:opacity-50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-[13px]">{mat.name}</p>
                    {mat.category && <p className="text-[11px] text-t3">{mat.category}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[13px] text-primary">€{mat.unit_price.toFixed(2)}</p>
                    <p className="text-[11px] text-t3">per {mat.unit}</p>
                  </div>
                </div>
                {mat.stock_quantity > 0 && (
                  <p className="text-[11px] text-success mt-1">{mat.stock_quantity} op voorraad</p>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
