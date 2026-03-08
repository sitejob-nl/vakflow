import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTradeVehicles, useTradeVehicleStats } from "@/hooks/useTradeVehicles";
import { useRdwLookup } from "@/hooks/useVehicles";
import { TradeVehicleDialog } from "@/components/TradeVehicleDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, TrendingUp, Car, Wrench, ShoppingCart, Camera, Loader2, RefreshCw, ImageIcon } from "lucide-react";

const PIPELINE_STEPS = [
  { key: "intake", label: "Intake", color: "bg-blue-500" },
  { key: "in_opknapbeurt", label: "Opknapbeurt", color: "bg-orange-500" },
  { key: "te_koop", label: "Te koop", color: "bg-emerald-500" },
  { key: "verkocht", label: "Verkocht", color: "bg-primary" },
] as const;

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  intake: "outline",
  in_opknapbeurt: "secondary",
  te_koop: "default",
  verkocht: "default",
  afgekeurd: "destructive",
};

const statusLabels: Record<string, string> = {
  intake: "Intake",
  in_opknapbeurt: "Opknapbeurt",
  te_koop: "Te koop",
  verkocht: "Verkocht",
  afgekeurd: "Afgekeurd",
};

const TradeVehiclesPage = () => {
  const { data: vehicles, isLoading, upsert } = useTradeVehicles();
  const stats = useTradeVehicleStats();
  const rdwLookup = useRdwLookup();
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [rdwPlate, setRdwPlate] = useState("");
  const [rdwLoading, setRdwLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const filtered = (vehicles || []).filter(v => {
    if (!search) return true;
    return [v.brand, v.model, v.license_plate].some(
      f => f?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleSave = (data: any) => {
    upsert.mutate(data);
  };

  const openEdit = (v: any) => { setEditing(v); setDialogOpen(true); };
  const openNew = () => { setEditing(null); setDialogOpen(true); };

  const handleRdwIntake = async () => {
    if (!rdwPlate.trim()) return;
    setRdwLoading(true);
    try {
      const result = await rdwLookup.mutateAsync(rdwPlate);
      if (result.found) {
        setEditing(null);
        // Pre-fill dialog with RDW data
        const prefill = {
          license_plate: rdwPlate.replace(/[\s-]/g, "").toUpperCase(),
          brand: result.brand ?? "",
          model: result.model ?? "",
          year: result.build_year ?? new Date().getFullYear(),
          fuel_type: result.fuel_type?.toLowerCase() ?? "benzine",
          color: result.color ?? "",
        };
        setEditing(prefill);
        setDialogOpen(true);
        setRdwPlate("");
      } else {
        toast({ title: "Kenteken niet gevonden bij RDW", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "RDW fout", description: err.message, variant: "destructive" });
    }
    setRdwLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !uploadTargetId || !companyId) return;
    setUploadingId(uploadTargetId);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${companyId}/${uploadTargetId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from("trade-vehicle-photos")
          .upload(path, file);
        if (error) throw error;
      }
      toast({ title: `${files.length} foto('s) geüpload` });
    } catch (err: any) {
      toast({ title: "Upload mislukt", description: err.message, variant: "destructive" });
    }
    setUploadingId(null);
    setUploadTargetId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerPhotoUpload = (vehicleId: string) => {
    setUploadTargetId(vehicleId);
    fileInputRef.current?.click();
  };

  // Pipeline counts
  const pipelineCounts = PIPELINE_STEPS.map((step) => ({
    ...step,
    count: (vehicles || []).filter((v) => v.status === step.key).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inruil & Verkoop</h1>
          <p className="text-muted-foreground">Beheer inruilvoertuigen, taxaties en marges</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nieuw voertuig</Button>
      </div>

      {/* Pipeline view */}
      <div className="grid grid-cols-4 gap-3">
        {pipelineCounts.map((step) => (
          <div key={step.key} className="relative bg-card border border-border rounded-lg p-4 text-center">
            <div className={`absolute top-0 left-0 right-0 h-1 ${step.color} rounded-t-lg`} />
            <p className="text-2xl font-bold mt-1">{step.count}</p>
            <p className="text-xs text-muted-foreground">{step.label}</p>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Totaal geïnvesteerd</p>
            <p className="text-xl font-bold">€ {stats.totalInvested.toLocaleString("nl-NL")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Omzet (verkocht)</p>
            <p className="text-xl font-bold">€ {stats.totalRevenue.toLocaleString("nl-NL")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Totale marge</p>
            <p className={`text-xl font-bold ${stats.totalMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              € {stats.totalMargin.toLocaleString("nl-NL")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* RDW intake + filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Zoek op kenteken, merk, model..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Input
            className="w-[140px] font-mono uppercase"
            placeholder="Kenteken"
            value={rdwPlate}
            onChange={(e) => setRdwPlate(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRdwIntake()}
          />
          <Button variant="outline" size="sm" onClick={handleRdwIntake} disabled={rdwLoading || !rdwPlate.trim()}>
            {rdwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1">RDW intake</span>
          </Button>
        </div>
      </div>

      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kenteken</TableHead>
                <TableHead>Voertuig</TableHead>
                <TableHead>Km-stand</TableHead>
                <TableHead>Inkoop</TableHead>
                <TableHead>Opknap</TableHead>
                <TableHead>Streefprijs</TableHead>
                <TableHead>Marge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Geen inruilvoertuigen gevonden</TableCell></TableRow>
              ) : filtered.map(v => {
                const cost = v.purchase_price + v.estimated_repair_cost;
                const sellPrice = v.status === "verkocht" ? (v.actual_sell_price || 0) : v.target_sell_price;
                const margin = sellPrice - cost;
                return (
                  <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(v)}>
                    <TableCell className="font-mono font-medium">{v.license_plate || "—"}</TableCell>
                    <TableCell>
                      <span className="font-medium">{v.brand} {v.model}</span>
                      {v.year && <span className="text-muted-foreground ml-1">({v.year})</span>}
                    </TableCell>
                    <TableCell>{v.mileage ? `${v.mileage.toLocaleString("nl-NL")} km` : "—"}</TableCell>
                    <TableCell>€ {v.purchase_price.toFixed(0)}</TableCell>
                    <TableCell>€ {v.estimated_repair_cost.toFixed(0)}</TableCell>
                    <TableCell>€ {v.target_sell_price.toFixed(0)}</TableCell>
                    <TableCell>
                      <span className={`font-semibold ${margin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        € {margin.toFixed(0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[v.status] || "outline"}>
                        {statusLabels[v.status] || v.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Foto's uploaden"
                        disabled={uploadingId === v.id}
                        onClick={() => triggerPhotoUpload(v.id)}
                      >
                        {uploadingId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TradeVehicleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicle={editing}
        onSave={handleSave}
      />
    </div>
  );
};

export default TradeVehiclesPage;
