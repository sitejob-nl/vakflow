import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Headset, Check, X, Loader2, Image, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getSignedUrl } from "@/utils/storageUtils";

const ServiceRequestsWidget = () => {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["service-requests-pending", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*, customers(name, phone, email)")
        .eq("company_id", companyId!)
        .eq("status", "aangevraagd")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from("service_requests")
        .update({ status, admin_notes: notes || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "in_behandeling" ? "Aanvraag geaccepteerd" : "Aanvraag afgewezen");
      queryClient.invalidateQueries({ queryKey: ["service-requests-pending"] });
      setSelected(null);
      setAdminNotes("");
      setMediaUrls([]);
    },
    onError: () => toast.error("Kon status niet wijzigen"),
  });

  const openDetail = async (req: any) => {
    setSelected(req);
    setAdminNotes("");
    // Load signed URLs for media
    const media = (req.media ?? []) as string[];
    if (media.length > 0) {
      const urls = await Promise.all(
        media.map((path: string) => getSignedUrl("portal-uploads", path))
      );
      setMediaUrls(urls.filter(Boolean) as string[]);
    } else {
      setMediaUrls([]);
    }
  };

  if (!requests?.length && !isLoading) return null;

  return (
    <>
      <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
        <div className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-border">
          <h3 className="text-[14px] md:text-[15px] font-bold flex items-center gap-2">
            <Headset className="h-4 w-4 text-primary" />
            Service-aanvragen
          </h3>
          <span className="inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold bg-primary-muted text-primary">
            {requests?.length ?? 0}
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests?.map((req: any) => {
              const mediaCount = (req.media as string[])?.length ?? 0;
              return (
                <div
                  key={req.id}
                  className="px-4 md:px-5 py-3 cursor-pointer hover:bg-bg-hover transition-colors"
                  onClick={() => openDetail(req)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold truncate">
                        {(req.customers as any)?.name ?? "Onbekende klant"}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {req.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-t3 font-mono">
                          {format(new Date(req.created_at), "d MMM HH:mm", { locale: nl })}
                        </span>
                        {mediaCount > 0 && (
                          <span className="text-[10px] text-t3 flex items-center gap-0.5">
                            <Image className="h-3 w-3" /> {mediaCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: req.id, status: "in_behandeling" }); }}
                        disabled={updateStatus.isPending}
                        className="p-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors"
                        title="Accepteren"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: req.id, status: "afgewezen" }); }}
                        disabled={updateStatus.isPending}
                        className="p-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                        title="Afwijzen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Service-aanvraag</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Klant</p>
                    <p className="font-medium">{(selected.customers as any)?.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Datum</p>
                    <p className="font-medium">{format(new Date(selected.created_at), "d MMMM yyyy HH:mm", { locale: nl })}</p>
                  </div>
                  {(selected.customers as any)?.phone && (
                    <div>
                      <p className="text-muted-foreground text-xs">Telefoon</p>
                      <p className="font-medium">{(selected.customers as any).phone}</p>
                    </div>
                  )}
                  {(selected.customers as any)?.email && (
                    <div>
                      <p className="text-muted-foreground text-xs">E-mail</p>
                      <p className="font-medium">{(selected.customers as any).email}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Omschrijving</p>
                  <p className="text-sm bg-muted/30 rounded-lg p-3">{selected.description}</p>
                </div>

                {mediaUrls.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Bijlagen</p>
                    <div className="grid grid-cols-3 gap-2">
                      {mediaUrls.map((url, i) => {
                        const path = ((selected.media as string[])?.[i] ?? "").toLowerCase();
                        const isVideo = path.endsWith(".mp4") || path.endsWith(".mov") || path.endsWith(".webm");
                        return isVideo ? (
                          <video key={i} src={url} controls className="rounded-lg aspect-square object-cover w-full" />
                        ) : (
                          <img key={i} src={url} alt="" className="rounded-lg aspect-square object-cover w-full" />
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Reactie / notities</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Optioneel: laat een bericht achter voor de klant..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => updateStatus.mutate({ id: selected.id, status: "in_behandeling", notes: adminNotes })}
                    disabled={updateStatus.isPending}
                    className="flex-1 bg-accent hover:bg-accent-hover text-accent-foreground gap-1"
                  >
                    <Check className="h-4 w-4" />
                    Accepteren
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateStatus.mutate({ id: selected.id, status: "afgewezen", notes: adminNotes })}
                    disabled={updateStatus.isPending}
                    className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5 gap-1"
                  >
                    <X className="h-4 w-4" />
                    Afwijzen
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ServiceRequestsWidget;
