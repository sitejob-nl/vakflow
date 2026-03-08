import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DamageItem {
  area: string;
  severity: "geen" | "licht" | "matig" | "zwaar";
  description: string;
  photo_url?: string;
}

export interface TradeVehicle {
  id: string;
  company_id: string;
  license_plate: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  color: string | null;
  fuel_type: string | null;
  transmission: string | null;
  vin: string | null;
  appraisal_date: string | null;
  appraised_by: string | null;
  damage_checklist: DamageItem[];
  general_notes: string | null;
  condition_score: number | null;
  purchase_price: number;
  estimated_repair_cost: number;
  target_sell_price: number;
  actual_sell_price: number | null;
  status: string;
  work_order_id: string | null;
  purchased_from_customer_id: string | null;
  sold_to_customer_id: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  purchased_from_customer?: { name: string } | null;
  sold_to_customer?: { name: string } | null;
  work_order?: { work_order_number: string; status: string; description: string | null } | null;
}

export type TradeVehicleInsert = Omit<TradeVehicle, "id" | "created_at" | "updated_at" | "purchased_from_customer" | "sold_to_customer" | "work_order">;

const DAMAGE_AREAS = [
  "Motorkap", "Voorbumper", "Linker voorscherm", "Rechter voorscherm",
  "Linker portier voor", "Rechter portier voor", "Linker portier achter", "Rechter portier achter",
  "Linker achterscherm", "Rechter achterscherm", "Achterbumper", "Kofferdeksel/achterklep",
  "Dak", "Onderstel", "Interieur", "Motor/Aandrijflijn", "Banden/Velgen", "Verlichting",
];

export { DAMAGE_AREAS };

export const useTradeVehicles = () => {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["trade_vehicles", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_vehicles" as any)
        .select(`
          *,
          purchased_from_customer:customers!trade_vehicles_purchased_from_customer_id_fkey(name),
          sold_to_customer:customers!trade_vehicles_sold_to_customer_id_fkey(name),
          work_order:work_orders!trade_vehicles_work_order_id_fkey(work_order_number, status, description)
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TradeVehicle[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (vehicle: Partial<TradeVehicleInsert> & { id?: string }) => {
      const payload = { ...vehicle, company_id: companyId };
      if (vehicle.id) {
        const { error } = await supabase
          .from("trade_vehicles" as any)
          .update(payload as any)
          .eq("id", vehicle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("trade_vehicles" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade_vehicles"] });
      toast.success("Inruilvoertuig opgeslagen");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("trade_vehicles" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade_vehicles"] });
      toast.success("Inruilvoertuig verwijderd");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, upsert, remove };
};

export const useTradeVehicleStats = () => {
  const { data: vehicles } = useTradeVehicles();

  const stats = {
    total: vehicles?.length || 0,
    intake: vehicles?.filter(v => v.status === "intake").length || 0,
    inRepair: vehicles?.filter(v => v.status === "in_opknapbeurt").length || 0,
    forSale: vehicles?.filter(v => v.status === "te_koop").length || 0,
    sold: vehicles?.filter(v => v.status === "verkocht").length || 0,
    totalInvested: vehicles?.reduce((sum, v) => sum + v.purchase_price + v.estimated_repair_cost, 0) || 0,
    totalRevenue: vehicles?.filter(v => v.status === "verkocht").reduce((sum, v) => sum + (v.actual_sell_price || 0), 0) || 0,
    totalMargin: vehicles?.filter(v => v.status === "verkocht").reduce((sum, v) => {
      const cost = v.purchase_price + v.estimated_repair_cost;
      return sum + ((v.actual_sell_price || 0) - cost);
    }, 0) || 0,
  };

  return stats;
};
