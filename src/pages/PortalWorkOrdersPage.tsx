import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, Calendar, User, MapPin, Image } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SignedMedia from "@/components/SignedMedia";

const statusColors: Record<string, string> = {
  gepland: "bg-primary/10 text-primary",
  onderweg: "bg-warning/10 text-warning",
  bezig: "bg-purple/10 text-purple",
  afgerond: "bg-accent/10 text-accent",
  geannuleerd: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  gepland: "Gepland",
  onderweg: "Onderweg",
  bezig: "Bezig",
  afgerond: "Afgerond",
  geannuleerd: "Geannuleerd",
};

const PortalWorkOrdersPage = () => {
  const { customerId } = usePortalAuth();
  const [selected, setSelected] = useState<any | null>(null);

  const { data: workOrders, isLoading } = useQuery({
    queryKey: ["portal-workorders", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*, services(name, color), profiles:assigned_to(full_name), appointments(scheduled_at, duration_minutes)")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Werkbonnen</h1>
        <p className="text-sm text-muted-foreground">Overzicht van alle werkzaamheden</p>
      </div>

      {!workOrders?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Geen werkbonnen beschikbaar</p>
            <p className="text-sm">Er zijn nog geen werkbonnen voor u.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {workOrders.map((wo) => {
            const appointment = wo.appointments?.[0];
            const photosAfter = (wo.photos_after ?? []) as string[];
            const photosBefore = (wo.photos_before ?? []) as string[];
            const hasPhotos = photosAfter.length > 0 || photosBefore.length > 0;

            return (
              <Card
                key={wo.id}
                className="overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setSelected(wo)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {wo.work_order_number ?? "Werkbon"}
                        {wo.services && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${wo.services.color || "#3b82f6"}18`,
                              color: wo.services.color || "#3b82f6",
                            }}
                          >
                            {wo.services.name}
                          </span>
                        )}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                        {appointment && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(appointment.scheduled_at), "d MMM yyyy HH:mm", { locale: nl })}
                          </span>
                        )}
                        {wo.profiles?.full_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {wo.profiles.full_name}
                          </span>
                        )}
                        {hasPhotos && (
                          <span className="flex items-center gap-1">
                            <Image className="h-3.5 w-3.5" />
                            {photosAfter.length + photosBefore.length} foto's
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className={statusColors[wo.status] ?? ""}>
                      {statusLabels[wo.status] ?? wo.status}
                    </Badge>
                  </div>
                </CardHeader>
                {wo.description && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2">{wo.description}</p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.work_order_number ?? "Werkbon"}
                  <Badge variant="secondary" className={statusColors[selected.status] ?? ""}>
                    {statusLabels[selected.status] ?? selected.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selected.services && (
                    <div>
                      <p className="text-muted-foreground text-xs">Dienst</p>
                      <p className="font-medium">{selected.services.name}</p>
                    </div>
                  )}
                  {selected.profiles?.full_name && (
                    <div>
                      <p className="text-muted-foreground text-xs">Monteur</p>
                      <p className="font-medium">{selected.profiles.full_name}</p>
                    </div>
                  )}
                  {selected.appointments?.[0] && (
                    <div>
                      <p className="text-muted-foreground text-xs">Gepland</p>
                      <p className="font-medium">
                        {format(new Date(selected.appointments[0].scheduled_at), "d MMM yyyy HH:mm", { locale: nl })}
                      </p>
                    </div>
                  )}
                  {selected.completed_at && (
                    <div>
                      <p className="text-muted-foreground text-xs">Afgerond</p>
                      <p className="font-medium">
                        {format(new Date(selected.completed_at), "d MMM yyyy HH:mm", { locale: nl })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selected.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Omschrijving</p>
                    <p className="text-sm bg-muted/30 rounded-lg p-3">{selected.description}</p>
                  </div>
                )}

                {/* Remarks */}
                {selected.remarks && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Opmerkingen monteur</p>
                    <p className="text-sm bg-muted/30 rounded-lg p-3">{selected.remarks}</p>
                  </div>
                )}

                {/* Photos before */}
                {(selected.photos_before ?? []).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Foto's voor</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(selected.photos_before as string[]).map((url, i) => (
                        <SignedMedia key={i} path={url} bucket="work-order-photos" className="rounded-lg aspect-square object-cover w-full" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Photos after */}
                {(selected.photos_after ?? []).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Foto's na</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(selected.photos_after as string[]).map((url, i) => (
                        <SignedMedia key={i} path={url} bucket="work-order-photos" className="rounded-lg aspect-square object-cover w-full" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalWorkOrdersPage;
