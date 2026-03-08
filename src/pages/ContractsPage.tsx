import { useState } from "react";
import { useContracts, type Contract } from "@/hooks/useContracts";
import ContractDialog from "@/components/ContractDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Play, Pause, XCircle, Pencil, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  actief: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  gepauzeerd: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  beeindigd: "bg-muted text-muted-foreground",
};

const ContractsPage = () => {
  const { contracts, isLoading, upsert, remove, generate } = useContracts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [tab, setTab] = useState("alle");

  const filtered = tab === "alle" ? contracts : contracts.filter((c) => c.status === tab);

  const dueCount = contracts.filter((c) => c.status === "actief" && c.next_due_date <= new Date().toISOString().split("T")[0]).length;

  const handleEdit = (c: Contract) => { setEditing(c); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setDialogOpen(true); };
  const handleStatusChange = (c: Contract, status: string) => upsert.mutate({ id: c.id, status });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contracten</h1>
          <p className="text-sm text-muted-foreground">Beheer terugkerende servicecontracten</p>
        </div>
        <div className="flex gap-2">
          {dueCount > 0 && (
            <Button variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
              <RefreshCw className={`w-4 h-4 mr-2 ${generate.isPending ? "animate-spin" : ""}`} />
              Genereer werkbonnen ({dueCount})
            </Button>
          )}
          <Button onClick={handleNew}><Plus className="w-4 h-4 mr-2" />Nieuw contract</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="alle">Alle ({contracts.length})</TabsTrigger>
          <TabsTrigger value="actief">Actief ({contracts.filter((c) => c.status === "actief").length})</TabsTrigger>
          <TabsTrigger value="gepauzeerd">Gepauzeerd ({contracts.filter((c) => c.status === "gepauzeerd").length})</TabsTrigger>
          <TabsTrigger value="beeindigd">Beëindigd ({contracts.filter((c) => c.status === "beeindigd").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">Geen contracten gevonden</p>
          <p className="text-sm">Maak een nieuw contract aan om te beginnen.</p>
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <div className="rounded-md border hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klant</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Prijs</TableHead>
                <TableHead>Volgende</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => handleEdit(c)}>
                  <TableCell className="font-medium">{c.customers?.name ?? "—"}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.interval_months} mnd</TableCell>
                  <TableCell>€{c.price.toFixed(2)}</TableCell>
                  <TableCell>{format(new Date(c.next_due_date), "d MMM yyyy", { locale: nl })}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[c.status] ?? ""}>{c.status}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(c)}>
                          <Pencil className="w-4 h-4 mr-2" />Bewerken
                        </DropdownMenuItem>
                        {c.status === "actief" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(c, "gepauzeerd")}>
                            <Pause className="w-4 h-4 mr-2" />Pauzeren
                          </DropdownMenuItem>
                        )}
                        {c.status === "gepauzeerd" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(c, "actief")}>
                            <Play className="w-4 h-4 mr-2" />Hervatten
                          </DropdownMenuItem>
                        )}
                        {c.status !== "beeindigd" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(c, "beeindigd")}>
                            <XCircle className="w-4 h-4 mr-2" />Beëindigen
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(c.id)}>
                          <Trash2 className="w-4 h-4 mr-2" />Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-2">
          {filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => handleEdit(c)}
              className="bg-card border border-border rounded-lg p-3.5 flex items-center gap-3 active:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold truncate">{c.customers?.name ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.name} · {c.interval_months} mnd · €{c.price.toFixed(2)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Volgende: {format(new Date(c.next_due_date), "d MMM yyyy", { locale: nl })}</div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <Badge variant="secondary" className={`text-[10px] ${statusColors[c.status] ?? ""}`}>{c.status}</Badge>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(c)}>
                        <Pencil className="w-4 h-4 mr-2" />Bewerken
                      </DropdownMenuItem>
                      {c.status === "actief" && (
                        <DropdownMenuItem onClick={() => handleStatusChange(c, "gepauzeerd")}>
                          <Pause className="w-4 h-4 mr-2" />Pauzeren
                        </DropdownMenuItem>
                      )}
                      {c.status === "gepauzeerd" && (
                        <DropdownMenuItem onClick={() => handleStatusChange(c, "actief")}>
                          <Play className="w-4 h-4 mr-2" />Hervatten
                        </DropdownMenuItem>
                      )}
                      {c.status !== "beeindigd" && (
                        <DropdownMenuItem onClick={() => handleStatusChange(c, "beeindigd")}>
                          <XCircle className="w-4 h-4 mr-2" />Beëindigen
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(c.id)}>
                        <Trash2 className="w-4 h-4 mr-2" />Verwijderen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ContractDialog open={dialogOpen} onOpenChange={setDialogOpen} contract={editing} />
    </div>
  );
};

export default ContractsPage;
