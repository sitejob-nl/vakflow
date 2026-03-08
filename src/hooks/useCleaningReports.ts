import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MaterialByAsset {
  asset_id: string;
  asset_name: string;
  total_cost: number;
  total_items: number;
}

interface QualityTrend {
  month: string;
  avg_score: number;
}

export function useCleaningReportData(filters: { startDate: Date; endDate: Date }) {
  const { companyId, industry } = useAuth();
  const isCleaning = industry === "cleaning";

  const query = useQuery({
    queryKey: ["cleaning-reports", companyId, filters.startDate.toISOString(), filters.endDate.toISOString()],
    enabled: !!companyId && isCleaning,
    queryFn: async () => {
      const start = filters.startDate.toISOString();
      const end = filters.endDate.toISOString();

      // 1. Active contracts & total value
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, name, price, status, asset_id, next_due_date")
        .eq("company_id", companyId!)
        .eq("status", "actief");

      const activeContracts = contracts?.length ?? 0;
      const totalContractValue = (contracts ?? []).reduce((s, c) => s + (c.price || 0), 0);

      // 2. Material consumption per asset via work_orders -> work_order_materials
      const { data: workOrders } = await supabase
        .from("work_orders")
        .select("id, asset_id")
        .eq("company_id", companyId!)
        .not("asset_id", "is", null)
        .gte("created_at", start)
        .lte("created_at", end);

      const woIds = workOrders?.map((w) => w.id) ?? [];
      const woAssetMap = new Map<string, string>();
      workOrders?.forEach((w) => { if (w.asset_id) woAssetMap.set(w.id, w.asset_id); });

      let materialByAsset: MaterialByAsset[] = [];
      if (woIds.length > 0) {
        const { data: materials } = await supabase
          .from("work_order_materials")
          .select("work_order_id, total, quantity")
          .in("work_order_id", woIds);

        // Aggregate per asset
        const assetTotals = new Map<string, { cost: number; items: number }>();
        materials?.forEach((m) => {
          const assetId = woAssetMap.get(m.work_order_id);
          if (!assetId) return;
          const cur = assetTotals.get(assetId) || { cost: 0, items: 0 };
          cur.cost += m.total || 0;
          cur.items += m.quantity || 0;
          assetTotals.set(assetId, cur);
        });

        // Get asset names
        const assetIds = [...assetTotals.keys()];
        if (assetIds.length > 0) {
          const { data: assetNames } = await supabase
            .from("assets")
            .select("id, name")
            .in("id", assetIds);

          const nameMap = new Map(assetNames?.map((a) => [a.id, a.name]) ?? []);
          materialByAsset = assetIds
            .map((id) => ({
              asset_id: id,
              asset_name: nameMap.get(id) || "Onbekend",
              total_cost: assetTotals.get(id)!.cost,
              total_items: assetTotals.get(id)!.items,
            }))
            .sort((a, b) => b.total_cost - a.total_cost)
            .slice(0, 10);
        }
      }

      // 3. Quality trend from quality_audits
      const { data: audits } = await supabase
        .from("quality_audits")
        .select("audit_date, overall_score")
        .eq("company_id", companyId!)
        .gte("audit_date", start.split("T")[0])
        .lte("audit_date", end.split("T")[0])
        .order("audit_date", { ascending: true });

      // Group by month
      const monthScores = new Map<string, number[]>();
      audits?.forEach((a) => {
        if (a.overall_score == null) return;
        const month = (a.audit_date as string).substring(0, 7);
        const arr = monthScores.get(month) || [];
        arr.push(a.overall_score);
        monthScores.set(month, arr);
      });

      const qualityTrend: QualityTrend[] = [...monthScores.entries()].map(([month, scores]) => ({
        month,
        avg_score: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)),
      }));

      // 4. Avg quality score across all active assets
      const { data: assetScores } = await supabase
        .from("assets")
        .select("avg_quality_score")
        .eq("company_id", companyId!)
        .not("avg_quality_score", "is", null);

      const scores = assetScores?.map((a) => a.avg_quality_score).filter(Boolean) as number[];
      const avgQualityScore = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null;

      return {
        activeContracts,
        totalContractValue,
        materialByAsset,
        qualityTrend,
        avgQualityScore,
      };
    },
  });

  return { data: query.data, isLoading: query.isLoading, isCleaning };
}
