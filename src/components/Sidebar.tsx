import { useNavigation, type Page } from "@/hooks/useNavigation";
import {
  LayoutGrid, Calendar, Users, FileText, DollarSign,
  MessageSquare, Bell, LogOut, Settings, Mail, Building2, BarChart3, Box, Megaphone
} from "lucide-react";
import vakflowLogo from "@/assets/vakflow-logo.svg";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";

const buildSections = (labels: { workOrders: string; assets: string }) => [
  {
    label: "Overzicht",
    items: [
      { id: "dashboard" as Page, icon: LayoutGrid, label: "Dashboard", adminOnly: false },
    ],
  },
  {
    label: "Operatie",
    items: [
      { id: "planning" as Page, icon: Calendar, label: "Planning", adminOnly: false },
      { id: "customers" as Page, icon: Users, label: "Klanten", adminOnly: true },
      { id: "workorders" as Page, icon: FileText, label: labels.workOrders, adminOnly: false },
    ],
  },
  {
    label: "Administratie",
    items: [
      { id: "invoices" as Page, icon: DollarSign, label: "Facturatie", adminOnly: true },
      { id: "quotes" as Page, icon: FileText, label: "Offertes", adminOnly: true },
      { id: "reports" as Page, icon: BarChart3, label: "Rapportages", adminOnly: true },
      { id: "email" as Page, icon: Mail, label: "E-mail", adminOnly: true },
      { id: "whatsapp" as Page, icon: MessageSquare, label: "WhatsApp", adminOnly: true },
      { id: "communication" as Page, icon: MessageSquare, label: "Logboek", adminOnly: true },
      { id: "reminders" as Page, icon: Bell, label: "Reminders", adminOnly: true },
    ],
  },
  {
    label: "Beheer",
    items: [
      { id: "assets" as Page, icon: Box, label: labels.assets, adminOnly: true },
      { id: "marketing" as Page, icon: Megaphone, label: "Marketing", adminOnly: true },
    ],
  },
];

const Sidebar = () => {
  const { currentPage, navigate } = useNavigation();
  const { signOut, isAdmin, isSuperAdmin, companyLogoUrl, enabledFeatures } = useAuth();
  const { labels } = useIndustryConfig();

  const handleNav = (page: Page) => {
    navigate(page);
  };

  const sections = buildSections(labels)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        (!item.adminOnly || isAdmin) &&
        (enabledFeatures.length === 0 || enabledFeatures.includes(item.id))
      ),
    }))
    .filter((section) => section.items.length > 0);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`px-5 py-[18px] flex items-center justify-center border-b border-border ${!companyLogoUrl ? 'bg-foreground rounded-t-lg' : ''}`}>
        <img src={companyLogoUrl || vakflowLogo} alt="Logo" className="h-10 object-contain max-w-[180px]" />
      </div>

      {/* Navigation */}
      <nav className="p-2 flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label} className="mb-1">
            <div className="text-[10px] font-bold uppercase tracking-[1.2px] text-t3 px-3.5 pt-2 pb-1">
              {section.label}
            </div>
            {section.items.map((item) => {
              const active = currentPage === item.id ||
                (item.id === "customers" && currentPage === "custDetail") ||
                (item.id === "workorders" && currentPage === "woDetail");
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-sm text-[13.5px] font-semibold transition-all mb-px ${
                    active
                      ? "bg-primary-muted text-primary"
                      : "text-secondary-foreground hover:bg-bg-hover hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3.5 border-t border-border space-y-px">
        {isSuperAdmin && (
          <button
            onClick={() => handleNav("superadmin")}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-sm text-[13.5px] font-semibold transition-all ${
              currentPage === "superadmin"
                ? "bg-primary-muted text-primary"
                : "text-secondary-foreground hover:bg-bg-hover hover:text-foreground"
            }`}
          >
            <Building2 className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
            Super Admin
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => handleNav("settings")}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-sm text-[13.5px] font-semibold transition-all ${
              currentPage === "settings"
                ? "bg-primary-muted text-primary"
                : "text-secondary-foreground hover:bg-bg-hover hover:text-foreground"
            }`}
          >
            <Settings className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
            Instellingen
          </button>
        )}
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-sm text-[13.5px] font-semibold text-secondary-foreground hover:bg-bg-hover hover:text-foreground transition-all"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
          Uitloggen
        </button>
      </div>
    </>
  );

  return (
    <aside className="hidden lg:flex w-60 bg-card border-r border-border flex-col flex-shrink-0">
      {sidebarContent}
    </aside>
  );
};

export default Sidebar;
