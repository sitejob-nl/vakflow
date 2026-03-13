import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import SettingsOnboarding from "@/components/SettingsOnboarding";
import { SETTINGS_INPUT_CLASS, SETTINGS_LABEL_CLASS } from "@/components/settings/shared";

const SettingsAssetFieldsTab = lazy(() => import("@/components/settings/SettingsAssetFieldsTab"));
const SettingsLeadsTab = lazy(() => import("@/components/settings/SettingsLeadsTab"));
const SettingsApiKeysTab = lazy(() => import("@/components/settings/SettingsApiKeysTab"));
const SettingsHexonTab = lazy(() => import("@/components/settings/SettingsHexonTab"));
const SettingsVoysTab = lazy(() => import("@/components/settings/SettingsVoysTab"));
const SettingsAiAgentTab = lazy(() => import("@/components/settings/SettingsAiAgentTab"));

interface TabDef {
  id: string;
  label: string;
  section: "general" | "integrations";
  requiredFeature?: string;
  adminOnly?: boolean;
}

const ALL_TABS: TabDef[] = [
  // Algemeen
  { id: "profiel", label: "Profiel", section: "general" },
  { id: "bedrijf", label: "Bedrijf", section: "general", adminOnly: true },
  { id: "voorkeuren", label: "Voorkeuren", section: "general" },
  { id: "diensten", label: "Diensten", section: "general", adminOnly: true },
  { id: "materialen", label: "Materialen", section: "general", adminOnly: true },
  { id: "objectvelden", label: "Objectvelden", section: "general", adminOnly: true, requiredFeature: "assets" },
  { id: "sjablonen", label: "Sjablonen", section: "general", adminOnly: true },
  { id: "werkplaats", label: "Werkplaats", section: "general", adminOnly: true, requiredFeature: "vehicles" },
  { id: "boekhouding", label: "Boekhouding", section: "general", adminOnly: true },
  { id: "apk", label: "APK-herinneringen", section: "general", adminOnly: true, requiredFeature: "vehicles" },
  { id: "team", label: "Gebruikers", section: "general", adminOnly: true },
  { id: "koppelingen", label: "Koppelingen", section: "general", adminOnly: true },
  { id: "leads", label: "Leads", section: "general", adminOnly: true, requiredFeature: "leads" },
  { id: "api", label: "API Keys", section: "general", adminOnly: true, requiredFeature: "api" },
  { id: "meta", label: "Meta", section: "integrations", adminOnly: true, requiredFeature: "marketing" },
  { id: "email-templates", label: "E-mail Templates", section: "general", adminOnly: true },
  // Integraties
  { id: "email", label: "E-mail", section: "integrations", requiredFeature: "email" },
  { id: "whatsapp", label: "WhatsApp", section: "integrations", requiredFeature: "whatsapp" },
  { id: "automations", label: "Automatiseringen", section: "integrations", adminOnly: true, requiredFeature: "whatsapp" },
  { id: "hexon", label: "Hexon DV", section: "integrations", adminOnly: true, requiredFeature: "hexon" },
  { id: "voip", label: "Telefonie", section: "integrations", adminOnly: true, requiredFeature: "voip" },
  { id: "ai_agent", label: "AI Agent", section: "integrations", adminOnly: true, requiredFeature: "ai_agent" },
];

const TabFallback = () => (
  <div className="flex justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

function useIntegrationStatuses(companyId: string | null) {
  const [statuses, setStatuses] = useState<{ hexon: string | null; voys: string | null; aiAgent: boolean | null }>({
    hexon: null, voys: null, aiAgent: null,
  });

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      (supabase.from("hexon_config" as any).select("status").eq("company_id", companyId).maybeSingle() as unknown as Promise<{ data: any }>),
      (supabase.from("voys_config" as any).select("status").eq("company_id", companyId).maybeSingle() as unknown as Promise<{ data: any }>),
      (supabase.from("ai_agent_config" as any).select("enabled").eq("company_id", companyId).maybeSingle() as unknown as Promise<{ data: any }>),
    ]).then(([hexon, voys, ai]) => {
      setStatuses({
        hexon: hexon.data?.status ?? null,
        voys: voys.data?.status ?? null,
        aiAgent: ai.data?.enabled ?? null,
      });
    });
  }, [companyId]);

  return statuses;
}

