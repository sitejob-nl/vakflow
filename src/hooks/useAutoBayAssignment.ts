import { useMemo } from "react";
import { useWorkshopBays } from "@/hooks/useVehicles";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { isSameDay, startOfDay } from "date-fns";

/**
 * Returns the bay with the least workload for a given date.
 * Used for auto-assigning bays when creating work orders.
 */
export const useAutoBayAssignment = (targetDate?: Date) => {
  const { data: bays } = useWorkshopBays();
  const { data: allWorkOrders } = useWorkOrders();

  const activeBays = useMemo(() => (bays ?? []).filter((b) => b.is_active), [bays]);

  const suggestion = useMemo(() => {
    if (!activeBays.length || !allWorkOrders || !targetDate) return null;

    const date = startOfDay(targetDate);

    // Count total minutes per bay for the target date
    const bayLoad = new Map<string, number>();
    activeBays.forEach((b) => bayLoad.set(b.id, 0));

    allWorkOrders.forEach((wo) => {
      const bayId = (wo as any).bay_id;
      if (!bayId || !bayLoad.has(bayId)) return;
      const scheduledAt = (wo as any).scheduled_at;
      if (scheduledAt && isSameDay(new Date(scheduledAt), date)) {
        const dur = (wo as any).estimated_duration_minutes || (wo as any).duration_minutes || 60;
        bayLoad.set(bayId, (bayLoad.get(bayId) ?? 0) + dur);
      }
    });

    // Find bay with lowest load
    let bestBay: { id: string; name: string } | null = null;
    let minLoad = Infinity;

    activeBays.forEach((bay) => {
      const load = bayLoad.get(bay.id) ?? 0;
      if (load < minLoad) {
        minLoad = load;
        bestBay = { id: bay.id, name: bay.name };
      }
    });

    return bestBay;
  }, [activeBays, allWorkOrders, targetDate]);

  return { suggestion, activeBays };
};
