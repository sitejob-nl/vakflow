import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { 
  RefreshCw, Users, FileText, Package, BookOpen, ChevronDown, 
  ArrowDownToLine, ArrowUpFromLine, Loader2, CheckCircle2
} from "lucide-react";
import {
  useSyncContactsRompslomp, usePullContactsRompslomp, useSyncInvoicesRompslomp, usePullInvoicesRompslomp, usePullInvoiceStatusRompslomp, useSyncQuotesRompslomp, usePullQuotesRompslomp,
  useSyncContactsMoneybird, usePullContactsMoneybird, useSyncInvoicesMoneybird, usePullInvoicesMoneybird, usePullInvoiceStatusMoneybird, useSyncQuotesMoneybird, usePullQuotesMoneybird, useSyncProductsMoneybird, usePullProductsMoneybird, usePullSubscriptionsMoneybird,
  useSyncAllContactsEboekhouden, useSyncAllInvoicesEboekhouden, usePullContactsEboekhouden, usePullInvoicesEboekhouden, usePullInvoiceStatusEboekhouden,
  useSyncContactsExact, usePullContactsExact, useSyncInvoicesExact, usePullInvoicesExact, usePullInvoiceStatusExact, useSyncQuotesExact, usePullQuotesExact,
  useSyncContactsWefact, usePullContactsWefact, useSyncInvoicesWefact, usePullInvoicesWefact, usePullInvoiceStatusWefact, useSyncProductsWefact, usePullProductsWefact,
} from "@/hooks/useInvoices";

interface Props {
  provider: string | null;
}

interface SyncAction {
  label: string;
  description: string;
  icon: React.ReactNode;
  direction: "push" | "pull" | "both";
  category: "contacts" | "invoices" | "quotes" | "products" | "subscriptions";
  action: () => Promise<any>;
}

const providerLabels: Record<string, string> = {
  exact: "Exact Online",
  moneybird: "Moneybird",
  rompslomp: "Rompslomp",
  wefact: "WeFact",
  eboekhouden: "e-Boekhouden",
  snelstart: "SnelStart",
};

