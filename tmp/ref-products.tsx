import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useRompslompProducts, useRompslompSettings, useCreateRompslompProduct, useDeleteRompslompProduct } from '@/hooks/useRompslomp';
import { toast } from 'sonner';

export function RompslompProducts() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    description: '',
    price_per_unit: '',
    product_code: '',
  });

  const { data: settings } = useRompslompSettings();
  const { data: products, isLoading, refetch } = useRompslompProducts(settings?.company_id ?? null);
  const createProduct = useCreateRompslompProduct();
  const deleteProduct = useDeleteRompslompProduct();

  const handleCreateProduct = async () => {
    if (!settings?.company_id || !newProduct.description || !newProduct.price_per_unit) {
      toast.error('Vul alle verplichte velden in');
      return;
    }

    try {
      await createProduct.mutateAsync({
        companyId: settings.company_id,
        product: {
          invoice_line: {
            description: newProduct.description,
            price_per_unit: newProduct.price_per_unit,
            product_code: newProduct.product_code || undefined,
          },
        },
      });
      toast.success('Product aangemaakt in Rompslomp');
      setIsDialogOpen(false);
      setNewProduct({ description: '', price_per_unit: '', product_code: '' });
    } catch (error) {
      toast.error('Fout bij aanmaken van product');
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!settings?.company_id) return;

    try {
      await deleteProduct.mutateAsync({
        companyId: settings.company_id,
        productId,
      });
      toast.success('Product verwijderd');
    } catch (error) {
      toast.error('Fout bij verwijderen van product');
    }
  };

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Koppel eerst een Rompslomp bedrijf om producten te beheren</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Producten
            </CardTitle>
            <CardDescription>
              Beheer je producten en diensten in Rompslomp
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nieuw Product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nieuw Product</DialogTitle>
                  <DialogDescription>
                    Voeg een nieuw product toe aan Rompslomp
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">Omschrijving *</Label>
                    <Input
                      id="description"
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      placeholder="Bijv. Tuinonderhoud"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Prijs per stuk (excl. BTW) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={newProduct.price_per_unit}
                      onChange={(e) => setNewProduct({ ...newProduct, price_per_unit: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Productcode</Label>
                    <Input
                      id="code"
                      value={newProduct.product_code}
                      onChange={(e) => setNewProduct({ ...newProduct, product_code: e.target.value })}
                      placeholder="Bijv. P001"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuleren
                  </Button>
                  <Button onClick={handleCreateProduct} disabled={createProduct.isPending}>
                    {createProduct.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Aanmaken'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : products && products.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Omschrijving</TableHead>
                <TableHead className="text-right">Prijs (excl.)</TableHead>
                <TableHead className="text-right">Prijs (incl.)</TableHead>
                <TableHead className="text-right">Verkocht</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Badge variant="outline">{product.invoice_line.product_code}</Badge>
                  </TableCell>
                  <TableCell>{product.invoice_line.description}</TableCell>
                  <TableCell className="text-right">
                    €{parseFloat(product.invoice_line.price_without_vat).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    €{parseFloat(product.invoice_line.price_with_vat).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">{product.number_sold}x</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteProduct(product.id)}
                      disabled={deleteProduct.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nog geen producten</p>
            <p className="text-sm">Voeg je eerste product toe via de knop hierboven</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
