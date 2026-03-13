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

export interface HexonListing {
  id: string;
  trade_vehicle_id: string;
  site_code: string;
  stocknumber: string;
  status: string | null;
  status_message: string | null;
  deeplink_url: string | null;
  errors: any;
  warnings: any;
  last_synced_at: string | null;
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
  // Extended fields
  hexon_stocknumber: string | null;
  description_nl: string | null;
  description_highlights: string[] | null;
  accessories: any;
  rdw_data: any;
  photo_count: number | null;
  video_url: string | null;
  bpm_amount: number | null;
  price_trade: number | null;
  price_export: number | null;
  source: string | null;
  supplier_name: string | null;
  delivery_date: string | null;
  transport_date: string | null;
  warranty_months: number | null;
  nap_weblabel_status: string | null;
  // Joined
  purchased_from_customer?: { name: string } | null;
  sold_to_customer?: { name: string } | null;
  work_order?: { work_order_number: string; status: string; description: string | null } | null;
  // Runtime (not from DB)
  hexon_listings?: HexonListing[];
  photo_urls?: string[];
}

export type TradeVehicleInsert = Omit<TradeVehicle, "id" | "created_at" | "updated_at" | "purchased_from_customer" | "sold_to_customer" | "work_order" | "hexon_listings" | "photo_urls">;

export const PIPELINE_STATUSES = [
  { key: "intake", label: "Intake", color: "bg-slate-500" },
  { key: "getaxeerd", label: "Getaxeerd", color: "bg-blue-500" },
  { key: "gekocht", label: "Gekocht", color: "bg-indigo-500" },
  { key: "betaald", label: "Betaald", color: "bg-violet-500" },
  { key: "transport", label: "Transport", color: "bg-amber-500" },
  { key: "binnen", label: "Binnen", color: "bg-cyan-500" },
  { key: "in_bewerking", label: "In bewerking", color: "bg-orange-500" },
  { key: "foto_klaar", label: "Foto klaar", color: "bg-teal-500" },
  { key: "online", label: "Online", color: "bg-emerald-500" },
  { key: "verkocht", label: "Verkocht", color: "bg-green-600" },
  { key: "afgeleverd", label: "Afgeleverd", color: "bg-green-700" },
  { key: "gearchiveerd", label: "Gearchiveerd", color: "bg-gray-500" },
] as const;

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PIPELINE_STATUSES.map((s) => [s.key, s.label])
);

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
      toast.success("Voertuig opgeslagen");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const payload: any = { status };
      if (status === "verkocht") payload.sold_at = new Date().toISOString();
      const { error } = await supabase
        .from("trade_vehicles" as any)
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade_vehicles"] });
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
      toast.success("Voertuig verwijderd");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, upsert, updateStatus, remove };
};

export const useHexonListings = (tradeVehicleId?: string) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["hexon_listings", companyId, tradeVehicleId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("hexon_listings" as any)
        .select("*")
        .eq("company_id", companyId);
      if (tradeVehicleId) q = q.eq("trade_vehicle_id", tradeVehicleId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as HexonListing[];
    },
  });
};

export const useTradeVehiclePhotos = (vehicleId: string | undefined) => {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["trade-vehicle-photos", companyId, vehicleId],
    enabled: !!companyId && !!vehicleId,
    queryFn: async () => {
      const prefix = `${companyId}/${vehicleId}/`;
      const { data, error } = await supabase.storage
        .from("trade-vehicle-photos")
        .list(prefix);
      if (error) throw error;
      return (data || []).map((f) => ({
        name: f.name,
        path: `${prefix}${f.name}`,
      }));
    },
  });
};

export const useTradeVehicleStats = () => {
  const { data: vehicles } = useTradeVehicles();

  return {
    total: vehicles?.length || 0,
    inPipeline: vehicles?.filter(v => !["verkocht", "afgeleverd", "gearchiveerd"].includes(v.status)).length || 0,
    online: vehicles?.filter(v => v.status === "online").length || 0,
    sold: vehicles?.filter(v => v.status === "verkocht" || v.status === "afgeleverd").length || 0,
    totalInvested: vehicles?.reduce((sum, v) => sum + v.purchase_price + v.estimated_repair_cost, 0) || 0,
    totalRevenue: vehicles?.filter(v => ["verkocht", "afgeleverd"].includes(v.status)).reduce((sum, v) => sum + (v.actual_sell_price || 0), 0) || 0,
    totalMargin: vehicles?.filter(v => ["verkocht", "afgeleverd"].includes(v.status)).reduce((sum, v) => {
      const cost = v.purchase_price + v.estimated_repair_cost;
      return sum + ((v.actual_sell_price || 0) - cost);
    }, 0) || 0,
  };
};
