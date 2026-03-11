import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface Props {
  columns: Column[];
  data: any[] | undefined;
  isLoading: boolean;
  searchKey?: string;
  emptyMessage?: string;
}

const AccountingDataTable = ({ columns, data, isLoading, searchKey = "name", emptyMessage = "Geen resultaten" }: Props) => {
  const [search, setSearch] = useState("");

  const filtered = (data ?? []).filter((row) => {
    if (!search) return true;
    const val = row[searchKey];
    return val && String(val).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoeken…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{emptyMessage}</p>
      ) : (
        <div className="border border-border rounded-md overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {columns.map((col) => (
                  <th key={col.key} className="text-left px-3 py-2 font-medium text-muted-foreground">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.id ?? i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AccountingDataTable;

export const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return format(new Date(d), "d MMM yyyy", { locale: nl });
  } catch {
    return d;
  }
};

export const formatCurrency = (v: number | null) => {
  if (v == null) return "—";
  return `€ ${v.toFixed(2).replace(".", ",")}`;
};

export const statusBadge = (status: string | null) => {
  if (!status) return "—";
  const colors: Record<string, string> = {
    concept: "bg-muted text-muted-foreground",
    verzonden: "bg-primary/10 text-primary",
    betaald: "bg-green-500/10 text-green-700",
    verlopen: "bg-destructive/10 text-destructive",
    geaccepteerd: "bg-green-500/10 text-green-700",
    afgewezen: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
};
