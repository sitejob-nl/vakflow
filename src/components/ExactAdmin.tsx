import { useState } from "react";
import { Loader2, Check, RefreshCw, ArrowUpFromLine, ArrowDownToLine, Users, FileText, BookOpen, Package, Unplug, Zap, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useExactOnlineConnections,
  useTestExactConnection,
  useRegisterExactTenant,
  useDisconnectExact,
  useSyncCustomersExact,
  useSyncInvoicesExact,
  useSyncQuotesExact,
  useSyncItemsExact,
} from "@/hooks/useExactOnline";
import AccountingDataTable, { formatDate, formatCurrency, statusBadge } from "./AccountingDataTable";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

type Tab = "contacts" | "invoices" | "quotes" | "sync";
const TABS: { key: Tab; label: string }[] = [
  { key: "contacts", label: "Contacten" },
  { key: "invoices", label: "Facturen" },
  { key: "quotes", label: "Offertes" },
  { key: "sync", label: "Synchronisatie" },
];

const ExactAdmin = () => {
  const [activeTab, setActiveTab] = useState<Tab>("contacts");
  const { companyId } = useAuth();
  const [syncLoading, setSyncLoading] = useState<string | null>(null);

  const { data: connections, isLoading: loadingConn } = useExactOnlineConnections();
  const activeConnection = connections?.find((c) => c.is_active);
  const divisionId = activeConnection?.division_id;

  const testConnection = useTestExactConnection();
  const registerTenant = useRegisterExactTenant();
  const disconnectExact = useDisconnectExact();
  const syncCustomers = useSyncCustomersExact();
  const syncInvoices = useSyncInvoicesExact();
  const syncQuotes = useSyncQuotesExact();
  const syncItems = useSyncItemsExact();

  const { data: customers, isLoading: loadingC } = useQuery({
    queryKey: ["exact-customers", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, email, phone, city, exact_account_id").eq("company_id", companyId!).not("exact_account_id", "is", null).order("name");
      return data ?? [];
    },
    enabled: !!companyId && activeTab === "contacts",
  });

  const { data: invoices, isLoading: loadingI } = useQuery({
    queryKey: ["exact-invoices", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, invoice_number, status, total, issued_at, customer_id, customers(name), exact_id").eq("company_id", companyId!).not("exact_id", "is", null).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId && activeTab === "invoices",
  });

  const { data: quotes, isLoading: loadingQ } = useQuery({
    queryKey: ["exact-quotes", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("quotes").select("id, quote_number, status, total, created_at, customer_id, customers(name)").eq("company_id", companyId!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId && activeTab === "quotes",
  });

  const handleSync = async (key: string, fn: () => Promise<any>) => {
    setSyncLoading(key);
    try { await fn(); } catch { /* toast handled in hook */ }
    setSyncLoading(null);
  };

  if (loadingConn) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold">Exact Online</CardTitle>
              {activeConnection ? (
                <Badge variant="default" className="text-xs bg-success/20 text-success border-success/30">Verbonden</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Niet verbonden</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeConnection && (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => testConnection.mutate(divisionId!)} disabled={testConnection.isPending}>
                    {testConnection.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                    Test
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => disconnectExact.mutate(activeConnection.id)}>
                    <Unplug className="h-3 w-3 mr-1" /> Ontkoppelen
                  </Button>
                </>
              )}
              {!activeConnection && (
                <Button size="sm" className="h-7 text-xs" onClick={() => {
                  registerTenant.mutate(undefined, {
                    onSuccess: (data) => {
                      if (data.tenant_id && !data.existing) {
                        const connectUrl = `https://connect.sitejob.nl/exact-setup?tenant_id=${data.tenant_id}`;
                        window.open(connectUrl, "exact-setup", "width=600,height=700");
                      }
                    }
                  });
                }} disabled={registerTenant.isPending}>
                  {registerTenant.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Koppelen
                </Button>
              )}
            </div>
          </div>
          {activeConnection?.company_name && (
            <p className="text-xs text-muted-foreground mt-1">Administratie: {activeConnection.company_name}</p>
          )}
        </CardHeader>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 text-[13px] font-semibold rounded-t-md transition-colors border-b-2 -mb-px ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "contacts" && (
        <AccountingDataTable
          columns={[
            { key: "name", label: "Naam" },
            { key: "email", label: "E-mail" },
            { key: "phone", label: "Telefoon" },
            { key: "city", label: "Plaats" },
            { key: "exact_account_id", label: "Exact ID" },
          ]}
          data={customers}
          isLoading={loadingC}
          emptyMessage="Geen gesynchroniseerde contacten"
        />
      )}

      {activeTab === "invoices" && (
        <AccountingDataTable
          columns={[
            { key: "invoice_number", label: "Nummer" },
            { key: "customers", label: "Klant", render: (v: any) => v?.name ?? "—" },
            { key: "total", label: "Bedrag", render: (v: number) => formatCurrency(v) },
            { key: "status", label: "Status", render: (v: string) => statusBadge(v) },
            { key: "issued_at", label: "Datum", render: (v: string) => formatDate(v) },
          ]}
          data={invoices}
          isLoading={loadingI}
          searchKey="invoice_number"
          emptyMessage="Geen gesynchroniseerde facturen"
        />
      )}

      {activeTab === "quotes" && (
        <AccountingDataTable
          columns={[
            { key: "quote_number", label: "Nummer" },
            { key: "customers", label: "Klant", render: (v: any) => v?.name ?? "—" },
            { key: "total", label: "Bedrag", render: (v: number) => formatCurrency(v) },
            { key: "status", label: "Status", render: (v: string) => statusBadge(v) },
            { key: "created_at", label: "Datum", render: (v: string) => formatDate(v) },
          ]}
          data={quotes}
          isLoading={loadingQ}
          searchKey="quote_number"
          emptyMessage="Geen gesynchroniseerde offertes"
        />
      )}

      {activeTab === "sync" && divisionId && (
        <div className="space-y-4">
          {/* Customers sync */}
          <Card>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" /> Klanten</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button variant="outline" size="sm" disabled={!!syncLoading} onClick={() => handleSync("c-push", () => syncCustomers.mutateAsync({ action: "push", divisionId }))}>
                  {syncLoading === "c-push" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowUpFromLine className="h-3 w-3 mr-1" />} Push
                </Button>
                <Button variant="outline" size="sm" disabled={!!syncLoading} onClick={() => handleSync("c-pull", () => syncCustomers.mutateAsync({ action: "pull", divisionId }))}>
                  {syncLoading === "c-pull" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowDownToLine className="h-3 w-3 mr-1" />} Pull
                </Button>
                <Button variant="outline" size="sm" disabled={!!syncLoading} onClick={() => handleSync("c-sync", () => syncCustomers.mutateAsync({ action: "sync", divisionId }))}>
                  {syncLoading === "c-sync" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />} Sync
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Invoices sync */}
          <Card>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Facturen</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button variant="outline" size="sm" disabled={!!syncLoading} onClick={() => handleSync("i-push", () => syncInvoices.mutateAsync({ action: "push", divisionId }))}>
                  {syncLoading === "i-push" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowUpFromLine className="h-3 w-3 mr-1" />} Push
                </Button>
                <Button variant="outline" size="sm" disabled={!!syncLoading} onClick={() => handleSync("i-pull", () => syncInvoices.mutateAsync({ action: "pull_status", divisionId }))}>
                  {syncLoading === "i-pull" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowDownToLine className="h-3 w-3 mr-1" />} Pull status
                </Button>
                <Button variant="outline" size="sm" disabled={!!syncLoading} onClick={() => handleSync("i-sync", () => syncInvoices.mutateAsync({ action: "sync", divisionId }))}>
                  {syncLoading === "i-sync" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />} Sync
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quotes sync */}
          <Card>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><BookOpen className="h-4 w-4" /> Offertes</div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" disabled={!!syncLoading} onClick={() => handleSync("q-push", () => syncQuotes.mutateAsync({ action: "push", divisionId }))}>
                  {syncLoading === "q-push" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowUpFromLine className="h-3 w-3 mr-1" />} Push
                </Button>
                <Button variant="outline" size="sm" disabled={!!syncLoading} onClick={() => handleSync("q-pull", () => syncQuotes.mutateAsync({ action: "pull_status", divisionId }))}>
                  {syncLoading === "q-pull" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowDownToLine className="h-3 w-3 mr-1" />} Pull status
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Items sync */}
          <Card>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><Package className="h-4 w-4" /> Artikelen</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button variant="outline" size="sm" disabled={!!syncLoading} onClick={() => handleSync("m-push", () => syncItems.mutateAsync({ action: "push", divisionId }))}>
                  {syncLoading === "m-push" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowUpFromLine className="h-3 w-3 mr-1" />} Push
                </Button>
                <Button variant="outline" size="sm" disabled={!!syncLoading} onClick={() => handleSync("m-pull", () => syncItems.mutateAsync({ action: "pull", divisionId }))}>
                  {syncLoading === "m-pull" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowDownToLine className="h-3 w-3 mr-1" />} Pull
                </Button>
                <Button variant="outline" size="sm" disabled={!!syncLoading} onClick={() => handleSync("m-sync", () => syncItems.mutateAsync({ action: "sync", divisionId }))}>
                  {syncLoading === "m-sync" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />} Sync
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "sync" && !divisionId && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Koppel eerst Exact Online om te synchroniseren.
        </div>
      )}
    </div>
  );
};

export default ExactAdmin;
