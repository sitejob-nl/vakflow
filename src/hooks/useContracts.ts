import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface Contract {
  id: string;
  company_id: string;
  customer_id: string;
  service_id: string | null;
  address_id: string | null;
  asset_id: string | null;
  assigned_to: string | null;
  name: string;
  description: string | null;
  status: string;
  interval_months: number;
  start_date: string;
  end_date: string | null;
  last_generated_at: string | null;
  next_due_date: string;
  price: number;
  notes: string | null;
  frequency: string | null;
  seasonal_months: number[] | null;
  auto_invoice: boolean;
  created_at: string;
  updated_at: string;
  customers?: { name: string } | null;
  services?: { name: string } | null;
}

export const useContracts = () => {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const key = ["contracts", companyId];

  const query = useQuery({
    queryKey: key,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, customers(name), services(name)")
        .eq("company_id", companyId!)
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      return data as Contract[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (contract: Partial<Contract> & { id?: string }) => {
      const payload = { ...contract, company_id: companyId! };
      if (contract.id) {
        const { error } = await supabase.from("contracts").update(payload).eq("id", contract.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contracts").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Contract opgeslagen" });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Contract verwijderd" });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("contract-generate");
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["workOrders"] });
      toast({ title: "Werkbonnen gegenereerd", description: `${data?.generated ?? 0} werkbon(nen) aangemaakt` });
    },
    onError: (e: any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  return { ...query, contracts: query.data ?? [], upsert, remove, generate };
};
