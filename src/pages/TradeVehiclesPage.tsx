import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTradeVehicles, useTradeVehicleStats } from "@/hooks/useTradeVehicles";
import { TradeVehicleDialog } from "@/components/TradeVehicleDialog";
import { Plus, Search, TrendingUp, Car, Wrench, ShoppingCart, DollarSign } from "lucide-react";

const statusLabels: Record<string, string> = {
  intake: "Intake",
  in_opknapbeurt: "In opknapbeurt",
  te_koop: "Te koop",
  verkocht: "Verkocht",
  afgekeurd: "Afgekeurd",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  intake: "outline",
  in_opknapbeurt: "secondary",
  te_koop: "default",
  verkocht: "default",
  afgekeurd: "destructive",
};

const TradeVehiclesPage = () => {
  const { data: vehicles, isLoading, upsert } = useTradeVehicles();
  const stats = useTradeVehicleStats();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = (vehicles || []).filter(v => {
    const matchesSearch = !search || [v.brand, v.model, v.license_plate].some(
      f => f?.toLowerCase().includes(search.toLowerCase())
    );
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSave = (data: any) => {
    upsert.mutate(data);
  };

  const openEdit = (v: any) => {
    setEditing(v);
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inruil & Verkoop</h1>
          <p className="text-muted-foreground">Beheer inruilvoertuigen, taxaties en marges</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nieuw voertuig</Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/50 p-2"><Car className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Intake</p>
                <p className="text-2xl font-bold">{stats.intake}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 dark:bg-orange-900/50 p-2"><Wrench className="h-5 w-5 text-orange-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">In opknapbeurt</p>
                <p className="text-2xl font-bold">{stats.inRepair}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/50 p-2"><ShoppingCart className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Te koop</p>
                <p className="text-2xl font-bold">{stats.forSale}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 dark:bg-purple-900/50 p-2"><TrendingUp className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Totale marge</p>
                <p className={`text-2xl font-bold ${stats.totalMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  € {stats.totalMargin.toLocaleString("nl-NL", { minimumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Zoek op kenteken, merk, model..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Alle statussen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Geen inruilvoertuigen gevonden</TableCell></TableRow>
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
