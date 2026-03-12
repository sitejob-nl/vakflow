import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Headset, Plus, Send, Image, X, Loader2, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";

const BUCKET = "portal-uploads";

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  aangevraagd: { label: "Aangevraagd", className: "bg-amber-500/10 text-amber-600", icon: Clock },
  in_behandeling: { label: "In behandeling", className: "bg-primary/10 text-primary", icon: Loader2 },
  afgerond: { label: "Afgerond", className: "bg-accent/10 text-accent", icon: CheckCircle2 },
  afgewezen: { label: "Afgewezen", className: "bg-destructive/10 text-destructive", icon: AlertCircle },
};

const PortalServiceRequestsPage = () => {
  const { customerId, companyId } = usePortalAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["portal-service-requests", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addFile = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    const valid = arr.filter((f) => {
      const isMedia = f.type.startsWith("image/") || f.type.startsWith("video/");
      const isSmall = f.size <= 20 * 1024 * 1024; // 20MB
      return isMedia && isSmall;
    });
    if (valid.length < arr.length) {
      toast.error("Alleen foto's/video's tot 20MB toegestaan");
    }
    setFiles((prev) => [...prev, ...valid]);
    // Generate previews
    valid.forEach((f) => {
      if (f.type.startsWith("image/")) {
        const url = URL.createObjectURL(f);
        setPreviews((prev) => [...prev, url]);
      } else {
        setPreviews((prev) => [...prev, "video"]);
      }
    });
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => {
      const url = prev[idx];
      if (url && url !== "video") URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!customerId || !companyId) throw new Error("Niet ingelogd");
      setUploading(true);

      // Upload files
      const mediaPaths: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${companyId}/${customerId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw error;
        mediaPaths.push(path);
      }

      // Insert request
      const { error } = await supabase.from("service_requests").insert({
        customer_id: customerId,
        company_id: companyId,
        description,
        media: mediaPaths,
        status: "aangevraagd",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Service-aanvraag verstuurd!");
      queryClient.invalidateQueries({ queryKey: ["portal-service-requests"] });
      resetForm();
    },
    onError: () => toast.error("Kon aanvraag niet versturen"),
    onSettled: () => setUploading(false),
  });

  const resetForm = () => {
    setDialogOpen(false);
    setDescription("");
    previews.forEach((p) => { if (p !== "video") URL.revokeObjectURL(p); });
    setFiles([]);
    setPreviews([]);
  };

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Service aanvragen</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Meld een probleem of vraag onderhoud aan</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nieuwe aanvraag</span>
          <span className="sm:hidden">Nieuw</span>
        </Button>
      </div>

      {!requests?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Headset className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">Geen service-aanvragen</p>
            <p className="text-sm">Heeft u een probleem? Dien een aanvraag in.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {requests.map((req: any) => {
            const cfg = statusConfig[req.status] || statusConfig.aangevraagd;
            const StatusIcon = cfg.icon;
            const mediaCount = (req.media as string[])?.length ?? 0;
            return (
              <Card key={req.id}>
                <CardContent className="p-3.5 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium line-clamp-2">{req.description}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(req.created_at), "d MMM yyyy · HH:mm", { locale: nl })}
                        </span>
                        {mediaCount > 0 && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <Image className="h-3 w-3" />
                            {mediaCount}
                          </span>
                        )}
                      </div>
                      {req.admin_notes && (
                        <div className="bg-muted/30 rounded-md p-2 mt-2 text-xs text-muted-foreground">
                          <span className="font-semibold">Reactie:</span> {req.admin_notes}
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary" className={`text-[10px] shrink-0 flex items-center gap-1 ${cfg.className}`}>
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

      {/* New request dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && !uploading && resetForm()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Service-aanvraag indienen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Beschrijf het probleem en voeg eventueel foto's of video's toe.
            </p>

            <div className="space-y-2">
              <Label>Omschrijving *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Wat is het probleem? Bijv. lekkage, kapot onderdeel, onderhoud nodig..."
                rows={4}
              />
            </div>

            {/* Media upload */}
            <div className="space-y-2">
              <Label>Foto's / Video's</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => addFile(e.target.files)}
              />

              {files.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {files.map((file, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                      {file.type.startsWith("image/") ? (
                        <img
                          src={previews[idx]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                          <span className="text-2xl">🎥</span>
                          <span className="text-[10px] mt-1 truncate max-w-full px-1">{file.name}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2"
              >
                <Image className="h-4 w-4" />
                Foto of video toevoegen
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={!description.trim() || uploading}
              onClick={() => submitMutation.mutate()}
              className="w-full gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploaden...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Aanvraag versturen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalServiceRequestsPage;
