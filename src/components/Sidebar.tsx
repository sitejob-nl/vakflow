import { useNavigation, type Page } from "@/hooks/useNavigation";
import {
  LayoutGrid, Calendar, Users, FileText, DollarSign,
  MessageSquare, Bell, LogOut, Settings, Mail, Building2, BarChart3, Box, Megaphone, RefreshCw, Car
} from "lucide-react";
import vakflowLogo from "@/assets/vakflow-logo.svg";
import { useLowStockCount } from "@/hooks/useMaterials";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

const buildSections = (labels: { workOrders: string; assets: string; vehicles: string }, industry: string) => [
  {
    label: "Overzicht",
    items: [
      { id: "dashboard" as Page, icon: LayoutGrid, label: "Dashboard", adminOnly: false },
    ],
  },
  {
    label: "Operatie",
    items: [
      { id: "planning" as Page, icon: Calendar, label: industry === "automotive" ? "Werkplaatsplanning" : "Planning", adminOnly: false },
      { id: "customers" as Page, icon: Users, label: "Klanten", adminOnly: true },
      { id: "workorders" as Page, icon: FileText, label: labels.workOrders, adminOnly: false },
      { id: "contracts" as Page, icon: RefreshCw, label: "Contracten", adminOnly: true },
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
      { id: "vehicles" as Page, icon: Car, label: labels.vehicles, adminOnly: true },
      { id: "marketing" as Page, icon: Megaphone, label: "Marketing", adminOnly: true },
    ],
  },
];

const Sidebar = () => {
  const { currentPage, navigate } = useNavigation();
  const { signOut, isAdmin, isSuperAdmin, companyLogoUrl, enabledFeatures } = useAuth();
  const { labels, industry } = useIndustryConfig();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const handleNav = (page: Page) => {
    navigate(page);
  };

  const isActive = (id: Page) =>
    currentPage === id ||
    (id === "customers" && currentPage === "custDetail") ||
    (id === "workorders" && currentPage === "woDetail") ||
    (id === "vehicles" && currentPage === "vehDetail");

  const sections = buildSections(labels, industry)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        (!item.adminOnly || isAdmin) &&
        (enabledFeatures.length === 0 || enabledFeatures.includes(item.id))
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <ShadcnSidebar collapsible="icon">
      {/* Logo */}
      <SidebarHeader className="p-0">
        <div className={`px-5 py-[18px] flex items-center ${collapsed ? 'justify-center px-2' : 'justify-center'} border-b border-sidebar-border ${!companyLogoUrl ? 'bg-sidebar-foreground rounded-t-lg' : ''}`}>
          {collapsed ? (
            <img src={companyLogoUrl || vakflowLogo} alt="Logo" className="h-7 w-7 object-contain" />
          ) : (
            <img src={companyLogoUrl || vakflowLogo} alt="Logo" className="h-10 object-contain max-w-[180px]" />
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label} className="py-1">
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[1.2px] text-sidebar-foreground/50 px-3.5">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => handleNav(item.id)}
                      isActive={isActive(item.id)}
                      tooltip={item.label}
                      className="text-[13.5px] font-semibold"
                    >
                      <item.icon className="!w-[18px] !h-[18px] flex-shrink-0" strokeWidth={1.8} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          {isSuperAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => handleNav("superadmin")}
                isActive={isActive("superadmin")}
                tooltip="Super Admin"
                className="text-[13.5px] font-semibold"
              >
                <Building2 className="!w-[18px] !h-[18px] flex-shrink-0" strokeWidth={1.8} />
                <span>Super Admin</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => handleNav("settings")}
                isActive={isActive("settings")}
                tooltip="Instellingen"
                className="text-[13.5px] font-semibold"
              >
                <Settings className="!w-[18px] !h-[18px] flex-shrink-0" strokeWidth={1.8} />
                <span>Instellingen</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => signOut()}
              tooltip="Uitloggen"
              className="text-[13.5px] font-semibold"
            >
              <LogOut className="!w-[18px] !h-[18px] flex-shrink-0" strokeWidth={1.8} />
              <span>Uitloggen</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </ShadcnSidebar>
  );
};

export default Sidebar;
