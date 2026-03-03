import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, RefreshCw, Search, Loader2 } from "lucide-react";

interface ErrorLog {
  id: string;
  function_name: string;
  error_message: string;
  error_details: Record<string, unknown>;
  severity: string;
  resolved: boolean;
  company_id: string | null;
  created_at: string;
}

interface Props {
  onUnresolvedCount?: (count: number) => void;
}

const SuperAdminErrors = ({ onUnresolvedCount }: Props) => {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [showResolved, setShowResolved] = useState(false);

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from("edge_function_errors")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!showResolved) query = query.eq("resolved", false);

    const { data } = await query;
    const items = (data || []) as ErrorLog[];
    setErrors(items);
    onUnresolvedCount?.(items.filter(e => !e.resolved).length);
    setLoading(false);
  }, [showResolved, onUnresolvedCount]);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchErrors, 30000);
    return () => clearInterval(interval);
  }, [fetchErrors]);

  const toggleResolved = async (id: string, resolved: boolean) => {
    await (supabase as any).from("edge_function_errors").update({ resolved: !resolved }).eq("id", id);
    fetchErrors();
  };

  const filtered = errors.filter(e => {
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (search && !e.function_name.toLowerCase().includes(search.toLowerCase()) && !e.error_message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-2 items-center flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Zoek op functie of foutmelding..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowResolved(v => !v)}>
            {showResolved ? "Verberg opgelost" : "Toon opgelost"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchErrors}>
            <RefreshCw className="w-4 h-4 mr-1" /> Ververs
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
          <p className="text-lg font-medium">Geen fouten gevonden</p>
          <p className="text-sm">Alles draait soepel!</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Functie</TableHead>
                <TableHead className="w-[80px]">Ernst</TableHead>
                <TableHead>Foutmelding</TableHead>
                <TableHead className="w-[160px]">Tijdstip</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => (
                <TableRow key={e.id} className={e.resolved ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs">{e.function_name}</TableCell>
                  <TableCell>
                    <Badge variant={e.severity === "error" ? "destructive" : "secondary"} className="text-[10px]">
                      {e.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[400px] truncate" title={e.error_message}>
                    {e.error_message}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString("nl-NL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleResolved(e.id, e.resolved)}
                      title={e.resolved ? "Markeer als onopgelost" : "Markeer als opgelost"}
                    >
                      <CheckCircle className={`w-4 h-4 ${e.resolved ? "text-green-500" : "text-muted-foreground"}`} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default SuperAdminErrors;
