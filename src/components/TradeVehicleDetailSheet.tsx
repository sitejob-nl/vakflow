import { useState, useEffect, useRef } from "react";
import { type TradeVehicle, useHexonListings, useTradeVehiclePhotos, PIPELINE_STATUSES, STATUS_LABELS, DAMAGE_AREAS, type DamageItem } from "@/hooks/useTradeVehicles";
import { useCustomers } from "@/hooks/useCustomers";
import { useCommunicationLogs } from "@/hooks/useCommunicationLogs";
import { useRdwLookup } from "@/hooks/useVehicles";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2, RefreshCw, ExternalLink, Upload, X, Trash2, Camera, Globe, GlobeLock, Sparkles, AlertTriangle,
} from "lucide-react";

interface Props {
  vehicle: TradeVehicle | null;
  onClose: () => void;
  onSave: (data: any) => void;
}

const fmtCurrency = (n: number | null) => n != null ? `€${n.toLocaleString("nl-NL", { minimumFractionDigits: 0 })}` : "—";

const TradeVehicleDetailSheet = ({ vehicle, onClose, onSave }: Props) => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: hexonListings = [] } = useHexonListings(vehicle?.id);
  const { data: photos = [] } = useTradeVehiclePhotos(vehicle?.id);
  const { data: customers } = useCustomers();
  const rdwLookup = useRdwLookup();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState("algemeen");
  const [rdwLoading, setRdwLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generatingText, setGeneratingText] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Editable fields
  const [descriptionNl, setDescriptionNl] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [highlightInput, setHighlightInput] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    if (vehicle) {
      setDescriptionNl(vehicle.description_nl || "");
      setHighlights(vehicle.description_highlights || []);
      setVideoUrl(vehicle.video_url || "");
      setTab("algemeen");
    }
  }, [vehicle?.id]);

  if (!vehicle) return null;

  const margin = vehicle.target_sell_price - vehicle.purchase_price - vehicle.estimated_repair_cost;
  const actualMargin = vehicle.actual_sell_price
    ? vehicle.actual_sell_price - vehicle.purchase_price - vehicle.estimated_repair_cost
    : null;

  const rdwData = vehicle.rdw_data as Record<string, any> | null;

  const handleRdwLookup = async () => {
    if (!vehicle.license_plate) return;
    setRdwLoading(true);
    try {
      const result = await rdwLookup.mutateAsync(vehicle.license_plate);
      if (result.found) {
        onSave({
          id: vehicle.id,
          rdw_data: result,
          brand: result.brand || vehicle.brand,
          model: result.model || vehicle.model,
          year: result.build_year || vehicle.year,
          fuel_type: result.fuel_type?.toLowerCase() || vehicle.fuel_type,
          color: result.color || vehicle.color,
        });
        toast({ title: "RDW data opgehaald" });
      } else {
        toast({ title: "Kenteken niet gevonden", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "RDW fout", description: err.message, variant: "destructive" });
    }
    setRdwLoading(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await supabase.functions.invoke("hexon-sync" as any, {
        body: { action: "publish", trade_vehicle_id: vehicle.id },
      });
      queryClient.invalidateQueries({ queryKey: ["hexon_listings"] });
      toast({ title: "Publicatie gestart" });
    } catch (err: any) {
      toast({ title: "Publicatie mislukt", description: err.message, variant: "destructive" });
    }
    setPublishing(false);
  };

  const handleUnpublish = async () => {
    setPublishing(true);
    try {
      await supabase.functions.invoke("hexon-sync" as any, {
        body: { action: "unpublish", trade_vehicle_id: vehicle.id },
      });
      queryClient.invalidateQueries({ queryKey: ["hexon_listings"] });
      toast({ title: "Offline gehaald" });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
    setPublishing(false);
  };

  const handleGenerateText = async () => {
    setGeneratingText(true);
    try {
      const { data } = await supabase.functions.invoke("hexon-sync" as any, {
        body: { action: "createdescription", trade_vehicle_id: vehicle.id },
      });
      if (data?.description) {
        setDescriptionNl(data.description);
        onSave({ id: vehicle.id, description_nl: data.description });
        toast({ title: "Tekst gegenereerd" });
      }
    } catch (err: any) {
      toast({ title: "Genereren mislukt", description: err.message, variant: "destructive" });
    }
    setGeneratingText(false);
  };

  const saveHexonFields = () => {
    onSave({
      id: vehicle.id,
      description_nl: descriptionNl,
      description_highlights: highlights,
      video_url: videoUrl,
    });
  };

  const addHighlight = () => {
    if (highlightInput.trim()) {
      setHighlights(prev => [...prev, highlightInput.trim()]);
      setHighlightInput("");
    }
  };

  const removeHighlight = (idx: number) => {
    setHighlights(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !companyId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${companyId}/${vehicle.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from("trade-vehicle-photos")
          .upload(path, file);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["trade-vehicle-photos"] });
      onSave({ id: vehicle.id, photo_count: (vehicle.photo_count || 0) + files.length });
      toast({ title: `${files.length} foto('s) geüpload` });
    } catch (err: any) {
      toast({ title: "Upload mislukt", description: err.message, variant: "destructive" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const hexonStatusBadge = (status: string | null) => {
    switch (status) {
      case "online":
      case "published":
        return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30" variant="outline">Online</Badge>;
      case "pending":
      case "processing":
        return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30" variant="outline">Pending</Badge>;
      case "error":
        return <Badge className="bg-destructive/15 text-destructive border-destructive/30" variant="outline">Fout</Badge>;
      default:
        return <Badge variant="outline">{status || "Onbekend"}</Badge>;
    }
  };

  return (
    <Sheet open={!!vehicle} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>{vehicle.brand} {vehicle.model}</span>
            {vehicle.license_plate && (
              <Badge variant="outline" className="font-mono">{vehicle.license_plate}</Badge>
            )}
            <Badge variant="outline" className="ml-auto">
              {STATUS_LABELS[vehicle.status] || vehicle.status}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-5 text-xs">
            <TabsTrigger value="algemeen">Algemeen</TabsTrigger>
            <TabsTrigger value="financieel">Financieel</TabsTrigger>
            <TabsTrigger value="hexon">Hexon</TabsTrigger>
            <TabsTrigger value="fotos">Foto's</TabsTrigger>
            <TabsTrigger value="historie">Historie</TabsTrigger>
          </TabsList>

          {/* ====== ALGEMEEN ====== */}
          <TabsContent value="algemeen" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Merk</p><p className="font-medium">{vehicle.brand || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Model</p><p className="font-medium">{vehicle.model || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Bouwjaar</p><p className="font-medium">{vehicle.year || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Km-stand</p><p className="font-medium">{vehicle.mileage ? `${vehicle.mileage.toLocaleString("nl-NL")} km` : "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Brandstof</p><p className="font-medium capitalize">{vehicle.fuel_type || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Transmissie</p><p className="font-medium capitalize">{vehicle.transmission || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Kleur</p><p className="font-medium">{vehicle.color || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">VIN</p><p className="font-medium font-mono text-xs">{vehicle.vin || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Bron</p><p className="font-medium">{vehicle.source || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Hexon stocknr.</p><p className="font-medium font-mono">{vehicle.hexon_stocknumber || "—"}</p></div>
            </div>

            {/* RDW data */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">RDW Data</p>
                <Button size="sm" variant="outline" onClick={handleRdwLookup} disabled={rdwLoading || !vehicle.license_plate}>
                  {rdwLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                  Ophalen
                </Button>
              </div>
              {rdwData ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(rdwData).filter(([k]) => !["found"].includes(k)).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-muted-foreground">{k}: </span>
                      <span className="font-medium">{String(v ?? "—")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Geen RDW data beschikbaar. Klik op &apos;Ophalen&apos; om data op te halen.</p>
              )}
            </div>

            {/* Notes */}
            {vehicle.general_notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Opmerkingen</p>
                <p className="text-sm bg-muted/50 rounded-md p-3">{vehicle.general_notes}</p>
              </div>
            )}

            {/* Damage checklist summary */}
            {vehicle.damage_checklist?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Schade-checklist</p>
                <div className="space-y-1">
                  {(vehicle.damage_checklist as DamageItem[]).filter(d => d.severity !== "geen").map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className={
                        d.severity === "licht" ? "bg-amber-500/15 text-amber-700 border-amber-500/30" :
                        d.severity === "matig" ? "bg-orange-500/15 text-orange-700 border-orange-500/30" :
                        "bg-destructive/15 text-destructive border-destructive/30"
                      }>{d.severity}</Badge>
                      <span className="font-medium">{d.area}</span>
                      {d.description && <span className="text-muted-foreground">— {d.description}</span>}
                    </div>
                  ))}
                  {(vehicle.damage_checklist as DamageItem[]).every(d => d.severity === "geen") && (
                    <p className="text-xs text-muted-foreground">Geen schade geregistreerd</p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ====== FINANCIEEL ====== */}
          <TabsContent value="financieel" className="space-y-4 mt-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="font-semibold text-sm">Margeberekening</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inkoopprijs</span>
                  <span className="font-medium">{fmtCurrency(vehicle.purchase_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geschatte reparatiekosten</span>
                  <span className="font-medium">{fmtCurrency(vehicle.estimated_repair_cost)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground font-medium">Totale investering</span>
                  <span className="font-bold">{fmtCurrency(vehicle.purchase_price + vehicle.estimated_repair_cost)}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Verkoopprijs (streef)</span>
                  <span className="font-medium">{fmtCurrency(vehicle.target_sell_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Verwachte marge</span>
                  <span className={`font-bold ${margin >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmtCurrency(margin)}</span>
                </div>
                {vehicle.actual_sell_price != null && (
                  <>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Werkelijke verkoopprijs</span>
                      <span className="font-medium">{fmtCurrency(vehicle.actual_sell_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Werkelijke marge</span>
                      <span className={`font-bold ${(actualMargin ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {fmtCurrency(actualMargin)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Handelsprijs</p>
                <p className="font-medium">{fmtCurrency(vehicle.price_trade)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Exportprijs</p>
                <p className="font-medium">{fmtCurrency(vehicle.price_export)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">BPM</p>
                <p className="font-medium">{fmtCurrency(vehicle.bpm_amount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Garantie</p>
                <p className="font-medium">{vehicle.warranty_months ? `${vehicle.warranty_months} maanden` : "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Ingekocht van</p>
                <p className="font-medium">{vehicle.purchased_from_customer?.name || vehicle.supplier_name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Verkocht aan</p>
                <p className="font-medium">{vehicle.sold_to_customer?.name || "—"}</p>
              </div>
            </div>
          </TabsContent>

          {/* ====== HEXON ====== */}
          <TabsContent value="hexon" className="space-y-4 mt-4">
            {/* Listings table */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Advertenties per portaal</p>
              {hexonListings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Geen Hexon advertenties</p>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs">
                        <th className="text-left p-2">Portaal</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Link</th>
                        <th className="text-left p-2">Fouten</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hexonListings.map(l => (
                        <tr key={l.id} className="border-t">
                          <td className="p-2 font-medium">{l.site_code}</td>
                          <td className="p-2">{hexonStatusBadge(l.status)}</td>
                          <td className="p-2">
                            {l.deeplink_url ? (
                              <a href={l.deeplink_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs">
                                <ExternalLink className="h-3 w-3" /> Bekijk
                              </a>
                            ) : "—"}
                          </td>
                          <td className="p-2 text-xs">
                            {l.errors ? (
                              <span className="text-destructive flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {typeof l.errors === "string" ? l.errors : JSON.stringify(l.errors).slice(0, 60)}
                              </span>
                            ) : l.warnings ? (
                              <span className="text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {typeof l.warnings === "string" ? l.warnings : JSON.stringify(l.warnings).slice(0, 60)}
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Advertentietekst</Label>
                <Button size="sm" variant="ghost" onClick={handleGenerateText} disabled={generatingText} className="text-xs h-7">
                  {generatingText ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  Genereer tekst
                </Button>
              </div>
              <Textarea value={descriptionNl} onChange={(e) => setDescriptionNl(e.target.value)} rows={5} />
            </div>

            {/* Highlights */}
            <div>
              <Label className="text-xs">Highlights</Label>
              <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                {highlights.map((h, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 text-xs">
                    {h}
                    <button onClick={() => removeHighlight(i)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={highlightInput}
                  onChange={(e) => setHighlightInput(e.target.value)}
                  placeholder="Voeg highlight toe..."
                  className="text-sm"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHighlight())}
                />
                <Button size="sm" variant="outline" onClick={addHighlight}>+</Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handlePublish} disabled={publishing}>
                {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
                Publiceer
              </Button>
              <Button size="sm" variant="outline" onClick={handleUnpublish} disabled={publishing}>
                <GlobeLock className="h-4 w-4 mr-1" />
                Haal offline
              </Button>
              <Button size="sm" variant="outline" onClick={saveHexonFields}>
                Opslaan
              </Button>
            </div>
          </TabsContent>

          {/* ====== FOTO'S ====== */}
          <TabsContent value="fotos" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Foto's ({vehicle.photo_count || photos.length})
              </p>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Upload
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />

            {photos.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
                <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nog geen foto's geüpload</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()}>
                  Foto's uploaden
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <div key={p.path} className="aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center text-xs text-muted-foreground">
                    {p.name}
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label className="text-xs">Video URL</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className="mt-1"
              />
              <Button size="sm" variant="outline" className="mt-2" onClick={() => onSave({ id: vehicle.id, video_url: videoUrl })}>
                Opslaan
              </Button>
            </div>
          </TabsContent>

          {/* ====== HISTORIE ====== */}
          <TabsContent value="historie" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <div>
                  <p className="font-medium">Aangemaakt</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(vehicle.created_at), "dd MMM yyyy HH:mm", { locale: nl })}
                  </p>
                </div>
              </div>
              {vehicle.sold_at && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <div>
                    <p className="font-medium">Verkocht</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(vehicle.sold_at), "dd MMM yyyy HH:mm", { locale: nl })}
                    </p>
                  </div>
                </div>
              )}
              {vehicle.delivery_date && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="font-medium">Afleverdatum</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(vehicle.delivery_date), "dd MMM yyyy", { locale: nl })}
                    </p>
                  </div>
                </div>
              )}
              {vehicle.transport_date && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <div>
                    <p className="font-medium">Transportdatum</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(vehicle.transport_date), "dd MMM yyyy", { locale: nl })}
                    </p>
                  </div>
                </div>
              )}

              {/* Linked work order */}
              {vehicle.work_order && (
                <div className="border rounded-md p-3 text-sm space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Gekoppelde werkbon</p>
                  <p className="font-medium">{vehicle.work_order.work_order_number}</p>
                  <p className="text-xs text-muted-foreground">Status: {vehicle.work_order.status}</p>
                  {vehicle.work_order.description && (
                    <p className="text-xs">{vehicle.work_order.description}</p>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground pt-2">
                Laatste update: {format(new Date(vehicle.updated_at), "dd MMM yyyy HH:mm", { locale: nl })}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default TradeVehicleDetailSheet;
