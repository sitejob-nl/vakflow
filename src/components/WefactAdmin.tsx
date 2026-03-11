import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AccountingDataTable, { formatDate, formatCurrency, statusBadge } from "./AccountingDataTable";
import ProviderSyncPanel from "./ProviderSyncPanel";

type Tab = "contacts" | "invoices" | "quotes" | "products";
const TABS: { key: Tab; label: string }[] = [
  { key: "contacts", label: "Contacten" },
  { key: "invoices", label: "Facturen" },
  { key: "quotes", label: "Offertes" },
  { key: "products", label: "Producten" },
];

const WefactAdmin = () => {
  const [activeTab, setActiveTab] = useState<Tab>("contacts");
  const { companyId } = useAuth();

  const { data: customers, isLoading: loadingC } = useQuery({
    queryKey: ["wefact-customers", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, email, phone, city, wefact_debtor_code").eq("company_id", companyId!).not("wefact_debtor_code", "is", null).order("name");
      return data ?? [];
    },
    enabled: !!companyId && activeTab === "contacts",
  });

  const { data: invoices, isLoading: loadingI } = useQuery({
    queryKey: ["wefact-invoices", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, invoice_number, status, total, issued_at, customer_id, customers(name), wefact_id").eq("company_id", companyId!).not("wefact_id", "is", null).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId && activeTab === "invoices",
  });

  const { data: quotes, isLoading: loadingQ } = useQuery({
    queryKey: ["wefact-quotes", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("quotes").select("id, quote_number, status, total, created_at, customer_id, customers(name)").eq("company_id", companyId!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId && activeTab === "quotes",
  });

  const { data: materials, isLoading: loadingM } = useQuery({
    queryKey: ["wefact-materials", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("materials").select("id, name, article_number, unit_price, unit, stock_quantity, wefact_product_id").eq("company_id", companyId!).not("wefact_product_id", "is", null).order("name");
      return data ?? [];
    },
    enabled: !!companyId && activeTab === "products",
  });

  return (
    <div className="space-y-4">
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
            { key: "wefact_debtor_code", label: "WeFact code" },
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

      {activeTab === "products" && (
        <AccountingDataTable
          columns={[
            { key: "name", label: "Naam" },
            { key: "article_number", label: "Artikelnr." },
            { key: "unit_price", label: "Prijs", render: (v: number) => formatCurrency(v) },
            { key: "unit", label: "Eenheid" },
            { key: "stock_quantity", label: "Voorraad" },
          ]}
          data={materials}
          isLoading={loadingM}
          emptyMessage="Geen gesynchroniseerde producten"
        />
      )}

      <ProviderSyncPanel provider="wefact" />
    </div>
  );
};

export default WefactAdmin;
