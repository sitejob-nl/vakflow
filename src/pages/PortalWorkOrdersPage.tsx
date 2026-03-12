import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, Calendar, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignedMedia } from "@/components/SignedMedia";

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  gepland: { label: "Ingepland", icon: Clock, className: "bg-primary/10 text-primary" },
  onderweg: { label: "Onderweg", icon: Clock, className: "bg-warning/10 text-warning" },
  bezig: { label: "In behandeling", icon: Clock, className: "bg-primary/10 text-primary" },
  open: { label: "Ingepland", icon: Clock, className: "bg-primary/10 text-primary" },
  afgerond: { label: "Afgerond", icon: CheckCircle2, className: "bg-accent/10 text-accent" },
  geannuleerd: { label: "Geannuleerd", icon: AlertCircle, className: "bg-destructive/10 text-destructive" },
};

const PortalWorkOrdersPage = () => {
  const { customerId } = usePortalAuth();
  const [selected, setSelected] = useState<any | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!customerId) return;
    const channel = supabase
      .channel("portal-wo-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_orders", filter: `customer_id=eq.${customerId}` },
        () => queryClient.invalidateQueries({ queryKey: ["portal-workorders", customerId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [customerId, queryClient]);

  const { data: workOrders, isLoading } = useQuery({
    queryKey: ["portal-workorders", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*, services(name, color), appointments(scheduled_at)")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Werkbonnen</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Overzicht van alle werkzaamheden</p>
      </div>

      {!workOrders?.length ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Wrench className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Geen werkbonnen</p>
            <p className="text-sm mt-1">Er zijn nog geen werkbonnen voor u.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {workOrders.map((wo) => {
            const appointment = wo.appointments?.[0];
            const cfg = statusConfig[wo.status] || statusConfig.open;
            const StatusIcon = cfg.icon;
            const photosAfter = (wo.photos_after ?? []) as string[];

            return (
              <Card
                key={wo.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelected(wo)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{wo.work_order_number ?? "Werkbon"}</span>
                        {wo.services && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${wo.services.color || "hsl(var(--primary))"}18`,
                              color: wo.services.color || "hsl(var(--primary))",
                            }}
                          >
                            {wo.services.name}
                          </span>
                        )}
                      </div>
                      {wo.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{wo.description}</p>
                      )}
                      {appointment && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(appointment.scheduled_at), "d MMMM yyyy", { locale: nl })}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className={`${cfg.className} flex items-center gap-1 shrink-0`}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (() => {
            const cfg = statusConfig[selected.status] || statusConfig.open;
            const StatusIcon = cfg.icon;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selected.work_order_number ?? "Werkbon"}
                    <Badge variant="secondary" className={`${cfg.className} flex items-center gap-1`}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selected.services && (
                      <div>
                        <p className="text-muted-foreground text-xs">Dienst</p>
                        <p className="font-medium">{selected.services.name}</p>
                      </div>
                    )}
                    {selected.appointments?.[0] && (
                      <div>
                        <p className="text-muted-foreground text-xs">Datum</p>
                        <p className="font-medium">
                          {format(new Date(selected.appointments[0].scheduled_at), "d MMMM yyyy", { locale: nl })}
                        </p>
                      </div>
                    )}
                    {selected.completed_at && (
                      <div>
                        <p className="text-muted-foreground text-xs">Afgerond op</p>
                        <p className="font-medium">
                          {format(new Date(selected.completed_at), "d MMMM yyyy", { locale: nl })}
                        </p>
                      </div>
                    )}
                  </div>

                  {selected.description && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Omschrijving</p>
                      <p className="text-sm bg-muted/30 rounded-lg p-3">{selected.description}</p>
                    </div>
                  )}

                  {/* Only show "after" photos to customer */}
                  {(selected.photos_after ?? []).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Foto's van de werkzaamheden</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(selected.photos_after as string[]).map((url, i) => (
                          <SignedMedia key={i} url={url} bucket="work-order-photos" type="image" className="rounded-lg aspect-square object-cover w-full" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalWorkOrdersPage;