const ProviderSyncPanel = ({ provider }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ key: string; success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  // Rompslomp hooks
  const syncContactsRompslomp = useSyncContactsRompslomp();
  const pullContactsRompslomp = usePullContactsRompslomp();
  const syncInvoicesRompslomp = useSyncInvoicesRompslomp();
  const pullInvoicesRompslomp = usePullInvoicesRompslomp();
  const pullStatusRompslomp = usePullInvoiceStatusRompslomp();
  const syncQuotesRompslomp = useSyncQuotesRompslomp();
  const pullQuotesRompslomp = usePullQuotesRompslomp();

  // Moneybird hooks
  const syncContactsMoneybird = useSyncContactsMoneybird();
  const pullContactsMoneybird = usePullContactsMoneybird();
  const syncInvoicesMoneybird = useSyncInvoicesMoneybird();
  const pullInvoicesMoneybird = usePullInvoicesMoneybird();
  const pullStatusMoneybird = usePullInvoiceStatusMoneybird();
  const syncQuotesMoneybird = useSyncQuotesMoneybird();
  const pullQuotesMoneybird = usePullQuotesMoneybird();
  const syncProductsMoneybird = useSyncProductsMoneybird();
  const pullProductsMoneybird = usePullProductsMoneybird();
  const pullSubscriptionsMoneybird = usePullSubscriptionsMoneybird();

  // e-Boekhouden hooks
  const syncContactsEb = useSyncAllContactsEboekhouden();
  const syncInvoicesEb = useSyncAllInvoicesEboekhouden();
  const pullContactsEb = usePullContactsEboekhouden();
  const pullInvoicesEb = usePullInvoicesEboekhouden();
  const pullStatusEb = usePullInvoiceStatusEboekhouden();

  // Exact hooks
  const syncContactsExact = useSyncContactsExact();
  const pullContactsExact = usePullContactsExact();
  const syncInvoicesExact = useSyncInvoicesExact();
  const pullInvoicesExact = usePullInvoicesExact();
  const pullStatusExact = usePullInvoiceStatusExact();
  const syncQuotesExact = useSyncQuotesExact();
  const pullQuotesExact = usePullQuotesExact();

  // WeFact hooks
  const syncContactsWefact = useSyncContactsWefact();
  const pullContactsWefact = usePullContactsWefact();
  const syncInvoicesWefact = useSyncInvoicesWefact();
  const pullInvoicesWefact = usePullInvoicesWefact();
  const pullStatusWefact = usePullInvoiceStatusWefact();
  const syncProductsWefact = useSyncProductsWefact();
  const pullProductsWefact = usePullProductsWefact();

  const getActionsForProvider = (): SyncAction[] => {
    switch (provider) {
      case "rompslomp":
        return [
          { label: "Push contacten", description: "Stuur klanten naar Rompslomp", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "contacts", action: () => syncContactsRompslomp.mutateAsync() },
          { label: "Pull contacten", description: "Haal klanten op uit Rompslomp", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "contacts", action: () => pullContactsRompslomp.mutateAsync() },
          { label: "Push facturen", description: "Stuur facturen naar Rompslomp", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "invoices", action: () => syncInvoicesRompslomp.mutateAsync() },
          { label: "Pull facturen", description: "Haal facturen op uit Rompslomp", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "invoices", action: () => pullInvoicesRompslomp.mutateAsync() },
          { label: "Pull betaalstatus", description: "Haal actuele betaalstatus op", icon: <RefreshCw className="w-4 h-4" />, direction: "pull", category: "invoices", action: () => pullStatusRompslomp.mutateAsync() },
          { label: "Push offertes", description: "Stuur offertes naar Rompslomp", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "quotes", action: () => syncQuotesRompslomp.mutateAsync() },
          { label: "Pull offertes", description: "Haal offertes op uit Rompslomp", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "quotes", action: () => pullQuotesRompslomp.mutateAsync() },
        ];

      case "moneybird":
        return [
          { label: "Push contacten", description: "Stuur klanten naar Moneybird", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "contacts", action: () => syncContactsMoneybird.mutateAsync() },
          { label: "Pull contacten", description: "Haal klanten op uit Moneybird", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "contacts", action: () => pullContactsMoneybird.mutateAsync() },
          { label: "Push facturen", description: "Stuur facturen naar Moneybird", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "invoices", action: () => syncInvoicesMoneybird.mutateAsync() },
          { label: "Pull facturen", description: "Haal facturen op uit Moneybird", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "invoices", action: () => pullInvoicesMoneybird.mutateAsync() },
          { label: "Pull betaalstatus", description: "Haal actuele betaalstatus op", icon: <RefreshCw className="w-4 h-4" />, direction: "pull", category: "invoices", action: () => pullStatusMoneybird.mutateAsync() },
          { label: "Push offertes", description: "Stuur offertes naar Moneybird", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "quotes", action: () => syncQuotesMoneybird.mutateAsync() },
          { label: "Pull offertes", description: "Haal offertes op uit Moneybird", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "quotes", action: () => pullQuotesMoneybird.mutateAsync() },
          { label: "Push producten", description: "Stuur materialen naar Moneybird", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "products", action: () => syncProductsMoneybird.mutateAsync() },
          { label: "Pull producten", description: "Haal producten op uit Moneybird", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "products", action: () => pullProductsMoneybird.mutateAsync() },
          { label: "Pull abonnementen", description: "Importeer terugkerende facturen", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "subscriptions", action: () => pullSubscriptionsMoneybird.mutateAsync() },
        ];

      case "eboekhouden":
        return [
          { label: "Sync alle contacten", description: "Volledig synchroniseren naar e-Boekhouden", icon: <RefreshCw className="w-4 h-4" />, direction: "both", category: "contacts", action: () => syncContactsEb.mutateAsync() },
          { label: "Pull contacten", description: "Haal klanten op uit e-Boekhouden", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "contacts", action: () => pullContactsEb.mutateAsync() },
          { label: "Sync alle facturen", description: "Volledig synchroniseren naar e-Boekhouden", icon: <RefreshCw className="w-4 h-4" />, direction: "both", category: "invoices", action: () => syncInvoicesEb.mutateAsync() },
          { label: "Pull facturen", description: "Haal facturen op uit e-Boekhouden", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "invoices", action: () => pullInvoicesEb.mutateAsync() },
          { label: "Pull betaalstatus", description: "Haal actuele betaalstatus op", icon: <RefreshCw className="w-4 h-4" />, direction: "pull", category: "invoices", action: () => pullStatusEb.mutateAsync() },
        ];

      case "exact":
        return [
          { label: "Push contacten", description: "Stuur klanten naar Exact Online", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "contacts", action: () => syncContactsExact.mutateAsync() },
          { label: "Pull contacten", description: "Haal klanten op uit Exact Online", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "contacts", action: () => pullContactsExact.mutateAsync() },
          { label: "Push facturen", description: "Stuur facturen naar Exact Online", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "invoices", action: () => syncInvoicesExact.mutateAsync() },
          { label: "Pull facturen", description: "Haal facturen op uit Exact Online", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "invoices", action: () => pullInvoicesExact.mutateAsync() },
          { label: "Pull betaalstatus", description: "Haal actuele betaalstatus op", icon: <RefreshCw className="w-4 h-4" />, direction: "pull", category: "invoices", action: () => pullStatusExact.mutateAsync() },
          { label: "Push offertes", description: "Stuur offertes naar Exact Online", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "quotes", action: () => syncQuotesExact.mutateAsync() },
          { label: "Pull offertes", description: "Haal offertes op uit Exact Online", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "quotes", action: () => pullQuotesExact.mutateAsync() },
        ];

      case "wefact":
        return [
          { label: "Push debiteuren", description: "Stuur klanten naar WeFact", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "contacts", action: () => syncContactsWefact.mutateAsync() },
          { label: "Pull debiteuren", description: "Haal klanten op uit WeFact", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "contacts", action: () => pullContactsWefact.mutateAsync() },
          { label: "Push facturen", description: "Stuur facturen naar WeFact", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "invoices", action: () => syncInvoicesWefact.mutateAsync() },
          { label: "Pull facturen", description: "Haal facturen op uit WeFact", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "invoices", action: () => pullInvoicesWefact.mutateAsync() },
          { label: "Pull betaalstatus", description: "Haal actuele betaalstatus op", icon: <RefreshCw className="w-4 h-4" />, direction: "pull", category: "invoices", action: () => pullStatusWefact.mutateAsync() },
          { label: "Push producten", description: "Stuur materialen naar WeFact", icon: <ArrowUpFromLine className="w-4 h-4" />, direction: "push", category: "products", action: () => syncProductsWefact.mutateAsync() },
          { label: "Pull producten", description: "Haal producten op uit WeFact", icon: <ArrowDownToLine className="w-4 h-4" />, direction: "pull", category: "products", action: () => pullProductsWefact.mutateAsync() },
        ];

      default:
        return [];
    }
  };

  const actions = getActionsForProvider();

  const handleAction = async (action: SyncAction, key: string) => {
    setLoading(key);
    setLastResult(null);
    try {
      const result = await action.action();
      const synced = result?.synced ?? result?.created ?? result?.imported ?? result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const errors = result?.errors ?? [];

      let message = `${synced} verwerkt`;
      if (skipped > 0) message += `, ${skipped} overgeslagen`;
      if (errors.length > 0) message += ` (${errors.length} fouten)`;

      setLastResult({ key, success: errors.length === 0, message });
      toast({ 
        title: errors.length === 0 ? `✓ ${action.label}` : `⚠ ${action.label}`, 
        description: message,
        variant: errors.length > 0 ? "destructive" : "default"
      });
    } catch (err: any) {
      setLastResult({ key, success: false, message: err.message });
      toast({ title: `${action.label} mislukt`, description: err.message, variant: "destructive" });
    }
    setLoading(null);
  };

  if (!provider || actions.length === 0) return null;

  const categoryIcons: Record<string, React.ReactNode> = {
    contacts: <Users className="w-4 h-4" />,
    invoices: <FileText className="w-4 h-4" />,
    quotes: <BookOpen className="w-4 h-4" />,
    products: <Package className="w-4 h-4" />,
    subscriptions: <RefreshCw className="w-4 h-4" />,
  };

  const categoryLabels: Record<string, string> = {
    contacts: "Contacten",
    invoices: "Facturen",
    quotes: "Offertes",
    products: "Producten",
    subscriptions: "Abonnementen",
  };

  // Group actions by category
  const categories = [...new Set(actions.map((a) => a.category))];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="mb-4">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-medium">
                  {providerLabels[provider]} Sync Center
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {actions.length} acties
                </Badge>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {categories.map((category) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                  {categoryIcons[category]}
                  {categoryLabels[category]}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {actions
                    .filter((a) => a.category === category)
                    .map((action, idx) => {
                      const key = `${category}-${idx}`;
                      const isLoading = loading === key;
                      const result = lastResult?.key === key ? lastResult : null;
                      return (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          className="justify-start h-auto py-2 px-3"
                          disabled={!!loading}
                          onClick={() => handleAction(action, key)}
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : result?.success ? (
                            <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                          ) : (
                            <span className="mr-2">{action.icon}</span>
                          )}
                          <div className="text-left">
                            <div className="font-medium">{action.label}</div>
                            <div className="text-xs text-muted-foreground">{action.description}</div>
                          </div>
                        </Button>
                      );
                    })}
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default ProviderSyncPanel;
