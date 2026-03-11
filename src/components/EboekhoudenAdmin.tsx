import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AccountingDataTable, { formatDate, formatCurrency, statusBadge } from "./AccountingDataTable";
import ProviderSyncPanel from "./ProviderSyncPanel";

type Tab = "contacts" | "invoices";
const TABS: { key: Tab; label: string }[] = [
  { key: "contacts", label: "Contacten" },
  { key: "invoices", label: "Facturen" },
];

const EboekhoudenAdmin = () => {
  const [activeTab, setActiveTab] = useState<Tab>("contacts");
  const { companyId } = useAuth();

  const { data: customers, isLoading: loadingC } = useQuery({
    queryKey: ["eboekhouden-customers", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, email, phone, city, eboekhouden_relation_id").eq("company_id", companyId!).not("eboekhouden_relation_id", "is", null).order("name");
      return data ?? [];
    },
    enabled: !!companyId && activeTab === "contacts",
  });

  const { data: invoices, isLoading: loadingI } = useQuery({
    queryKey: ["eboekhouden-invoices", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, invoice_number, status, total, issued_at, customer_id, customers(name), eboekhouden_id").eq("company_id", companyId!).not("eboekhouden_id", "is", null).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId && activeTab === "invoices",
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
            { key: "eboekhouden_relation_id", label: "e-Boekhouden ID" },
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

      <ProviderSyncPanel provider="eboekhouden" />
    </div>
  );
};

export default EboekhoudenAdmin;
