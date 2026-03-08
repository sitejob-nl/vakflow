import { useState } from "react";
import { useWorkshopBays, useCreateWorkshopBay, useUpdateWorkshopBay, useDeleteWorkshopBay, type WorkshopBay } from "@/hooks/useVehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WorkshopBaySettings = () => {
  const { data: bays, isLoading } = useWorkshopBays();
  const createBay = useCreateWorkshopBay();
  const updateBay = useUpdateWorkshopBay();
  const deleteBay = useDeleteWorkshopBay();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createBay.mutateAsync({ name: newName.trim(), sort_order: (bays?.length ?? 0) + 1 });
      setNewName("");
      toast({ title: "Brug toegevoegd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleToggle = async (bay: WorkshopBay) => {
    try {
      await updateBay.mutateAsync({ id: bay.id, is_active: !bay.is_active });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBay.mutateAsync(deleteId);
      toast({ title: "Brug verwijderd" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold">Werkplaatsbruggen</h3>
      <p className="text-xs text-muted-foreground">Beheer de bruggen/hefbruggen in je werkplaats voor de planning.</p>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Naam nieuwe brug (bijv. Brug 1)"
          className="max-w-xs"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={createBay.isPending || !newName.trim()}>
          {createBay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Toevoegen
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Laden...</p>
      ) : !bays?.length ? (
        <p className="text-muted-foreground text-sm">Nog geen bruggen aangemaakt.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead className="w-[80px]">Actief</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bays.map((bay) => (
              <TableRow key={bay.id}>
                <TableCell className="font-medium">{bay.name}</TableCell>
                <TableCell>
                  <Switch checked={bay.is_active} onCheckedChange={() => handleToggle(bay)} />
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(bay.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brug verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Werkbonnen op deze brug raken hun toewijzing kwijt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkshopBaySettings;
