import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";

const SettingsProfileTab = lazy(() => import("@/components/settings/SettingsProfileTab"));
const SettingsCompanyTab = lazy(() => import("@/components/settings/SettingsCompanyTab"));
const SettingsPreferencesTab = lazy(() => import("@/components/settings/SettingsPreferencesTab"));
const SettingsServicesTab = lazy(() => import("@/components/settings/SettingsServicesTab"));
const SettingsTemplatesTab = lazy(() => import("@/components/settings/SettingsTemplatesTab"));
const SettingsTeamTab = lazy(() => import("@/components/settings/SettingsTeamTab"));
const SettingsAccountingTab = lazy(() => import("@/components/settings/SettingsAccountingTab"));
const SettingsEmailTab = lazy(() => import("@/components/settings/SettingsEmailTab"));
const SettingsEmailTemplatesTab = lazy(() => import("@/components/settings/SettingsEmailTemplatesTab"));
const SettingsWhatsAppTab = lazy(() => import("@/components/settings/SettingsWhatsAppTab"));
const SettingsAutomationsTab = lazy(() => import("@/components/settings/SettingsAutomationsTab"));
const SettingsIntegrationsTab = lazy(() => import("@/components/settings/SettingsIntegrationsTab"));
import MaterialsSettings from "@/components/MaterialsSettings";
import WorkshopBaySettings from "@/components/WorkshopBaySettings";
import ApkReminderSettings from "@/components/ApkReminderSettings";
import MetaSettingsTab from "@/components/MetaSettingsTab";
import { SETTINGS_INPUT_CLASS, SETTINGS_LABEL_CLASS } from "@/components/settings/shared";

const SettingsAssetFieldsTab = lazy(() => import("@/components/settings/SettingsAssetFieldsTab"));
const SettingsLeadsTab = lazy(() => import("@/components/settings/SettingsLeadsTab"));

const BASE_TABS: string[] = [
  "Profiel", "Bedrijfsgegevens", "App-voorkeuren", "Diensten", "Materialen",
  "Objectvelden", "Sjablonen", "Werkplaats", "Boekhouding", "E-mail", "WhatsApp",
  "E-mail Templates", "Automatiseringen", "APK-herinneringen", "Teamleden",
  "Koppelingen", "Meta", "Leads",
];

const TAB_FEATURE_MAP: Record<string, string> = {
  "E-mail": "email",
  "WhatsApp": "whatsapp",
  "Automatiseringen": "whatsapp",
  "Meta": "marketing",
  "Werkplaats": "vehicles",
  "APK-herinneringen": "vehicles",
  "Objectvelden": "assets",
  "Leads": "leads",
};

// Tabs that require admin role — monteurs only see what's NOT in this list
const ADMIN_ONLY_TABS = new Set([
  "Bedrijfsgegevens", "Diensten", "Materialen", "Objectvelden", "Sjablonen",
  "Werkplaats", "Boekhouding", "E-mail", "WhatsApp", "E-mail Templates",
  "Automatiseringen", "APK-herinneringen", "Teamleden", "Koppelingen", "Meta", "Leads",
]);

const TabFallback = () => (
  <div className="flex justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const SettingsPage = () => {
  const { enabledFeatures, role } = useAuth();
  const [activeTab, setActiveTab] = useState("Profiel");
  const isAdmin = role === "admin" || role === "super_admin";

  const tabs = BASE_TABS.filter((tab) => {
    // Role filter: monteurs only see non-admin tabs
    if (!isAdmin && ADMIN_ONLY_TABS.has(tab)) return false;
    // Feature filter
    const requiredFeature = TAB_FEATURE_MAP[tab];
    if (!requiredFeature) return true;
    return enabledFeatures.length === 0 || enabledFeatures.includes(requiredFeature);
  });

  const renderTab = () => {
    switch (activeTab) {
      case "Profiel":
        return <SettingsProfileTab />;
      case "Bedrijfsgegevens":
        return <SettingsCompanyTab />;
      case "App-voorkeuren":
        return <SettingsPreferencesTab />;
      case "Diensten":
        return <SettingsServicesTab />;
      case "Materialen":
        return <MaterialsSettings />;
      case "Objectvelden":
        return <SettingsAssetFieldsTab />;
      case "Sjablonen":
        return <SettingsTemplatesTab />;
      case "Werkplaats":
        return (
          <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
            <WorkshopBaySettings />
          </div>
        );
      case "Boekhouding":
        return <SettingsAccountingTab />;
      case "E-mail":
        return <SettingsEmailTab />;
      case "WhatsApp":
        return <SettingsWhatsAppTab />;
      case "E-mail Templates":
        return <SettingsEmailTemplatesTab />;
      case "Automatiseringen":
        return <SettingsAutomationsTab />;
      case "APK-herinneringen":
        return (
          <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
            <ApkReminderSettings inputClass={SETTINGS_INPUT_CLASS} labelClass={SETTINGS_LABEL_CLASS} />
          </div>
        );
      case "Teamleden":
        return <SettingsTeamTab />;
      case "Koppelingen":
        return <SettingsIntegrationsTab />;
      case "Meta":
        return <MetaSettingsTab inputClass={SETTINGS_INPUT_CLASS} labelClass={SETTINGS_LABEL_CLASS} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex gap-0 border-b-2 border-border mb-5 overflow-x-auto scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 md:px-5 py-2.5 text-[12px] md:text-[13px] font-bold border-b-2 -mb-[2px] transition-colors whitespace-nowrap ${
              t === activeTab
                ? "text-primary border-primary"
                : "text-t3 border-transparent hover:text-secondary-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <Suspense fallback={<TabFallback />}>
        {renderTab()}
      </Suspense>
    </div>
  );
};

export default SettingsPage;
