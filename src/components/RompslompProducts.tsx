import { useState } from "react";
import { Loader2, Package, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRompslompProducts, useRompslompSettings, useCreateRompslompProduct, useDeleteRompslompProduct } from "@/hooks/useRompslomp";
import { toast } from "sonner";
import { SETTINGS_INPUT_CLASS as inputClass, SETTINGS_LABEL_CLASS as labelClass } from "@/components/settings/shared";

export function RompslompProducts() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ description: "", price_per_unit: "", product_code: "" });

  const { data: settings } = useRompslompSettings();
  const hasSettings = !!settings?.company_id;
  const { data: products, isLoading, refetch } = useRompslompProducts(hasSettings);
  const createProduct = useCreateRompslompProduct();
  const deleteProduct = useDeleteRompslompProduct();

  const handleCreate = async () => {
    if (!newProduct.description || !newProduct.price_per_unit) {
      toast.error("Vul alle verplichte velden in");
      return;
    }
    try {
      await createProduct.mutateAsync({
        product: {
          invoice_line: {
            description: newProduct.description,
            price_per_unit: newProduct.price_per_unit,
            product_code: newProduct.product_code || undefined,
          },
        },
      });
      toast.success("Product aangemaakt");
      setDialogOpen(false);
      setNewProduct({ description: "", price_per_unit: "", product_code: "" });
    } catch {
      toast.error("Aanmaken mislukt");
    }
  };

  const handleDelete = async (productId: number) => {
    try {
      await deleteProduct.mutateAsync({ productId });
      toast.success("Product verwijderd");
    } catch {
      toast.error("Verwijderen mislukt");
    }
  };

  if (!hasSettings) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-foreground flex items-center gap-2">
          <Package className="h-4 w-4" /> Producten
        </h3>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-7 text-[11px]">
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 text-[11px]"><Plus className="h-3 w-3 mr-1" /> Nieuw</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nieuw Product</DialogTitle>
                <DialogDescription>Voeg een nieuw product toe aan Rompslomp</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3">
                <div>
                  <label className={labelClass}>Omschrijving *</label>
                  <input value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} className={inputClass} placeholder="Bijv. Tuinonderhoud" />
                </div>
                <div>
                  <label className={labelClass}>Prijs (excl. BTW) *</label>
                  <input type="number" step="0.01" value={newProduct.price_per_unit} onChange={(e) => setNewProduct({ ...newProduct, price_per_unit: e.target.value })} className={inputClass} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelClass}>Productcode</label>
                  <input value={newProduct.product_code} onChange={(e) => setNewProduct({ ...newProduct, product_code: e.target.value })} className={inputClass} placeholder="Bijv. P001" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuleren</Button>
                <Button onClick={handleCreate} disabled={createProduct.isPending}>
                  {createProduct.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aanmaken"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : products && products.length > 0 ? (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Code</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Omschrijving</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Prijs (excl.)</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Verkocht</th>
                <th className="w-[40px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5"><Badge variant="outline" className="text-[10px]">{p.invoice_line.product_code || "-"}</Badge></td>
                  <td className="px-3 py-2.5 text-[12px] text-foreground">{p.invoice_line.description}</td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-foreground">€{parseFloat(p.invoice_line.price_without_vat).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-muted-foreground">{p.number_sold}×</td>
                  <td className="px-3 py-2.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(p.id)} disabled={deleteProduct.isPending}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center py-8 text-[13px] text-muted-foreground">Nog geen producten</p>
      )}
    </div>
  );
}
