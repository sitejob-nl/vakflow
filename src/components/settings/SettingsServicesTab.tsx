import { useState, useEffect } from "react";
import { useServices, useDeleteService } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ServiceDialog from "@/components/ServiceDialog";
import type { Tables } from "@/integrations/supabase/types";

const SettingsServicesTab = () => {
  const { toast } = useToast();
  const { data: services, isLoading } = useServices();
  const deleteService = useDeleteService();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Tables<"services"> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold">Diensten</h3>
        <Button size="sm" onClick={() => { setEditingService(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nieuwe dienst
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !services?.length ? (
        <p className="text-[13px] text-muted-foreground text-center py-8">Nog geen diensten. Voeg je eerste dienst toe.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Naam</TableHead>
              <TableHead>Categorie</TableHead>
              <TableHead className="text-right">Prijs (incl.)</TableHead>
              <TableHead className="text-right">Duur</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((s) => (
              <TableRow key={s.id}>
                <TableCell><span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: s.color || "#64748b" }} /></TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-muted-foreground">{s.category || "—"}</TableCell>
                <TableCell className="text-right">€{Number(s.price).toFixed(2)}</TableCell>
                <TableCell className="text-right">{(s as any).duration_minutes ?? 60} min</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingService(s); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingId(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ServiceDialog open={dialogOpen} onOpenChange={setDialogOpen} service={editingService} />

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dienst verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await deleteService.mutateAsync(deletingId!); setDeletingId(null); toast({ title: "Dienst verwijderd" }); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsServicesTab;
