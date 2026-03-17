import { useNavigation, type Page } from "@/hooks/useNavigation";
import {
  LayoutGrid, Calendar, Users, FileText, DollarSign,
  MessageSquare, Bell, LogOut, Settings, Mail, Building2, BarChart3, Box, Megaphone, RefreshCw, Car, Repeat, CalendarCheck, ClipboardCheck, FolderKanban, UserPlus, BookOpen, Link, Phone, Globe, Bot
} from "lucide-react";
import vakflowLogo from "@/assets/vakflow-logo.svg";
import CompanySwitcher from "@/components/CompanySwitcher";
import { useLowStockCount } from "@/hooks/useMaterials";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountingProvider } from "@/hooks/useAccountingProvider";
import { useIndustryConfig } from "@/hooks/useIndustryConfig";
import { useLiveCalls } from "@/hooks/useLiveCalls";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
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

const buildSections = (labels: { workOrders: string; assets: string; vehicles: string }, industry: string, subcategory: string | null): { label: string; items: { id: Page; icon: any; label: string; adminOnly: boolean; requiredFeature?: string }[] }[] => [
  {
    label: "Overzicht",
    items: [
      { id: "dashboard" as Page, icon: LayoutGrid, label: "Dashboard", adminOnly: false },
    ],
  },
  {
    label: "Operatie",
    items: [
      { id: "planning" as Page, icon: Calendar, label: industry === "automotive" ? (subcategory === "dealer" ? "Planning" : "Werkplaatsplanning") : "Planning", adminOnly: false },
      { id: "customers" as Page, icon: Users, label: "Klanten", adminOnly: true },
      { id: "projects" as Page, icon: FolderKanban, label: "Projecten", adminOnly: true, requiredFeature: "projects" },
      { id: "workorders" as Page, icon: FileText, label: labels.workOrders, adminOnly: false },
      { id: "schedule" as Page, icon: CalendarCheck, label: "Te plannen", adminOnly: false, requiredFeature: "schedule" },
      { id: "contracts" as Page, icon: RefreshCw, label: "Contracten", adminOnly: true, requiredFeature: "contracts" },
    ],
  },
  {
    label: "Administratie",
    items: [
      { id: "invoices" as Page, icon: DollarSign, label: "Facturatie", adminOnly: true },
      { id: "quotes" as Page, icon: FileText, label: "Offertes", adminOnly: true },
      { id: "accounting" as Page, icon: BookOpen, label: "Boekhouding", adminOnly: true },
      { id: "reports" as Page, icon: BarChart3, label: "Rapportages", adminOnly: true },
      { id: "email" as Page, icon: Mail, label: "E-mail", adminOnly: true },
      { id: "whatsapp" as Page, icon: MessageSquare, label: "WhatsApp", adminOnly: true },
      { id: "calltracking" as Page, icon: Phone, label: "Calltracking", adminOnly: true, requiredFeature: "voip" },
      { id: "aiconversations" as Page, icon: Bot, label: "AI Conversaties", adminOnly: true, requiredFeature: "ai_agent" },
      { id: "communication" as Page, icon: MessageSquare, label: "Logboek", adminOnly: true },
      { id: "reminders" as Page, icon: Bell, label: "Reminders", adminOnly: true },
    ],
  },
  {
    label: "Beheer",
    items: [
      { id: "assets" as Page, icon: Box, label: labels.assets, adminOnly: true, requiredFeature: "assets" },
      ...(industry === "cleaning" ? [{ id: "audits" as Page, icon: ClipboardCheck, label: "Inspecties", adminOnly: true }] : []),
      { id: "vehicles" as Page, icon: Car, label: labels.vehicles, adminOnly: true, requiredFeature: "vehicles" },
      ...(industry === "automotive" ? [{ id: "trade" as Page, icon: Repeat, label: "Voertuig Pipeline", adminOnly: true, requiredFeature: "vehicle_sales" }] : []),
      ...(industry === "automotive" ? [{ id: "hexon" as Page, icon: Globe, label: "Hexon DV", adminOnly: true, requiredFeature: "hexon" }] : []),
      { id: "marketing" as Page, icon: Megaphone, label: "Marketing", adminOnly: true },
      { id: "leads" as Page, icon: UserPlus, label: "Leads", adminOnly: true, requiredFeature: "leads" },
    ],
  },
];

const Sidebar = () => {
  const { currentPage, navigate } = useNavigation();
  const { signOut, isAdmin, isSuperAdmin, companyLogoUrl, enabledFeatures } = useAuth();
  const { labels, industry, config, subcategory } = useIndustryConfig();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { data: lowStockCount } = useLowStockCount();
  const { activeCalls, ringingCalls, answeredCalls, latestRinging } = useLiveCalls();
  const prevActiveCalls = useRef(0);

  // Toast on new ringing call
  useEffect(() => {
    if (activeCalls > 0 && prevActiveCalls.current === 0 && latestRinging && currentPage !== "calltracking") {
      const caller = latestRinging.caller_name || latestRinging.from_number || "Onbekend";
      toast(`Inkomend gesprek van ${caller}`, {
        action: {
          label: "Bekijken",
          onClick: () => navigate("calltracking"),
        },
        duration: 6000,
      });
    }
    prevActiveCalls.current = activeCalls;
  }, [activeCalls, latestRinging, currentPage, navigate]);

  const handleNav = (page: Page) => {
    navigate(page);
  };

  const isActive = (id: Page) =>
    currentPage === id ||
    (id === "customers" && currentPage === "custDetail") ||
    (id === "workorders" && currentPage === "woDetail") ||
    (id === "vehicles" && currentPage === "vehDetail") ||
    (id === "projects" && currentPage === "projDetail");

  const industryModules = config.modules;

  const sections = buildSections(labels, industry, subcategory ?? null)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        (!item.adminOnly || isAdmin) &&
        (industryModules.includes(item.id) || item.requiredFeature) &&
        (enabledFeatures.length === 0 || enabledFeatures.includes(item.id) || item.id === "accounting") &&
        (!item.requiredFeature || enabledFeatures.includes(item.requiredFeature) || (item.requiredFeature === "vehicle_sales" && enabledFeatures.includes("trade_vehicles")))
      ),
    }))
    .filter((section) => section.items.length > 0);

  // Determine badge for calltracking
  const liveCallBadge = activeCalls > 0 ? (
    <span
      className={`ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold text-white ${
        ringingCalls > 0
          ? "bg-destructive animate-pulse"
          : "bg-emerald-500 animate-pulse"
      }`}
    >
      {activeCalls}
    </span>
  ) : null;

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

      <CompanySwitcher />

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
                      {item.id === "calltracking" && !collapsed && liveCallBadge}
                      {item.id === "calltracking" && collapsed && activeCalls > 0 && (
                        <span className={`absolute top-1 right-1 h-2.5 w-2.5 rounded-full ${ringingCalls > 0 ? "bg-destructive" : "bg-emerald-500"} animate-pulse`} />
                      )}
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
                className="text-[13.5px] font-semibold relative"
              >
                <Settings className="!w-[18px] !h-[18px] flex-shrink-0" strokeWidth={1.8} />
                <span>Instellingen</span>
                {(lowStockCount ?? 0) > 0 && (
                  <span className="absolute top-1 left-5 h-2 w-2 rounded-full bg-destructive" />
                )}
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
