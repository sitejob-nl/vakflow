import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import TemplateDialog from "@/components/TemplateDialog";
import { useQuoteTemplatesDB, useDeleteQuoteTemplate, useCombinedTemplates, type QuoteTemplateDB } from "@/hooks/useQuoteTemplates";

const SettingsTemplatesTab = () => {
  const { toast } = useToast();
  const { data: customTemplates, isLoading } = useQuoteTemplatesDB();
  const { data: allTemplates } = useCombinedTemplates();
  const deleteTemplate = useDeleteQuoteTemplate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplateDB | null>(null);
  const [editingStandard, setEditingStandard] = useState<{ name: string; items: any[]; optional_items: any[] } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("hidden_standard_templates") || "[]"); } catch { return []; }
  });

  const hideTemplate = (id: string) => {
    const next = [...hidden, id];
    setHidden(next);
    localStorage.setItem("hidden_standard_templates", JSON.stringify(next));
    toast({ title: "Standaard sjabloon verborgen" });
  };

  const visible = allTemplates?.filter(t => !(!t.isCustom && hidden.includes(t.id))) ?? [];

  return (
    <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold mb-1">Offerte / Factuur sjablonen</h3>
          <p className="text-[12px] text-secondary-foreground">Beheer je eigen sjablonen voor offertes en facturen.</p>
        </div>
        <Button size="sm" onClick={() => { setEditingTemplate(null); setEditingStandard(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nieuw sjabloon
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !visible.length ? (
        <p className="text-[13px] text-muted-foreground text-center py-6">Geen sjablonen gevonden.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Artikelen</TableHead>
              <TableHead>Optioneel</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${t.isCustom ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {t.isCustom ? "★ Aangepast" : "Standaard"}
                  </span>
                </TableCell>
                <TableCell>{t.items.length}</TableCell>
                <TableCell>{t.optionalItems.length}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      if (t.isCustom) {
                        const dbTpl = customTemplates?.find(ct => ct.id === t.id);
                        if (dbTpl) { setEditingTemplate(dbTpl); setEditingStandard(null); setDialogOpen(true); }
                      } else {
                        setEditingTemplate(null);
                        setEditingStandard({ name: t.name, items: t.items, optional_items: t.optionalItems });
                        setDialogOpen(true);
                      }
                    }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => {
                      t.isCustom ? setDeletingId(t.id) : setHidingId(t.id);
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {hidden.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => { setHidden([]); localStorage.removeItem("hidden_standard_templates"); }}>
          Verborgen standaard sjablonen herstellen ({hidden.length})
        </Button>
      )}

      <TemplateDialog open={dialogOpen} onOpenChange={setDialogOpen} editTemplate={editingTemplate} prefill={editingStandard} />

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Sjabloon verwijderen?</AlertDialogTitle><AlertDialogDescription>Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await deleteTemplate.mutateAsync(deletingId!); setDeletingId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hidingId} onOpenChange={(open) => !open && setHidingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Standaard sjabloon verbergen?</AlertDialogTitle><AlertDialogDescription>Dit sjabloon wordt verborgen. Je kunt het later herstellen.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { hideTemplate(hidingId!); setHidingId(null); }}>Verbergen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsTemplatesTab;
