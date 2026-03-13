import { useAuth } from "@/contexts/AuthContext";
import { useNavigation } from "@/hooks/useNavigation";
import { useState, useRef, useMemo } from "react";
import { useCustomers, useDeleteCustomer, usePaginatedCustomers } from "@/hooks/useCustomers";
import { Loader2, Search, RefreshCw, MapPin, Upload, ChevronLeft, ChevronRight, Filter, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import ClickToDialButton from "@/components/shared/ClickToDialButton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CustomerDialog from "@/components/CustomerDialog";
import { useToast } from "@/hooks/use-toast";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

const tabs = ["Alle klanten", "Particulier", "Zakelijk", "VvE"];
const PAGE_SIZE = 25;

type SortKey = "name" | "city" | "interval_months";
type SortDir = "asc" | "desc";

const badgeStyles: Record<string, string> = {
  primary: "bg-primary-muted text-primary",
  accent: "bg-accent-muted text-accent",
  purple: "bg-purple-muted text-purple",
};

const typeMap: Record<string, string> = {
  particulier: "Particulier",
  zakelijk: "Zakelijk",
  vve: "VvE",
};

const CustomersPage = () => {
  const { companyId } = useAuth();
  const { navigate } = useNavigation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [page, setPage] = useState(0);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 300);
  };

  const typeFilter = activeTab === 0 ? null : ["particulier", "zakelijk", "vve"][activeTab - 1];

  // Server-side paginated query
  const { data: paginatedResult, isLoading } = usePaginatedCustomers({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    typeFilter,
    cityFilter: cityFilter !== "all" ? cityFilter : null,
    sortKey,
    sortDir,
  });

  const customers = paginatedResult?.data ?? [];
  const totalCount = paginatedResult?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Use unpaginated query just for filter dropdowns (lightweight)
  const { data: allCustomers } = useCustomers();

  const cities = useMemo(() => {
    const set = new Set<string>();
    (allCustomers ?? []).forEach((c) => { if (c.city) set.add(c.city); });
    return Array.from(set).sort();
  }, [allCustomers]);

  const formatPhone = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    let p = raw.toString().replace(/[\s\-()]/g, "");
    if (p.startsWith("06")) p = "+31" + p.slice(1);
    if (p.startsWith("316")) p = "+316" + p.slice(3);
    if (p.startsWith("0031")) p = "+" + p.slice(2);
    return p || null;
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    setImportProgress(0);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws);

      const mapped = rows
        .filter((r) => r["Volledige naam"]?.toString().trim())
        .map((r) => {
          const addr = [r["Adres"], r["Toevoeging"]].filter(Boolean).join(" ").trim() || null;
          return {
            name: r["Volledige naam"].toString().trim(),
            phone: formatPhone(r["Nummer mobiel"]),
            email: r["E-mail"]?.toString().trim().toLowerCase() || null,
            address: addr,
            postal_code: r["Postcode"]?.toString().trim().toUpperCase() || null,
            city: r["Plaats"]?.toString().trim() || null,
            notes: r["Opmerking"]?.toString().trim() || null,
            type: "particulier" as const,
            company_id: companyId,
          };
        });

      if (mapped.length === 0) {
        toast({ title: "Leeg bestand", description: "Geen klanten gevonden in het bestand.", variant: "destructive" });
        setImporting(false);
        return;
      }

      const existingAll = allCustomers ?? [];
      const existingKeys = new Set(existingAll.map((c) => `${c.name.toLowerCase()}|${(c.postal_code ?? "").toLowerCase()}`));
      const toInsert = mapped.filter((m) => !existingKeys.has(`${m.name.toLowerCase()}|${(m.postal_code ?? "").toLowerCase()}`));
      const skipped = mapped.length - toInsert.length;

      const batchSize = 50;
      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const { error } = await supabase.from("customers").insert(batch);
        if (error) throw error;
        inserted += batch.length;
        setImportProgress(Math.round((inserted / toInsert.length) * 100));
      }

      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-paginated"] });
      toast({
        title: "Import voltooid",
        description: `${inserted} klanten geïmporteerd${skipped > 0 ? `, ${skipped} duplicaten overgeslagen` : ""}.`,
      });
    } catch (err: any) {
      toast({ title: "Import mislukt", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const handleGeocodeCustomers = async () => {
    setGeocoding(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode-customers");
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-paginated"] });
      toast({
        title: "Coördinaten bijgewerkt",
        description: `${data.geocoded} van ${data.total} klanten geocodeerd.`,
      });
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  };

  const { containerRef, pullDistance, refreshing, isTriggered } = usePullToRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      return queryClient.invalidateQueries({ queryKey: ["customers-paginated"] });
    },
  });

  const resetPage = () => setPage(0);

  const hasActiveFilters = cityFilter !== "all";

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    resetPage();
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="inline ml-1 h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="inline ml-1 h-3 w-3" /> : <ArrowDown className="inline ml-1 h-3 w-3" />;
  };

  const getInitials = (name: string) =>
    name.split(/[\s.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const getAvatarColor = (type: string) => {
    if (type === "zakelijk") return "bg-accent-muted text-accent";
    if (type === "vve") return "bg-purple-muted text-purple";
    return "bg-primary-muted text-primary";
  };

  return (
    <div ref={containerRef}>
      {/* Pull-to-refresh indicator */}
      <div
        className="flex justify-center items-center overflow-hidden transition-all duration-200 lg:hidden"
        style={{ height: pullDistance > 0 ? `${pullDistance}px` : 0 }}
      >
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <RefreshCw className={`h-5 w-5 transition-transform ${isTriggered ? "rotate-180" : ""} ${refreshing ? "animate-spin" : ""}`} />
          {isTriggered && !refreshing && <span className="text-[11px]">Loslaten om te verversen</span>}
          {refreshing && <span className="text-[11px]">Verversen...</span>}
        </div>
      </div>
      {/* Scrollable tabs */}
      <div className="flex gap-0 border-b-2 border-border mb-4 md:mb-5 overflow-x-auto scrollbar-hide">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => { setActiveTab(i); resetPage(); }}
            className={`px-3.5 md:px-5 py-2.5 text-[12px] md:text-[13px] font-bold border-b-2 -mb-[2px] transition-colors whitespace-nowrap ${
              i === activeTab ? "text-primary border-primary" : "text-t3 border-transparent hover:text-secondary-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
        {/* Header with search & button */}
        <div className="px-4 md:px-5 py-3 md:py-4 flex flex-col gap-2 border-b border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h3 className="text-[14px] md:text-[15px] font-bold">{totalCount} klanten</h3>
            <div className="flex gap-2 items-center w-full sm:w-auto flex-wrap">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Zoek klant..."
                  className="pl-8 h-8 w-full sm:w-48 text-[12px]"
                />
              </div>
              <button
                onClick={() => navigate("custCreate")}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-[12px] font-bold hover:bg-primary-hover transition-colors whitespace-nowrap flex-shrink-0"
              >
                + Nieuw
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGeocodeCustomers}
                disabled={geocoding}
                className="text-[12px] h-8 whitespace-nowrap flex-shrink-0"
              >
                {geocoding ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <MapPin className="mr-1.5 h-3.5 w-3.5" />}
                Coördinaten
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="text-[12px] h-8 whitespace-nowrap flex-shrink-0"
              >
                {importing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                Importeren
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportExcel}
              />
            </div>
          </div>

          {/* Filter row */}
          <div className="flex gap-2 items-center flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <Select value={cityFilter} onValueChange={(v) => { setCityFilter(v); resetPage(); }}>
              <SelectTrigger className="h-8 w-[160px] text-[12px]">
                <SelectValue placeholder="Alle plaatsen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle plaatsen</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCityFilter("all"); resetPage(); }}
                className="h-8 text-[12px] text-muted-foreground"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Wis filters
              </Button>
            )}
          </div>
        </div>

        {importing && (
          <div className="px-4 md:px-5 py-2 border-b border-border">
            <Progress value={importProgress} className="h-2" />
            <p className="text-[11px] text-muted-foreground mt-1">{importProgress}% geïmporteerd...</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {debouncedSearch || hasActiveFilters ? "Geen klanten gevonden" : "Nog geen klanten. Voeg je eerste klant toe!"}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="bg-background">
                  <th className="text-left px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("name")}>
                    Klant<SortIcon col="name" />
                  </th>
                  <th className="text-left px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("city")}>
                    Locatie<SortIcon col="city" />
                  </th>
                  <th className="text-left px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border">Dienst</th>
                  <th className="text-left px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border">Telefoon</th>
                  <th className="text-left px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("interval_months")}>
                    Interval<SortIcon col="interval_months" />
                  </th>
                  <th className="text-left px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-t3 border-b border-border">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => navigate("custDetail", { customerId: c.id })}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] ${getAvatarColor(c.type)}`}>
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <div className="text-[13.5px] font-bold">{c.name}</div>
                          <div className="text-[11.5px] text-t3">{typeMap[c.type] ?? c.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[13.5px]">{c.city || "—"}</td>
                    <td className="px-5 py-3">
                      {c.services ? (
                        <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[11px] font-bold ${badgeStyles[c.services.color ?? "primary"]}`}>
                          {c.services.name}
                        </span>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); navigate("custDetail", { customerId: c.id }); }} className="text-[11px] text-primary hover:underline font-bold">Stel in</button>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[12px] font-mono">{c.interval_months} mnd</td>
                    <td className="px-5 py-3">
                      {c.whatsapp_optin ? (
                        <span className="text-accent text-[12px] font-bold">✓ Ja</span>
                      ) : (
                        <span className="text-t3 text-[12px]">Nee</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-border">
              {customers.map((c) => (
                <div
                  key={c.id}
                  className="px-4 py-3 flex items-center gap-3 active:bg-bg-hover transition-colors cursor-pointer"
                  onClick={() => navigate("custDetail", { customerId: c.id })}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${getAvatarColor(c.type)}`}>
                    {getInitials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold truncate">{c.name}</div>
                    <div className="text-[11px] text-t3 truncate">
                      {typeMap[c.type] ?? c.type} · {c.city || "—"}
                      {c.services ? ` · ${c.services.name}` : ""}
                    </div>
                  </div>
                  <span className="text-[11px] text-t3 font-mono flex-shrink-0">{c.interval_months}m</span>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 md:px-5 py-3 flex items-center justify-between border-t border-border">
                <span className="text-[12px] text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} van {totalCount}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i)
                    .filter((i) => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1)
                    .reduce<(number | "ellipsis")[]>((acc, i, idx, arr) => {
                      if (idx > 0 && i - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                      acc.push(i);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "ellipsis" ? (
                        <span key={`e-${idx}`} className="px-1 text-muted-foreground text-[12px] self-center">…</span>
                      ) : (
                        <Button
                          key={item}
                          variant={item === page ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8 text-[12px]"
                          onClick={() => setPage(item)}
                        >
                          {item + 1}
                        </Button>
                      )
                    )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};

export default CustomersPage;
