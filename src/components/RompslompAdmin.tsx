import { useState, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const RompslompContacts = lazy(() => import("@/components/RompslompContacts").then(m => ({ default: m.RompslompContacts })));
const RompslompInvoices = lazy(() => import("@/components/RompslompInvoices").then(m => ({ default: m.RompslompInvoices })));
const RompslompQuotations = lazy(() => import("@/components/RompslompQuotations").then(m => ({ default: m.RompslompQuotations })));
const RompslompProducts = lazy(() => import("@/components/RompslompProducts").then(m => ({ default: m.RompslompProducts })));

type RompslompTab = "contacts" | "invoices" | "quotations" | "products";

const TABS: { key: RompslompTab; label: string }[] = [
  { key: "contacts", label: "Contacten" },
  { key: "invoices", label: "Facturen" },
  { key: "quotations", label: "Offertes" },
  { key: "products", label: "Producten" },
];

const RompslompAdmin = () => {
  const [activeTab, setActiveTab] = useState<RompslompTab>("contacts");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-[13px] font-semibold rounded-t-md transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
        {activeTab === "contacts" && <RompslompContacts />}
        {activeTab === "invoices" && <RompslompInvoices />}
        {activeTab === "quotations" && <RompslompQuotations />}
        {activeTab === "products" && <RompslompProducts />}
      </Suspense>
    </div>
  );
};

export default RompslompAdmin;
