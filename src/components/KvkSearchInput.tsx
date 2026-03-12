import { useState, useRef } from "react";
import { useKvkLookup, type KvkCompanyData } from "@/hooks/useKvkLookup";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface KvkSearchInputProps {
  onCompanySelected: (data: KvkCompanyData) => void;
  initialValue?: string;
  /** Show only company name result, or full address autofill */
  variant?: "compact" | "full";
}

const KvkSearchInput = ({ onCompanySelected, initialValue = "", variant = "full" }: KvkSearchInputProps) => {
  const { search, getCompanyData, isLoading } = useKvkLookup();
  const { toast } = useToast();
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || q.length < 2) {
      toast({ title: "Voer minimaal 2 tekens in", variant: "destructive" });
      return;
    }
    const res = await search(q);
    setResults(res);
    setOpen(res.length > 0);
    if (res.length === 0) {
      toast({ title: "Geen resultaten gevonden" });
    }
  };

  const handleSelect = async (result: any) => {
    setSelecting(true);
    setOpen(false);
    const data = await getCompanyData(result.kvkNummer, result.vestigingsnummer);
    if (data) {
      setQuery(data.kvk_number);
      onCompanySelected(data);
      toast({ title: "Bedrijfsgegevens ingevuld" });
    } else {
      toast({ title: "Gegevens ophalen mislukt", variant: "destructive" });
    }
    setSelecting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="KVK-nummer of bedrijfsnaam"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSearch}
              disabled={isLoading || selecting}
              className="flex items-center gap-1.5 whitespace-nowrap"
            >
              {(isLoading || selecting) ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              Zoeken
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 max-h-64 overflow-y-auto"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {results.map((r, i) => {
            const addr = r.adres?.binnenlandsAdres;
            return (
              <button
                key={`${r.kvkNummer}-${r.vestigingsnummer || i}`}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-0 flex items-start gap-2.5"
              >
                <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{r.naam}</div>
                  <div className="text-xs text-muted-foreground">
                    KVK {r.kvkNummer}
                    {addr && ` · ${addr.straatnaam || ""} ${addr.huisnummer || ""}, ${addr.plaats || ""}`}
                  </div>
                </div>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default KvkSearchInput;
