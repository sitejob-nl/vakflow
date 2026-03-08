import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CustomerCombobox from "@/components/CustomerCombobox";
import { useCustomers } from "@/hooks/useCustomers";
import { useContracts, type Contract } from "@/hooks/useContracts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contract?: Contract | null;
}

const ContractDialog = ({ open, onOpenChange, contract }: Props) => {
  const { upsert } = useContracts();
  const { data: customers } = useCustomers();
  const { toast } = useToast();
  const [syncingMb, setSyncingMb] = useState(false);

  const [form, setForm] = useState({
    name: "",
    customer_id: "",
    description: "",
    interval_months: 12,
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    next_due_date: new Date().toISOString().split("T")[0],
    price: 0,
    status: "actief",
    notes: "",
  });

  useEffect(() => {
    if (contract) {
      setForm({
        name: contract.name,
        customer_id: contract.customer_id,
        description: contract.description || "",
        interval_months: contract.interval_months,
        start_date: contract.start_date,
        end_date: contract.end_date || "",
        next_due_date: contract.next_due_date,
        price: contract.price,
        status: contract.status,
        notes: contract.notes || "",
      });
    } else {
      setForm({
        name: "",
        customer_id: "",
        description: "",
        interval_months: 12,
        start_date: new Date().toISOString().split("T")[0],
        end_date: "",
        next_due_date: new Date().toISOString().split("T")[0],
        price: 0,
        status: "actief",
        notes: "",
      });
    }
  }, [contract, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.customer_id) return;
    upsert.mutate(
      {
        ...(contract?.id ? { id: contract.id } : {}),
        name: form.name,
        customer_id: form.customer_id,
        description: form.description || null,
        interval_months: form.interval_months,
        start_date: form.start_date,
        end_date: form.end_date || null,
        next_due_date: form.next_due_date,
        price: form.price,
        status: form.status,
        notes: form.notes || null,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const handleSyncMoneybird = async () => {
    if (!contract?.id) return;
    setSyncingMb(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-moneybird", {
        body: { action: "create-subscription", contract_id: contract.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Contract gesynchroniseerd met Moneybird", description: `Subscription ID: ${data.moneybird_subscription_id}` });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setSyncingMb(false);
  };

  const set = (key: string, val: any) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contract ? "Contract bewerken" : "Nieuw contract"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Contractnaam *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Klant *</Label>
            <CustomerCombobox customers={customers} value={form.customer_id} onValueChange={(v) => set("customer_id", v)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Interval (maanden)</Label>
              <Select value={String(form.interval_months)} onValueChange={(v) => set("interval_months", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 6, 12, 24].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} maand{m > 1 ? "en" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prijs per beurt (€)</Label>
              <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set("price", parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Startdatum</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Einddatum (optioneel)</Label>
              <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Volgende werkbon-datum</Label>
            <Input type="date" value={form.next_due_date} onChange={(e) => set("next_due_date", e.target.value)} />
          </div>

          {contract && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="actief">Actief</SelectItem>
                  <SelectItem value="gepauzeerd">Gepauzeerd</SelectItem>
                  <SelectItem value="beeindigd">Beëindigd</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Omschrijving</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Notities</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>

          <div className="flex justify-between items-center pt-2">
            <div>
              {contract?.id && (
                <Button type="button" variant="outline" size="sm" onClick={handleSyncMoneybird} disabled={syncingMb}>
                  {syncingMb ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Sync naar Moneybird
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
              <Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? "Opslaan..." : "Opslaan"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContractDialog;