function StatusIndicator({ tabId, statuses }: { tabId: string; statuses: ReturnType<typeof useIntegrationStatuses> }) {
  if (tabId === "hexon") {
    const s = statuses.hexon;
    if (s === "active" || s === "connected") return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 text-[10px]">Actief</Badge>;
    if (s === "error") return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">Fout</Badge>;
    return <Badge variant="outline" className="text-[10px]">Niet geconfigureerd</Badge>;
  }
  if (tabId === "voip") {
    const s = statuses.voys;
    if (s === "active" || s === "connected") return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 text-[10px]">Actief</Badge>;
    if (s === "error") return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">Fout</Badge>;
    return <Badge variant="outline" className="text-[10px]">Niet geconfigureerd</Badge>;
  }
  if (tabId === "ai_agent") {
    if (statuses.aiAgent === true) return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 text-[10px]">Actief</Badge>;
    return <Badge variant="outline" className="text-[10px]">Uitgeschakeld</Badge>;
  }
  return null;
}

const SettingsPage = () => {
  const { enabledFeatures, role, companyId } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "profiel";
  const [activeTab, setActiveTab] = useState(initialTab);
  const isAdmin = role === "admin" || role === "super_admin";
  const statuses = useIntegrationStatuses(companyId);

  const visibleTabs = ALL_TABS.filter((tab) => {
    if (tab.adminOnly && !isAdmin) return false;
    if (!tab.requiredFeature) return true;
    return enabledFeatures.length === 0 || enabledFeatures.includes(tab.requiredFeature);
  });

  const generalTabs = visibleTabs.filter(t => t.section === "general");
  const integrationTabs = visibleTabs.filter(t => t.section === "integrations");

  // Ensure active tab is valid
  useEffect(() => {
    if (!visibleTabs.some(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id || "profiel");
    }
  }, [visibleTabs, activeTab]);

  const handleTabChange = (tabLabel: string) => {
    // Support legacy label-based tab switching from SettingsOnboarding
    const found = ALL_TABS.find(t => t.label === tabLabel || t.id === tabLabel);
    if (found) setActiveTab(found.id);
  };

  const renderTab = () => {
    switch (activeTab) {
      case "profiel": return <SettingsProfileTab />;
      case "bedrijf": return <SettingsCompanyTab />;
      case "voorkeuren": return <SettingsPreferencesTab />;
      case "diensten": return <SettingsServicesTab />;
      case "materialen": return <MaterialsSettings />;
      case "objectvelden": return <SettingsAssetFieldsTab />;
      case "sjablonen": return <SettingsTemplatesTab />;
      case "werkplaats":
        return (
          <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
            <WorkshopBaySettings />
          </div>
        );
      case "boekhouding": return <SettingsAccountingTab />;
      case "email": return <SettingsEmailTab />;
      case "whatsapp": return <SettingsWhatsAppTab />;
      case "email-templates": return <SettingsEmailTemplatesTab />;
      case "automations": return <SettingsAutomationsTab />;
      case "apk":
        return (
          <div className="bg-card border border-border rounded-lg shadow-card p-5 md:p-6">
            <ApkReminderSettings inputClass={SETTINGS_INPUT_CLASS} labelClass={SETTINGS_LABEL_CLASS} />
          </div>
        );
      case "team": return <SettingsTeamTab />;
      case "koppelingen": return <SettingsIntegrationsTab />;
      case "meta": return <MetaSettingsTab inputClass={SETTINGS_INPUT_CLASS} labelClass={SETTINGS_LABEL_CLASS} />;
      case "leads": return <SettingsLeadsTab />;
      case "api": return <SettingsApiKeysTab />;
      case "hexon": return <SettingsHexonTab />;
      case "voip": return <SettingsVoysTab />;
      case "ai_agent": return <SettingsAiAgentTab />;
      default: return null;
    }
  };

  const TabButton = ({ tab }: { tab: TabDef }) => (
    <button
      onClick={() => setActiveTab(tab.id)}
      className={`px-4 md:px-5 py-2.5 text-[12px] md:text-[13px] font-bold border-b-2 -mb-[2px] transition-colors whitespace-nowrap flex items-center gap-1.5 ${
        tab.id === activeTab
          ? "text-primary border-primary"
          : "text-t3 border-transparent hover:text-secondary-foreground"
      }`}
    >
      {tab.label}
      <StatusIndicator tabId={tab.id} statuses={statuses} />
    </button>
  );

  return (
    <div className="max-w-2xl">
      <SettingsOnboarding onTabChange={handleTabChange} />

      {/* Algemeen tabs */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-0 border-b-2 border-border mb-0">
          {generalTabs.map((t) => <TabButton key={t.id} tab={t} />)}
        </div>
      </div>

      {/* Integraties tabs */}
      {integrationTabs.length > 0 && (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-0 border-b-2 border-border mb-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-2.5 whitespace-nowrap">Integraties</span>
            {integrationTabs.map((t) => <TabButton key={t.id} tab={t} />)}
          </div>
        </div>
      )}

      {integrationTabs.length === 0 && <div className="mb-5" />}

      <Suspense fallback={<TabFallback />}>
        {renderTab()}
      </Suspense>
    </div>
  );
};

export default SettingsPage;
